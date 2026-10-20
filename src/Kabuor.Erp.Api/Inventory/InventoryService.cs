// Stock: how many of each item are where, and what they cost. Every change is a StockMove (the history) plus
// an update to StockLevel (the current count) in the same save. Cost is the moving average across all
// locations: buying at a new price blends into it; selling, losing or moving stock doesn't change it.
using Kabuor.Erp.Accounting;
using Kabuor.Erp.Common;
using Kabuor.Erp.Data;
using Kabuor.Erp.Domain;
using Microsoft.EntityFrameworkCore;

namespace Kabuor.Erp.Inventory;

public sealed record CountInput(Guid ItemId, decimal Counted);

public sealed class InventoryService(ErpDb db, Ledger ledger, RequestContext ctx)
{
    /// <summary>The main store. Every company has one; it's made on first use.</summary>
    public async Task<Location> DefaultLocation()
    {
        var loc = await db.Locations.Where(l => l.Active).OrderByDescending(l => l.IsDefault).ThenBy(l => l.Name).FirstOrDefaultAsync()
            ?? db.Locations.Local.FirstOrDefault(l => l.IsDefault);
        if (loc is not null) return loc;
        loc = new Location { Name = "Main store", IsDefault = true };
        db.Locations.Add(loc);
        return loc;
    }

    public async Task<Location> LocationOrDefault(Guid? id) =>
        id is { } lid ? await db.Locations.SingleOrDefaultAsync(l => l.Id == lid && l.Active) ?? throw new AppException("That store no longer exists.") : await DefaultLocation();

    async Task<StockLevel> Level(Guid itemId, Guid locationId)
    {
        var level = db.StockLevels.Local.FirstOrDefault(l => l.ItemId == itemId && l.LocationId == locationId)
            ?? await db.StockLevels.SingleOrDefaultAsync(l => l.ItemId == itemId && l.LocationId == locationId);
        if (level is null)
        {
            level = new StockLevel { CompanyId = db.CompanyId, ItemId = itemId, LocationId = locationId };
            db.StockLevels.Add(level);
        }
        return level;
    }

    /// <summary>Total on hand across all locations (including changes not saved yet).</summary>
    async Task<decimal> OnHand(Guid itemId)
    {
        var saved = await db.StockLevels.Where(l => l.ItemId == itemId).Select(l => new { l.LocationId, l.Quantity }).ToListAsync();
        var local = db.StockLevels.Local.Where(l => l.ItemId == itemId).ToList();
        return local.Sum(l => l.Quantity) + saved.Where(s => local.All(l => l.LocationId != s.LocationId)).Sum(s => s.Quantity);
    }

    async Task Move(Item item, Guid locationId, decimal qty, StockMoveKind kind, decimal unitCost, string sourceType, Guid? sourceId, string reference, string note = "")
    {
        var level = await Level(item.Id, locationId);
        level.Quantity += qty;
        db.StockMoves.Add(new StockMove { ItemId = item.Id, LocationId = locationId, Kind = kind, Quantity = qty, UnitCost = unitCost, SourceType = sourceType, SourceId = sourceId, Reference = reference, Note = note, Actor = ctx.Actor });
    }

    /// <summary>Stock coming in at a cost (before VAT): blends into the average cost.</summary>
    public async Task Receive(Item item, Guid locationId, decimal qty, decimal unitCost, StockMoveKind kind, string sourceType, Guid? sourceId, string reference)
    {
        var before = await OnHand(item.Id);
        item.AverageCost = before <= 0 ? unitCost : (before * item.AverageCost + qty * unitCost) / (before + qty);
        await Move(item, locationId, qty, kind, unitCost, sourceType, sourceId, reference);
    }

    /// <summary>Stock going out (sold): returns its cost at the current average, in cents.</summary>
    public async Task<long> Issue(Item item, Guid locationId, decimal qty, string sourceType, Guid? sourceId, string reference)
    {
        await Move(item, locationId, -qty, StockMoveKind.Sold, item.AverageCost, sourceType, sourceId, reference);
        return (long)Math.Round(qty * item.AverageCost, MidpointRounding.AwayFromZero);
    }

    /// <summary>Ingredients used in production: returns their cost at the current average, in cents.</summary>
    public async Task<long> Consume(Item item, Guid locationId, decimal qty, string sourceType, Guid? sourceId, string reference)
    {
        await Move(item, locationId, -qty, StockMoveKind.Consumed, item.AverageCost, sourceType, sourceId, reference);
        return (long)Math.Round(qty * item.AverageCost, MidpointRounding.AwayFromZero);
    }

    /// <summary>A bill voided: what it brought in goes back out at the price it came in at.</summary>
    public async Task Unreceive(Item item, Guid locationId, decimal qty, decimal unitCost, string sourceType, Guid? sourceId, string reference)
    {
        var before = await OnHand(item.Id);
        var after = before - qty;
        if (after > 0) item.AverageCost = Math.Max(0, (before * item.AverageCost - qty * unitCost) / after);
        await Move(item, locationId, -qty, StockMoveKind.Reversed, unitCost, sourceType, sourceId, reference);
    }

    /// <summary>Sets what was physically counted at a location; the difference is a loss or a find, posted to the books.</summary>
    public async Task<List<object>> Count(Guid? locationId, List<CountInput> counts, string note)
    {
        if (counts is not { Count: > 0 }) throw new AppException("Enter at least one count.");
        if (counts.Any(c => c.Counted < 0)) throw new AppException("Counts can't be negative.");
        var loc = await LocationOrDefault(locationId);
        var ids = counts.Select(c => c.ItemId).ToList();
        var items = await db.Items.Where(i => ids.Contains(i.Id) && i.TrackStock).ToDictionaryAsync(i => i.Id);
        var reference = $"Count {Clock.Today:d MMM}, {loc.Name}";
        var changes = new List<object>();
        long value = 0;
        var sourceId = Guid.NewGuid();
        foreach (var c in counts)
        {
            var item = items.GetValueOrDefault(c.ItemId) ?? throw new AppException("One of those items isn't tracked in stock.");
            var level = await Level(item.Id, loc.Id);
            var diff = c.Counted - level.Quantity;
            if (diff == 0) continue;
            await Move(item, loc.Id, diff, StockMoveKind.Adjusted, item.AverageCost, "Count", sourceId, reference, note);
            var v = (long)Math.Round(diff * item.AverageCost, MidpointRounding.AwayFromZero);
            value += v;
            changes.Add(new { itemId = item.Id, item.Name, difference = diff, value = v });
        }
        await ledger.PostStockAdjustment(reference, sourceId, value);
        await db.SaveChangesAsync();
        return changes;
    }

    /// <summary>Stock already on the shelf when the business starts using the system, at what it cost.</summary>
    public async Task Opening(Guid itemId, Guid? locationId, decimal qty, long unitCost)
    {
        if (qty <= 0) throw new AppException("Enter how many you have.");
        if (unitCost < 0) throw new AppException("Costs can't be negative.");
        var item = await db.Items.SingleOrDefaultAsync(i => i.Id == itemId && i.TrackStock) ?? throw new AppException("Turn on stock tracking for this item first.");
        var loc = await LocationOrDefault(locationId);
        var sourceId = Guid.NewGuid();
        await Receive(item, loc.Id, qty, unitCost, StockMoveKind.Adjusted, "Opening", sourceId, $"Opening stock, {loc.Name}");
        await ledger.PostOpeningStock($"{item.Name} at {loc.Name}", sourceId, (long)Math.Round(qty * unitCost, MidpointRounding.AwayFromZero));
        await db.SaveChangesAsync();
    }

    /// <summary>Moves stock between stores. No money changes hands, so the books don't change.</summary>
    public async Task Transfer(Guid itemId, Guid fromId, Guid toId, decimal qty, string note)
    {
        if (qty <= 0) throw new AppException("Enter how many to move.");
        if (fromId == toId) throw new AppException("Choose two different stores.");
        var item = await db.Items.SingleOrDefaultAsync(i => i.Id == itemId && i.TrackStock) ?? throw new AppException("That item isn't tracked in stock.");
        var from = await LocationOrDefault(fromId);
        var to = await LocationOrDefault(toId);
        var have = (await Level(item.Id, from.Id)).Quantity;
        if (qty > have) throw new AppException($"{from.Name} only has {have:0.##} {item.Unit} of {item.Name}.");
        var reference = $"{from.Name} → {to.Name}";
        var sourceId = Guid.NewGuid();
        await Move(item, from.Id, -qty, StockMoveKind.TransferOut, item.AverageCost, "Transfer", sourceId, reference, note);
        await Move(item, to.Id, qty, StockMoveKind.TransferIn, item.AverageCost, "Transfer", sourceId, reference, note);
        await db.SaveChangesAsync();
    }

    /// <summary>Everything in stock: per location, total, value at average cost, and whether it's running low.</summary>
    public async Task<object> Overview(string? filter, string? q)
    {
        var items = await db.Items.Where(i => i.TrackStock).OrderBy(i => i.Name).ToListAsync();
        var levels = await db.StockLevels.ToListAsync();
        var locations = await db.Locations.Where(l => l.Active).OrderByDescending(l => l.IsDefault).ThenBy(l => l.Name).Select(l => new { l.Id, l.Name, l.IsDefault }).ToListAsync();
        var rows = items.Select(i =>
        {
            var at = levels.Where(l => l.ItemId == i.Id).ToList();
            var total = at.Sum(l => l.Quantity);
            var state = total <= 0 ? "out" : total <= i.ReorderLevel ? "low" : "ok";
            return new
            {
                i.Id, i.Name, i.Sku, i.Unit, i.ReorderLevel, i.Price,
                averageCost = (long)Math.Round(i.AverageCost),
                total, value = (long)Math.Round(Math.Max(0, total) * i.AverageCost),
                state,
                byLocation = locations.ToDictionary(l => l.Id.ToString(), l => at.FirstOrDefault(x => x.LocationId == l.Id)?.Quantity ?? 0),
            };
        }).ToList();
        var counts = new { all = rows.Count, low = rows.Count(r => r.state is "low" or "out"), @out = rows.Count(r => r.state == "out") };
        var shown = rows.Where(r => filter switch { "low" => r.state is "low" or "out", "out" => r.state == "out", _ => true })
            .Where(r => string.IsNullOrWhiteSpace(q) || r.Name.Contains(q.Trim(), StringComparison.OrdinalIgnoreCase) || r.Sku.Contains(q.Trim(), StringComparison.OrdinalIgnoreCase))
            .OrderBy(r => r.state == "out" ? 0 : r.state == "low" ? 1 : 2).ThenBy(r => r.Name).ToList();
        return new { counts, locations, totalValue = rows.Sum(r => r.value), items = shown };
    }
}
