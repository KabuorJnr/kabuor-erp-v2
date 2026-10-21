// Kabuor Intelligence: insights for the owner, tracking links for salespeople and channels, the inquiries inbox,
// and the customers' own side on the internet (the shop and portal at /s/{slug}, and links at /l/{code}).
using Kabuor.Erp.Auth;
using Kabuor.Erp.Common;
using Kabuor.Erp.Crm;
using Kabuor.Erp.Data;
using Kabuor.Erp.Domain;
using Kabuor.Erp.Intelligence;
using Kabuor.Erp.Sales;
using Microsoft.EntityFrameworkCore;

namespace Kabuor.Erp;

public sealed record PortalSettingsInput(bool Enabled, string? Slug);

public static class IntelligenceEndpoints
{
    static string BaseUrl(HttpRequest r) => $"{r.Scheme}://{r.Host}";
    static DateOnly From(DateOnly? f) => f ?? Clock.Today.AddDays(-89);
    static DateOnly To(DateOnly? t) => t ?? Clock.Today;

    public static void Map(WebApplication app)
    {
        var api = app.MapGroup("/api");
        var staff = api.MapGroup("").RequireAuthorization(Policies.Read);

        // ---------- insights (the owner's questions) ----------
        var insights = staff.MapGroup("/insights").RequireAuthorization(Policies.Reports);
        insights.MapGet("/overview", (InsightsService s) => s.Overview());
        insights.MapGet("/selling", (InsightsService s, DateOnly? from, DateOnly? to) => s.Selling(From(from), To(to)));
        insights.MapGet("/shelf", (InsightsService s) => s.Shelf());
        insights.MapGet("/buy", (InsightsService s, int? lead, int? safety) => s.BuyMore(Math.Clamp(lead ?? 7, 1, 90), Math.Clamp(safety ?? 7, 0, 90)));
        insights.MapGet("/customers", (InsightsService s) => s.Customers());
        insights.MapGet("/inquiries", (InsightsService s, DateOnly? from, DateOnly? to) => s.Inquiries(From(from), To(to)));
        insights.MapGet("/channels", (InsightsService s, DateOnly? from, DateOnly? to) => s.Channels(From(from), To(to)));
        insights.MapGet("/accuracy", (InsightsService s, int? days) => s.StockAccuracy(Math.Clamp(days ?? 90, 7, 730)));
        // Profiles and journeys are for anyone who looks after customers.
        staff.MapGet("/insights/customer/{id:guid}", (Guid id, InsightsService s) => s.Customer(id)).RequireAuthorization(Policies.SalesView);
        staff.MapGet("/insights/journey/{id:guid}", (Guid id, InsightsService s) => s.Journey(id)).RequireAuthorization(Policies.SalesView);
        // The leaderboard is for the whole team to see.
        staff.MapGet("/insights/salespeople", (InsightsService s, int? year) => s.Salespeople(year ?? Clock.Today.Year));

        // ---------- tracking links ----------
        var links = staff.MapGroup("/links").RequireAuthorization(Policies.Crm);
        links.MapGet("", (LinkService s, HttpRequest r, DateOnly? from, DateOnly? to) => s.List(From(from), To(to), BaseUrl(r)));
        links.MapPost("", async (LinkInput input, LinkService s, HttpRequest r) => { var l = await s.Create(input); return Results.Created("", new { l.Id, l.Code, url = $"{BaseUrl(r)}/l/{l.Code}" }); });
        links.MapDelete("/{id:guid}", async (Guid id, LinkService s) => { await s.Deactivate(id); return Results.NoContent(); });

        // ---------- the inquiries inbox ----------
        var inbox = staff.MapGroup("/inquiries").RequireAuthorization(Policies.SalesView);
        inbox.MapGet("", (InquiryService s, string? status, bool? mine) => s.List(status, mine == true));
        inbox.MapGet("/{id:guid}", async (Guid id, InquiryService s, ErpDb db) =>
        {
            var i = await s.Get(id);
            var item = i.ItemId is { } iid ? await db.Items.Where(x => x.Id == iid).Select(x => x.Name).SingleOrDefaultAsync() : null;
            return new
            {
                i.Id, i.Number, i.Name, i.Phone, i.Email, i.Subject, channel = i.Channel.ToString(), status = i.Status.ToString(), i.AssignedUserId, i.AssignedName, i.CustomerId, i.LeadId,
                i.QuoteId, i.InvoiceId, i.LostReason, i.CreatedAt, i.FirstResponseAt, i.ClosedAt, item, lostReasons = InquiryService.LostReasons,
                messages = i.Messages.OrderBy(m => m.At).Select(m => new { m.From, m.Author, m.Text, m.At }),
            };
        });
        inbox.MapPost("", (InquiryInput input, InquiryService s) => s.Create(input)).RequireAuthorization(Policies.Sell);
        inbox.MapPost("/{id:guid}/reply", async (Guid id, ReplyInput input, InquiryService s) => { var i = await s.Reply(id, input); return new { i.Id, status = i.Status.ToString() }; }).RequireAuthorization(Policies.Sell);
        inbox.MapPost("/{id:guid}/assign", async (Guid id, AssignInput input, InquiryService s) => { var i = await s.Assign(id, input); return new { i.Id, i.AssignedName }; }).RequireAuthorization(Policies.Sell);
        inbox.MapPost("/{id:guid}/close", async (Guid id, CloseInput input, InquiryService s) => { var i = await s.Close(id, input); return new { i.Id, status = i.Status.ToString() }; }).RequireAuthorization(Policies.Sell);
        // Answering with a quote: a would-be customer becomes a customer, and a draft quote is made to finish.
        inbox.MapPost("/{id:guid}/quote", async (Guid id, InquiryService s, CrmService crm, SalesService sales, ErpDb db) =>
        {
            var i = await s.Get(id);
            if (i.QuoteId is { } existing) return new { quoteId = existing };
            var customerId = i.CustomerId ?? (i.LeadId is { } lid ? (await crm.Convert(lid)).Customer.Id : throw new AppException("This inquiry has no customer or lead to quote."));
            i.CustomerId = customerId;
            var line = i.ItemId is { } item ? new LineInput(item, null, 1, null, null) : new LineInput(null, i.Subject, 1, 0, null);
            var quote = await sales.Create(new SalesDocInput(SalesDocKind.Quote, customerId, null, 14, $"For inquiry {i.Number}", [line]));
            await s.LinkQuote(i.Id, quote.Id);
            return new { quoteId = quote.Id };
        }).RequireAuthorization(Policies.Sell);

        // ---------- the business's public shop and portal ----------
        staff.MapGet("/settings/portal", async (LinkService s, ErpDb db, HttpRequest r) =>
        {
            var c = await db.Companies.SingleAsync(x => x.Id == db.CompanyId);
            return new { c.PortalEnabled, c.Slug, url = c.Slug.Length > 0 ? $"{BaseUrl(r)}/s/{c.Slug}" : null };
        }).RequireAuthorization(Policies.Admin);
        staff.MapPut("/settings/portal", async (PortalSettingsInput input, LinkService s, ErpDb db, HttpRequest r) =>
        {
            var c = await s.EnsurePortal();
            if (!string.IsNullOrWhiteSpace(input.Slug))
            {
                var slug = new string(input.Slug.Trim().ToLowerInvariant().Where(ch => char.IsAsciiLetterOrDigit(ch) || ch == '-').ToArray()).Trim('-');
                if (slug.Length is < 3 or > 40) throw new AppException("Use 3–40 letters, numbers or dashes for the address.");
                if (slug != c.Slug && await db.Companies.IgnoreQueryFilters().AnyAsync(x => x.Slug == slug)) throw new AppException("That address is taken.", 409);
                c.Slug = slug;
            }
            c.PortalEnabled = input.Enabled;
            await db.SaveChangesAsync();
            return new { c.PortalEnabled, c.Slug, url = $"{BaseUrl(r)}/s/{c.Slug}" };
        }).RequireAuthorization(Policies.Admin);

        // A tracking link: count the visit, remember the link in the visitor's browser, open the shop.
        app.MapGet("/l/{code}", async (string code, HttpContext http, ErpDb db) =>
        {
            var link = await db.TrackingLinks.IgnoreQueryFilters().SingleOrDefaultAsync(l => l.Code == code.ToLowerInvariant() && l.Active);
            if (link is null) return Results.Redirect("/");
            var company = await db.Companies.Where(c => c.Id == link.CompanyId).Select(c => new { c.Slug, c.PortalEnabled }).SingleAsync();
            var visitor = http.Request.Cookies["kv"] is { Length: > 10 and < 64 } v ? v : Guid.NewGuid().ToString("N");
            var referrer = Uri.TryCreate(http.Request.Headers.Referer.ToString(), UriKind.Absolute, out var u) ? u.Host : "";
            var agent = http.Request.Headers.UserAgent.ToString();
            db.LinkVisits.Add(new LinkVisit { CompanyId = link.CompanyId, LinkId = link.Id, VisitorId = visitor, Referrer = referrer.Length > 120 ? referrer[..120] : referrer, Mobile = agent.Contains("Mobi", StringComparison.OrdinalIgnoreCase) });
            await db.SaveChangesAsync();
            var cookie = new CookieOptions { MaxAge = TimeSpan.FromDays(60), HttpOnly = false, SameSite = SameSiteMode.Lax, Secure = http.Request.IsHttps };
            http.Response.Cookies.Append("kv", visitor, cookie);
            http.Response.Cookies.Append("kref", link.Code, cookie);
            if (!company.PortalEnabled) return Results.Redirect("/");
            var target = link.Target == "ask" ? "?ask=1&" : Guid.TryParse(link.Target, out var item) ? $"?item={item}&" : "?";
            return Results.Redirect($"/s/{company.Slug}{target}ref={link.Code}");
        });

        var shop = api.MapGroup("/public/{slug}").RequireRateLimiting("auth").AddEndpointFilter(async (inv, next) =>
        {
            var http = inv.HttpContext;
            var slug = (http.Request.RouteValues["slug"] as string ?? "").ToLowerInvariant();
            var db = http.RequestServices.GetRequiredService<ErpDb>();
            var c = await db.Companies.Where(x => x.Slug == slug && x.PortalEnabled).Select(x => new { x.Id, x.CreatedAt, x.TrialEndsAt, x.PaidUntil }).SingleOrDefaultAsync();
            if (c is null) return Results.NotFound(new { error = "This shop isn't open online." });
            var ctx = http.RequestServices.GetRequiredService<RequestContext>();
            (ctx.CompanyId, ctx.Actor) = (c.Id, "Customer portal");
            if (http.Request.Method != "GET" && Billing.Plans.Locked(new Company { Name = "", CreatedAt = c.CreatedAt, TrialEndsAt = c.TrialEndsAt, PaidUntil = c.PaidUntil }, DateTimeOffset.UtcNow))
                return Results.Json(new { error = "This shop isn't taking orders online right now. Please call or WhatsApp them." }, statusCode: 402);
            // A signed-in customer: their token must be for this business.
            if (http.RequestServices.GetRequiredService<PortalTokens>().Read(http.Request.Headers["X-Portal-Token"]) is { } t && t.Company == c.Id) http.Items["customer"] = t.Customer;
            return await next(inv);
        });
        static Guid Customer(HttpContext h) => h.Items["customer"] is Guid g ? g : throw new AppException("Sign in with your phone number first.", 401);

        shop.MapGet("", (HttpContext h, PortalService s) => s.Shop(h.Items["customer"] as Guid?));
        shop.MapPost("/inquiries", async (InquiryInput input, PortalService s, InquiryService inquiries, HttpContext h) =>
            h.Items["customer"] is Guid cid ? await s.Ask(cid, input) : new { (await inquiries.Create(input with { CustomerId = null }, "customer")).Id });
        shop.MapPost("/auth/code", (PortalCodeInput input, PortalService s) => s.SendCode(input));
        shop.MapPost("/auth/verify", (VerifyInput input, PortalService s) => s.Verify(input));
        shop.MapGet("/me", (HttpContext h, PortalService s) => s.Account(Customer(h)));
        shop.MapPut("/me", (PortalProfileInput input, HttpContext h, PortalService s) => s.UpdateProfile(Customer(h), input));
        shop.MapPost("/orders", (PortalOrderInput input, HttpContext h, PortalService s) => s.Order(Customer(h), input));
        shop.MapPost("/inquiries/{id:guid}/messages", (Guid id, ReplyInput input, HttpContext h, PortalService s) => s.Reply(Customer(h), id, input));
        shop.MapGet("/invoices/{id:guid}", (Guid id, HttpContext h, PortalService s) => s.Invoice(Customer(h), id));
        shop.MapPost("/invoices/{id:guid}/pay", (Guid id, PortalPayInput input, HttpContext h, PortalService s) => s.Pay(Customer(h), id, input, BaseUrl(h.Request)));
    }
}
