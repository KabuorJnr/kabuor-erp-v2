// The platform console's API (Kabuor Builds only). /me answers everyone, so the web app knows whether to show the
// console; everything else is refused unless the signed-in user is a platform admin.
using Kabuor.Erp.Auth;
using Kabuor.Erp.Platform;

namespace Kabuor.Erp;

public static class PlatformEndpoints
{
    public static void Map(WebApplication app)
    {
        var platform = app.MapGroup("/api/platform").RequireAuthorization(Policies.Read);
        platform.MapGet("/me", async (PlatformService s) => { var (allowed, why) = await s.Access(); return new { allowed, why }; });
        var admin = platform.MapGroup("").AddEndpointFilter(async (inv, next) =>
        {
            var (allowed, why) = await inv.HttpContext.RequestServices.GetRequiredService<PlatformService>().Access();
            return allowed ? await next(inv) : Results.Json(new { error = why }, statusCode: 403);
        });
        admin.MapGet("/health", (PlatformService s) => s.Health());
        admin.MapGet("/analytics", (PlatformService s, int? days) => s.Analytics(days ?? 30));
    }
}
