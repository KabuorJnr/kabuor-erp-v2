// The KPI scorecard. The owner sets a target for each measure that matters; the dashboard shows where the business
// is, whether it's on pace to meet the target (a month half gone needs half the month's sales), how it moved over
// the last six periods, and links to the detail. Every value is worked out from the books, stock and CRM.
using System.Text.Json;
using System.Text.Json.Nodes;
using Kabuor.Erp.Common;
using Kabuor.Erp.Data;
using Kabuor.Erp.Domain;
using Microsoft.EntityFrameworkCore;

namespace Kabuor.Erp.Intelligence;

/// <summary>What a KPI is: how to read it, which way is good, and the target most businesses start from.</summary>
public sealed record KpiDef(string Key, string Group, string Name, string Unit, bool HigherIsBetter, decimal? DefaultTarget, bool Cumulative, string Link, string Explain);

public sealed class KpiService(ErpDb db)
{
    public static readonly KpiDef[] All =
    [
        new("sales", "Sales", "Sales (before VAT)", "ksh", true, null, true, "/reports", "Invoiced in the period, before VAT."),
        new("margin", "Sales", "Gross margin", "%", true, 25, false, "/intelligence?tab=selling", "Sales minus what the goods cost, as a share of sales."),
        new("avgInvoice", "Sales", "Average invoice", "ksh", true, null, false, "/invoices", "Sales divided by the number of invoices."),
        new("newCustomers", "Customers", "New customers", "count", true, null, true, "/intelligence?tab=customers", "Customers whose first invoice was in the period."),
        new("repeat", "Customers", "Repeat buyers", "%", true, 40, false, "/intelligence?tab=customers", "Buyers who bought twice or more in the period."),
        new("conversion", "Customers", "Inquiries that buy", "%", true, 30, false, "/intelligence?tab=inquiries", "Finished inquiries that became a sale."),
        new("response", "Customers", "Time to answer an inquiry", "hours", false, 2, false, "/inquiries", "Median hours to the first reply."),
        new("collected", "Cash", "Money collected", "ksh", true, null, true, "/money-in", "Payments received in the period."),
        new("dso", "Cash", "Days to get paid", "days", false, 30, false, "/intelligence?tab=customers", "What customers owe, in days of sales (DSO)."),
        new("overdue", "Cash", "Overdue share of debts", "%", false, 15, false, "/invoices?status=overdue", "Of everything customers owe, the part past its due date."),
        new("stockDays", "Stock", "Days of stock", "days", false, 45, false, "/intelligence?tab=shelf", "Stock at cost, in days of cost of sales."),
        new("accuracy", "Stock", "Stock count accuracy", "%", true, 98, false, "/intelligence?tab=accuracy", "Counted lines that matched the system exactly."),
        new("stockouts", "Stock", "Selling items out of stock", "count", false, 0, false, "/stock?filter=out", "Items sold in the last 90 days that have none left."),
        new("payroll", "People", "Payroll cost of sales", "%", false, 20, false, "/payroll", "Gross pay plus employer NSSF, Housing Levy and NITA, as a share of sales."),
        new("etims", "Compliance", "Invoices signed by KRA", "%", true, 100, false, "/invoices", "VAT invoices in the period signed with eTIMS."),
        new("pipeline", "Customers", "Open pipeline", "ksh", true, null, false, "/pipeline", "Estimated value of leads not yet won or lost."),
    ];

    static readonly SalesDocStatus[] Issued = [SalesDocStatus.Sent, SalesDocStatus.PartPaid, SalesDocStatus.Paid];
    static DateTimeOffset Start(DateOnly d) => new(d.ToDateTime(TimeOnly.MinValue), TimeSpan.FromHours(3));
    static DateTimeOffset End(DateOnly d) => new(d.AddDays(1).ToDateTime(TimeOnly.MinValue), TimeSpan.FromHours(3));

    /// <summary>The period's dates: this month, quarter or year (offset 0), or earlier ones (offset -1, -2…).</summary>
    public static (DateOnly From, DateOnly To) Period(string period, int offset, DateOnly today)
    {
        switch (period)
        {
            case "quarter":
            {
                var q = new DateOnly(today.Year, (today.Month - 1) / 3 * 3 + 1, 1).AddMonths(3 * offset);
                return (q, q.AddMonths(3).AddDays(-1));
            }
            case "year":
            {
                var y = new DateOnly(today.Year + offset, 1, 1);
                return (y, y.AddYears(1).AddDays(-1));
            }
            default:
            {
                var m = new DateOnly(today.Year, today.Month, 1).AddMonths(offset);
                return (m, m.AddMonths(1).AddDays(-1));
            }
        }
    }

    public async Task<Dictionary<string, decimal?>> Targets()
    {
        var raw = await db.Companies.Where(c => c.Id == db.CompanyId).Select(c => c.KpiTargets).SingleAsync();
        var saved = JsonNode.Parse(string.IsNullOrWhiteSpace(raw) ? "{}" : raw) as JsonObject ?? [];
        return All.ToDictionary(k => k.Key, k => saved[k.Key] is { } v && decimal.TryParse(v.ToJsonString(), System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var t) ? t : k.DefaultTarget);
    }

    public async Task<object> SaveTargets(Dictionary<string, decimal?> input)
    {
        var clean = new JsonObject();
        foreach (var (key, value) in input)
        {
            var def = All.FirstOrDefault(k => k.Key == key) ?? throw new AppException($"No KPI called {key}.");
            if (value is null) continue;
            if (value < 0 || (def.Unit == "%" && value > 100)) throw new AppException($"{def.Name}: enter a target between 0 and {(def.Unit == "%" ? "100" : "any amount")}.");
            // Money targets are entered in shillings and kept in cents, like every other amount.
            clean[key] = def.Unit == "ksh" ? Math.Round(value.Value * 100) : value.Value;
        }
        var c = await db.Companies.SingleAsync(x => x.Id == db.CompanyId);
        c.KpiTargets = clean.ToJsonString();
        await db.SaveChangesAsync();
        return await Targets();
    }

    sealed record Facts(Dictionary<string, decimal?> Values);

    /// <summary>Every KPI's value for one period.</summary>
    async Task<Dictionary<string, decimal?>> Measure(DateOnly from, DateOnly to, bool current)
    {
        var today = Clock.Today;
        var (start, end) = (Start(from), End(to));
        var docs = await db.SalesDocs.Where(d => d.Kind == SalesDocKind.Invoice && !d.Opening && Issued.Contains(d.Status) && d.IssueDate >= from && d.IssueDate <= to)
            .Select(d => new { d.Id, d.CustomerId, d.Net, d.Total, d.EtimsStatus }).ToListAsync();
        var docIds = docs.Select(d => d.Id).ToList();
        var cost = await db.SalesLines.Where(l => docIds.Contains(l.SalesDocId)).SumAsync(l => (long?)l.Cost) ?? 0;
        var sales = docs.Sum(d => d.Net);
        var buyers = docs.GroupBy(d => d.CustomerId).ToList();
        var firstInvoice = await db.SalesDocs.Where(d => d.Kind == SalesDocKind.Invoice && !d.Opening && Issued.Contains(d.Status)).GroupBy(d => d.CustomerId).Select(g => new { g.Key, first = g.Min(d => d.IssueDate) }).ToListAsync();
        var collected = (await db.Payments.Select(p => new { p.Amount, p.ReceivedAt }).ToListAsync()).Where(p => p.ReceivedAt >= start && p.ReceivedAt < end).Sum(p => p.Amount);
        var inquiries = (await db.Inquiries.Select(i => new { i.Status, i.CreatedAt, i.FirstResponseAt }).ToListAsync()).Where(i => i.CreatedAt >= start && i.CreatedAt < end).ToList();
        var decided = inquiries.Count(i => i.Status is InquiryStatus.Won or InquiryStatus.Lost);
        var answerHours = inquiries.Where(i => i.FirstResponseAt != null).Select(i => (decimal)(i.FirstResponseAt!.Value - i.CreatedAt).TotalHours).OrderBy(h => h).ToList();
        var counts = (await db.StockCountLines.Select(l => new { l.Expected, l.Counted, l.At }).ToListAsync()).Where(l => l.At >= start && l.At < end).ToList();
        var months = Enumerable.Range(0, (to.Year - from.Year) * 12 + to.Month - from.Month + 1).Select(i => new DateOnly(from.Year, from.Month, 1).AddMonths(i)).ToList();
        var payroll = await db.PayrollRuns.Include(r => r.Payslips).Where(r => months.Contains(r.Period) && r.Status != PayrollStatus.Draft).ToListAsync();
        var payrollCost = payroll.SelectMany(r => r.Payslips).Sum(p => p.Gross + p.NssfEmployer + p.HousingLevyEmployer + p.Nita);
        var vatDocs = docs.Where(d => d.EtimsStatus != EtimsStatus.NotRequired).ToList();

        var v = new Dictionary<string, decimal?>
        {
            ["sales"] = sales,
            ["margin"] = sales == 0 ? null : Math.Round(100m * (sales - cost) / sales, 1),
            ["avgInvoice"] = docs.Count == 0 ? null : Math.Round((decimal)sales / docs.Count),
            ["newCustomers"] = firstInvoice.Count(f => f.first >= from && f.first <= to),
            ["repeat"] = buyers.Count == 0 ? null : Math.Round(100m * buyers.Count(g => g.Count() >= 2) / buyers.Count, 1),
            ["conversion"] = decided == 0 ? null : Math.Round(100m * inquiries.Count(i => i.Status == InquiryStatus.Won) / decided, 1),
            ["response"] = answerHours.Count == 0 ? null : Math.Round(answerHours[answerHours.Count / 2], 1),
            ["collected"] = collected,
            ["accuracy"] = counts.Count == 0 ? null : Math.Round(100m * counts.Count(l => l.Counted == l.Expected) / counts.Count, 1),
            ["payroll"] = sales == 0 || payroll.Count == 0 ? null : Math.Round(100m * payrollCost / sales, 1),
            ["etims"] = vatDocs.Count == 0 ? null : Math.Round(100m * vatDocs.Count(d => d.EtimsStatus == EtimsStatus.Signed) / vatDocs.Count, 1),
        };
        // Balances that only make sense "now": receivables, stock and the pipeline.
        if (current)
        {
            var open = await db.SalesDocs.Where(d => d.Kind == SalesDocKind.Invoice && (d.Status == SalesDocStatus.Sent || d.Status == SalesDocStatus.PartPaid)).Select(d => new { balance = d.Total - d.Paid, d.DueDate }).ToListAsync();
            var owed = open.Sum(o => o.balance);
            var last90 = await db.SalesDocs.Where(d => d.Kind == SalesDocKind.Invoice && !d.Opening && Issued.Contains(d.Status) && d.IssueDate > today.AddDays(-90)).SumAsync(d => (long?)d.Total) ?? 0;
            v["dso"] = last90 == 0 ? null : Math.Round(owed / (last90 / 90m), 0);
            v["overdue"] = owed == 0 ? 0 : Math.Round(100m * open.Where(o => o.DueDate < today).Sum(o => o.balance) / owed, 1);
            var items = await db.Items.Where(i => i.TrackStock && i.Active).Select(i => new { i.Id, i.AverageCost }).ToListAsync();
            var levels = await db.StockLevels.GroupBy(l => l.ItemId).Select(g => new { g.Key, q = g.Sum(x => x.Quantity) }).ToDictionaryAsync(x => x.Key, x => x.q);
            var stockValue = items.Sum(i => Math.Max(0, levels.GetValueOrDefault(i.Id)) * i.AverageCost);
            var recentIds = await db.SalesDocs.Where(d => d.Kind == SalesDocKind.Invoice && Issued.Contains(d.Status) && d.IssueDate > today.AddDays(-90)).Select(d => d.Id).ToListAsync();
            var cogs90 = await db.SalesLines.Where(l => recentIds.Contains(l.SalesDocId)).SumAsync(l => (long?)l.Cost) ?? 0;
            v["stockDays"] = cogs90 == 0 ? null : Math.Round(stockValue / (cogs90 / 90m), 0);
            var soldItems = await db.SalesLines.Where(l => l.ItemId != null && recentIds.Contains(l.SalesDocId)).Select(l => l.ItemId!.Value).Distinct().ToListAsync();
            v["stockouts"] = items.Count(i => soldItems.Contains(i.Id) && levels.GetValueOrDefault(i.Id) <= 0);
            v["pipeline"] = await db.Leads.Where(l => l.Stage != LeadStage.Won && l.Stage != LeadStage.Lost).SumAsync(l => (long?)l.EstimatedValue) ?? 0;
        }
        return v;
    }

    public async Task<object> Scorecard(string period, int offset)
    {
        period = period is "quarter" or "year" ? period : "month";
        var today = Clock.Today;
        var (from, to) = Period(period, offset, today);
        var current = offset == 0;
        var shownTo = current && to > today ? today : to;
        var now = await Measure(from, shownTo, current);
        var (pFrom, pTo) = Period(period, offset - 1, today);
        // Like for like: this month so far against the same days of last month.
        var prev = await Measure(pFrom, current ? pFrom.AddDays(shownTo.DayNumber - from.DayNumber) : pTo, false);
        var history = new List<(DateOnly From, Dictionary<string, decimal?> Values)>();
        for (var i = -5; i <= 0; i++)
        {
            var (hf, ht) = Period(period, offset + i, today);
            history.Add((hf, i == 0 ? now : await Measure(hf, ht, false)));
        }
        var targets = await Targets();
        var elapsed = Math.Clamp((decimal)(shownTo.DayNumber - from.DayNumber + 1) / (to.DayNumber - from.DayNumber + 1), 0.01m, 1m);
        var kpis = All.Select(k =>
        {
            var value = now.GetValueOrDefault(k.Key);
            // Running-total targets are monthly: a quarter needs three months' worth, a year twelve.
            var target = targets.GetValueOrDefault(k.Key) is { } raw && k.Cumulative ? raw * (period == "year" ? 12 : period == "quarter" ? 3 : 1) : targets.GetValueOrDefault(k.Key);
            // A running total (sales, money collected, new customers) is judged against the share of the period gone.
            var due = target is { } t && k.Cumulative ? Math.Round(t * elapsed) : target;
            string status = value is null || due is null ? "none"
                : k.HigherIsBetter ? (value >= due ? "met" : value >= due * 0.9m ? "close" : "behind")
                : (value <= due ? "met" : value <= (due == 0 ? 1 : due * 1.1m) ? "close" : "behind");
            var before = prev.GetValueOrDefault(k.Key);
            return new
            {
                k.Key, k.Group, k.Name, k.Unit, k.HigherIsBetter, k.Link, k.Explain, value, target, dueByNow = k.Cumulative ? due : null, status,
                previous = before, change = value is { } a && before is { } b && b != 0 ? Math.Round(100m * (a - b) / Math.Abs(b), 1) : (decimal?)null,
                projected = k.Cumulative && current && value is { } x ? Math.Round(x / elapsed) : (decimal?)null,
                trend = history.Select(h => new { from = h.From, value = h.Values.GetValueOrDefault(k.Key) }),
            };
        }).ToList();
        return new
        {
            period, offset, from, to, shownTo, elapsedShare = Math.Round(elapsed * 100, 0),
            met = kpis.Count(k => k.status == "met"), close = kpis.Count(k => k.status == "close"), behind = kpis.Count(k => k.status == "behind"), withoutTarget = kpis.Count(k => k.status == "none"),
            kpis,
        };
    }

    /// <summary>The owner's charts: twelve months of sales against target and cash in against cash out, what
    /// customers owe by age, where sales come from, the best sellers, and how inquiries turn into sales.</summary>
    public async Task<object> Charts(int monthCount = 12)
    {
        monthCount = Math.Clamp(monthCount, 3, 24);
        var today = Clock.Today;
        var first = new DateOnly(today.Year, today.Month, 1).AddMonths(1 - monthCount);
        var months = Enumerable.Range(0, monthCount).Select(i => first.AddMonths(i)).ToList();
        var (start, end) = (Start(first), End(today));
        var docs = await db.SalesDocs.Where(d => d.Kind == SalesDocKind.Invoice && !d.Opening && Issued.Contains(d.Status) && d.IssueDate >= first && d.IssueDate <= today)
            .Select(d => new { d.Id, d.IssueDate, d.Net, d.Total, d.Channel, d.CustomerId }).ToListAsync();
        var docIds = docs.Select(d => d.Id).ToList();
        var lines = await db.SalesLines.Where(l => docIds.Contains(l.SalesDocId)).Select(l => new { l.SalesDocId, l.ItemId, l.Description, l.Net, l.Cost, l.Quantity }).ToListAsync();
        var costByDoc = lines.GroupBy(l => l.SalesDocId).ToDictionary(g => g.Key, g => g.Sum(l => l.Cost));
        var paymentsIn = (await db.Payments.Select(p => new { p.Amount, p.ReceivedAt }).ToListAsync()).Where(p => p.ReceivedAt >= start && p.ReceivedAt < end).ToList();
        var toSuppliers = (await db.SupplierPayments.Select(p => new { p.Amount, p.PaidAt }).ToListAsync()).Where(p => p.PaidAt >= start && p.PaidAt < end).ToList();
        var payroll = await db.PayrollRuns.Include(r => r.Payslips).Where(r => r.PaidAt != null).ToListAsync();
        var toStaff = payroll.Where(r => r.PaidAt >= start && r.PaidAt < end).Select(r => new { r.PaidAt, amount = r.Payslips.Sum(p => p.Net) }).ToList();
        DateOnly Month(DateTimeOffset at) { var d = DateOnly.FromDateTime(at.ToOffset(TimeSpan.FromHours(3)).DateTime); return new(d.Year, d.Month, 1); }
        var target = (await Targets()).GetValueOrDefault("sales");

        var monthly = months.Select(m =>
        {
            var inMonth = docs.Where(d => d.IssueDate.Year == m.Year && d.IssueDate.Month == m.Month).ToList();
            var sales = inMonth.Sum(d => d.Net);
            var cost = inMonth.Sum(d => costByDoc.GetValueOrDefault(d.Id));
            return new
            {
                month = m, sales, target, invoices = inMonth.Count,
                grossProfit = sales - cost,
                moneyIn = paymentsIn.Where(p => Month(p.ReceivedAt) == m).Sum(p => p.Amount),
                moneyOut = toSuppliers.Where(p => Month(p.PaidAt) == m).Sum(p => p.Amount) + toStaff.Where(p => Month(p.PaidAt!.Value) == m).Sum(p => p.amount),
            };
        }).ToList();

        // What customers owe, by how late it is.
        var open = await db.SalesDocs.Where(d => d.Kind == SalesDocKind.Invoice && (d.Status == SalesDocStatus.Sent || d.Status == SalesDocStatus.PartPaid)).Select(d => new { balance = d.Total - d.Paid, d.DueDate }).ToListAsync();
        (string Label, int Min, int Max)[] buckets = [("Not yet due", int.MinValue, 0), ("1–30 days late", 1, 30), ("31–60 days late", 31, 60), ("61–90 days late", 61, 90), ("Over 90 days late", 91, int.MaxValue)];
        var ageing = buckets.Select(b =>
        {
            var inBucket = open.Where(o => { var late = today.DayNumber - o.DueDate.DayNumber; return late >= b.Min && late <= b.Max; }).ToList();
            return new { bucket = b.Label, amount = inBucket.Sum(o => o.balance), invoices = inBucket.Count };
        }).ToList();

        // Where the last 90 days of sales came from: the invoice's channel, else how the customer first found us.
        var since = today.AddDays(-89);
        var recent = docs.Where(d => d.IssueDate >= since).ToList();
        var acquired = await db.Customers.ToDictionaryAsync(c => c.Id, c => c.AcquisitionChannel);
        var channels = recent.GroupBy(d => (d.Channel ?? acquired.GetValueOrDefault(d.CustomerId))?.ToString() ?? "Direct / unknown")
            .Select(g => new { channel = g.Key, sales = g.Sum(d => d.Net), invoices = g.Count() }).OrderByDescending(x => x.sales).ToList();
        var recentIds = recent.Select(d => d.Id).ToHashSet();
        var products = lines.Where(l => recentIds.Contains(l.SalesDocId)).GroupBy(l => l.ItemId?.ToString() ?? l.Description)
            .Select(g => new { name = g.First().Description, sales = g.Sum(l => l.Net), grossProfit = g.Sum(l => l.Net - l.Cost), quantity = g.Sum(l => l.Quantity) })
            .OrderByDescending(x => x.sales).Take(8).ToList();

        // Inquiries from the last 90 days, step by step to a sale; visits are tracking-link clicks.
        var (s90, e90) = (Start(since), End(today));
        var visits = (await db.LinkVisits.Select(v => new { v.VisitorId, v.At }).ToListAsync()).Where(v => v.At >= s90 && v.At < e90).Select(v => v.VisitorId).Distinct().Count();
        var inquiries = (await db.Inquiries.Select(i => new { i.Status, i.CreatedAt, i.QuoteId, i.FirstResponseAt }).ToListAsync()).Where(i => i.CreatedAt >= s90 && i.CreatedAt < e90).ToList();
        var funnel = new[]
        {
            new { step = "Visited a link", count = visits },
            new { step = "Asked a question", count = inquiries.Count },
            new { step = "Got an answer", count = inquiries.Count(i => i.FirstResponseAt != null || i.Status != InquiryStatus.Open) },
            new { step = "Got a quote", count = inquiries.Count(i => i.QuoteId != null || i.Status is InquiryStatus.Quoted or InquiryStatus.Won) },
            new { step = "Bought", count = inquiries.Count(i => i.Status == InquiryStatus.Won) },
        };

        return new { from = first, to = today, salesTarget = target, monthly, ageing, owed = open.Sum(o => o.balance), channels, products, funnel };
    }
}
