using Kabuor.Erp.Accounting;
using Kabuor.Erp.Common;
using Kabuor.Erp.Data;
using Kabuor.Erp.Domain;
using Kabuor.Erp.Etims;
using Kabuor.Erp.Inventory;
using Microsoft.EntityFrameworkCore;

namespace Kabuor.Erp.Sales;

public sealed record LineInput(Guid? ItemId, string? Description, decimal Quantity, long? UnitPrice, TaxType? TaxType);
public sealed record SalesDocInput(SalesDocKind Kind, Guid CustomerId, DateOnly? IssueDate, int? DueInDays, string? Notes, List<LineInput> Lines, Guid? LocationId = null);

public sealed class SalesService(ErpDb db, Ledger ledger, Numbers numbers, IEtimsClient etims, InventoryService stock)
{
    async Task<Company> Company() => await db.Companies.SingleAsync(c => c.Id == db.CompanyId);

    /// <summary>Creates a draft quote or invoice. Prices come from the item unless the user typed one.</summary>
    public async Task<SalesDoc> Create(SalesDocInput input)
    {
        if (input.Lines is not { Count: > 0 }) throw new AppException("Add at least one line.");
        if (input.Lines.Count > 200) throw new AppException("An invoice can have at most 200 lines.");
        var customer = await db.Customers.SingleOrDefaultAsync(c => c.Id == input.CustomerId) ?? throw new AppException("Choose a customer.");
        var company = await Company();
        var issue = input.IssueDate ?? Clock.Today;
        var doc = new SalesDoc
        {
            Kind = input.Kind,
            Number = await numbers.Next(input.Kind == SalesDocKind.Quote ? "QT" : "INV"),
            CustomerId = customer.Id,
            IssueDate = issue,
            DueDate = issue.AddDays(Math.Clamp(input.DueInDays ?? (input.Kind == SalesDocKind.Quote ? 14 : 7), 0, 365)),
            Notes = (input.Notes ?? "").Trim(),
            LocationId = input.LocationId is null ? null : (await stock.LocationOrDefault(input.LocationId)).Id,
        };
        await SetLines(doc, input.Lines, company.VatRegistered);
        db.SalesDocs.Add(doc);
        await db.SaveChangesAsync();
        return doc;
    }

    async Task SetLines(SalesDoc doc, List<LineInput> lines, bool vat)
    {
        var ids = lines.Where(l => l.ItemId is not null).Select(l => l.ItemId!.Value).ToList();
        var items = await db.Items.Where(i => ids.Contains(i.Id)).ToDictionaryAsync(i => i.Id);
        doc.Lines.Clear();
        foreach (var l in lines)
        {
            Item? item = l.ItemId is { } id ? items.GetValueOrDefault(id) ?? throw new AppException("One of the items no longer exists.") : null;
            if (l.Quantity <= 0 || l.Quantity > 1_000_000) throw new AppException("Quantities must be more than 0.");
            var price = l.UnitPrice ?? item?.Price ?? throw new AppException("Give each line a price.");
            if (price < 0) throw new AppException("Prices can't be negative.");
            var type = l.TaxType ?? item?.TaxType ?? TaxType.B_Standard16;
            var (net, tax, total) = Tax.Line(l.Quantity, price, type, vat);
            var description = (l.Description ?? item?.Name ?? "").Trim();
            if (description.Length == 0) throw new AppException("Describe each line.");
            doc.Lines.Add(new SalesLine { ItemId = item?.Id, Description = description, Quantity = l.Quantity, UnitPrice = price, TaxType = type, Net = net, Tax = tax, Total = total });
        }
        doc.Net = doc.Lines.Sum(l => l.Net);
        doc.Tax = doc.Lines.Sum(l => l.Tax);
        doc.Total = doc.Lines.Sum(l => l.Total);
    }

    public async Task<SalesDoc> Get(Guid id) =>
        await db.SalesDocs.Include(d => d.Lines).Include(d => d.Customer).SingleOrDefaultAsync(d => d.Id == id) ?? throw new AppException("Not found.", 404);

    /// <summary>Changes a draft. Issued invoices can't be edited: void and reissue instead (KRA keeps the original).</summary>
    public async Task<SalesDoc> Update(Guid id, SalesDocInput input)
    {
        var doc = await Get(id);
        if (doc.Status != SalesDocStatus.Draft) throw new AppException("Only drafts can be changed. Void this one and make a new one.");
        var customer = await db.Customers.SingleOrDefaultAsync(c => c.Id == input.CustomerId) ?? throw new AppException("Choose a customer.");
        doc.CustomerId = customer.Id;
        doc.IssueDate = input.IssueDate ?? doc.IssueDate;
        doc.DueDate = doc.IssueDate.AddDays(Math.Clamp(input.DueInDays ?? doc.DueDate.DayNumber - doc.IssueDate.DayNumber, 0, 365));
        doc.Notes = (input.Notes ?? "").Trim();
        db.SalesLines.RemoveRange(doc.Lines);
        await SetLines(doc, input.Lines ?? [], (await Company()).VatRegistered);
        await db.SaveChangesAsync();
        return doc;
    }

    /// <summary>Issues an invoice: posts it to the books, signs it with eTIMS, and applies any unmatched money
    /// the customer already sent. A quote is just marked sent.</summary>
    public async Task<SalesDoc> Issue(Guid id)
    {
        var doc = await Get(id);
        if (doc.Status != SalesDocStatus.Draft) throw new AppException("This has already been sent.");
        doc.Status = SalesDocStatus.Sent;
        if (doc.Kind == SalesDocKind.Invoice)
        {
            await ledger.PostInvoice(doc);
            await TakeFromStock(doc);
            var company = await Company();
            doc.EtimsStatus = company.VatRegistered ? EtimsStatus.Pending : EtimsStatus.NotRequired;
        }
        await db.SaveChangesAsync();
        if (doc.EtimsStatus == EtimsStatus.Pending) await Sign(doc);
        return doc;
    }

    /// <summary>Stocked items on an issued invoice leave the store; their cost moves from Stock to cost of sales.</summary>
    async Task TakeFromStock(SalesDoc doc)
    {
        var ids = doc.Lines.Where(l => l.ItemId is not null).Select(l => l.ItemId!.Value).ToList();
        var items = await db.Items.Where(i => ids.Contains(i.Id) && i.TrackStock).ToDictionaryAsync(i => i.Id);
        if (items.Count == 0) return;
        var location = await stock.LocationOrDefault(doc.LocationId);
        doc.LocationId = location.Id;
        foreach (var l in doc.Lines)
            if (l.ItemId is { } iid && items.GetValueOrDefault(iid) is { } item)
                l.Cost = await stock.Issue(item, location.Id, l.Quantity, "Invoice", doc.Id, doc.Number);
        await ledger.PostCostOfSales(doc.IssueDate, doc.Number, doc.Id, doc.Lines.Sum(l => l.Cost));
    }

    /// <summary>A voided invoice: exactly what left the store goes back, at the cost it left with.</summary>
    async Task PutBackInStock(SalesDoc doc)
    {
        var moves = await db.StockMoves.Where(m => m.SourceType == "Invoice" && m.SourceId == doc.Id).ToListAsync();
        if (moves.Count == 0) return;
        var ids = moves.Select(m => m.ItemId).Distinct().ToList();
        var items = await db.Items.Where(i => ids.Contains(i.Id)).ToDictionaryAsync(i => i.Id);
        foreach (var m in moves)
            await stock.Receive(items[m.ItemId], m.LocationId, -m.Quantity, m.UnitCost, StockMoveKind.Returned, "InvoiceVoid", doc.Id, doc.Number);
        await ledger.PostCostOfSales(Clock.Today, doc.Number, doc.Id, doc.Lines.Sum(l => l.Cost), reverse: true);
    }

    /// <summary>Sends the invoice to KRA eTIMS. A failure never blocks the sale: it stays Pending/Failed and can be retried.</summary>
    public async Task Sign(SalesDoc doc)
    {
        var company = await Company();
        try
        {
            var r = await etims.Sign(company, doc);
            (doc.EtimsStatus, doc.EtimsInvoiceNo, doc.EtimsControlCode, doc.EtimsQrUrl, doc.EtimsError) = (EtimsStatus.Signed, r.InvoiceNo, r.ControlCode, r.QrUrl, "");
        }
        catch (Exception e)
        {
            (doc.EtimsStatus, doc.EtimsError) = (EtimsStatus.Failed, e.Message);
        }
        await db.SaveChangesAsync();
    }

    public async Task<SalesDoc> Void(Guid id)
    {
        var doc = await Get(id);
        if (doc.Status is SalesDocStatus.Void) throw new AppException("Already void.");
        if (doc.Paid > 0) throw new AppException("This invoice has payments on it. Move the payments to another invoice first.");
        if (doc.Kind == SalesDocKind.Invoice && doc.Status != SalesDocStatus.Draft)
        {
            await ledger.ReverseInvoice(doc, Clock.Today);
            await PutBackInStock(doc);
        }
        doc.Status = SalesDocStatus.Void;
        await db.SaveChangesAsync();
        return doc;
    }

    /// <summary>Turns an accepted quote into a draft invoice with the same lines.</summary>
    public async Task<SalesDoc> ToInvoice(Guid quoteId)
    {
        var q = await Get(quoteId);
        if (q.Kind != SalesDocKind.Quote) throw new AppException("Only quotes can become invoices.");
        if (q.Status is SalesDocStatus.Accepted or SalesDocStatus.Void) throw new AppException("This quote has already been used or voided.");
        var inv = await Create(new SalesDocInput(SalesDocKind.Invoice, q.CustomerId, Clock.Today, null, q.Notes,
            q.Lines.Select(l => new LineInput(l.ItemId, l.Description, l.Quantity, l.UnitPrice, l.TaxType)).ToList()));
        inv.FromQuoteId = q.Id;
        q.Status = SalesDocStatus.Accepted;
        await db.SaveChangesAsync();
        return inv;
    }
}
