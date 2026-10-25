// The platform console for Kabuor Builds: is the system healthy, and how is the business of Kabuor itself doing?
// It reads across every company, so it shows only counts and totals per business, never a business's customers,
// and only to the emails in Platform:Admins (with two-step sign-in on, outside Development).
using System.Diagnostics;
using Kabuor.Erp.Billing;
using Kabuor.Erp.Common;
using Kabuor.Erp.Data;
using Kabuor.Erp.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;

namespace Kabuor.Erp.Platform;

public sealed class PlatformService(ErpDb db, RequestContext ctx, IConfiguration config, IWebHostEnvironment env, IDistributedCache cache, RequestMetrics metrics, Heartbeat heartbeat)
{
    static readonly SalesDocStatus[] Issued = [SalesDocStatus.Sent, SalesDocStatus.PartPaid, SalesDocStatus.Paid];

    /// <summary>Platform admins: listed by email in Platform:Admins, and (outside Development) using two-step sign-in.</summary>
    public async Task<(bool Allowed, string Why)> Access()
    {
        var admins = (config["Platform:Admins"] ?? "").Split([',', ';', ' '], StringSplitOptions.RemoveEmptyEntries).Select(e => e.Trim().ToLowerInvariant()).ToHashSet();
        if (ctx.UserId is not { } id) return (false, "Sign in first.");
        var u = await db.Users.IgnoreQueryFilters().Where(x => x.Id == id).Select(x => new { x.Email, x.TwoFactorEnabled, x.Active }).SingleOrDefaultAsync();
        if (u is null || !u.Active || !admins.Contains(u.Email.ToLowerInvariant())) return (false, "This login isn't a platform admin.");
        if (!u.TwoFactorEnabled && !env.IsDevelopment()) return (false, "Turn on two-step sign-in (Security) to use the platform console.");
        return (true, "");
    }

    // ------------------------------------------------------------------ health
    sealed record Check(string Key, string Name, string Status, string Summary, object? Detail = null);

    public async Task<object> Health()
    {
        var checks = new List<Check>();

        // Database
        try
        {
            var clock = Stopwatch.StartNew();
            await db.Database.ExecuteSqlRawAsync("SELECT 1");
            var ms = Math.Round(clock.Elapsed.TotalMilliseconds, 1);
            // PostgreSQL (live) is kept by migrations; SQLite (local, tests) is built from the model directly.
            var pending = db.Database.IsNpgsql() ? (await db.Database.GetPendingMigrationsAsync()).ToList() : [];
            var provider = db.Database.IsNpgsql() ? "PostgreSQL" : "SQLite";
            long? size = null;
            try
            {
                if (db.Database.IsNpgsql()) size = await db.Database.SqlQueryRaw<long>("SELECT pg_database_size(current_database()) AS \"Value\"").SingleAsync();
                else if (db.Database.GetDbConnection().DataSource is { Length: > 0 } file && File.Exists(file)) size = new FileInfo(file).Length;
            }
            catch { /* size is a nice-to-have */ }
            var status = pending.Count > 0 ? "bad" : ms > 250 ? "warn" : "good";
            checks.Add(new("database", "Database", status,
                pending.Count > 0 ? $"{pending.Count} migration(s) not applied" : $"{provider} answering in {ms} ms",
                new { provider, latencyMs = ms, pendingMigrations = pending, sizeMb = size is { } s ? Math.Round(s / 1048576.0, 1) : (double?)null }));
        }
        catch (Exception e)
        {
            checks.Add(new("database", "Database", "bad", "Not answering: " + e.Message));
        }

        // Cache
        try
        {
            var clock = Stopwatch.StartNew();
            var key = $"platform:health:{Guid.NewGuid():N}";
            await cache.SetStringAsync(key, "ok", new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(30) });
            var back = await cache.GetStringAsync(key);
            await cache.RemoveAsync(key);
            var kind = cache.GetType().Name.Contains("Redis", StringComparison.OrdinalIgnoreCase) ? "Redis / Valkey" : "Memory (one server only)";
            var ms = Math.Round(clock.Elapsed.TotalMilliseconds, 1);
            checks.Add(new("cache", "Cache", back == "ok" ? (ms > 100 ? "warn" : "good") : "bad", back == "ok" ? $"{kind}, round trip {ms} ms" : $"{kind} didn't return what was stored", new { kind, latencyMs = ms }));
        }
        catch (Exception e)
        {
            checks.Add(new("cache", "Cache", "warn", "Cache unavailable, the app falls back to the database: " + e.Message));
        }

        // Agent scheduler
        var tickMinutes = config.GetValue("Agents:TickMinutes", 1);
        if (config.GetValue("Agents:Disabled", false)) checks.Add(new("agents", "Agent scheduler", "warn", "Switched off by configuration"));
        else if (heartbeat.AgentsTick is not { } tick) checks.Add(new("agents", "Agent scheduler", (DateTimeOffset.UtcNow - metrics.StartedAt).TotalMinutes < 2 ? "good" : "bad", "Hasn't run since the server started"));
        else
        {
            var age = DateTimeOffset.UtcNow - tick;
            var failedRecently = heartbeat.AgentsError is { } err && DateTimeOffset.UtcNow - err < TimeSpan.FromMinutes(10 * tickMinutes);
            checks.Add(new("agents", "Agent scheduler", age.TotalMinutes > 3 * tickMinutes ? "bad" : failedRecently ? "warn" : "good",
                failedRecently ? $"Last run failed: {heartbeat.AgentsErrorMessage}" : $"Last run {Math.Round(age.TotalSeconds)} s ago",
                new { lastTick = tick, lastError = heartbeat.AgentsError, heartbeat.AgentsErrorMessage }));
        }

        var day = DateTimeOffset.UtcNow.AddDays(-1);
        // M-Pesa prompts in the last day
        var stk = await db.MpesaRequests.IgnoreQueryFilters().Where(r => r.CreatedAt >= day).GroupBy(r => r.Status).Select(g => new { g.Key, n = g.Count() }).ToListAsync();
        var stkFailed = stk.Where(s => s.Key == MpesaRequestStatus.Failed).Sum(s => s.n);
        var stkAll = stk.Sum(s => s.n);
        var lastMpesa = await db.Payments.IgnoreQueryFilters().Where(p => p.Method == PaymentMethod.Mpesa).OrderByDescending(p => p.ReceivedAt).Select(p => (DateTimeOffset?)p.ReceivedAt).FirstOrDefaultAsync();
        checks.Add(new("mpesa", "M-Pesa", stkAll >= 5 && stkFailed * 2 > stkAll ? "warn" : "good",
            $"{stkAll} prompt(s) in 24 h, {stkFailed} failed" + (lastMpesa is { } lm ? $"; last payment {lm:dd MMM HH:mm}" : ""),
            new { prompts24h = stkAll, failed24h = stkFailed, lastPayment = lastMpesa }));

        // eTIMS
        var week = Clock.Today.AddDays(-7);
        var etims = await db.SalesDocs.IgnoreQueryFilters().Where(d => d.Kind == SalesDocKind.Invoice && d.IssueDate >= week && d.EtimsStatus != EtimsStatus.NotRequired)
            .GroupBy(d => d.EtimsStatus).Select(g => new { g.Key, n = g.Count() }).ToListAsync();
        var etimsFailed = etims.Where(e => e.Key == EtimsStatus.Failed).Sum(e => e.n);
        var etimsPending = etims.Where(e => e.Key == EtimsStatus.Pending).Sum(e => e.n);
        checks.Add(new("etims", "KRA eTIMS", etimsFailed > 0 ? "warn" : "good",
            $"{etims.Where(e => e.Key == EtimsStatus.Signed).Sum(e => e.n)} signed in 7 days, {etimsPending} waiting, {etimsFailed} failed",
            new { signed7d = etims.Where(e => e.Key == EtimsStatus.Signed).Sum(e => e.n), pending = etimsPending, failed = etimsFailed }));

        // Webhooks
        var hooks = await db.WebhookDeliveries.IgnoreQueryFilters().Where(d => d.CreatedAt >= day).GroupBy(d => d.Status).Select(g => new { g.Key, n = g.Count() }).ToListAsync();
        var hooksFailed = hooks.Where(h => h.Key == Kabuor.Erp.Integrations.DeliveryStatus.Failed).Sum(h => h.n);
        checks.Add(new("webhooks", "Webhooks", hooksFailed > 0 ? "warn" : "good", $"{hooks.Sum(h => h.n)} sent in 24 h, {hooksFailed} gave up",
            new { sent24h = hooks.Sum(h => h.n), failed24h = hooksFailed }));

        // Subscription payments stuck waiting
        var stuckSince = DateTimeOffset.UtcNow.AddMinutes(-15);
        var stuck = await db.BillingPayments.IgnoreQueryFilters().CountAsync(p => p.Status == BillingStatus.Pending && p.CreatedAt < stuckSince && p.CreatedAt > day);
        checks.Add(new("billing", "Subscription payments", stuck > 0 ? "warn" : "good", stuck > 0 ? $"{stuck} payment(s) waiting over 15 minutes" : "None stuck"));

        // Requests
        dynamic traffic = metrics.Snapshot();
        double errorRate = traffic.errorRate;
        checks.Add(new("requests", "Requests (last hour)", errorRate >= 5 ? "bad" : errorRate >= 1 || (double)traffic.p95 > 1000 ? "warn" : "good",
            $"{traffic.requests} requests, {errorRate}% server errors, 95% under {traffic.p95} ms"));

        var process = Process.GetCurrentProcess();
        var configured = new
        {
            sentry = !string.IsNullOrWhiteSpace(config["Sentry:Dsn"]), ai = !string.IsNullOrWhiteSpace(config["Anthropic:ApiKey"]),
            sms = !string.IsNullOrWhiteSpace(config["AfricasTalking:ApiKey"]), billing = !string.IsNullOrWhiteSpace(config["Billing:Mpesa:ConsumerKey"]),
            redis = !string.IsNullOrWhiteSpace(config["REDIS_URL"] ?? config["VALKEY_URL"] ?? config.GetConnectionString("Redis")),
            legalEmail = !string.IsNullOrWhiteSpace(config["Legal:Email"]),
        };
        var order = new[] { "good", "warn", "bad" };
        return new
        {
            status = checks.Select(c => Array.IndexOf(order, c.Status)).DefaultIfEmpty(0).Max() switch { 2 => "bad", 1 => "warn", _ => "good" },
            checkedAt = DateTimeOffset.UtcNow,
            server = new
            {
                environment = env.EnvironmentName, version = (config["RENDER_GIT_COMMIT"] ?? config["RAILWAY_GIT_COMMIT_SHA"] ?? "local") is var v && v.Length > 7 ? v[..7] : config["RENDER_GIT_COMMIT"] ?? "local",
                startedAt = metrics.StartedAt, uptimeHours = Math.Round((DateTimeOffset.UtcNow - metrics.StartedAt).TotalHours, 1),
                memoryMb = Math.Round(process.WorkingSet64 / 1048576.0), heapMb = Math.Round(GC.GetTotalMemory(false) / 1048576.0), threads = process.Threads.Count,
                dotnet = Environment.Version.ToString(), os = System.Runtime.InteropServices.RuntimeInformation.OSDescription,
            },
            configured, checks, traffic,
        };
    }

    // ------------------------------------------------------------------ analytics
    public async Task<object> Analytics(int days)
    {
        days = Math.Clamp(days, 7, 365);
        var now = DateTimeOffset.UtcNow;
        var from = now.AddDays(-days);
        var prevFrom = from.AddDays(-days);
        var fromDate = Clock.Today.AddDays(1 - days);
        var plans = Plans.All(config).ToDictionary(p => p.Id, p => p);

        var companies = await db.Companies.Select(c => new { c.Id, c.Name, c.Plan, c.TrialEndsAt, c.PaidUntil, c.CreatedAt, c.County }).ToListAsync();
        string State(DateTimeOffset? paidUntil, DateTimeOffset? trialEnds, DateTimeOffset created) =>
            paidUntil > now ? "paying" : now <= (trialEnds ?? created.AddDays(Plans.TrialDays)) ? "trial" : now <= (trialEnds ?? created.AddDays(Plans.TrialDays)).AddDays(Plans.GraceDays) ? "grace" : "locked";
        var states = companies.Select(c => new { c.Id, state = State(c.PaidUntil, c.TrialEndsAt, c.CreatedAt), c.Plan }).ToList();
        var paying = states.Where(s => s.state == "paying").ToList();
        var mrr = paying.Sum(s => plans.TryGetValue(s.Plan, out var p) ? p.Monthly : 0);

        var users = await db.Users.IgnoreQueryFilters().Where(u => u.Active).Select(u => new { u.CompanyId, u.LastSignInAt, u.Role }).ToListAsync();
        var docs = await db.SalesDocs.IgnoreQueryFilters().Where(d => d.Kind == SalesDocKind.Invoice && !d.Opening && Issued.Contains(d.Status) && d.IssueDate >= DateOnly.FromDateTime(prevFrom.UtcDateTime))
            .Select(d => new { d.CompanyId, d.IssueDate, d.Total }).ToListAsync();
        var payments = (await db.Payments.IgnoreQueryFilters().Select(p => new { p.CompanyId, p.ReceivedAt, p.Amount }).ToListAsync()).Where(p => p.ReceivedAt >= prevFrom).ToList();
        var revenue = (await db.BillingPayments.IgnoreQueryFilters().Where(p => p.Status == BillingStatus.Paid && !p.Test).Select(p => new { p.Amount, p.PaidAt }).ToListAsync())
            .Where(p => p.PaidAt >= from).Sum(p => p.Amount);
        var inquiries = (await db.Inquiries.IgnoreQueryFilters().Select(i => i.CreatedAt).ToListAsync()).Count(t => t >= from);
        var assets = await db.Assets.IgnoreQueryFilters().CountAsync();
        var agentTasks = (await db.AgentTasks.IgnoreQueryFilters().Select(t => t.CreatedAt).ToListAsync()).Count(t => t >= from);

        var periodDocs = docs.Where(d => d.IssueDate >= fromDate).ToList();
        var prevDocs = docs.Where(d => d.IssueDate < fromDate).ToList();
        var periodPayments = payments.Where(p => p.ReceivedAt >= from).ToList();
        var prevPayments = payments.Where(p => p.ReceivedAt < from).ToList();
        var activeSince7 = now.AddDays(-7);
        var active7 = docs.Where(d => d.IssueDate >= Clock.Today.AddDays(-6)).Select(d => d.CompanyId)
            .Concat(payments.Where(p => p.ReceivedAt >= activeSince7).Select(p => p.CompanyId))
            .Concat(users.Where(u => u.LastSignInAt >= activeSince7).Select(u => u.CompanyId)).ToHashSet();
        var active30 = periodDocs.Select(d => d.CompanyId).Concat(periodPayments.Select(p => p.CompanyId)).Concat(users.Where(u => u.LastSignInAt >= from).Select(u => u.CompanyId)).ToHashSet();
        static decimal? Change(decimal now, decimal before) => before == 0 ? null : Math.Round(100m * (now - before) / before, 1);

        var dates = Enumerable.Range(0, days).Select(i => fromDate.AddDays(i)).ToList();
        var signupsByDay = companies.GroupBy(c => DateOnly.FromDateTime(c.CreatedAt.ToOffset(TimeSpan.FromHours(3)).DateTime)).ToDictionary(g => g.Key, g => g.Count());
        var invoicesByDay = periodDocs.GroupBy(d => d.IssueDate).ToDictionary(g => g.Key, g => g.Sum(d => d.Total));
        var paymentsByDay = periodPayments.GroupBy(p => DateOnly.FromDateTime(p.ReceivedAt.ToOffset(TimeSpan.FromHours(3)).DateTime)).ToDictionary(g => g.Key, g => g.Sum(p => p.Amount));
        var lastActivity = docs.GroupBy(d => d.CompanyId).ToDictionary(g => g.Key, g => g.Max(d => d.IssueDate));
        var signIns = users.GroupBy(u => u.CompanyId).ToDictionary(g => g.Key, g => g.Max(u => u.LastSignInAt));

        return new
        {
            days, from, to = now,
            businesses = new
            {
                total = companies.Count, newInPeriod = companies.Count(c => c.CreatedAt >= from), newBefore = companies.Count(c => c.CreatedAt >= prevFrom && c.CreatedAt < from),
                active7d = active7.Count, activeInPeriod = active30.Count,
                trial = states.Count(s => s.state == "trial"), paying = paying.Count, grace = states.Count(s => s.state == "grace"), locked = states.Count(s => s.state == "locked"),
                byPlan = plans.Values.Select(p => new { p.Id, p.Name, businesses = paying.Count(s => s.Plan == p.Id), monthly = p.Monthly, mrr = paying.Count(s => s.Plan == p.Id) * p.Monthly }),
            },
            revenue = new { mrr, arr = mrr * 12, collectedInPeriod = revenue },
            users = new { total = users.Count, signedIn7d = users.Count(u => u.LastSignInAt >= activeSince7), signedInPeriod = users.Count(u => u.LastSignInAt >= from) },
            volume = new
            {
                invoices = periodDocs.Count, invoiceValue = periodDocs.Sum(d => d.Total), invoiceValueChange = Change(periodDocs.Sum(d => d.Total), prevDocs.Sum(d => d.Total)),
                payments = periodPayments.Count, paymentValue = periodPayments.Sum(p => p.Amount), paymentValueChange = Change(periodPayments.Sum(p => p.Amount), prevPayments.Sum(p => p.Amount)),
                inquiries, agentTasks, assets,
            },
            series = dates.Select(d => new { day = d, signups = signupsByDay.GetValueOrDefault(d), invoiceValue = invoicesByDay.GetValueOrDefault(d), paymentValue = paymentsByDay.GetValueOrDefault(d) }),
            top = companies.Select(c => new
            {
                c.Id, c.Name, c.County, c.CreatedAt, state = State(c.PaidUntil, c.TrialEndsAt, c.CreatedAt), plan = c.Plan,
                users = users.Count(u => u.CompanyId == c.Id),
                invoices = periodDocs.Count(d => d.CompanyId == c.Id), invoiceValue = periodDocs.Where(d => d.CompanyId == c.Id).Sum(d => d.Total),
                lastInvoice = lastActivity.TryGetValue(c.Id, out var li) ? li : (DateOnly?)null, lastSignIn = signIns.GetValueOrDefault(c.Id),
            }).OrderByDescending(c => c.invoiceValue).ThenByDescending(c => c.lastSignIn).Take(50),
        };
    }
}
