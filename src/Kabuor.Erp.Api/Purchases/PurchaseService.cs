// Buying: purchase orders (what we asked for) and bills (what the supplier says we owe).
// Posting a bill puts stocked items into stock at their cost, other lines on their expense accounts, VAT paid
// on the VAT-input account (claimable against VAT on sales), and the total on "Money we owe suppliers".
using Kabuor.Erp.Accounting;
using Kabuor.Erp.Common;
using Kabuor.Erp.Data;
using Kabuor.Erp.Domain;
using Kabuor.Erp.Inventory;
using Microsoft.EntityFrameworkCore;

namespace Kabuor.Erp.Purchases;

public sealed record PurchaseLineInput(Guid? ItemId, Guid? AccountId, string? Description, decimal Quantity, long? UnitCost, TaxType? TaxType, string? Unit = null, string? BatchNo = null, DateOnly? Expiry = null);
public sealed record PurchaseInput(PurchaseKind Kind, Guid SupplierId, DateOnly? IssueDate, int? DueInDays, string? SupplierRef, Guid? LocationId, string? Notes, List<PurchaseLineInput> Lines);
public sealed record SupplierPaymentInput(PaymentMethod Method, long Amount, string? Reference, DateTimeOffset? PaidAt);

public sealed class PurchaseService(ErpDb db, Ledger ledger, Numbers numbers, InventoryService stock, RequestContext ctx)
{
    async Task<Company> Company() => await db.Companies.SingleAsync(c => c.Id == db.CompanyId);

    public async Task<PurchaseDoc> Get(Guid id) =>
        await db.PurchaseDocs.Include(d => d.Lines).Include(d => d.Supplier).SingleOrDefaultAsync(d => d.Id == id) ?? throw new AppException("Not found.", 404);

    public async Task<PurchaseDoc> Create(PurchaseInput input)
    {
        var supplier = await db.Suppliers.SingleOrDefaultAsync(s => s.Id == input.SupplierId) ?? throw new AppException("Choose a supplier.");
        var issue = input.IssueDate ?? Clock.Today;
        var doc = new PurchaseDoc
        {
            Kind = input.Kind,
            Number = await numbers.Next(input.Kind == PurchaseKind.Order ? "PO" : "BILL"),
            SupplierId = supplier.Id,
            IssueDate = issue,
            DueDate = issue.AddDays(Math.Clamp(input.DueInDays ?? 30, 0, 365)),
            SupplierRef = (input.SupplierRef ?? "").Trim(),
            LocationId = (await stock.LocationOrDefault(input.LocationId)).Id,
            Notes = (input.Notes ?? "").Trim(),
        };
        await SetLines(doc, input.Lines);
        db.PurchaseDocs.Add(doc);
        await db.SaveChangesAsync();
        return doc;
    }

    public async Task<PurchaseDoc> Update(Guid id, PurchaseInput input)
    {
        var doc = await Get(id);
        if (doc.Status != PurchaseStatus.Draft) throw new AppException("Only drafts can be changed.");
        var supplier = await db.Suppliers.SingleOrDefaultAsync(s => s.Id == input.SupplierId) ?? throw new AppException("Choose a supplier.");
        doc.SupplierId = supplier.Id;
        doc.IssueDate = input.IssueDate ?? doc.IssueDate;
        doc.DueDate = doc.IssueDate.AddDays(Math.Clamp(input.DueInDays ?? doc.DueDate.DayNumber - doc.IssueDate.DayNumber, 0, 365));
        doc.SupplierRef = (input.SupplierRef ?? "").Trim();
        doc.LocationId = (await stock.LocationOrDefault(input.LocationId)).Id;
        doc.Notes = (input.Notes ?? "").Trim();
        db.PurchaseLines.RemoveRange(doc.Lines);
        await SetLines(doc, input.Lines);
        await db.SaveChangesAsync();
        return doc;
    }

    async Task SetLines(PurchaseDoc doc, List<PurchaseLineInput>? lines)
    {
        if (lines is not { Count: > 0 }) throw new AppException("Add at least one line.");
        if (lines.Count > 200) throw new AppException("A bill can have at most 200 lines.");
        var vat = (await Company()).VatRegistered;
        var ids = lines.Where(l => l.ItemId is not null).Select(l => l.ItemId!.Value).ToList();
        var items = await db.Items.Where(i => ids.Contains(i.Id)).ToDictionaryAsync(i => i.Id);
        var units = await db.ItemUnits.Where(u => ids.Contains(u.ItemId)).ToListAsync();
        var accountIds = lines.Where(l => l.AccountId is not null).Select(l => l.AccountId!.Value).ToList();
        var accounts = await db.Accounts.Where(a => accountIds.Contains(a.Id)).ToDictionaryAsync(a => a.Id);
        doc.Lines.Clear();
        foreach (var l in lines)
        {
            Item? item = l.ItemId is { } iid ? items.GetValueOrDefault(iid) ?? throw new AppException("One of the items no longer exists.") : null;
            if (l.AccountId is { } aid)
            {
                var a = accounts.GetValueOrDefault(aid) ?? throw new AppException("One of the accounts no longer exists.");
                if (a.Type is not (AccountType.Expense or AccountType.Asset) || a.SystemKey is SystemAccounts.Receivable or SystemAccounts.Mpesa or SystemAccounts.Cash or SystemAccounts.Bank or SystemAccounts.VatInput)
                    throw new AppException($"“{a.Name}” can’t be used for a purchase line. Choose an expense.");
            }
            if (l.Quantity <= 0 || l.Quantity > 1_000_000) throw new AppException("Quantities must be more than 0.");
            var (unitName, factor) = ("", 1m);
            if (item is not null && !string.IsNullOrWhiteSpace(l.Unit) && !l.Unit.Trim().Equals(item.Unit, StringComparison.OrdinalIgnoreCase))
            {
                var u = units.FirstOrDefault(x => x.ItemId == item.Id && x.Name.Equals(l.Unit.Trim(), StringComparison.OrdinalIgnoreCase))
                    ?? throw new AppException($"{item.Name} has no “{l.Unit.Trim()}” unit. Add it to the product first.");
                (unitName, factor) = (u.Name, u.Factor);
            }
            var batch = item?.TrackBatches == true ? (l.BatchNo ?? "").Trim() : "";
            var cost = l.UnitCost ?? throw new AppException("Give each line a cost.");
            if (cost < 0) throw new AppException("Costs can't be negative.");
            var type = l.TaxType ?? item?.TaxType ?? TaxType.B_Standard16;
            var (net, tax, total) = Tax.Line(l.Quantity, cost, type, vat);
            var description = (l.Description ?? item?.Name ?? "").Trim();
            if (description.Length == 0) throw new AppException("Describe each line.");
            doc.Lines.Add(new PurchaseLine { ItemId = item?.Id, AccountId = item?.TrackStock == true ? null : l.AccountId, Description = description, Quantity = l.Quantity, UnitCost = cost, TaxType = type, Net = net, Tax = tax, Total = total, Unit = unitName, UnitFactor = factor, BatchNo = batch, Expiry = batch.Length > 0 ? l.Expiry : null });
        }
        doc.Net = doc.Lines.Sum(l => l.Net);
        doc.Tax = doc.Lines.Sum(l => l.Tax);
        doc.Total = doc.Lines.Sum(l => l.Total);
    }

    /// <summary>Posts a bill (books + stock), or marks an order as sent to the supplier.</summary>
    public async Task<PurchaseDoc> Post(Guid id)
    {
        var doc = await Get(id);
        if (doc.Status != PurchaseStatus.Draft) throw new AppException("This has already been sent or posted.");
        if (doc.Kind == PurchaseKind.Order)
        {
            doc.Status = PurchaseStatus.Sent;
            await db.SaveChangesAsync();
            return doc;
        }
        var stockAccount = await ledger.Id(SystemAccounts.Stock);
        var itemIds = doc.Lines.Where(l => l.ItemId is not null).Select(l => l.ItemId!.Value).ToList();
        var items = await db.Items.Where(i => itemIds.Contains(i.Id)).ToDictionaryAsync(i => i.Id);
        var location = await stock.LocationOrDefault(doc.LocationId);
        foreach (var l in doc.Lines)
        {
            var item = l.ItemId is { } iid ? items.GetValueOrDefault(iid) : null;
            if (item?.TrackStock == true)
            {
                // Batches are known when the goods arrive: an order doesn't need one, a bill being posted does.
                if (item.TrackBatches && l.BatchNo.Length == 0) throw new AppException($"{item.Name} is kept by batch: enter the batch number and expiry from the packaging before posting this bill.");
                l.AccountId = stockAccount;
                var qty = l.Quantity * l.UnitFactor;
                await stock.Receive(item, location.Id, qty, (decimal)l.Net / qty, StockMoveKind.Received, "Bill", doc.Id, doc.Number, l.BatchNo, l.Expiry);
            }
        }
        await ledger.PostBill(doc);
        doc.Status = PurchaseStatus.Open;
        await db.SaveChangesAsync();
        return doc;
    }

    /// <summary>The goods on an order arrived: makes a draft bill with the same lines to check against the supplier's invoice.</summary>
    public async Task<PurchaseDoc> ToBill(Guid orderId)
    {
        var o = await Get(orderId);
        if (o.Kind != PurchaseKind.Order) throw new AppException("Only purchase orders can be received.");
        if (o.Status is PurchaseStatus.Received or PurchaseStatus.Void) throw new AppException("This order has already been received or voided.");
        var bill = await Create(new PurchaseInput(PurchaseKind.Bill, o.SupplierId, Clock.Today, o.DueDate.DayNumber - o.IssueDate.DayNumber, "", o.LocationId, o.Notes,
            o.Lines.Select(l => new PurchaseLineInput(l.ItemId, l.AccountId, l.Description, l.Quantity, l.UnitCost, l.TaxType, l.Unit)).ToList()));
        bill.FromOrderId = o.Id;
        o.Status = PurchaseStatus.Received;
        await db.SaveChangesAsync();
        return bill;
    }

    public async Task<PurchaseDoc> Pay(Guid id, SupplierPaymentInput input)
    {
        var bill = await Get(id);
        if (bill.Kind != PurchaseKind.Bill || bill.Status is PurchaseStatus.Draft or PurchaseStatus.Void) throw new AppException("Post the bill before paying it.");
        if (input.Amount <= 0) throw new AppException("Enter an amount above 0.");
        if (input.Amount > bill.Balance) throw new AppException($"Only {bill.Balance / 100m:N2} is left to pay on {bill.Number}.");
        var p = new SupplierPayment { PurchaseDocId = bill.Id, SupplierId = bill.SupplierId, Method = input.Method, Amount = input.Amount, Reference = (input.Reference ?? "").Trim().ToUpperInvariant(), PaidAt = input.PaidAt ?? DateTimeOffset.UtcNow, Actor = ctx.Actor };
        db.SupplierPayments.Add(p);
        bill.Paid += p.Amount;
        bill.Status = bill.Balance == 0 ? PurchaseStatus.Paid : PurchaseStatus.PartPaid;
        await ledger.PostSupplierPayment(p, bill);
        await db.SaveChangesAsync();
        return bill;
    }

    public async Task<PurchaseDoc> Void(Guid id)
    {
        var doc = await Get(id);
        if (doc.Status == PurchaseStatus.Void) throw new AppException("Already void.");
        if (doc.Paid > 0) throw new AppException("This bill has payments on it, so it can't be voided.");
        if (doc.Kind == PurchaseKind.Bill && doc.Status != PurchaseStatus.Draft)
        {
            var itemIds = doc.Lines.Where(l => l.ItemId is not null).Select(l => l.ItemId!.Value).ToList();
            var items = await db.Items.Where(i => itemIds.Contains(i.Id)).ToDictionaryAsync(i => i.Id);
            var location = await stock.LocationOrDefault(doc.LocationId);
            foreach (var l in doc.Lines)
                if (l.ItemId is { } iid && items.GetValueOrDefault(iid) is { TrackStock: true } item)
                    await stock.Unreceive(item, location.Id, l.Quantity * l.UnitFactor, (decimal)l.Net / (l.Quantity * l.UnitFactor), "BillVoid", doc.Id, doc.Number, l.BatchNo);
            await ledger.PostBill(doc, reverse: true);
        }
        doc.Status = PurchaseStatus.Void;
        await db.SaveChangesAsync();
        return doc;
    }
}
