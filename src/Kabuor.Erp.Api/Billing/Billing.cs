// Plans in shillings, a 30-day free trial, and paying by M-Pesa (an STK prompt to the owner's phone).
// After the trial (and 7 days' grace) an unpaid company can still see and download everything but can't add or
// change records until it picks a plan: nobody is locked out of their own books.
// Prices are configuration (Billing:Plans:<id>:Monthly, in shillings), so they can change without a release.
// M-Pesa: with Billing:Mpesa keys set, a real STK prompt; without them, a clearly marked test payment.
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json.Nodes;
using Kabuor.Erp.Common;
using Kabuor.Erp.Data;
using Kabuor.Erp.Domain;
using Microsoft.EntityFrameworkCore;

namespace Kabuor.Erp.Billing;

public sealed record Plan(string Id, string Name, long Monthly, int Users, int Staff, string[] Includes);
public sealed record PayInput(string Plan, int Months, string Phone);

public static class Plans
{
    public const int TrialDays = 30, GraceDays = 7;

    public static List<Plan> All(IConfiguration c)
    {
        long Price(string id, long fallback) => (c.GetValue<long?>($"Billing:Plans:{id}:Monthly") ?? fallback) * 100;
        return
        [
            new("starter", "Starter", Price("starter", 1_500), 3, 5, ["Invoices, quotes and the till (POS)", "M-Pesa matching", "Stock and suppliers", "eTIMS", "3 users"]),
            new("business", "Business", Price("business", 4_500), 15, 50, ["Everything in Starter", "Payroll and staff portal (up to 50 staff)", "CRM and campaigns", "Agents and Msaidizi", "15 users"]),
            new("growth", "Growth", Price("growth", 9_500), 1000, 1000, ["Everything in Business", "Unlimited users and staff", "Several branches and stores", "Priority support on WhatsApp"]),
        ];
    }

    /// <summary>A year paid at once is charged ten months.</summary>
    public static long Amount(Plan p, int months) => months >= 12 ? p.Monthly * 10 * (months / 12) + p.Monthly * (months % 12) : p.Monthly * months;

    public static DateTimeOffset TrialEnds(Company c) => c.TrialEndsAt ?? c.CreatedAt.AddDays(TrialDays);

    /// <summary>Read-only once the trial and grace are over and nothing is paid up.</summary>
    public static bool Locked(Company c, DateTimeOffset now) =>
        !(c.PaidUntil > now) && now > TrialEnds(c).AddDays(GraceDays);
}

public sealed class BillingService(ErpDb db, IConfiguration config, IHttpClientFactory http, RequestContext ctx, ILogger<BillingService> log)
{
    async Task<Company> Company() => await db.Companies.SingleAsync(c => c.Id == db.CompanyId);

    public async Task<object> Status()
    {
        var c = await Company();
        var now = DateTimeOffset.UtcNow;
        var plans = Plans.All(config);
        var trialEnds = Plans.TrialEnds(c);
        var users = await db.Users.CountAsync(u => u.Active && u.Role != Role.Employee);
        var staff = await db.Employees.CountAsync(e => e.EndDate == null || e.EndDate >= Clock.Today);
        var current = plans.FirstOrDefault(p => p.Id == c.Plan);
        return new
        {
            plan = c.Plan, planName = current?.Name ?? "Free trial", paidUntil = c.PaidUntil, trialEnds,
            daysLeft = (int)Math.Ceiling(((c.PaidUntil > now ? c.PaidUntil!.Value : trialEnds) - now).TotalDays),
            onTrial = !(c.PaidUntil > now), locked = Plans.Locked(c, now), graceDays = Plans.GraceDays,
            users, userLimit = current?.Users ?? 1000, staff, staffLimit = current?.Staff ?? 1000,
            plans = plans.Select(p => new { p.Id, p.Name, p.Monthly, yearly = Plans.Amount(p, 12), p.Users, p.Staff, p.Includes }),
            payments = await db.BillingPayments.OrderByDescending(p => p.CreatedAt).Take(12).ToListAsync(),
            testMode = !Live,
        };
    }

    bool Live => !string.IsNullOrEmpty(config["Billing:Mpesa:ConsumerKey"]) && !string.IsNullOrEmpty(config["Billing:Mpesa:Passkey"]);

    public async Task<BillingPayment> Pay(PayInput input, string callbackBase)
    {
        var plan = Plans.All(config).FirstOrDefault(p => p.Id == input.Plan) ?? throw new AppException("Choose a plan.");
        if (input.Months is not (1 or 3 or 6 or 12)) throw new AppException("Pay for 1, 3, 6 or 12 months.");
        var phone = Phones.ToMsisdn(input.Phone) ?? throw new AppException("Enter the Safaricom number to send the M-Pesa prompt to.");
        var users = await db.Users.CountAsync(u => u.Active && u.Role != Role.Employee);
        if (users > plan.Users) throw new AppException($"You have {users} users; {plan.Name} allows {plan.Users}. Choose a bigger plan or remove users first.");
        var amount = Plans.Amount(plan, input.Months);
        var p = new BillingPayment { Plan = plan.Id, Months = input.Months, Amount = amount, Phone = phone, Test = !Live, RequestedBy = ctx.Actor };
        db.BillingPayments.Add(p);
        if (!Live)
        {
            // No M-Pesa keys on this server: a test payment, marked as such, so the flow can be tried end to end.
            await Settle(p, $"TEST{DateTime.UtcNow:HHmmss}");
            return p;
        }
        var token = await Token();
        var shortcode = config["Billing:Mpesa:Shortcode"]!;
        var stamp = DateTime.UtcNow.AddHours(3).ToString("yyyyMMddHHmmss");
        var body = new JsonObject
        {
            ["BusinessShortCode"] = shortcode,
            ["Password"] = Convert.ToBase64String(Encoding.UTF8.GetBytes(shortcode + config["Billing:Mpesa:Passkey"] + stamp)),
            ["Timestamp"] = stamp,
            ["TransactionType"] = config["Billing:Mpesa:Type"] ?? "CustomerPayBillOnline",
            ["Amount"] = amount / 100,
            ["PartyA"] = phone,
            ["PartyB"] = config["Billing:Mpesa:PartyB"] ?? shortcode,
            ["PhoneNumber"] = phone,
            ["CallBackURL"] = $"{callbackBase.TrimEnd('/')}/api/billing/mpesa/{config["Billing:Mpesa:CallbackSecret"]}",
            ["AccountReference"] = "Kabuor ERP",
            ["TransactionDesc"] = $"{plan.Name} {input.Months} month{(input.Months == 1 ? "" : "s")}",
        };
        using var req = new HttpRequestMessage(HttpMethod.Post, $"{Base}/mpesa/stkpush/v1/processrequest") { Content = JsonContent.Create(body) };
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        using var res = await http.CreateClient("daraja").SendAsync(req);
        var json = await res.Content.ReadFromJsonAsync<JsonObject>();
        if (!res.IsSuccessStatusCode || json?["ResponseCode"]?.GetValue<string>() != "0")
        {
            log.LogWarning("STK push refused: {Body}", json?.ToJsonString());
            throw new AppException("M-Pesa didn't send the prompt. Check the number and try again.", 502);
        }
        p.CheckoutId = json["CheckoutRequestID"]!.GetValue<string>();
        await db.SaveChangesAsync();
        return p;
    }

    string Base => config["Billing:Mpesa:Environment"] == "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";

    async Task<string> Token()
    {
        var basic = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{config["Billing:Mpesa:ConsumerKey"]}:{config["Billing:Mpesa:ConsumerSecret"]}"));
        using var req = new HttpRequestMessage(HttpMethod.Get, $"{Base}/oauth/v1/generate?grant_type=client_credentials");
        req.Headers.Authorization = new AuthenticationHeaderValue("Basic", basic);
        using var res = await http.CreateClient("daraja").SendAsync(req);
        var json = await res.Content.ReadFromJsonAsync<JsonObject>();
        return json?["access_token"]?.GetValue<string>() ?? throw new AppException("M-Pesa sign-in failed.", 502);
    }

    /// <summary>Paid: the plan runs from today, or from the end of what's already paid.</summary>
    async Task Settle(BillingPayment p, string receipt)
    {
        var c = await db.Companies.SingleAsync(x => x.Id == p.CompanyId || x.Id == db.CompanyId);
        var from = c.PaidUntil > DateTimeOffset.UtcNow ? c.PaidUntil!.Value : DateTimeOffset.UtcNow;
        (c.Plan, c.PaidUntil) = (p.Plan, from.AddMonths(p.Months));
        (p.Status, p.Receipt, p.PaidAt) = (BillingStatus.Paid, receipt, DateTimeOffset.UtcNow);
        await db.SaveChangesAsync();
    }

    /// <summary>Safaricom's answer to the prompt (no sign-in; the URL carries the secret).</summary>
    public async Task Callback(JsonObject body)
    {
        var cb = body["Body"]?["stkCallback"];
        var checkout = cb?["CheckoutRequestID"]?.GetValue<string>() ?? "";
        var p = await db.BillingPayments.IgnoreQueryFilters().SingleOrDefaultAsync(x => x.CheckoutId == checkout);
        if (p is null || p.Status != BillingStatus.Pending) return;
        ctx.CompanyId = p.CompanyId;
        if (cb?["ResultCode"]?.GetValue<int>() == 0)
        {
            var receipt = cb["CallbackMetadata"]?["Item"]?.AsArray().FirstOrDefault(i => i?["Name"]?.GetValue<string>() == "MpesaReceiptNumber")?["Value"]?.ToString() ?? "";
            await Settle(p, receipt);
        }
        else
        {
            (p.Status, p.Note) = (BillingStatus.Failed, cb?["ResultDesc"]?.GetValue<string>() ?? "Not paid");
            await db.SaveChangesAsync();
        }
    }
}
