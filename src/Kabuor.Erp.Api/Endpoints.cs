// Every HTTP endpoint. Each group asks for a policy (see Auth/Policies); the database filters every query by
// the caller's company, so handlers never pass company ids around.
using Kabuor.Erp.Auth;
using Kabuor.Erp.Common;
using Kabuor.Erp.Data;
using Kabuor.Erp.Domain;
using Kabuor.Erp.Payments;
using Kabuor.Erp.Reports;
using Kabuor.Erp.Sales;
using Microsoft.EntityFrameworkCore;

namespace Kabuor.Erp;

public sealed record CustomerInput(string Name, string? Phone, string? Email, string? KraPin, string? Address, long? CreditLimit, string? Notes, bool? MarketingOptOut = null);
public sealed record ItemInput(string Name, string? Sku, ItemKind? Kind, string? Unit, long Price, TaxType? TaxType, bool? Active, bool? TrackStock, decimal? ReorderLevel);
public sealed record CompanyInput(string Name, string? KraPin, string? Phone, string? Email, string? County, bool VatRegistered, string? MpesaShortcode);
public sealed record UserInput(string Name, string Email, string? Phone, Role Role, string Password);
public sealed record AllocateInput(List<AllocationInput> Allocations);

public static class Endpoints
{
    public static void Map(WebApplication app)
    {
        var api = app.MapGroup("/api");
        api.MapGet("/health", () => Results.Ok(new { ok = true }));

        // ---------- sign up / sign in ----------
        var auth = api.MapGroup("/auth").RequireRateLimiting("auth");
        auth.MapPost("/register", (RegisterInput input, AuthService s) => s.Register(input));
        auth.MapPost("/login", (LoginInput input, AuthService s) => s.Login(input));

        // ---------- M-Pesa (Safaricom calls these; no login, the URL carries the company's secret key) ----------
        var mpesa = api.MapGroup("/mpesa/c2b/{key}");
        mpesa.MapPost("/validation", () => MpesaAck());
        mpesa.MapPost("/confirmation", async (string key, MpesaC2B body, ErpDb db, RequestContext ctx, PaymentService payments, ILogger<PaymentService> log) =>
        {
            var company = await db.Companies.SingleOrDefaultAsync(c => c.MpesaCallbackKey == key);
            if (company is null) return Results.NotFound();
            if (company.MpesaShortcode.Length > 0 && body.BusinessShortCode != company.MpesaShortcode)
            {
                log.LogWarning("M-Pesa confirmation for shortcode {Got} reached company {Company} (expects {Want})", body.BusinessShortCode, company.Id, company.MpesaShortcode);
                return MpesaAck();
            }
            (ctx.CompanyId, ctx.Actor) = (company.Id, "M-Pesa");
            await payments.FromMpesa(body);
            return MpesaAck();
        });

        var app_ = api.MapGroup("").RequireAuthorization(Policies.Read);

        // ---------- home ----------
        app_.MapGet("/today", (ReportService r) => r.Today());

        // ---------- customers ----------
        var customers = app_.MapGroup("/customers").RequireAuthorization(Policies.SalesView);
        customers.MapGet("", async (ErpDb db, string? q, string? filter, int? skip, int? take) =>
        {
            var today = Clock.Today;
            var (s, t) = Paging.Of(skip, take);
            var query = db.Customers.AsQueryable();
            if (!string.IsNullOrWhiteSpace(q))
            {
                var like = $"%{q.Trim()}%";
                query = query.Where(c => EF.Functions.Like(c.Name, like) || EF.Functions.Like(c.Phone, like) || EF.Functions.Like(c.Number, like) || EF.Functions.Like(c.KraPin, like));
            }
            var rows = await query.Select(c => new
            {
                c.Id, c.Number, c.Name, c.Phone, c.Email, c.KraPin,
                owes = db.SalesDocs.Where(d => d.CustomerId == c.Id && d.Kind == SalesDocKind.Invoice && (d.Status == SalesDocStatus.Sent || d.Status == SalesDocStatus.PartPaid)).Sum(d => d.Total - d.Paid),
                overdue = db.SalesDocs.Where(d => d.CustomerId == c.Id && d.Kind == SalesDocKind.Invoice && (d.Status == SalesDocStatus.Sent || d.Status == SalesDocStatus.PartPaid) && d.DueDate < today).Sum(d => d.Total - d.Paid),
            }).ToListAsync();
            var counts = new { all = rows.Count, owing = rows.Count(r => r.owes > 0), overdue = rows.Count(r => r.overdue > 0) };
            var filtered = (filter switch { "owing" => rows.Where(r => r.owes > 0), "overdue" => rows.Where(r => r.overdue > 0), _ => rows.AsEnumerable() })
                .OrderByDescending(r => r.overdue).ThenByDescending(r => r.owes).ThenBy(r => r.Name).ToList();
            return new { counts, page = new Page<object>(filtered.Skip(s).Take(t).Cast<object>().ToList(), filtered.Count, s, t) };
        });
        customers.MapGet("/{id:guid}", async (Guid id, ErpDb db) =>
        {
            var c = await db.Customers.SingleOrDefaultAsync(x => x.Id == id) ?? throw new AppException("Not found.", 404);
            var docs = await db.SalesDocs.Where(d => d.CustomerId == id).OrderByDescending(d => d.IssueDate).ThenByDescending(d => d.Number)
                .Select(d => new { d.Id, d.Kind, d.Number, d.Status, d.IssueDate, d.DueDate, d.Total, d.Paid }).Take(200).ToListAsync();
            var payments = await db.Payments.Where(p => p.CustomerId == id).OrderByDescending(p => p.ReceivedAt)
                .Select(p => new { p.Id, p.Method, p.Amount, p.Allocated, p.Reference, p.ReceivedAt }).Take(200).ToListAsync();
            var open = docs.Where(d => d.Kind == SalesDocKind.Invoice && d.Status is SalesDocStatus.Sent or SalesDocStatus.PartPaid).ToList();
            return new
            {
                customer = c, documents = docs, payments,
                owes = open.Sum(d => d.Total - d.Paid),
                overdue = open.Where(d => d.DueDate < Clock.Today).Sum(d => d.Total - d.Paid),
                credit = payments.Sum(p => p.Amount - p.Allocated),
                lifetime = docs.Where(d => d.Kind == SalesDocKind.Invoice && d.Status != SalesDocStatus.Void && d.Status != SalesDocStatus.Draft).Sum(d => d.Total),
            };
        });
        customers.MapPost("", async (CustomerInput input, ErpDb db, Numbers numbers) =>
        {
            var c = new Customer { Number = await numbers.Next("C"), Name = "" };
            await ApplyCustomer(db, c, input);
            db.Customers.Add(c);
            await db.SaveChangesAsync();
            return Results.Created($"/api/customers/{c.Id}", c);
        }).RequireAuthorization(Policies.Sell);
        customers.MapPut("/{id:guid}", async (Guid id, CustomerInput input, ErpDb db) =>
        {
            var c = await db.Customers.SingleOrDefaultAsync(x => x.Id == id) ?? throw new AppException("Not found.", 404);
            await ApplyCustomer(db, c, input);
            await db.SaveChangesAsync();
            return c;
        }).RequireAuthorization(Policies.Sell);

        // ---------- items ----------
        var items = app_.MapGroup("/items");
        items.MapGet("", async (ErpDb db, string? q, bool? all) =>
        {
            var query = db.Items.AsQueryable();
            if (all != true) query = query.Where(i => i.Active);
            if (!string.IsNullOrWhiteSpace(q)) query = query.Where(i => EF.Functions.Like(i.Name, $"%{q.Trim()}%") || EF.Functions.Like(i.Sku, $"%{q.Trim()}%"));
            return await query.OrderBy(i => i.Name).Take(500).ToListAsync();
        });
        items.MapPost("", async (ItemInput input, ErpDb db) =>
        {
            var i = new Item { Name = "" };
            ApplyItem(i, input);
            db.Items.Add(i);
            await db.SaveChangesAsync();
            return Results.Created($"/api/items/{i.Id}", i);
        }).RequireAuthorization(Policies.Sell);
        items.MapPut("/{id:guid}", async (Guid id, ItemInput input, ErpDb db) =>
        {
            var i = await db.Items.SingleOrDefaultAsync(x => x.Id == id) ?? throw new AppException("Not found.", 404);
            ApplyItem(i, input);
            await db.SaveChangesAsync();
            return i;
        }).RequireAuthorization(Policies.Sell);

        // ---------- quotes and invoices ----------
        var docs = app_.MapGroup("/sales").RequireAuthorization(Policies.SalesView);
        docs.MapGet("", async (ErpDb db, SalesDocKind? kind, string? status, string? q, int? skip, int? take) =>
        {
            var today = Clock.Today;
            var (s, t) = Paging.Of(skip, take);
            var query = db.SalesDocs.Where(d => d.Kind == (kind ?? SalesDocKind.Invoice));
            if (!string.IsNullOrWhiteSpace(q))
            {
                var like = $"%{q.Trim()}%";
                query = query.Where(d => EF.Functions.Like(d.Number, like) || EF.Functions.Like(d.Customer!.Name, like) || EF.Functions.Like(d.Customer.Phone, like));
            }
            var open = new[] { SalesDocStatus.Sent, SalesDocStatus.PartPaid };
            // Counts for the filter chips, so each one shows what it will return before it's tapped.
            var counts = new
            {
                all = await query.CountAsync(),
                draft = await query.CountAsync(d => d.Status == SalesDocStatus.Draft),
                unpaid = await query.CountAsync(d => open.Contains(d.Status)),
                overdue = await query.CountAsync(d => open.Contains(d.Status) && d.DueDate < today),
                paid = await query.CountAsync(d => d.Status == SalesDocStatus.Paid),
            };
            query = status switch
            {
                "draft" => query.Where(d => d.Status == SalesDocStatus.Draft),
                "unpaid" => query.Where(d => open.Contains(d.Status)),
                "overdue" => query.Where(d => open.Contains(d.Status) && d.DueDate < today),
                "paid" => query.Where(d => d.Status == SalesDocStatus.Paid),
                _ => query,
            };
            var total = await query.CountAsync();
            var rows = await query.OrderByDescending(d => d.IssueDate).ThenByDescending(d => d.Number).Skip(s).Take(t)
                .Select(d => new { d.Id, d.Kind, d.Number, d.Status, d.IssueDate, d.DueDate, d.Total, d.Paid, d.EtimsStatus, customer = d.Customer!.Name, customerId = d.CustomerId })
                .ToListAsync();
            return new { counts, page = new Page<object>(rows.Cast<object>().ToList(), total, s, t) };
        });
        docs.MapGet("/{id:guid}", async (Guid id, SalesService s, ErpDb db) =>
        {
            var d = await s.Get(id);
            var paidBy = await db.PaymentAllocations.Where(a => a.SalesDocId == id)
                .Join(db.Payments, a => a.PaymentId, p => p.Id, (a, p) => new { a.Amount, a.MatchedBy, a.At, p.Method, p.Reference, p.ReceivedAt }).ToListAsync();
            var company = await db.Companies.SingleAsync(c => c.Id == db.CompanyId);
            return new { document = d, payments = paidBy, payTo = new { paybill = company.MpesaShortcode, account = d.Number } };
        });
        docs.MapPost("", async (SalesDocInput input, SalesService s) => Results.Created("", await s.Create(input))).RequireAuthorization(Policies.Sell);
        docs.MapPut("/{id:guid}", (Guid id, SalesDocInput input, SalesService s) => s.Update(id, input)).RequireAuthorization(Policies.Sell);
        docs.MapPost("/{id:guid}/issue", async (Guid id, SalesService s, PaymentService payments) =>
        {
            var d = await s.Issue(id);
            if (d.Kind == SalesDocKind.Invoice) await payments.RetryUnmatched(); // money that arrived before the invoice
            return await s.Get(id);
        }).RequireAuthorization(Policies.Sell);
        docs.MapPost("/{id:guid}/void", (Guid id, SalesService s) => s.Void(id)).RequireAuthorization(Policies.Finance);
        docs.MapPost("/{id:guid}/to-invoice", (Guid id, SalesService s) => s.ToInvoice(id)).RequireAuthorization(Policies.Sell);
        docs.MapPost("/{id:guid}/etims", async (Guid id, SalesService s) =>
        {
            var d = await s.Get(id);
            if (d.Kind != SalesDocKind.Invoice || d.Status is SalesDocStatus.Draft or SalesDocStatus.Void) throw new AppException("Only issued invoices are signed.");
            if (d.EtimsStatus == EtimsStatus.Signed) return d;
            await s.Sign(d);
            return d;
        }).RequireAuthorization(Policies.Sell);

        // ---------- money in ----------
        var pay = app_.MapGroup("/payments").RequireAuthorization(Policies.SalesView);
        pay.MapGet("", async (ErpDb db, string? status, string? q, int? skip, int? take) =>
        {
            var (s, t) = Paging.Of(skip, take);
            var query = db.Payments.AsQueryable();
            if (!string.IsNullOrWhiteSpace(q))
            {
                var like = $"%{q.Trim()}%";
                query = query.Where(p => EF.Functions.Like(p.Reference, like) || EF.Functions.Like(p.PayerName, like) || EF.Functions.Like(p.PayerPhone, like) || EF.Functions.Like(p.AccountRef, like));
            }
            var counts = new { all = await query.CountAsync(), toMatch = await query.CountAsync(p => p.Status != PaymentStatus.Matched), matched = await query.CountAsync(p => p.Status == PaymentStatus.Matched) };
            if (status == "to-match") query = query.Where(p => p.Status != PaymentStatus.Matched);
            if (status == "matched") query = query.Where(p => p.Status == PaymentStatus.Matched);
            var total = await query.CountAsync();
            var rows = await query.OrderByDescending(p => p.ReceivedAt).Skip(s).Take(t).ToListAsync();
            return new { counts, page = new Page<Payment>(rows, total, s, t) };
        });
        pay.MapGet("/{id:guid}", async (Guid id, ErpDb db, PaymentService payments) =>
        {
            var p = await db.Payments.Include(x => x.Allocations).SingleOrDefaultAsync(x => x.Id == id) ?? throw new AppException("Not found.", 404);
            var suggestion = await payments.Suggest(p);
            return new { payment = p, suggestion = suggestion.Allocations.Count > 0 ? new { suggestion.Reason, suggestion.Auto, allocations = suggestion.Allocations } : null };
        });
        pay.MapPost("", async (PaymentInput input, PaymentService payments, RequestContext ctx) => Results.Created("", await payments.Record(input, ctx.Actor))).RequireAuthorization(Policies.Sell);
        pay.MapPost("/{id:guid}/allocate", (Guid id, AllocateInput input, PaymentService payments, RequestContext ctx) => payments.Allocate(id, input.Allocations ?? [], $"user: {ctx.Actor}")).RequireAuthorization(Policies.Finance);
        pay.MapPost("/retry-matching", async (PaymentService payments) => new { matched = await payments.RetryUnmatched() }).RequireAuthorization(Policies.Finance);

        // ---------- reports ----------
        var reports = app_.MapGroup("/reports").RequireAuthorization(Policies.Reports);
        reports.MapGet("/aging", (ReportService r) => r.Aging());
        reports.MapGet("/profit-and-loss", (ReportService r, DateOnly? from, DateOnly? to) =>
            r.ProfitAndLoss(from ?? new DateOnly(Clock.Today.Year, Clock.Today.Month, 1), to ?? Clock.Today));
        reports.MapGet("/vat", (ReportService r, DateOnly? from, DateOnly? to) =>
            r.Vat(from ?? new DateOnly(Clock.Today.Year, Clock.Today.Month, 1), to ?? Clock.Today));
        reports.MapGet("/trial-balance", (ReportService r, DateOnly? to) => r.TrialBalance(to));
        reports.MapGet("/accounts", async (ReportService r) => await r.Balances());

        // ---------- company, people, audit ----------
        var settings = app_.MapGroup("/settings");
        settings.MapGet("/company", async (ErpDb db, HttpRequest req) =>
        {
            var c = await db.Companies.SingleAsync(x => x.Id == db.CompanyId);
            return new { c.Id, c.Name, c.KraPin, c.Phone, c.Email, c.County, c.VatRegistered, c.MpesaShortcode, mpesaConfirmationUrl = $"{req.Scheme}://{req.Host}/api/mpesa/c2b/{c.MpesaCallbackKey}/confirmation" };
        }).RequireAuthorization(Policies.Admin);
        settings.MapPut("/company", async (CompanyInput input, ErpDb db) =>
        {
            var c = await db.Companies.SingleAsync(x => x.Id == db.CompanyId);
            var pin = (input.KraPin ?? "").Trim().ToUpperInvariant();
            if (pin.Length > 0 && !Etims.SandboxEtimsClient.IsKraPin(pin)) throw new AppException("That KRA PIN doesn't look right (e.g. P051234567X).");
            if ((input.Name ?? "").Trim().Length < 2) throw new AppException("Enter the business name.");
            (c.Name, c.KraPin, c.Phone, c.Email, c.County, c.VatRegistered) = (input.Name!.Trim(), pin, Phones.ToMsisdn(input.Phone) ?? c.Phone, (input.Email ?? "").Trim(), (input.County ?? "").Trim(), input.VatRegistered);
            c.MpesaShortcode = new string((input.MpesaShortcode ?? "").Where(char.IsDigit).ToArray());
            await db.SaveChangesAsync();
            return Results.NoContent();
        }).RequireAuthorization(Policies.Admin);
        settings.MapGet("/users", async (ErpDb db) => await db.Users.OrderBy(u => u.Name).Select(u => new { u.Id, u.Name, u.Email, u.Phone, Role = u.Role.ToString(), u.Active }).ToListAsync()).RequireAuthorization(Policies.Admin);
        settings.MapPost("/users", async (UserInput input, AuthService s) =>
        {
            var u = await s.AddUser(input.Name, input.Email, input.Phone ?? "", input.Role, input.Password);
            return Results.Created("", new { u.Id, u.Name, u.Email, Role = u.Role.ToString() });
        }).RequireAuthorization(Policies.Admin);
        app_.MapGet("/audit", async (ErpDb db, string? entity, int? take) =>
        {
            var query = db.AuditEntries.AsQueryable();
            if (!string.IsNullOrEmpty(entity)) query = query.Where(a => a.Entity == entity);
            return await query.OrderByDescending(a => a.Id).Take(Math.Clamp(take ?? 100, 1, 500)).ToListAsync();
        }).RequireAuthorization(Policies.Finance);

        BuyingEndpoints.Map(app_);
        PosEndpoints.Map(app_);
        PeopleEndpoints.Map(app_);
        GrowthEndpoints.Map(app_);
        AgentEndpoints.Map(app_);
        SelfEndpoints.Map(app);
        SearchEndpoints.Map(app_);
        ProductionEndpoints.Map(app_);
        Assistant.AssistantEndpoints.Map(app_);
    }

    // Safaricom's exact reply format (PascalCase, unlike the rest of the API).
    static readonly System.Text.Json.JsonSerializerOptions Exact = new();
    static IResult MpesaAck() => Results.Json(new { ResultCode = 0, ResultDesc = "Accepted" }, Exact);

    static async Task ApplyCustomer(ErpDb db, Customer c, CustomerInput input)
    {
        var name = (input.Name ?? "").Trim();
        if (name.Length < 2) throw new AppException("Enter the customer's name.");
        var phone = string.IsNullOrWhiteSpace(input.Phone) ? "" : Phones.ToMsisdn(input.Phone) ?? throw new AppException("That phone number doesn't look right (e.g. 0712 345 678).");
        var pin = (input.KraPin ?? "").Trim().ToUpperInvariant();
        if (pin.Length > 0 && !Etims.SandboxEtimsClient.IsKraPin(pin)) throw new AppException("That KRA PIN doesn't look right (e.g. P051234567X).");
        if (phone.Length > 0 && await db.Customers.AnyAsync(x => x.Phone == phone && x.Id != c.Id))
            throw new AppException("Another customer already has that phone number.", 409);
        (c.Name, c.Phone, c.Email, c.KraPin, c.Address, c.Notes) = (name, phone, (input.Email ?? "").Trim(), pin, (input.Address ?? "").Trim(), (input.Notes ?? "").Trim());
        c.CreditLimit = Math.Max(0, input.CreditLimit ?? c.CreditLimit);
        c.MarketingOptOut = input.MarketingOptOut ?? c.MarketingOptOut;
    }

    static void ApplyItem(Item i, ItemInput input)
    {
        var name = (input.Name ?? "").Trim();
        if (name.Length < 2) throw new AppException("Enter the item's name.");
        if (input.Price < 0) throw new AppException("Prices can't be negative.");
        (i.Name, i.Sku, i.Kind, i.Unit, i.Price, i.TaxType, i.Active) = (name, (input.Sku ?? "").Trim(), input.Kind ?? i.Kind, string.IsNullOrWhiteSpace(input.Unit) ? i.Unit : input.Unit.Trim(), input.Price, input.TaxType ?? i.TaxType, input.Active ?? i.Active);
        if (input.ReorderLevel < 0) throw new AppException("The reorder level can't be negative.");
        i.TrackStock = (input.TrackStock ?? i.TrackStock) && i.Kind == ItemKind.Product; // services aren't counted
        i.ReorderLevel = input.ReorderLevel ?? i.ReorderLevel;
    }
}
