using Kabuor.Erp.Accounting;
using Kabuor.Erp.Common;
using Kabuor.Erp.Data;
using Kabuor.Erp.Domain;
using Microsoft.EntityFrameworkCore;

namespace Kabuor.Erp.Reports;

public sealed partial class ReportService(ErpDb db, RequestContext ctx)
{
    static readonly SalesDocStatus[] Open = [SalesDocStatus.Sent, SalesDocStatus.PartPaid];

    /// <summary>The home screen: what needs doing today, and how money is moving. Each number has its context.</summary>
    public async Task<object> Today()
    {
        var today = Clock.Today;
        var weekStart = today.AddDays(-6);
        var prevStart = weekStart.AddDays(-7);
        var openInv = await db.SalesDocs.Where(d => d.Kind == SalesDocKind.Invoice && Open.Contains(d.Status))
            .Select(d => new { d.Id, d.Number, Customer = d.Customer!.Name, CustomerPhone = d.Customer.Phone, d.Total, d.Paid, d.DueDate })
            .ToListAsync();
        var overdue = openInv.Where(d => d.DueDate < today).OrderBy(d => d.DueDate).ToList();
        var dueSoon = openInv.Where(d => d.DueDate >= today && d.DueDate <= today.AddDays(7)).ToList();

        var since = new DateTimeOffset(prevStart.ToDateTime(TimeOnly.MinValue), TimeSpan.FromHours(3));
        var recent = await db.Payments.Where(p => p.ReceivedAt >= since).Select(p => new { p.Amount, p.ReceivedAt, p.Method }).ToListAsync();
        long In(DateOnly from, DateOnly to) => recent.Where(p => { var d = DateOnly.FromDateTime(p.ReceivedAt.ToOffset(TimeSpan.FromHours(3)).DateTime); return d >= from && d <= to; }).Sum(p => p.Amount);

        var unmatched = await db.Payments.Where(p => p.Status != PaymentStatus.Matched)
            .Select(p => new { p.Id, p.Amount, p.Allocated, p.PayerName, p.Reference, p.ReceivedAt }).ToListAsync();
        var drafts = await db.SalesDocs.CountAsync(d => d.Kind == SalesDocKind.Invoice && d.Status == SalesDocStatus.Draft);
        var etimsProblems = await db.SalesDocs.CountAsync(d => d.EtimsStatus == EtimsStatus.Failed || d.EtimsStatus == EtimsStatus.Pending);
        var pending = await db.Proposals.CountAsync(p => p.Status == ProposalStatus.Pending);
        var openBills = new[] { PurchaseStatus.Open, PurchaseStatus.PartPaid };
        var bills = await db.PurchaseDocs.Where(d => d.Kind == PurchaseKind.Bill && openBills.Contains(d.Status))
            .Select(d => new { d.Id, d.Number, Supplier = d.Supplier!.Name, d.Total, d.Paid, d.DueDate }).ToListAsync();
        var billsDue = bills.OrderBy(b => b.DueDate).ToList();
        var tracked = await db.Items.Where(i => i.TrackStock).Select(i => new { i.Id, i.Name, i.ReorderLevel }).ToListAsync();
        var levels = await db.StockLevels.Select(l => new { l.ItemId, l.Quantity }).ToListAsync();
        var low = tracked.Select(i => new { i.Id, i.Name, onHand = levels.Where(l => l.ItemId == i.Id).Sum(l => l.Quantity), i.ReorderLevel })
            .Where(i => i.onHand <= i.ReorderLevel).OrderBy(i => i.onHand).ToList();

        var balances = await Balances();
        long Bal(string key) => balances.FirstOrDefault(b => b.SystemKey == key)?.Balance ?? 0;

        bool sales = ctx.Can(Auth.Policies.SalesView), money = ctx.Can(Auth.Policies.Finance), buy = ctx.Can(Auth.Policies.BuyView),
            stock = ctx.Can(Auth.Policies.StockView), crm = ctx.Can(Auth.Policies.Crm), people = ctx.Can(Auth.Policies.People);
        // Each section goes only to the roles that may see it; the others get null and the page leaves it out.
        return new
        {
            today,
            moneyIn = sales ? new { last7Days = In(weekStart, today), previous7Days = In(prevStart, weekStart.AddDays(-1)), todayAmount = In(today, today) } : null,
            owed = sales ? new { total = openInv.Sum(d => d.Total - d.Paid), invoices = openInv.Count } : null,
            overdue = sales ? new
            {
                total = overdue.Sum(d => d.Total - d.Paid),
                count = overdue.Count,
                top = overdue.Take(5).Select(d => new { d.Id, d.Number, d.Customer, d.CustomerPhone, balance = d.Total - d.Paid, daysLate = today.DayNumber - d.DueDate.DayNumber }),
            } : null,
            dueThisWeek = sales ? new { total = dueSoon.Sum(d => d.Total - d.Paid), count = dueSoon.Count } : null,
            toMatch = sales ? new { total = unmatched.Sum(p => p.Amount - p.Allocated), count = unmatched.Count } : null,
            cash = money ? new { mpesa = Bal(SystemAccounts.Mpesa), bank = Bal(SystemAccounts.Bank), cash = Bal(SystemAccounts.Cash) } : null,
            vatOwed = money ? -Bal(SystemAccounts.VatOutput) : 0,
            drafts = sales ? drafts : 0,
            etimsProblems = sales ? etimsProblems : 0,
            weOwe = money ? new { total = bills.Sum(b => b.Total - b.Paid), count = bills.Count } : null,
            billsDue = money ? new
            {
                total = billsDue.Sum(b => b.Total - b.Paid),
                count = billsDue.Count,
                overdue = billsDue.Count(b => b.DueDate < today),
                top = billsDue.Take(5).Select(b => new { b.Id, b.Number, b.Supplier, balance = b.Total - b.Paid, b.DueDate }),
            } : null,
            lowStock = stock ? new { count = low.Count, top = low.Take(5) } : null,
            people = people ? await PeopleToday(today) : null,
            cues = new
            {
                quotesOpen = sales ? await db.SalesDocs.CountAsync(d => d.Kind == SalesDocKind.Quote && d.Status == SalesDocStatus.Sent) : (int?)null,
                openLeads = crm ? await db.Leads.CountAsync(l => l.Stage != LeadStage.Won && l.Stage != LeadStage.Lost) : (int?)null,
                productionPlanned = ctx.Can(Auth.Policies.Make) ? await db.ProductionRuns.CountAsync(r => r.Status == ProductionStatus.Planned) : (int?)null,
                ordersToReceive = buy ? await db.PurchaseDocs.CountAsync(d => d.Kind == PurchaseKind.Order && d.Status == PurchaseStatus.Sent) : (int?)null,
                draftPayroll = people ? await db.PayrollRuns.CountAsync(r => r.Status == PayrollStatus.Draft) : (int?)null,
            },
            headline = sales ? await Headline(today) : null,
            followUps = crm ? new
            {
                due = await db.Activities.CountAsync(x => x.FollowUpOn != null && !x.FollowUpDone && x.FollowUpOn <= today),
                overdue = await db.Activities.CountAsync(x => x.FollowUpOn != null && !x.FollowUpDone && x.FollowUpOn < today),
            } : null,
            proposals = pending,
            agentTasks = await AgentTasksFor(),
        };
    }

    /// <summary>Agent tasks waiting for a decision this person is allowed to make.</summary>
    async Task<int> AgentTasksFor()
    {
        var keys = Agents.AgentService.All.Where(a => ctx.Can(a.Policy)).Select(a => a.Key).ToList();
        return await db.AgentTasks.CountAsync(t => t.Status == AgentTaskStatus.NeedsReview && keys.Contains(t.AgentKey));
    }

    /// <summary>One sentence about how the business is doing, worked out from its own numbers.</summary>
    async Task<string> Headline(DateOnly today)
    {
        var monthStart = new DateOnly(today.Year, today.Month, 1);
        var lastStart = monthStart.AddMonths(-1);
        var lastSameDay = lastStart.AddDays(Math.Min(today.Day, DateTime.DaysInMonth(lastStart.Year, lastStart.Month)) - 1);
        var sales = await db.SalesDocs.Where(d => d.Kind == SalesDocKind.Invoice && !d.Opening && d.Status != SalesDocStatus.Draft && d.Status != SalesDocStatus.Void && d.IssueDate >= lastStart)
            .Select(d => new { d.IssueDate, d.Net }).ToListAsync();
        long now = sales.Where(x => x.IssueDate >= monthStart).Sum(x => x.Net), before = sales.Where(x => x.IssueDate <= lastSameDay && x.IssueDate < monthStart).Sum(x => x.Net);
        var best = await db.SalesLines.Join(db.SalesDocs, l => l.SalesDocId, d => d.Id, (l, d) => new { l, d })
            .Where(x => x.d.Kind == SalesDocKind.Invoice && x.d.Status != SalesDocStatus.Draft && x.d.Status != SalesDocStatus.Void && x.d.IssueDate >= monthStart)
            .GroupBy(x => x.l.Description).Select(g => new { name = g.Key, total = g.Sum(x => x.l.Net) }).ToListAsync();
        var top = best.MaxBy(b => b.total);
        string K(long c) => $"KSh {c / 100m:N0}";
        if (now == 0 && before == 0) return "No sales invoiced yet this month. Your first invoice will start the numbers here.";
        var trend = before == 0 ? $"Sales this month: {K(now)}." :
            now >= before ? $"Sales are up {Math.Round(100m * (now - before) / before)}% on the same days last month ({K(now)})." :
            $"Sales are down {Math.Round(100m * (before - now) / before)}% on the same days last month ({K(now)} vs {K(before)}).";
        return top is null ? trend : $"{trend} Best seller: {top.name}.";
    }

    /// <summary>For people who handle HR: leave waiting for a decision, who's away, and statutory payments due.</summary>
    async Task<object> PeopleToday(DateOnly today)
    {
        var pendingLeave = await db.LeaveRequests.CountAsync(l => l.Status == LeaveStatus.Pending);
        var away = await db.LeaveRequests.Where(l => l.Status == LeaveStatus.Approved && l.From <= today && l.To >= today).Select(l => new { l.Employee!.Name, l.Type, l.To }).ToListAsync();
        // Statutory payments for approved payrolls not yet recorded as paid; due by the 9th of the next month.
        var runs = await db.PayrollRuns.Include(r => r.Payslips).Where(r => r.Status != PayrollStatus.Draft).OrderByDescending(r => r.Period).Take(6).ToListAsync();
        var due = runs.SelectMany(r => Payroll.PeopleService.RemitKinds
                .Where(k => !r.Remitted.Split(',').Contains(k))
                .Select(k => new { period = r.Period, kind = k, amount = Payroll.PeopleService.Owed(r, k), dueDate = r.Period.AddMonths(1).AddDays(8) }))
            .Where(x => x.amount > 0).ToList();
        var unpaidNet = runs.Where(r => r.Status == PayrollStatus.Approved).Sum(r => r.Payslips.Sum(p => p.Net));
        return new
        {
            pendingLeave,
            away,
            statutoryDue = new { total = due.Sum(d => d.amount), soonest = due.MinBy(d => d.dueDate)?.dueDate, items = due },
            salariesToPay = unpaidNet,
        };
    }

    public sealed record AccountBalance(Guid Id, string Code, string Name, AccountType Type, string? SystemKey, long Debit, long Credit)
    {
        /// <summary>Debit-positive balance (assets, expenses positive; liabilities, income negative).</summary>
        public long Balance => Debit - Credit;
    }

    public async Task<List<AccountBalance>> Balances(DateOnly? from = null, DateOnly? to = null)
    {
        var lines = db.JournalLines.Join(db.JournalEntries, l => l.JournalEntryId, e => e.Id, (l, e) => new { l, e.Date });
        if (from is { } f) lines = lines.Where(x => x.Date >= f);
        if (to is { } t) lines = lines.Where(x => x.Date <= t);
        var sums = await lines.GroupBy(x => x.l.AccountId).Select(g => new { g.Key, Debit = g.Sum(x => x.l.Debit), Credit = g.Sum(x => x.l.Credit) }).ToListAsync();
        var accounts = await db.Accounts.OrderBy(a => a.Code).ToListAsync();
        return accounts.Select(a =>
        {
            var s = sums.FirstOrDefault(x => x.Key == a.Id);
            return new AccountBalance(a.Id, a.Code, a.Name, a.Type, a.SystemKey, s?.Debit ?? 0, s?.Credit ?? 0);
        }).ToList();
    }

    /// <summary>Trial balance: total debits equal total credits, or something is wrong.</summary>
    public async Task<object> TrialBalance(DateOnly? to)
    {
        var b = await Balances(null, to);
        return new { to, accounts = b.Where(x => x.Debit != 0 || x.Credit != 0), debit = b.Sum(x => x.Debit), credit = b.Sum(x => x.Credit), balanced = b.Sum(x => x.Debit) == b.Sum(x => x.Credit) };
    }

    /// <summary>Profit and loss for a period, with the same-length period before for comparison.</summary>
    public async Task<object> ProfitAndLoss(DateOnly from, DateOnly to)
    {
        if (to < from) throw new AppException("The end date is before the start date.");
        var days = to.DayNumber - from.DayNumber + 1;
        async Task<object> Period(DateOnly f, DateOnly t)
        {
            var b = await Balances(f, t);
            var income = b.Where(x => x.Type == AccountType.Income && x.Balance != 0).Select(x => new { x.Code, x.Name, amount = -x.Balance }).ToList();
            var expenses = b.Where(x => x.Type == AccountType.Expense && x.Balance != 0).Select(x => new { x.Code, x.Name, amount = x.Balance }).ToList();
            var ti = income.Sum(x => x.amount);
            var te = expenses.Sum(x => x.amount);
            return new { from = f, to = t, income, expenses, totalIncome = ti, totalExpenses = te, profit = ti - te };
        }
        return new { current = await Period(from, to), previous = await Period(from.AddDays(-days), from.AddDays(-1)) };
    }

    /// <summary>Who owes what, by how late: current, 1–30, 31–60, 61–90, over 90 days.</summary>
    public async Task<object> Aging()
    {
        var today = Clock.Today;
        var open = await db.SalesDocs.Where(d => d.Kind == SalesDocKind.Invoice && Open.Contains(d.Status))
            .Select(d => new { d.CustomerId, Customer = d.Customer!.Name, d.Customer.Phone, d.Total, d.Paid, d.DueDate }).ToListAsync();
        static int Bucket(int late) => late <= 0 ? 0 : late <= 30 ? 1 : late <= 60 ? 2 : late <= 90 ? 3 : 4;
        var rows = open.GroupBy(d => new { d.CustomerId, d.Customer, d.Phone }).Select(g =>
        {
            var buckets = new long[5];
            foreach (var d in g) buckets[Bucket(today.DayNumber - d.DueDate.DayNumber)] += d.Total - d.Paid;
            return new { g.Key.CustomerId, g.Key.Customer, g.Key.Phone, buckets, total = buckets.Sum(), oldestDue = g.Min(d => d.DueDate) };
        }).OrderByDescending(r => r.buckets[4]).ThenByDescending(r => r.buckets[3]).ThenByDescending(r => r.total).ToList();
        var totals = new long[5];
        foreach (var r in rows) for (var i = 0; i < 5; i++) totals[i] += r.buckets[i];
        return new { labels = new[] { "Not yet due", "1–30 days", "31–60 days", "61–90 days", "Over 90 days" }, rows, totals, total = totals.Sum() };
    }

    /// <summary>VAT on sales for a period, by eTIMS tax type: the figures for the VAT return.</summary>
    public async Task<object> Vat(DateOnly from, DateOnly to)
    {
        var lines = await db.SalesLines.Join(db.SalesDocs, l => l.SalesDocId, d => d.Id, (l, d) => new { l, d })
            .Where(x => x.d.Kind == SalesDocKind.Invoice && !x.d.Opening && x.d.Status != SalesDocStatus.Draft && x.d.Status != SalesDocStatus.Void && x.d.IssueDate >= from && x.d.IssueDate <= to)
            .Select(x => new { x.l.TaxType, x.l.Net, x.l.Tax, x.l.Total }).ToListAsync();
        var byType = lines.GroupBy(l => l.TaxType).Select(g => new { type = g.Key.ToString(), label = Tax.Label(g.Key), net = g.Sum(x => x.Net), tax = g.Sum(x => x.Tax), total = g.Sum(x => x.Total) }).OrderBy(x => x.type);
        // VAT paid on purchases in the period: claimable only with the supplier's invoice number (and their eTIMS invoice).
        var bought = await db.PurchaseLines.Join(db.PurchaseDocs, l => l.PurchaseDocId, d => d.Id, (l, d) => new { l, d })
            .Where(x => x.d.Kind == PurchaseKind.Bill && !x.d.Opening && x.d.Status != PurchaseStatus.Draft && x.d.Status != PurchaseStatus.Void && x.d.IssueDate >= from && x.d.IssueDate <= to)
            .Select(x => new { x.l.TaxType, x.l.Net, x.l.Tax, x.l.Total, x.d.SupplierRef, x.d.Number }).ToListAsync();
        var purchases = bought.GroupBy(l => l.TaxType).Select(g => new { type = g.Key.ToString(), label = Tax.Label(g.Key), net = g.Sum(x => x.Net), tax = g.Sum(x => x.Tax), total = g.Sum(x => x.Total) }).OrderBy(x => x.type);
        var output = lines.Sum(l => l.Tax);
        var input = bought.Sum(l => l.Tax);
        var missingRefs = bought.Where(b => b.Tax > 0 && b.SupplierRef.Length == 0).Select(b => b.Number).Distinct().ToList();
        var withheld = await db.WithholdingCertificates.Where(w => w.Kind == WithholdingKind.Vat && w.Date >= from && w.Date <= to).SumAsync(w => (long?)w.Amount) ?? 0;
        return new { from, to, byType, purchases, totalTax = output, totalSales = lines.Sum(l => l.Total), inputTax = input, vatWithheld = withheld, payable = output - input - withheld, billsMissingSupplierInvoiceNo = missingRefs };
    }
}
