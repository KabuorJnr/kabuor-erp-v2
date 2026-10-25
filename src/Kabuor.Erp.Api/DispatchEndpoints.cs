using Kabuor.Erp.Auth;
using Kabuor.Erp.Dispatch;

namespace Kabuor.Erp;

public static class DispatchEndpoints
{
    public static void Map(RouteGroupBuilder api)
    {
        var dispatch = api.MapGroup("/dispatch").RequireAuthorization(Policies.Read);

        dispatch.MapGet("/trips", async (DispatchService svc, string? status) =>
            await svc.ListTrips(status));

        dispatch.MapGet("/trips/{id:guid}", async (Guid id, DispatchService svc) =>
            await svc.GetTrip(id));

        dispatch.MapPost("/trips", async (CreateTripInput input, DispatchService svc) =>
            Results.Created("", await svc.CreateTrip(input)))
            .RequireAuthorization(Policies.Stock);

        dispatch.MapPost("/trips/{id:guid}/dispatch", async (Guid id, DispatchService svc) =>
            await svc.Dispatch(id))
            .RequireAuthorization(Policies.Stock);

        dispatch.MapPost("/deliveries/{deliveryId:guid}/pod", async (Guid deliveryId, ConfirmPodInput input, DispatchService svc) =>
            await svc.ConfirmPod(deliveryId, input))
            .RequireAuthorization(Policies.Read);

        dispatch.MapPost("/trips/{id:guid}/complete", async (Guid id, DispatchService svc) =>
            await svc.CompleteTrip(id))
            .RequireAuthorization(Policies.Stock);
    }
}
