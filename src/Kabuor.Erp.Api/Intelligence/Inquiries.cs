// Inquiries: every question a customer or would-be customer asks, wherever it came from (the web shop, a
// tracking link, WhatsApp, a call, a walk-in). Each one has an owner, a thread, and an ending: a quote and a
// sale, or a reason it was lost. That ending is what lets Kabuor Intelligence say why people ask but don't buy.
using Kabuor.Erp.Auth;
using Kabuor.Erp.Common;
using Kabuor.Erp.Data;
using Kabuor.Erp.Domain;
using Microsoft.EntityFrameworkCore;

namespace Kabuor.Erp.Intelligence;

public sealed record InquiryInput(string? Name, string? Phone, string? Email, string Message, Guid? ItemId, Guid? CustomerId, Channel? Channel, string? Ref);
public sealed record ReplyInput(string Text);
public sealed record AssignInput(Guid? UserId);
public sealed record CloseInput(bool Won, string? Reason, Guid? InvoiceId);

public sealed class InquiryService(ErpDb db, Numbers numbers, RequestContext ctx)
{
    public static readonly string[] LostReasons = ["Price too high", "Out of stock", "Bought elsewhere", "No reply from customer", "Just comparing / asking", "Delivery or location", "Took too long to answer", "Other"];

    static LeadSource SourceOf(Channel c) => c switch
    {
        Channel.WhatsApp => LeadSource.WhatsApp,
        Channel.Instagram => LeadSource.Instagram,
        Channel.Facebook => LeadSource.Facebook,
        Channel.Referral => LeadSource.Referral,
        Channel.WalkIn => LeadSource.WalkIn,
        Channel.Website or Channel.Google => LeadSource.Website,
        Channel.Event => LeadSource.Event,
        _ => LeadSource.Other,
    };

    /// <summary>A new inquiry. Known phone: it's the customer's. Otherwise it becomes (or joins) a lead, so the
    /// pipeline shows it. Credit goes to the tracking link it came through, and so does the first reply.</summary>
    public async Task<Inquiry> Create(InquiryInput input, string from = "staff")
    {
        var message = (input.Message ?? "").Trim();
        if (message.Length is < 2 or > 4000) throw new AppException("Write the question or request (up to 4,000 characters).");
        var phone = Phones.ToMsisdn(input.Phone) ?? "";
        if (from == "customer" && phone.Length == 0 && input.CustomerId is null) throw new AppException("Enter a phone number so we can reply (e.g. 0712 345 678).");
        var link = string.IsNullOrWhiteSpace(input.Ref) ? null : await db.TrackingLinks.SingleOrDefaultAsync(l => l.Code == input.Ref.Trim().ToLowerInvariant());
        var channel = input.Channel ?? link?.Channel ?? (from == "customer" ? Channel.Website : Channel.Other);
        var customer = input.CustomerId is { } cid ? await db.Customers.SingleOrDefaultAsync(c => c.Id == cid)
            : phone.Length > 0 ? await db.Customers.FirstOrDefaultAsync(c => c.Phone == phone) : null;
        var item = input.ItemId is { } iid ? await db.Items.SingleOrDefaultAsync(i => i.Id == iid) : null;
        var name = (input.Name ?? "").Trim();
        var inq = new Inquiry
        {
            Number = await numbers.Next("ENQ"), CustomerId = customer?.Id, Name = customer?.Name ?? (name.Length > 0 ? name : "Visitor"), Phone = phone.Length > 0 ? phone : customer?.Phone ?? "",
            Email = (input.Email ?? "").Trim(), Subject = message.Length > 90 ? message[..90] + "…" : message, ItemId = item?.Id, Channel = channel, LinkId = link?.Id,
            AssignedUserId = link?.OwnerUserId, AssignedName = link?.OwnerName ?? "",
        };
        inq.Messages.Add(new InquiryMessage { From = from, Author = from == "customer" ? inq.Name : ctx.Actor, Text = message });
        db.Inquiries.Add(inq);
        if (customer is null)
        {
            var lead = phone.Length > 0 ? await db.Leads.FirstOrDefaultAsync(l => l.Phone == phone && l.Stage != LeadStage.Won && l.Stage != LeadStage.Lost) : null;
            if (lead is null)
            {
                lead = new Lead
                {
                    Number = await numbers.Next("L"), Name = inq.Name, Phone = phone, Email = inq.Email, Source = SourceOf(channel), Interest = item?.Name ?? inq.Subject,
                    OwnerUserId = link?.OwnerUserId, OwnerName = link?.OwnerName ?? "", LinkId = link?.Id, Channel = channel, InquiryId = inq.Id,
                };
                db.Leads.Add(lead);
            }
            lead.LinkId ??= link?.Id;
            lead.Channel ??= channel;
            inq.LeadId = lead.Id;
        }
        await db.SaveChangesAsync();
        return inq;
    }

    public async Task<object> List(string? status, bool mine)
    {
        var all = await db.Inquiries.ToListAsync();
        var scoped = mine ? all.Where(i => i.AssignedUserId == ctx.UserId).ToList() : all;
        var counts = new
        {
            open = scoped.Count(i => i.Status == InquiryStatus.Open), answered = scoped.Count(i => i.Status == InquiryStatus.Answered), quoted = scoped.Count(i => i.Status == InquiryStatus.Quoted),
            won = scoped.Count(i => i.Status == InquiryStatus.Won), lost = scoped.Count(i => i.Status == InquiryStatus.Lost), unassigned = scoped.Count(i => i.AssignedUserId == null && i.Status == InquiryStatus.Open),
        };
        var shown = status switch
        {
            "open" => scoped.Where(i => i.Status == InquiryStatus.Open),
            "waiting" => scoped.Where(i => i.Status is InquiryStatus.Answered or InquiryStatus.Quoted),
            "won" => scoped.Where(i => i.Status == InquiryStatus.Won),
            "lost" => scoped.Where(i => i.Status == InquiryStatus.Lost),
            _ => scoped.Where(i => i.Status is InquiryStatus.Open or InquiryStatus.Answered or InquiryStatus.Quoted),
        };
        var now = DateTimeOffset.UtcNow;
        return new
        {
            counts, lostReasons = LostReasons,
            items = shown.OrderBy(i => i.Status == InquiryStatus.Open ? 0 : 1).ThenBy(i => i.CreatedAt).Take(200).Select(i => new
            {
                i.Id, i.Number, i.Name, i.Phone, i.Subject, channel = i.Channel.ToString(), status = i.Status.ToString(), i.AssignedUserId, i.AssignedName, i.CustomerId, i.LeadId,
                i.QuoteId, i.InvoiceId, i.CreatedAt, i.FirstResponseAt, i.LostReason,
                waitingHours = i.Status == InquiryStatus.Open && i.FirstResponseAt is null ? Math.Round((now - i.CreatedAt).TotalHours, 1) : (double?)null,
            }),
        };
    }

    public async Task<Inquiry> Get(Guid id) =>
        await db.Inquiries.Include(i => i.Messages).SingleOrDefaultAsync(i => i.Id == id) ?? throw new AppException("Not found.", 404);

    public async Task<Inquiry> Reply(Guid id, ReplyInput input, string from = "staff")
    {
        var inq = await Get(id);
        var text = (input.Text ?? "").Trim();
        if (text.Length is < 1 or > 4000) throw new AppException("Write the reply (up to 4,000 characters).");
        inq.Messages.Add(new InquiryMessage { InquiryId = inq.Id, From = from, Author = from == "customer" ? inq.Name : ctx.Actor, Text = text });
        if (from == "customer")
        {
            if (inq.Status is InquiryStatus.Answered or InquiryStatus.Lost) (inq.Status, inq.ClosedAt) = (InquiryStatus.Open, null);
        }
        else
        {
            inq.FirstResponseAt ??= DateTimeOffset.UtcNow;
            if (inq.Status == InquiryStatus.Open) inq.Status = InquiryStatus.Answered;
            // The first person to answer an unassigned inquiry owns it.
            if (inq.AssignedUserId is null && ctx.UserId is { } uid) (inq.AssignedUserId, inq.AssignedName) = (uid, ctx.Actor);
        }
        await db.SaveChangesAsync();
        return inq;
    }

    public async Task<Inquiry> Assign(Guid id, AssignInput input)
    {
        var inq = await Get(id);
        if (input.UserId is { } uid)
        {
            var name = await db.Users.Where(u => u.Id == uid && u.Active && u.Role != Role.Employee).Select(u => u.Name).SingleOrDefaultAsync() ?? throw new AppException("Choose someone with a staff login.");
            (inq.AssignedUserId, inq.AssignedName) = (uid, name);
        }
        else (inq.AssignedUserId, inq.AssignedName) = (null, "");
        await db.SaveChangesAsync();
        return inq;
    }

    public async Task<Inquiry> Close(Guid id, CloseInput input)
    {
        var inq = await Get(id);
        if (input.Won)
        {
            if (input.InvoiceId is { } inv && !await db.SalesDocs.AnyAsync(d => d.Id == inv && d.Kind == SalesDocKind.Invoice)) throw new AppException("That invoice doesn't exist.");
            (inq.Status, inq.InvoiceId, inq.LostReason) = (InquiryStatus.Won, input.InvoiceId ?? inq.InvoiceId, "");
        }
        else
        {
            var reason = (input.Reason ?? "").Trim();
            if (reason.Length < 2) throw new AppException("Say why it was lost: it's how you learn what stops people buying.");
            (inq.Status, inq.LostReason) = (InquiryStatus.Lost, reason.Length > 200 ? reason[..200] : reason);
            if (inq.LeadId is { } lid && await db.Leads.SingleOrDefaultAsync(l => l.Id == lid) is { } lead && lead.Stage is not (LeadStage.Won or LeadStage.Lost))
                (lead.Stage, lead.LostReason, lead.StageChangedAt) = (LeadStage.Lost, inq.LostReason, DateTimeOffset.UtcNow);
        }
        inq.ClosedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();
        return inq;
    }

    /// <summary>A quote made for an inquiry: the two are linked and the inquiry shows it was quoted.</summary>
    public async Task LinkQuote(Guid inquiryId, Guid quoteId)
    {
        var inq = await Get(inquiryId);
        (inq.QuoteId, inq.Status) = (quoteId, InquiryStatus.Quoted);
        await db.SaveChangesAsync();
    }

    /// <summary>When an invoice is issued: the customer's latest unfinished inquiry (last 60 days) is won by it.</summary>
    public static async Task OnInvoiceIssued(ErpDb db, SalesDoc invoice)
    {
        var since = DateTimeOffset.UtcNow.AddDays(-60);
        var open = (await db.Inquiries.Where(i => i.CustomerId == invoice.CustomerId && (i.Status == InquiryStatus.Open || i.Status == InquiryStatus.Answered || i.Status == InquiryStatus.Quoted)).ToListAsync())
            .Where(i => i.CreatedAt >= since).OrderByDescending(i => i.QuoteId == invoice.FromQuoteId && invoice.FromQuoteId != null).ThenByDescending(i => i.CreatedAt).FirstOrDefault();
        if (open is null) return;
        (open.Status, open.InvoiceId, open.ClosedAt) = (InquiryStatus.Won, invoice.Id, DateTimeOffset.UtcNow);
        invoice.InquiryId ??= open.Id;
        invoice.LinkId ??= open.LinkId;
        invoice.Channel ??= open.Channel;
    }
}
