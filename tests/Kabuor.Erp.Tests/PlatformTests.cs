// The platform console: only the emails in Platform:Admins get in; it reports health and reads across every
// business (counts and totals only), and a business owner who isn't listed is refused.
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace Kabuor.Erp.Tests;

public class PlatformTests(ErpFactory factory) : IClassFixture<ErpFactory>
{
    static async Task<JsonElement> Ok(HttpResponseMessage res)
    {
        var body = await res.Content.ReadAsStringAsync();
        Assert.True(res.IsSuccessStatusCode, $"{(int)res.StatusCode}: {body}");
        return JsonDocument.Parse(body).RootElement;
    }

    [Fact]
    public async Task Only_listed_admins_see_health_and_analytics_across_businesses()
    {
        var adminEmail = $"{Guid.NewGuid():N}@kabuor.test";
        var app = factory.WithWebHostBuilder(b => b.UseSetting("Platform:Admins", $"someone@else.test, {adminEmail.ToUpperInvariant()}"));

        async Task<HttpClient> Business(string email, string name)
        {
            var c = app.CreateClient();
            var s = await Ok(await c.PostAsJsonAsync("/api/auth/register", new { companyName = name, ownerName = "Owner Person", email, phone = "0712345678", password = "a-long-password" }));
            c.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", s.GetProperty("token").GetString());
            return c;
        }
        var shop = await Business($"{Guid.NewGuid():N}@example.com", $"Duka {Guid.NewGuid():N}");
        var soap = (await Ok(await shop.PostAsJsonAsync("/api/items", new { name = "Soap", price = 100_00, taxType = "A_Exempt" }))).GetProperty("id").GetGuid();
        var buyer = (await Ok(await shop.PostAsJsonAsync("/api/customers", new { name = "Buyer" }))).GetProperty("id").GetGuid();
        var inv = await Ok(await shop.PostAsJsonAsync("/api/sales", new { kind = "Invoice", customerId = buyer, lines = new[] { new { itemId = soap, quantity = 3 } } }));
        await Ok(await shop.PostAsync($"/api/sales/{inv.GetProperty("id")}/issue", null));

        // A business owner who isn't a platform admin.
        Assert.False((await Ok(await shop.GetAsync("/api/platform/me"))).GetProperty("allowed").GetBoolean());
        Assert.Equal(HttpStatusCode.Forbidden, (await shop.GetAsync("/api/platform/health")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await shop.GetAsync("/api/platform/analytics")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await app.CreateClient().GetAsync("/api/platform/health")).StatusCode);

        var admin = await Business(adminEmail, "Kabuor Builds");
        Assert.True((await Ok(await admin.GetAsync("/api/platform/me"))).GetProperty("allowed").GetBoolean());

        var health = await Ok(await admin.GetAsync("/api/platform/health"));
        var checks = health.GetProperty("checks").EnumerateArray().ToDictionary(c => c.GetProperty("key").GetString()!);
        Assert.Equal("good", checks["database"].GetProperty("status").GetString());
        Assert.Equal("good", checks["cache"].GetProperty("status").GetString());
        Assert.Contains("requests", checks.Keys);
        Assert.True(health.GetProperty("traffic").GetProperty("requests").GetInt64() > 0);

        var a = await Ok(await admin.GetAsync("/api/platform/analytics?days=30"));
        Assert.True(a.GetProperty("businesses").GetProperty("total").GetInt32() >= 2);
        Assert.True(a.GetProperty("businesses").GetProperty("trial").GetInt32() >= 2);
        Assert.True(a.GetProperty("users").GetProperty("signedIn7d").GetInt32() >= 0);
        Assert.True(a.GetProperty("volume").GetProperty("invoiceValue").GetInt64() >= 300_00); // the shop's invoice counts, across businesses
        Assert.Equal(30, a.GetProperty("series").GetArrayLength());
        Assert.Contains(a.GetProperty("top").EnumerateArray(), c => c.GetProperty("invoiceValue").GetInt64() >= 300_00);
    }
}
