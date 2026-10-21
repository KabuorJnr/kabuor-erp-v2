using System.Text.Json;
using Microsoft.Extensions.Caching.Distributed;

namespace Kabuor.Erp.Common;

/// <summary>Distributed caching abstraction (backed by Redis in production, or memory in development).</summary>
public sealed class AppCache(IDistributedCache cache)
{
    public async Task<T?> GetAsync<T>(string key)
    {
        try
        {
            var bytes = await cache.GetAsync(key);
            if (bytes is null || bytes.Length == 0) return default;
            return JsonSerializer.Deserialize<T>(bytes);
        }
        catch
        {
            return default;
        }
    }

    public async Task SetAsync<T>(string key, T value, TimeSpan? expiry = null)
    {
        try
        {
            var bytes = JsonSerializer.SerializeToUtf8Bytes(value);
            var options = new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = expiry ?? TimeSpan.FromMinutes(5)
            };
            await cache.SetAsync(key, bytes, options);
        }
        catch
        {
            // Transient cache failures should never crash application requests
        }
    }

    public async Task<string?> GetStringAsync(string key)
    {
        try
        {
            return await cache.GetStringAsync(key);
        }
        catch
        {
            return null;
        }
    }

    public async Task SetStringAsync(string key, string value, TimeSpan? expiry = null)
    {
        try
        {
            var options = new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = expiry ?? TimeSpan.FromMinutes(5)
            };
            await cache.SetStringAsync(key, value, options);
        }
        catch {}
    }

    public async Task RemoveAsync(string key)
    {
        try
        {
            await cache.RemoveAsync(key);
        }
        catch {}
    }

    public async Task<T> GetOrSetAsync<T>(string key, Func<Task<T>> factory, TimeSpan? expiry = null)
    {
        var cached = await GetAsync<T>(key);
        if (cached is not null) return cached;
        var fresh = await factory();
        if (fresh is not null) await SetAsync(key, fresh, expiry);
        return fresh;
    }
}
