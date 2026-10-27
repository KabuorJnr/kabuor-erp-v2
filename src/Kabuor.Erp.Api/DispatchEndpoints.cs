// Fleet and dispatch. Anyone who can see stock sees the fleet, trips and waybills; planning trips, sending them out,
// recording proof of delivery and closing trips needs the stock role (storekeepers, procurement, accountants, owners).
using Kabuor.Erp.Auth;
using Kabuor.Erp.Dispatch;

namespace Kabuor.Erp;

public static class DispatchEndpoints
{
    public static void Map(RouteGroupBuilder api)
    {
        var dispatch = api.MapGroup("/dispatch").RequireAuthorization(Policies.StockView);

        dispatch.MapGet("/trips", async (DispatchService svc, string? status) =>
            await svc.ListTrips(status));

        dispatch.MapGet("/counts", (DispatchService svc) => svc.Counts());
        dispatch.MapGet("/fleet", (DispatchService svc) => svc.Fleet());
        dispatch.MapGet("/to-deliver", (DispatchService svc) => svc.ToDeliver());

        dispatch.MapGet("/trips/{id:guid}", async (Guid id, DispatchService svc) =>
            await svc.TripDetail(id));

        dispatch.MapPost("/trips", async (CreateTripInput input, DispatchService svc) =>
            Results.Created("", await svc.CreateTrip(input)))
            .RequireAuthorization(Policies.Stock);

        dispatch.MapPost("/trips/{id:guid}/dispatch", async (Guid id, DispatchService svc) =>
            await svc.Dispatch(id))
            .RequireAuthorization(Policies.Stock);

        dispatch.MapPost("/deliveries/{deliveryId:guid}/pod", async (Guid deliveryId, ConfirmPodInput input, DispatchService svc) =>
            await svc.ConfirmPod(deliveryId, input))
            .RequireAuthorization(Policies.Stock);

        dispatch.MapPost("/trips/{id:guid}/complete", async (Guid id, DispatchService svc) =>
            await svc.CompleteTrip(id))
            .RequireAuthorization(Policies.Stock);

        dispatch.MapPost("/trips/{id:guid}/cancel", async (Guid id, DispatchService svc) =>
            await svc.CancelTrip(id))
            .RequireAuthorization(Policies.Stock);
    }
}
