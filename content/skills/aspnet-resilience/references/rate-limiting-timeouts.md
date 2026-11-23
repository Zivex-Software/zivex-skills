# Inbound protection: rate limits, concurrency, timeouts

Sources: learn.microsoft.com/aspnet/core/performance/rate-limit, /performance/timeouts (checked, .NET 10).

## Rate limiting

- `AddRateLimiter` + `UseRateLimiter` (after `UseRouting` when you use endpoint attributes/`RequireRateLimiting`). Limiters: **fixed window** (burst at window edges), **sliding window** (`SegmentsPerWindow`), **token bucket** (smooth, allows bursts: good default), **concurrency** (caps simultaneous requests: protects expensive endpoints, not a rate).
- `QueueLimit = 0` means reject instead of queue; queues hold request threads/memory: keep them small.
- Partition per user/API key (fallback IP); a global limiter via `options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(...)`; named policies via `RequireRateLimiting("name")`/`[EnableRateLimiting]`; `[DisableRateLimiting]` overrides.
- Unbounded partition keys from user input can be abused for DoS; normalise and cap them.
- Rejection: set `RejectionStatusCode` explicitly to 429 (the **default is 503 Service Unavailable**, per the `RateLimiterOptions` API reference; the guide only sets 429 in its examples) and write `Retry-After` from `MetadataName.RetryAfter` in `OnRejected` (the fixed-window limiter reports it; the concurrency limiter does not on .NET 10).
- Counters are in memory **per instance**: with N replicas the effective limit is N x. Use a gateway/edge or distributed limiter for hard global limits.
- Order: put cheap, early limits (per IP) before authentication, per-user limits after it; exclude health endpoints.

## Request timeouts

```csharp
builder.Services.AddRequestTimeouts(o =>
{
    o.DefaultPolicy = new() { Timeout = TimeSpan.FromSeconds(15) };
    o.AddPolicy("report", TimeSpan.FromSeconds(60));
});
app.UseRouting(); app.UseRequestTimeouts();   // after UseRouting when it is called explicitly
app.MapGet("/reports/{id}", GetReport).WithRequestTimeout("report");
```

- The middleware **cancels `HttpContext.RequestAborted`**; it doesn't kill your code: pass the token to every I/O call. Unhandled timeout -> 504 by default (customise `TimeoutStatusCode`/`WriteTimeoutResponse`).
- Disable per endpoint with `DisableRequestTimeout()` (streaming, SSE, websockets). Not enforced while a debugger is attached.
- Your deadlines must nest: request timeout > total outbound timeout > attempt timeout.

## Load shedding and degradation

- Prefer failing fast (429/503 + `Retry-After`) over queueing unbounded work: a saturated service with a deep queue answers everyone late.
- Protect the expensive paths with a concurrency limiter (e.g. exports, reports, search) and keep cheap endpoints available.
- Degrade features, not the whole service: serve cached/stale data (HybridCache with a longer fallback), disable optional calls when a breaker is open, return partial results with a flag.
- Readiness checks should fail when the instance can't take traffic (dependencies required for every request), but **not** for optional dependencies (avoids cascading restarts). See `aspnet-observability`.

## Kestrel limits (defence in depth)

- Per-endpoint `[RequestSizeLimit]`, request header/body timeouts and minimum data rates protect against slow-loris style abuse; defaults (`KestrelServerLimits` API reference): `RequestHeadersTimeout` 30 s, `KeepAliveTimeout` 130 s (the current API reference; an old 5.0 block of the options page still says 2 minutes), `MaxRequestHeadersTotalSize` 32 KB, `MaxRequestBodySize` 30,000,000 bytes, `MinRequestBodyDataRate` and `MinResponseDataRate` 240 bytes/s with a 5 s grace period. Change them only with a measured reason. Keep `AllowSynchronousIO` false.

## Testing

- Assert 429 with `Retry-After` after the limit, 504 on timeout, that the token is cancelled in the handler, and that health endpoints are not rate-limited.
