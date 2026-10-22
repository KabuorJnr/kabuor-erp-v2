// The asset register: add things (one or many at once, each with its own generated tag), find them by tag or
// serial number, move them, give them to someone, mark repairs and losses, and record each scan as a sighting.
using Kabuor.Erp.Common;
using Kabuor.Erp.Data;
using Kabuor.Erp.Domain;
using Microsoft.EntityFrameworkCore;

namespace Kabuor.Erp.Assets;

public sealed record AssetInput(string Name, string? Category, int? Quantity, string? SerialNumber, Guid? LocationId, Guid? EmployeeId, string? AssignedTo,
    AssetStatus? Status, AssetCondition? Condition, DateOnly? PurchaseDate, long? Cost, string? Supplier, string? Notes);

/// <summary>One change: kind = move | assign | status | condition | seen | note.</summary>
public sealed record AssetAction(string Kind, Guid? LocationId, Guid? EmployeeId, string? AssignedTo, AssetStatus? Status, AssetCondition? Condition, string? Note);

public sealed class AssetService(ErpDb db, Numbers numbers, RequestContext ctx)
{
    const int MaxAtOnce = 200;

    static string Plain(AssetStatus s) => s switch
    {
        AssetStatus.InUse => "in use", AssetStatus.InStore => "in store", AssetStatus.UnderRepair => "under repair", AssetStatus.Lost => "lost", _ => "disposed",
    };

    async Task<string> Where(Guid? locationId) => locationId is { } id ? await db.Locations.Where(l => l.Id == id).Select(l => l.Name).SingleOrDefaultAsync() ?? "" : "";

    void Log(Asset a, string kind, string text) => db.AssetEvents.Add(new AssetEvent { AssetId = a.Id, Kind = kind, Text = text, Actor = ctx.Actor });

    async Task<string> Who(Guid? employeeId, string? name)
    {
        if (employeeId is { } id)
            return await db.Employees.Where(e => e.Id == id).Select(e => e.Name).SingleOrDefaultAsync() ?? throw new AppException("That employee isn't on the list.");
        return (name ?? "").Trim();
    }

    public async Task<object> List(string? q, string? status, string? category, Guid? locationId)
    {
        var all = await db.Assets.ToListAsync();
        var locations = await db.Locations.ToDictionaryAsync(l => l.Id, l => l.Name);
        var unseenSince = DateTimeOffset.UtcNow.AddDays(-90);
        bool Match(Asset a)
        {
            if (string.IsNullOrWhiteSpace(q)) return true;
            var t = q.Trim();
            return a.Tag.Contains(t, StringComparison.OrdinalIgnoreCase) || a.Name.Contains(t, StringComparison.OrdinalIgnoreCase)
                || a.SerialNumber.Contains(t, StringComparison.OrdinalIgnoreCase) || a.AssignedTo.Contains(t, StringComparison.OrdinalIgnoreCase);
        }
        var current = all.Where(a => a.Status != AssetStatus.Disposed).ToList();
        var shown = all.Where(Match)
            .Where(a => status switch { null or "" or "all" => a.Status != AssetStatus.Disposed, "unseen" => a.Status != AssetStatus.Disposed && (a.LastSeenAt is null || a.LastSeenAt < unseenSince), _ => Enum.TryParse<AssetStatus>(status, true, out var s) && a.Status == s })
            .Where(a => string.IsNullOrEmpty(category) || a.Category == category)
            .Where(a => locationId is null || a.LocationId == locationId)
            .OrderBy(a => a.Tag).ToList();
        return new
        {
            counts = new
            {
                all = current.Count,
                inUse = current.Count(a => a.Status == AssetStatus.InUse), inStore = current.Count(a => a.Status == AssetStatus.InStore),
                underRepair = current.Count(a => a.Status == AssetStatus.UnderRepair), lost = current.Count(a => a.Status == AssetStatus.Lost),
                disposed = all.Count(a => a.Status == AssetStatus.Disposed), unseen = current.Count(a => a.LastSeenAt is null || a.LastSeenAt < unseenSince),
            },
            totalCost = current.Sum(a => a.Cost),
            categories = AssetCategories.All.Select(c => new { code = c.Code, name = c.Name, count = current.Count(a => a.Category == c.Code) }),
            items = shown.Select(a => Row(a, locations)),
        };
    }

    static object Row(Asset a, Dictionary<Guid, string> locations) => new
    {
        a.Id, a.Tag, a.Name, a.Category, categoryName = AssetCategories.Name(a.Category), a.SerialNumber, a.LocationId,
        location = a.LocationId is { } l ? locations.GetValueOrDefault(l, "") : "", a.EmployeeId, a.AssignedTo,
        status = a.Status.ToString(), condition = a.Condition.ToString(), a.PurchaseDate, a.Cost, a.Supplier, a.Notes, a.LastSeenAt, a.LastSeenBy, a.CreatedAt,
    };

    /// <summary>Adds one asset, or many identical ones (20 chairs), each with its own tag in sequence.</summary>
    public async Task<object> Add(AssetInput input)
    {
        var name = (input.Name ?? "").Trim();
        if (name.Length < 2) throw new AppException("Say what it is, e.g. \"Office chair\".");
        var category = AssetCategories.All.Any(c => c.Code == input.Category) ? input.Category! : "OTH";
        var quantity = input.Quantity ?? 1;
        if (quantity < 1 || quantity > MaxAtOnce) throw new AppException($"Add between 1 and {MaxAtOnce} at a time.");
        var serial = (input.SerialNumber ?? "").Trim();
        if (quantity > 1 && serial.Length > 0) throw new AppException("A serial number belongs to one item. Add them one at a time, or leave it empty.");
        if ((input.Cost ?? 0) < 0) throw new AppException("The cost can't be negative.");
        if (input.LocationId is { } loc && !await db.Locations.AnyAsync(l => l.Id == loc)) throw new AppException("Choose a place from the list.");
        var assigned = await Who(input.EmployeeId, input.AssignedTo);
        var place = await Where(input.LocationId);
        var added = new List<Asset>();
        for (var n = 0; n < quantity; n++)
        {
            var a = new Asset
            {
                Tag = await numbers.Next($"AST-{category}"), Name = name, Category = category, SerialNumber = serial, LocationId = input.LocationId,
                EmployeeId = input.EmployeeId, AssignedTo = assigned, Status = input.Status ?? (assigned.Length > 0 ? AssetStatus.InUse : AssetStatus.InStore),
                Condition = input.Condition ?? AssetCondition.Good, PurchaseDate = input.PurchaseDate, Cost = input.Cost ?? 0,
                Supplier = (input.Supplier ?? "").Trim(), Notes = (input.Notes ?? "").Trim(),
            };
            db.Assets.Add(a);
            Log(a, "added", $"Added{(place.Length > 0 ? $" at {place}" : "")}{(assigned.Length > 0 ? $", with {assigned}" : "")}");
            added.Add(a);
        }
        await db.SaveChangesAsync();
        var locations = await db.Locations.ToDictionaryAsync(l => l.Id, l => l.Name);
        return new { added = added.Count, items = added.Select(a => Row(a, locations)) };
    }

    public async Task<object> Update(Guid id, AssetInput input)
    {
        var a = await db.Assets.SingleOrDefaultAsync(x => x.Id == id) ?? throw new AppException("Not found.", 404);
        var name = (input.Name ?? "").Trim();
        if (name.Length < 2) throw new AppException("Say what it is.");
        if ((input.Cost ?? 0) < 0) throw new AppException("The cost can't be negative.");
        (a.Name, a.SerialNumber, a.PurchaseDate, a.Cost, a.Supplier, a.Notes) = (name, (input.SerialNumber ?? "").Trim(), input.PurchaseDate, input.Cost ?? a.Cost, (input.Supplier ?? "").Trim(), (input.Notes ?? "").Trim());
        // The category is part of the tag, so it stays as it was; moves and assignments go through actions, so they are logged.
        await db.SaveChangesAsync();
        return await Get(id);
    }

    public async Task<object> Get(Guid id)
    {
        var a = await db.Assets.SingleOrDefaultAsync(x => x.Id == id) ?? throw new AppException("Not found.", 404);
        var locations = await db.Locations.ToDictionaryAsync(l => l.Id, l => l.Name);
        var history = await db.AssetEvents.Where(e => e.AssetId == id).OrderByDescending(e => e.At).Take(100).Select(e => new { e.Kind, e.Text, e.Actor, e.At }).ToListAsync();
        return new { asset = Row(a, locations), history };
    }

    /// <summary>A scanned label: the tag itself, or the label's link (…/assets?tag=AST-FUR-0001). Scanning counts as a sighting.</summary>
    public async Task<object> Scan(string code, bool seen)
    {
        var tag = (code ?? "").Trim();
        if (Uri.TryCreate(tag, UriKind.Absolute, out var u) && System.Web.HttpUtility.ParseQueryString(u.Query)["tag"] is { Length: > 0 } fromLink) tag = fromLink;
        var a = await db.Assets.SingleOrDefaultAsync(x => x.Tag == tag.ToUpperInvariant())
            ?? await db.Assets.FirstOrDefaultAsync(x => x.SerialNumber != "" && x.SerialNumber == tag)
            ?? throw new AppException($"No asset has the tag or serial number {tag}.", 404);
        if (seen) await Act(a.Id, new AssetAction("seen", null, null, null, null, null, null));
        return await Get(a.Id);
    }

    public async Task<object> Act(Guid id, AssetAction input)
    {
        var a = await db.Assets.SingleOrDefaultAsync(x => x.Id == id) ?? throw new AppException("Not found.", 404);
        var note = (input.Note ?? "").Trim();
        switch ((input.Kind ?? "").ToLowerInvariant())
        {
            case "move":
                if (input.LocationId is not { } loc || !await db.Locations.AnyAsync(l => l.Id == loc)) throw new AppException("Choose where it went.");
                var from = await Where(a.LocationId);
                a.LocationId = loc;
                Log(a, "moved", $"Moved{(from.Length > 0 ? $" from {from}" : "")} to {await Where(loc)}");
                break;
            case "assign":
                var who = await Who(input.EmployeeId, input.AssignedTo);
                (a.EmployeeId, a.AssignedTo) = (input.EmployeeId, who);
                if (who.Length > 0 && a.Status == AssetStatus.InStore) a.Status = AssetStatus.InUse;
                Log(a, "assigned", who.Length > 0 ? $"Given to {who}" : "Returned (no one has it now)");
                break;
            case "status":
                if (input.Status is not { } st) throw new AppException("Choose the new status.");
                if (st is AssetStatus.Lost or AssetStatus.Disposed && note.Length < 3) throw new AppException("Say what happened, for the record.");
                a.Status = st;
                if (st is AssetStatus.InStore or AssetStatus.Disposed) (a.EmployeeId, a.AssignedTo) = (null, "");
                Log(a, "status", $"Marked {Plain(st)}");
                break;
            case "condition":
                if (input.Condition is not { } c) throw new AppException("Choose the condition.");
                a.Condition = c;
                Log(a, "condition", $"Condition: {c.ToString().ToLowerInvariant()}");
                break;
            case "seen":
                (a.LastSeenAt, a.LastSeenBy) = (DateTimeOffset.UtcNow, ctx.Actor);
                if (a.Status == AssetStatus.Lost) { a.Status = AssetStatus.InStore; Log(a, "status", "Found again"); }
                Log(a, "seen", "Seen (scanned)");
                break;
            case "note":
                if (note.Length == 0) throw new AppException("Write the note.");
                break;
            default:
                throw new AppException("Unknown action.");
        }
        if (note.Length > 0) Log(a, "note", note);
        await db.SaveChangesAsync();
        return await Get(id);
    }
}
