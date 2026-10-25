// What the running server knows about itself, kept in memory since it started: requests per minute for the last two
// hours, latency, errors, the slowest routes, and when the agent scheduler last ran. Lost on restart, by design:
// long-term history belongs in Sentry and the hosting provider's logs.
using System.Collections.Concurrent;
using System.Diagnostics;

namespace Kabuor.Erp.Platform;

public sealed class RequestMetrics
{
    sealed class Minute
    {
        public long Requests, Errors5xx, Errors4xx, TotalMs;
    }

    sealed class Route
    {
        public long Requests, Errors5xx, TotalMs, MaxMs;
    }

    public DateTimeOffset StartedAt { get; } = DateTimeOffset.UtcNow;
    readonly ConcurrentDictionary<long, Minute> minutes = new();
    readonly ConcurrentDictionary<string, Route> routes = new();
    readonly double[] recent = new double[4096];
    long recentCount;

    public void Record(string route, int status, double ms)
    {
        var minute = minutes.GetOrAdd(DateTimeOffset.UtcNow.ToUnixTimeSeconds() / 60, _ => new Minute());
        Interlocked.Increment(ref minute.Requests);
        Interlocked.Add(ref minute.TotalMs, (long)ms);
        if (status >= 500) Interlocked.Increment(ref minute.Errors5xx);
        else if (status >= 400) Interlocked.Increment(ref minute.Errors4xx);
        var r = routes.GetOrAdd(route, _ => new Route());
        Interlocked.Increment(ref r.Requests);
        Interlocked.Add(ref r.TotalMs, (long)ms);
        if (status >= 500) Interlocked.Increment(ref r.Errors5xx);
        long max;
        while ((max = Interlocked.Read(ref r.MaxMs)) < ms && Interlocked.CompareExchange(ref r.MaxMs, (long)ms, max) != max) { }
        recent[Interlocked.Increment(ref recentCount) % recent.Length] = ms;
        // Keep two hours of minutes.
        var cutoff = DateTimeOffset.UtcNow.ToUnixTimeSeconds() / 60 - 120;
        if (minutes.Count > 130) foreach (var k in minutes.Keys.Where(k => k < cutoff)) minutes.TryRemove(k, out _);
    }

    public object Snapshot(int lastMinutes = 60)
    {
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds() / 60;
        var series = Enumerable.Range(0, lastMinutes).Select(i => now - lastMinutes + 1 + i).Select(k =>
        {
            minutes.TryGetValue(k, out var m);
            return new { at = DateTimeOffset.FromUnixTimeSeconds(k * 60), requests = m?.Requests ?? 0, errors = m?.Errors5xx ?? 0, rejected = m?.Errors4xx ?? 0, avgMs = m is { Requests: > 0 } ? m.TotalMs / m.Requests : 0 };
        }).ToList();
        var n = (int)Math.Min(Interlocked.Read(ref recentCount), recent.Length);
        var sample = recent.Take(n).Where(x => x > 0).OrderBy(x => x).ToArray();
        double P(double p) => sample.Length == 0 ? 0 : Math.Round(sample[Math.Min(sample.Length - 1, (int)(p * sample.Length))], 1);
        var total = series.Sum(s => s.requests);
        var errors = series.Sum(s => s.errors);
        return new
        {
            series, requests = total, errors, rejected = series.Sum(s => s.rejected),
            errorRate = total == 0 ? 0 : Math.Round(100.0 * errors / total, 2),
            p50 = P(0.5), p95 = P(0.95), p99 = P(0.99),
            slowest = routes.Where(r => r.Value.Requests >= 3).OrderByDescending(r => (double)r.Value.TotalMs / r.Value.Requests).Take(8)
                .Select(r => new { route = r.Key, r.Value.Requests, avgMs = r.Value.TotalMs / r.Value.Requests, maxMs = r.Value.MaxMs, errors = r.Value.Errors5xx }),
            failing = routes.Where(r => r.Value.Errors5xx > 0).OrderByDescending(r => r.Value.Errors5xx).Take(8)
                .Select(r => new { route = r.Key, errors = r.Value.Errors5xx, r.Value.Requests }),
        };
    }

    /// <summary>Times every API request by its route pattern (/api/sales/{id}), not its URL, so ids don't explode the list.</summary>
    public static Func<HttpContext, Func<Task>, Task> Middleware(RequestMetrics metrics) => async (http, next) =>
    {
        if (!http.Request.Path.StartsWithSegments("/api") && !http.Request.Path.StartsWithSegments("/l"))
        {
            await next();
            return;
        }
        var clock = Stopwatch.StartNew();
        try { await next(); }
        finally
        {
            var pattern = (http.GetEndpoint() as RouteEndpoint)?.RoutePattern.RawText ?? "(unmatched)";
            metrics.Record($"{http.Request.Method} /{pattern.TrimStart('/')}", http.Response.StatusCode, clock.Elapsed.TotalMilliseconds);
        }
    };
}

/// <summary>Background work reporting that it is alive.</summary>
public sealed class Heartbeat
{
    public DateTimeOffset? AgentsTick { get; set; }
    public DateTimeOffset? AgentsError { get; set; }
    public string AgentsErrorMessage { get; set; } = "";
}
