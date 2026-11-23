# Caching

Sources: learn.microsoft.com/aspnet/core/performance/caching/{overview,hybrid,output,response,memory} (checked, Nov 2026).

## Which cache

| Need                                                       | Use                                                                                                             |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Expensive computed/queried **data** reused across requests | **HybridCache** (new code; the docs call it a drop-in replacement for `IMemoryCache`/`IDistributedCache` usage) |
| Whole **HTTP responses** (public GETs, UI)                 | **Output caching** (server-side, tags, invalidation, locking, revalidation)                                     |
| HTTP semantics for clients/proxies (`Cache-Control`)       | Response caching headers (`[ResponseCache]`); the middleware only caches public GET/HEAD                        |
| Tiny process-local lookups                                 | `IMemoryCache` with `SizeLimit` and expirations                                                                 |

## HybridCache

```csharp
builder.Services.AddHybridCache(o =>
{
    o.MaximumPayloadBytes = 1024 * 1024; // default 1 MB; larger entries are not cached
    o.DefaultEntryOptions = new() { Expiration = TimeSpan.FromMinutes(5), LocalCacheExpiration = TimeSpan.FromMinutes(1) };
});
// package: Microsoft.Extensions.Caching.Hybrid

var dto = await cache.GetOrCreateAsync(
    $"product:{tenantId}:{id}",
    async ct => await LoadProductAsync(id, ct),
    tags: [$"product:{id}", $"tenant:{tenantId}"],
    cancellationToken: ct);
await cache.RemoveByTagAsync($"product:{id}");   // logical invalidation (entries become misses)
```

- Order: L1 (in-memory) -> L2 if an `IDistributedCache` (Redis, SQL, Postgres) is registered -> factory. Without L2 it is L1 only; `AddDistributedMemoryCache` does **not** add a useful L2.
- **Stampede protection** per key within one `HybridCache` instance (concurrent callers wait for one factory run); not across servers.
- Prefer the **stateless** overload (state captured via the factory args) to avoid closure allocations.
- Invalidation affects this server and the L2 store; **other servers' L1 copies are not invalidated**: keep `LocalCacheExpiration` short where freshness matters.
- Tags: no empty tags, `"*"` is reserved, no globs. Key max length 1024: don't build keys from raw user input.
- Serialization: `string`/`byte[]` built in, everything else System.Text.Json; add serializers with `AddSerializer<T, TSerializer>()` and `AddSerializerFactory`, chained from `AddHybridCache` (confirmed in the guide and the `IHybridCacheBuilder` API reference). Mark cached DTOs `sealed` + `[ImmutableObject(true)]` to allow instance reuse. Native AOT: source-generated serializer context.

## Output caching

```csharp
builder.Services.AddOutputCache(o => o.AddPolicy("catalog", b => b.Expire(TimeSpan.FromMinutes(1)).Tag("catalog").SetVaryByQuery("page", "size")));
app.UseOutputCache();                       // after UseCors, UseRouting, UseAuthentication, UseAuthorization
app.MapGet("/catalog", GetCatalog).CacheOutput("catalog");
await store.EvictByTagAsync("catalog", ct); // IOutputCacheStore
```

- Default policy caches only 200 responses to GET/HEAD, not responses that set cookies, **not authenticated requests**. If you override that, vary by user/tenant or you will serve one user's data to another.
- Locking (single regeneration) is on by default; ETag revalidation returns 304 automatically. Defaults: 60 s expiry, 100 MB size limit, 64 MB max body.
- Redis store: `AddStackExchangeRedisOutputCache`; `IDistributedCache` is not recommended as the output-cache store (no atomic operations for tags).
- 11+: `IOutputCachePolicyProvider` for dynamic policies (not on .NET 10).

## Response caching (headers)

- `AddResponseCaching`/`UseResponseCaching` + `[ResponseCache(Duration=..., Location=...)]`: requires `Duration > 0`; honours client `Cache-Control: no-cache` (clients can bypass). Disable for content that differs per signed-in user. For UI apps output caching is the better fit.

## IMemoryCache pitfalls

- Set `SizeLimit` (and give each entry a `Size`); without it the cache grows without bound and is **not trimmed under memory pressure**.
- Combine sliding with absolute expiration (sliding alone may never expire). Expiry is checked on cache activity, not by a timer.
- `GetOrCreate(Async)` is **not atomic**: the factory may run several times: use HybridCache when that matters.
- Never use external input as keys; the cache stores references, so mutating a cached object changes it for all readers; `Count` is expensive under concurrency.
- Farms: in-memory caches need sticky sessions or a distributed cache.

## Decide what to cache (and what never)

- Cache: reference data, expensive aggregates, results of slow third-party calls, rendered public pages.
- Don't cache: per-user/tenant data without the user/tenant in the key, authorization decisions longer than the token lifetime, anything with secrets, writes.
- Every cache has: an owner, a key scheme including tenant/culture, an expiry, an invalidation trigger, and a metric (hit rate). Say so in the change.
- Cache the **result**, not the `IQueryable`; don't cache entities attached to a `DbContext` (cache DTOs).
