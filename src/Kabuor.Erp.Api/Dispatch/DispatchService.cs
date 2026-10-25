using Kabuor.Erp.Common;
using Kabuor.Erp.Data;
using Kabuor.Erp.Domain;
using Microsoft.EntityFrameworkCore;

namespace Kabuor.Erp.Dispatch;

public sealed record DeliveryItemInput(
    Guid? SalesDocId,
    string? CustomerName,
    string? DeliveryAddress,
    string? ContactPhone
);

public sealed record CreateTripInput(
    string VehiclePlate,
    string DriverName,
    string? DriverPhone,
    string RouteName,
    string? Notes,
    List<DeliveryItemInput> Deliveries
);

public sealed record ConfirmPodInput(
    string RecipientName,
    string? PodNotes,
    DeliveryItemStatus? Status = null
);

public sealed class DispatchService(ErpDb db, Numbers numbers)
{
    public async Task<List<object>> ListTrips(string? status)
    {
        var query = db.DispatchTrips.AsQueryable();
        if (!string.IsNullOrWhiteSpace(status))
        {
            if (Enum.TryParse<DispatchStatus>(status.Trim(), true, out var parsedStatus))
                query = query.Where(t => t.Status == parsedStatus);
            else
                query = query.Where(t => false);
        }

        var trips = await query.OrderByDescending(t => t.CreatedAt)
            .Select(t => new
            {
                t.Id,
                t.TripNumber,
                t.VehiclePlate,
                t.DriverName,
                t.DriverPhone,
                t.RouteName,
                Status = t.Status.ToString(),
                t.DispatchedAt,
                t.DeliveredAt,
                t.CreatedAt,
                DeliveriesCount = t.Deliveries.Count,
                DeliveredCount = t.Deliveries.Count(d => d.Status == DeliveryItemStatus.Delivered),
                PendingCount = t.Deliveries.Count(d => d.Status == DeliveryItemStatus.Pending || d.Status == DeliveryItemStatus.Dispatched)
            })
            .ToListAsync();

        return trips.Cast<object>().ToList();
    }

    public async Task<DispatchTrip> GetTrip(Guid id)
    {
        return await db.DispatchTrips
            .Include(t => t.Deliveries)
            .SingleOrDefaultAsync(t => t.Id == id) 
            ?? throw new AppException("Dispatch trip not found.", 404);
    }

    public async Task<DispatchTrip> CreateTrip(CreateTripInput input)
    {
        var plate = (input.VehiclePlate ?? "").Trim().ToUpperInvariant();
        var driver = (input.DriverName ?? "").Trim();
        var route = (input.RouteName ?? "").Trim();

        if (plate.Length < 3) throw new AppException("Enter the vehicle number plate.");
        if (driver.Length < 2) throw new AppException("Enter the driver's name.");
        if (route.Length < 2) throw new AppException("Enter the delivery route / destination.");
        if (input.Deliveries is not { Count: > 0 }) throw new AppException("Add at least one delivery drop to the trip.");
        if (input.Deliveries.Count > 100) throw new AppException("A dispatch trip can have at most 100 delivery drops.");

        var trip = new DispatchTrip
        {
            TripNumber = await numbers.Next("TRIP"),
            VehiclePlate = plate,
            DriverName = driver,
            DriverPhone = Phones.ToMsisdn(input.DriverPhone) ?? (input.DriverPhone ?? "").Trim(),
            RouteName = route,
            Notes = (input.Notes ?? "").Trim(),
            Status = DispatchStatus.Draft
        };

        var salesDocIds = input.Deliveries.Where(d => d.SalesDocId != null).Select(d => d.SalesDocId!.Value).Distinct().ToList();
        var salesDocs = await db.SalesDocs.Include(s => s.Customer).Where(s => salesDocIds.Contains(s.Id)).ToDictionaryAsync(s => s.Id);

        foreach (var drop in input.Deliveries)
        {
            SalesDoc? doc = drop.SalesDocId is { } sid ? salesDocs.GetValueOrDefault(sid) : null;
            var custName = !string.IsNullOrWhiteSpace(drop.CustomerName) 
                ? drop.CustomerName.Trim() 
                : doc?.Customer?.Name ?? "Walk-in";
            var phone = !string.IsNullOrWhiteSpace(drop.ContactPhone)
                ? (Phones.ToMsisdn(drop.ContactPhone) ?? drop.ContactPhone.Trim())
                : doc?.Customer?.Phone ?? "";
            var address = !string.IsNullOrWhiteSpace(drop.DeliveryAddress)
                ? drop.DeliveryAddress.Trim()
                : doc?.Customer?.Address ?? route;

            var waybill = await numbers.Next("WB");
            trip.Deliveries.Add(new DeliveryItem
            {
                TripId = trip.Id,
                SalesDocId = doc?.Id,
                WaybillNumber = waybill,
                CustomerName = custName,
                DeliveryAddress = address,
                ContactPhone = phone,
                Status = DeliveryItemStatus.Pending
            });
        }

        db.DispatchTrips.Add(trip);
        await db.SaveChangesAsync();
        return trip;
    }

    public async Task<DispatchTrip> Dispatch(Guid tripId)
    {
        var trip = await GetTrip(tripId);
        if (trip.Status != DispatchStatus.Draft) throw new AppException("Only draft trips can be dispatched.");
        if (trip.Deliveries.Count == 0) throw new AppException("Trip has no deliveries assigned.");

        trip.Status = DispatchStatus.Dispatched;
        trip.DispatchedAt = DateTimeOffset.UtcNow;
        foreach (var delivery in trip.Deliveries)
        {
            if (delivery.Status == DeliveryItemStatus.Pending)
                delivery.Status = DeliveryItemStatus.Dispatched;
        }

        await db.SaveChangesAsync();
        return trip;
    }

    public async Task<DeliveryItem> ConfirmPod(Guid deliveryId, ConfirmPodInput input)
    {
        var recipient = (input.RecipientName ?? "").Trim();
        if (recipient.Length < 2) throw new AppException("Enter recipient name for Proof of Delivery (e-POD).");
        if (input.Status is DeliveryItemStatus.Pending or DeliveryItemStatus.Dispatched)
            throw new AppException("Proof of delivery status must be Delivered, PartialReturn, or Failed.");

        var delivery = await db.DeliveryItems.SingleOrDefaultAsync(d => d.Id == deliveryId)
            ?? throw new AppException("Delivery item not found.", 404);

        var trip = await db.DispatchTrips.Include(t => t.Deliveries).SingleAsync(t => t.Id == delivery.TripId);
        if (trip.Status == DispatchStatus.Draft) throw new AppException("Trip has not been dispatched yet.");
        if (trip.Status == DispatchStatus.Completed) throw new AppException("Trip is already completed.");

        delivery.RecipientName = recipient;
        delivery.PodNotes = (input.PodNotes ?? "").Trim();
        delivery.Status = input.Status ?? DeliveryItemStatus.Delivered;
        delivery.PodConfirmedAt = DateTimeOffset.UtcNow;

        // If all deliveries are resolved, mark trip as Delivered
        if (trip.Deliveries.All(d => d.Status is DeliveryItemStatus.Delivered or DeliveryItemStatus.PartialReturn or DeliveryItemStatus.Failed))
        {
            trip.Status = DispatchStatus.Delivered;
            trip.DeliveredAt = DateTimeOffset.UtcNow;
        }

        await db.SaveChangesAsync();
        return delivery;
    }

    public async Task<DispatchTrip> CompleteTrip(Guid tripId)
    {
        var trip = await GetTrip(tripId);
        if (trip.Status == DispatchStatus.Draft) throw new AppException("Trip must be dispatched before completing.");
        if (trip.Status == DispatchStatus.Completed) throw new AppException("Trip already completed.");
        trip.Status = DispatchStatus.Completed;
        trip.DeliveredAt ??= DateTimeOffset.UtcNow;
        await db.SaveChangesAsync();
        return trip;
    }
}
