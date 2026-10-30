// Kabuor Verified's API. The owner and the accountant see the proof; only the owner will share it (next step).
using Kabuor.Erp.Auth;
using Kabuor.Erp.Verified;

namespace Kabuor.Erp;

public static class VerifiedEndpoints
{
    public static void Map(WebApplication app)
    {
        var verified = app.MapGroup("/api/verified").RequireAuthorization(Policies.VerifiedView);
        verified.MapGet("/summary", (VerifiedService s, int? months) => s.Summary(months ?? 6));
    }
}
