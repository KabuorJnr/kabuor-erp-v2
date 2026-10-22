// The asset register's API. Anyone who can see stock can look things up and scan labels; adding, moving,
// assigning and writing things off needs the stock role.
using Kabuor.Erp.Assets;
using Kabuor.Erp.Auth;

namespace Kabuor.Erp;

public static class AssetEndpoints
{
    public static void Map(WebApplication app)
    {
        var assets = app.MapGroup("/api/assets").RequireAuthorization(Policies.StockView);
        assets.MapGet("", (AssetService s, string? q, string? status, string? category, Guid? locationId) => s.List(q, status, category, locationId));
        assets.MapGet("/{id:guid}", (Guid id, AssetService s) => s.Get(id));
        assets.MapGet("/scan", (AssetService s, string code, bool? seen) => s.Scan(code, seen == true));
        assets.MapPost("", async (AssetInput input, AssetService s) => Results.Created("", await s.Add(input))).RequireAuthorization(Policies.Stock);
        assets.MapPut("/{id:guid}", (Guid id, AssetInput input, AssetService s) => s.Update(id, input)).RequireAuthorization(Policies.Stock);
        assets.MapPost("/{id:guid}/actions", (Guid id, AssetAction input, AssetService s) => s.Act(id, input)).RequireAuthorization(Policies.Stock);
    }
}
