using Kabuor.Erp.Data;
using Kabuor.Erp.Domain;
using Microsoft.EntityFrameworkCore;

namespace Kabuor.Erp.Common;

/// <summary>A problem the user can fix, shown to them as is (400 unless another status is given).</summary>
public sealed class AppException(string message, int status = 400) : Exception(message)
{
    public int Status { get; } = status;
}

public static class Clock
{
    /// <summary>Today in Kenya (EAT, UTC+3; no daylight saving).</summary>
    public static DateOnly Today => DateOnly.FromDateTime(DateTime.UtcNow.AddHours(3));
}

public sealed class Numbers(ErpDb db)
{
    /// <summary>The next number in a series for this company: Next("INV") → "INV-0001".</summary>
    public async Task<string> Next(string key)
    {
        // A series started earlier in this same save isn't in the database yet: use that one, not a second.
        var seq = db.Sequences.Local.FirstOrDefault(s => s.Key == key && s.CompanyId == db.CompanyId)
            ?? await db.Sequences.SingleOrDefaultAsync(s => s.Key == key);
        if (seq is null) db.Sequences.Add(seq = new Sequence { Key = key, CompanyId = db.CompanyId });
        var n = seq.Next++;
        return $"{key}-{n:0000}";
    }
}

public static class Phones
{
    /// <summary>0712 345 678 / +254712345678 / 712345678 → 254712345678; null if it isn't a Kenyan mobile.</summary>
    public static string? ToMsisdn(string? phone)
    {
        var digits = new string((phone ?? "").Where(char.IsDigit).ToArray());
        var local = digits.StartsWith("254") ? digits[3..] : digits.StartsWith('0') ? digits[1..] : digits;
        return local.Length == 9 && (local[0] == '7' || local[0] == '1') ? $"254{local}" : null;
    }
}

/// <summary>A page of results with the total, so lists can say "41 of 1,557".</summary>
public sealed record Page<T>(IReadOnlyList<T> Items, int Total, int Skip, int Take);

public static class Paging
{
    public static (int Skip, int Take) Of(int? skip, int? take) => (Math.Max(0, skip ?? 0), Math.Clamp(take ?? 50, 1, 200));
}

public static class Money
{
    /// <summary>"KSh 12,500" (whole shillings), for messages people read.</summary>
    public static string Ksh(long cents) => "KSh " + (cents / 100m).ToString("N0", System.Globalization.CultureInfo.InvariantCulture);
}
