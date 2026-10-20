// The agents and what each one does. Modelled on Dynamics 365 Business Central's agents (Sales Order, Payables):
//  - an agent is its own actor: everything it changes is audited under its name;
//  - it works with the rights of the person who switched it on, never more (and approving needs the approver's rights);
//  - it does safe, internal work on its own (drafts, matches the matcher is sure about);
//  - anything that leaves the business or moves money waits as a task for a person, with a timeline of what happened.
using System.Text.Json;
using System.Text.Json.Nodes;
using Kabuor.Erp.Auth;
using Kabuor.Erp.Common;
using Kabuor.Erp.Data;
using Kabuor.Erp.Domain;
using Kabuor.Erp.Marketing;
using Kabuor.Erp.Payments;
using Kabuor.Erp.Purchases;
using Microsoft.EntityFrameworkCore;

namespace Kabuor.Erp.Agents;

public sealed record AgentInfo(string Key, string Name, string Job, string Policy, string[] OnItsOwn, string[] AsksFirst, TimeSpan Every, string EveryText);
public sealed record AgentConfigInput(bool Enabled, JsonObject? Settings);
public sealed record AgentDecision(string? Text, string? Note);

public sealed class AgentService(ErpDb db, RequestContext ctx, PaymentService payments, PurchaseService purchases, ISmsSender sms, IHttpClientFactory http, IConfiguration config, ILogger<AgentService> log)
{
    public static readonly AgentInfo[] All =
    [
        new("collections", "Collections agent",
            "Finds customers with overdue invoices and drafts a polite reminder for each, in English or Kiswahili.",
            Policies.Sell,
            ["Checks overdue invoices every morning", "Drafts one reminder per customer (not more often than you set)"],
            ["Sending any message to a customer"],
            TimeSpan.FromHours(24), "Every morning"),
        new("matching", "Payment matching agent",
            "Goes through M-Pesa and bank payments nobody has matched yet, applies the ones it's sure about, and asks you about the rest.",
            Policies.Finance,
            ["Applies payments when the account number or phone leaves no doubt", "Works out the most likely invoice for the others"],
            ["Applying a payment it isn't sure about"],
            TimeSpan.FromHours(1), "Every hour"),
        new("restock", "Restock agent",
            "Watches stock against reorder levels and drafts purchase orders to the supplier you last bought each item from.",
            Policies.Buy,
            ["Checks stock every morning", "Drafts purchase orders (drafts commit you to nothing)"],
            ["Sending an order to a supplier"],
            TimeSpan.FromHours(24), "Every morning"),
    ];

    public static AgentInfo Info(string key) => All.FirstOrDefault(a => a.Key == key) ?? throw new AppException("No such agent.", 404);

    static readonly JsonObject CollectionsDefaults = new() { ["remindEveryDays"] = 7, ["minDaysLate"] = 1, ["language"] = "en" };

    // ---------- setup ----------

    public async Task<object> List()
    {
        var setups = await db.AgentSetups.ToListAsync();
        var open = await db.AgentTasks.Where(t => t.Status == AgentTaskStatus.NeedsReview).GroupBy(t => t.AgentKey).Select(g => new { g.Key, n = g.Count() }).ToListAsync();
        return All.Where(a => ctx.Can(a.Policy) || ctx.Can(Policies.Admin)).Select(a =>
        {
            var s = setups.FirstOrDefault(x => x.Key == a.Key);
            return new
            {
                a.Key, a.Name, a.Job, a.OnItsOwn, a.AsksFirst, every = a.EveryText,
                enabled = s?.Enabled ?? false, enabledBy = s?.EnabledByName, lastRunAt = s?.LastRunAt, lastRunSummary = s?.LastRunSummary,
                settings = Settings(a.Key, s), toReview = open.FirstOrDefault(o => o.Key == a.Key)?.n ?? 0,
                canManage = ctx.Can(Policies.Admin), canRun = ctx.Can(a.Policy) && (s?.Enabled ?? false),
            };
        }).ToList();
    }

    static JsonObject Settings(string key, AgentSetup? s)
    {
        var d = key == "collections" ? (JsonObject)CollectionsDefaults.DeepClone() : [];
        if (s is not null && JsonNode.Parse(s.Settings) is JsonObject saved)
            foreach (var (k, v) in saved) d[k] = v?.DeepClone();
        return d;
    }

    /// <summary>Switching an agent on: the owner does it, and the agent then works with the owner's rights for its job.</summary>
    public async Task<object> Configure(string key, AgentConfigInput input)
    {
        var a = Info(key);
        if (input.Enabled && !ctx.Can(a.Policy)) throw new AppException("Your role can't do this agent's job, so you can't switch it on.", 403);
        var s = await db.AgentSetups.SingleOrDefaultAsync(x => x.Key == key);
        if (s is null) db.AgentSetups.Add(s = new AgentSetup { Key = key });
        if (input.Enabled && !s.Enabled) (s.EnabledBy, s.EnabledByName, s.EnabledByRole) = (ctx.UserId, ctx.Actor, ctx.Role);
        s.Enabled = input.Enabled;
        if (input.Settings is { } settings)
        {
            var clean = new JsonObject();
            if (key == "collections")
            {
                clean["remindEveryDays"] = Math.Clamp(settings["remindEveryDays"]?.GetValue<int>() ?? 7, 1, 60);
                clean["minDaysLate"] = Math.Clamp(settings["minDaysLate"]?.GetValue<int>() ?? 1, 0, 90);
                clean["language"] = settings["language"]?.GetValue<string>() == "sw" ? "sw" : "en";
            }
            s.Settings = clean.ToJsonString();
        }
        await db.SaveChangesAsync();
        return new { s.Key, s.Enabled };
    }

    // ---------- running ----------

    /// <summary>"Run now" from the page: needs the person's rights for the job too.</summary>
    public async Task<object> RunNow(string key)
    {
        var a = Info(key);
        if (!ctx.Can(a.Policy)) throw new AppException("Your role doesn't cover this agent's job.", 403);
        var s = await db.AgentSetups.SingleOrDefaultAsync(x => x.Key == key && x.Enabled) ?? throw new AppException("Switch the agent on first.");
        var who = ctx.Actor;
        var summary = await Run(s, $"{a.Name} (run by {who})");
        return new { summary };
    }

    /// <summary>One run of one agent for the current company. The scheduler calls this with the agent as the actor.</summary>
    public async Task<string> Run(AgentSetup s, string? actor = null)
    {
        var a = Info(s.Key);
        // The agent can't do more than the person who switched it on: if their role lost the job, it stops.
        if (!s.EnabledByRole.Allows(a.Policy))
        {
            s.Enabled = false;
            s.LastRunSummary = $"Switched off: {s.EnabledByName}'s role no longer covers this job. Switch it on again.";
            await db.SaveChangesAsync();
            return s.LastRunSummary;
        }
        var previousActor = ctx.Actor;
        ctx.Actor = actor ?? a.Name;
        try
        {
            var summary = s.Key switch
            {
                "collections" => await Collections(a, Settings(s.Key, s)),
                "matching" => await Matching(a),
                "restock" => await Restock(a),
                _ => "",
            };
            (s.LastRunAt, s.LastRunSummary) = (DateTimeOffset.UtcNow, summary);
            await db.SaveChangesAsync();
            return summary;
        }
        catch (Exception e)
        {
            log.LogError(e, "Agent {Agent} failed for company {Company}", s.Key, s.CompanyId);
            db.ChangeTracker.Clear();
            var fresh = await db.AgentSetups.SingleAsync(x => x.Id == s.Id);
            (fresh.LastRunAt, fresh.LastRunSummary) = (DateTimeOffset.UtcNow, "Couldn't finish this run. It will try again next time.");
            await db.SaveChangesAsync();
            return fresh.LastRunSummary;
        }
        finally
        {
            ctx.Actor = previousActor;
        }
    }

    AgentTask NewTask(AgentInfo a, string title, params string[] steps)
    {
        var t = new AgentTask { AgentKey = a.Key, Title = title };
        foreach (var text in steps) t.Steps.Add(new AgentStep { Who = a.Name, Text = text });
        db.AgentTasks.Add(t);
        return t;
    }

    static string K(long cents) => $"KSh {cents / 100m:N0}";

    async Task<string> Collections(AgentInfo a, JsonObject settings)
    {
        var today = Clock.Today;
        var every = settings["remindEveryDays"]!.GetValue<int>();
        var minLate = settings["minDaysLate"]!.GetValue<int>();
        var sw = settings["language"]!.GetValue<string>() == "sw";
        var cutoff = today.AddDays(-minLate);
        var overdue = await db.SalesDocs.Where(d => d.Kind == SalesDocKind.Invoice && (d.Status == SalesDocStatus.Sent || d.Status == SalesDocStatus.PartPaid) && d.DueDate < cutoff)
            .Select(d => new { d.Id, d.Number, d.CustomerId, Customer = d.Customer!.Name, Phone = d.Customer.Phone, balance = d.Total - d.Paid, d.DueDate }).ToListAsync();
        var since = DateTimeOffset.UtcNow.AddDays(-every);
        var recent = await db.AgentTasks.Where(t => t.AgentKey == a.Key && t.CreatedAt >= since && t.Status != AgentTaskStatus.Failed).Select(t => t.SubjectId).ToListAsync();
        var company = await db.Companies.SingleAsync(c => c.Id == db.CompanyId);
        var drafted = 0;
        foreach (var g in overdue.GroupBy(o => o.CustomerId))
        {
            if (recent.Contains(g.Key)) continue;
            var first = g.First();
            var total = g.Sum(x => x.balance);
            var oldest = g.Max(x => today.DayNumber - x.DueDate.DayNumber);
            var list = string.Join("; ", g.OrderBy(x => x.DueDate).Select(x => $"{x.Number} {K(x.balance)}, {today.DayNumber - x.DueDate.DayNumber} days late"));
            var numbers = string.Join(", ", g.Select(x => x.Number));
            var t = NewTask(a, $"Remind {first.Customer}: {K(total)} overdue", $"Found {g.Count()} overdue invoice{(g.Count() == 1 ? "" : "s")} for {first.Customer} (oldest {oldest} days late).");
            (t.SubjectKind, t.SubjectId, t.Link, t.Detail) = ("customer", g.Key, $"/customers/{g.Key}", list);
            if (string.IsNullOrEmpty(first.Phone))
            {
                t.Steps.Add(new AgentStep { Who = a.Name, Text = "There's no phone number for this customer, so I can't draft a message. Add one, or call them." });
                drafted++;
                continue;
            }
            var (text, byAi) = await ReminderText(company.Name, first.Customer, total, numbers, oldest, sw);
            t.Action = "send_reminder";
            t.Payload = new JsonObject { ["customerId"] = g.Key, ["phone"] = first.Phone, ["text"] = text }.ToJsonString();
            t.Steps.Add(new AgentStep { Who = a.Name, Text = byAi ? "Drafted the reminder with Claude, from the invoice facts only." : "Drafted the reminder from the standard wording." });
            drafted++;
        }
        await db.SaveChangesAsync();
        return drafted == 0 ? "No customer needs a reminder today." : $"Drafted {drafted} reminder{(drafted == 1 ? "" : "s")} for you to check.";
    }

    async Task<(string Text, bool ByAi)> ReminderText(string company, string customer, long total, string numbers, int daysLate, bool swahili)
    {
        var fallback = swahili
            ? $"Habari {customer}, huu ni ukumbusho kutoka {company} kwamba {K(total)} ya ankara {numbers} imepita tarehe ya kulipa. Lipa kwa M-Pesa ukitumia nambari ya ankara kama akaunti. Asante."
            : $"Hello {customer}, a friendly reminder from {company} that {K(total)} on invoice {numbers} is past due. You can pay by M-Pesa using the invoice number as the account number. Thank you.";
        var key = config["Anthropic:ApiKey"];
        if (string.IsNullOrEmpty(key)) return (fallback, false);
        try
        {
            var body = new JsonObject
            {
                ["model"] = config["Anthropic:Model"] ?? "claude-opus-5-5",
                ["max_tokens"] = 300,
                ["system"] = "You write short SMS payment reminders for a Kenyan small business. Warm, respectful, firm, never threatening. Under 300 characters. Use only the facts given; never invent amounts, dates, discounts or penalties. Reply with the message only.",
                ["messages"] = new JsonArray(new JsonObject
                {
                    ["role"] = "user",
                    ["content"] = $"Business: {company}\nCustomer: {customer}\nAmount overdue: {K(total)}\nInvoices: {numbers}\nOldest is {daysLate} days late\nHow to pay: M-Pesa, invoice number as the account number\nLanguage: {(swahili ? "Kiswahili" : "English")}",
                }),
            };
            using var req = new HttpRequestMessage(HttpMethod.Post, "v1/messages") { Content = JsonContent.Create(body) };
            req.Headers.Add("x-api-key", key);
            req.Headers.Add("anthropic-version", "2023-06-01");
            using var res = await http.CreateClient("anthropic").SendAsync(req);
            var json = await res.Content.ReadFromJsonAsync<JsonObject>();
            var text = json?["content"]?.AsArray().FirstOrDefault(b => b?["type"]?.GetValue<string>() == "text")?["text"]?.GetValue<string>()?.Trim();
            // The agent's words must still carry the real amount; otherwise use the standard wording.
            return res.IsSuccessStatusCode && text is { Length: > 20 and < 480 } && text.Contains($"{total / 100m:N0}") ? (text, true) : (fallback, false);
        }
        catch (Exception e)
        {
            log.LogWarning(e, "Reminder wording by Claude failed; using the standard wording");
            return (fallback, false);
        }
    }

    async Task<string> Matching(AgentInfo a)
    {
        var matched = await payments.RetryUnmatched();
        if (matched > 0)
        {
            var done = NewTask(a, $"Applied {matched} payment{(matched == 1 ? "" : "s")} by myself", "The account number or the payer's phone pointed to exactly one invoice each time.");
            (done.Status, done.Link, done.DecidedAt, done.DecidedBy) = (AgentTaskStatus.Done, "/money-in?status=matched", DateTimeOffset.UtcNow, a.Name);
        }
        var asked = await db.AgentTasks.Where(t => t.AgentKey == a.Key && t.Status == AgentTaskStatus.NeedsReview && t.SubjectId != null).Select(t => t.SubjectId).ToListAsync();
        var waiting = await db.Payments.Include(p => p.Allocations).Where(p => p.Status != PaymentStatus.Matched).OrderBy(p => p.ReceivedAt).Take(100).ToListAsync();
        var questions = 0;
        foreach (var p in waiting.Where(p => !asked.Contains(p.Id)))
        {
            var from = string.IsNullOrWhiteSpace(p.PayerName) ? p.PayerPhone : p.PayerName;
            var m = await payments.Suggest(p);
            AgentTask t;
            if (m.Allocations.Count > 0)
            {
                var to = string.Join(", ", m.Allocations.Select(x => $"{x.InvoiceNumber} ({K(x.Amount)})"));
                t = NewTask(a, $"Apply {K(m.Total)} from {from} to {to}?", $"{p.Method} {p.Reference} for {K(p.Unallocated)} isn't matched yet.", $"Most likely: {m.Reason}.");
                t.Action = "match_payment";
                t.Payload = new JsonObject
                {
                    ["paymentId"] = p.Id,
                    ["allocations"] = new JsonArray(m.Allocations.Select(x => (JsonNode)new JsonObject { ["invoiceId"] = x.InvoiceId, ["amount"] = x.Amount }).ToArray()),
                }.ToJsonString();
                t.Detail = m.Reason;
            }
            else
            {
                t = NewTask(a, $"What is {K(p.Unallocated)} from {from} for?", $"{p.Method} {p.Reference} doesn't match any open invoice by account number, phone or amount.");
                t.Detail = "Match it by hand on Money in, or leave it as a customer credit.";
            }
            (t.SubjectKind, t.SubjectId, t.Link) = ("payment", p.Id, $"/money-in?status=to-match");
            questions++;
        }
        await db.SaveChangesAsync();
        return (matched, questions) switch
        {
            (0, 0) => "Every payment is matched.",
            (0, _) => $"{questions} payment{(questions == 1 ? " needs" : "s need")} you.",
            _ => $"Applied {matched} by itself; {questions} need{(questions == 1 ? "s" : "")} you.",
        };
    }

    async Task<string> Restock(AgentInfo a)
    {
        var tracked = await db.Items.Where(i => i.TrackStock && i.Active && i.ReorderLevel > 0).ToListAsync();
        var levels = await db.StockLevels.GroupBy(l => l.ItemId).Select(g => new { g.Key, q = g.Sum(x => x.Quantity) }).ToDictionaryAsync(x => x.Key, x => x.q);
        var low = tracked.Select(i => (item: i, onHand: levels.GetValueOrDefault(i.Id))).Where(x => x.onHand <= x.item.ReorderLevel).ToList();
        if (low.Count == 0) return "Everything is above its reorder level.";

        var onOrder = await db.PurchaseLines.Where(l => l.ItemId != null)
            .Join(db.PurchaseDocs.Where(d => d.Kind == PurchaseKind.Order && (d.Status == PurchaseStatus.Draft || d.Status == PurchaseStatus.Sent)), l => l.PurchaseDocId, d => d.Id, (l, d) => l.ItemId!.Value)
            .Distinct().ToListAsync();
        low = low.Where(x => !onOrder.Contains(x.item.Id)).ToList();
        if (low.Count == 0) return "Low items are already on order.";

        var ids = low.Select(x => x.item.Id).ToList();
        var history = await db.PurchaseLines.Where(l => l.ItemId != null && ids.Contains(l.ItemId.Value))
            .Join(db.PurchaseDocs.Where(d => d.Status != PurchaseStatus.Void && d.Status != PurchaseStatus.Draft), l => l.PurchaseDocId, d => d.Id,
                (l, d) => new { l.ItemId, l.UnitCost, l.TaxType, d.SupplierId, d.IssueDate, d.CreatedAt })
            .ToListAsync();
        var last = history.GroupBy(x => x.ItemId!.Value).ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.IssueDate).ThenByDescending(x => x.CreatedAt).First());

        var drafted = 0;
        foreach (var bySupplier in low.Where(x => last.ContainsKey(x.item.Id)).GroupBy(x => last[x.item.Id].SupplierId))
        {
            var lines = bySupplier.Select(x =>
            {
                var qty = Math.Max(Math.Ceiling(x.item.ReorderLevel * 2 - x.onHand), 1); // back up to twice the reorder level
                var l = last[x.item.Id];
                return new PurchaseLineInput(x.item.Id, null, x.item.Name, qty, l.UnitCost, l.TaxType);
            }).ToList();
            var po = await purchases.Create(new PurchaseInput(PurchaseKind.Order, bySupplier.Key, Clock.Today, null, null, null, $"Drafted by the {a.Name}", lines));
            var supplier = await db.Suppliers.Where(s => s.Id == bySupplier.Key).Select(s => s.Name).SingleAsync();
            var t = NewTask(a, $"Send order {po.Number} to {supplier}? ({lines.Count} item{(lines.Count == 1 ? "" : "s")}, {K(po.Total)})",
                $"{string.Join(", ", bySupplier.Select(x => $"{x.item.Name}: {x.onHand:0.##} {x.item.Unit} left, reorder at {x.item.ReorderLevel:0.##}"))}.",
                $"Drafted {po.Number} to {supplier}, who supplied these last, at their last prices. Quantities bring each item back to twice its reorder level.");
            (t.Action, t.Payload, t.SubjectKind, t.SubjectId, t.Link) = ("send_order", new JsonObject { ["purchaseId"] = po.Id }.ToJsonString(), "purchase", po.Id, $"/purchases/{po.Id}");
            t.Detail = string.Join("; ", lines.Select(l => $"{l.Description} × {l.Quantity:0.##}"));
            drafted++;
        }
        var unknown = low.Where(x => !last.ContainsKey(x.item.Id)).ToList();
        var weekAgo = DateTimeOffset.UtcNow.AddDays(-7);
        if (unknown.Count > 0 && !await db.AgentTasks.AnyAsync(t => t.AgentKey == a.Key && t.SubjectKind == "no-supplier" && t.CreatedAt >= weekAgo))
        {
            var t = NewTask(a, $"{unknown.Count} low item{(unknown.Count == 1 ? " has" : "s have")} no supplier yet", "I can only draft orders for items bought before, because that's how I know the supplier and price.");
            (t.SubjectKind, t.Link, t.Detail) = ("no-supplier", "/stock?filter=low", string.Join(", ", unknown.Select(x => $"{x.item.Name} ({x.onHand:0.##} left)")));
        }
        await db.SaveChangesAsync();
        return drafted == 0 ? $"{unknown.Count} low item(s) need a supplier first." : $"Drafted {drafted} purchase order{(drafted == 1 ? "" : "s")} for you to send.";
    }

    // ---------- tasks ----------

    public async Task<object> Tasks(string? status)
    {
        var mine = All.Where(a => ctx.Can(a.Policy)).Select(a => a.Key).ToList();
        var q = db.AgentTasks.Where(t => mine.Contains(t.AgentKey));
        var counts = new { review = await q.CountAsync(t => t.Status == AgentTaskStatus.NeedsReview), done = await q.CountAsync(t => t.Status != AgentTaskStatus.NeedsReview) };
        q = status == "done" ? q.Where(t => t.Status != AgentTaskStatus.NeedsReview) : q.Where(t => t.Status == AgentTaskStatus.NeedsReview);
        var rows = await q.OrderByDescending(t => t.CreatedAt).Take(100).Include(t => t.Steps).ToListAsync();
        return new
        {
            counts,
            items = rows.Select(t => new
            {
                t.Id, t.AgentKey, agent = Info(t.AgentKey).Name, t.Title, t.Detail, t.Action, t.Status, t.Result, t.Link, t.CreatedAt, t.DecidedAt, t.DecidedBy,
                draft = t.Action == "send_reminder" ? JsonNode.Parse(t.Payload)?["text"]?.GetValue<string>() : null,
                steps = t.Steps.OrderBy(s => s.At).Select(s => new { s.At, s.Who, s.Text }),
            }),
        };
    }

    public async Task<object> Decide(Guid id, bool approve, AgentDecision input)
    {
        var t = await db.AgentTasks.Include(x => x.Steps).SingleOrDefaultAsync(x => x.Id == id) ?? throw new AppException("Not found.", 404);
        var a = Info(t.AgentKey);
        // Approving runs with the approver's rights (as in Business Central).
        if (!ctx.Can(a.Policy)) throw new AppException("Your role can't approve this.", 403);
        if (t.Status != AgentTaskStatus.NeedsReview) throw new AppException("This has already been decided.");
        (t.DecidedAt, t.DecidedBy) = (DateTimeOffset.UtcNow, ctx.Actor);
        var note = string.IsNullOrWhiteSpace(input.Note) ? "" : $" Note: {input.Note.Trim()}";
        if (!approve)
        {
            t.Status = AgentTaskStatus.Dismissed;
            if (t.Action == "send_order" && JsonNode.Parse(t.Payload)?["purchaseId"]?.GetValue<Guid>() is { } draftId)
            {
                await purchases.Void(draftId);
                t.Result = "Draft order cancelled.";
            }
            t.Steps.Add(new AgentStep { Who = ctx.Actor, Text = $"Dismissed.{note}" });
            await db.SaveChangesAsync();
            return new { t.Id, status = t.Status.ToString(), t.Result };
        }
        var data = JsonNode.Parse(t.Payload)!.AsObject();
        switch (t.Action)
        {
            case "send_reminder":
            {
                var text = string.IsNullOrWhiteSpace(input.Text) ? data["text"]!.GetValue<string>() : input.Text.Trim();
                if (text.Length > 480) throw new AppException("Keep the message under 480 characters.");
                var phone = data["phone"]!.GetValue<string>();
                var customerId = data["customerId"]!.GetValue<Guid>();
                if (sms.Live)
                {
                    var (ok, error) = await sms.Send(phone, text);
                    if (!ok) throw new AppException($"The SMS didn't go: {error}");
                    t.Result = "Sent by SMS.";
                }
                else t.Result = $"https://wa.me/{phone}?text={Uri.EscapeDataString(text)}";
                db.Activities.Add(new Activity { CustomerId = customerId, Kind = sms.Live ? ActivityKind.Note : ActivityKind.WhatsApp, Text = $"Payment reminder ({a.Name}, approved by {ctx.Actor}): {text}", Actor = ctx.Actor, ActorId = ctx.UserId });
                t.Steps.Add(new AgentStep { Who = ctx.Actor, Text = (sms.Live ? "Approved; sent by SMS." : "Approved; opened in WhatsApp to send.") + note });
                break;
            }
            case "match_payment":
            {
                var allocations = data["allocations"]!.AsArray().Select(x => new AllocationInput(x!["invoiceId"]!.GetValue<Guid>(), x["amount"]!.GetValue<long>())).ToList();
                await payments.Allocate(data["paymentId"]!.GetValue<Guid>(), allocations, $"{a.Name}, approved by {ctx.Actor}");
                t.Result = "Payment applied.";
                t.Steps.Add(new AgentStep { Who = ctx.Actor, Text = $"Approved; the payment is applied.{note}" });
                break;
            }
            case "send_order":
            {
                var po = await purchases.Post(data["purchaseId"]!.GetValue<Guid>());
                t.Result = $"{po.Number} marked as sent.";
                t.Steps.Add(new AgentStep { Who = ctx.Actor, Text = $"Approved; {po.Number} is marked as sent to the supplier.{note}" });
                break;
            }
            default:
                t.Steps.Add(new AgentStep { Who = ctx.Actor, Text = $"Marked as handled.{note}" });
                break;
        }
        t.Status = AgentTaskStatus.Done;
        await db.SaveChangesAsync();
        return new { t.Id, status = t.Status.ToString(), t.Result };
    }

    public static string Json(object o) => JsonSerializer.Serialize(o);
}
