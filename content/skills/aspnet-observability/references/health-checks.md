# Health checks

Source: learn.microsoft.com/aspnet/core/host-and-deploy/health-checks (checked).

## Liveness vs readiness

```csharp
builder.Services.AddHealthChecks()
    .AddCheck<DatabaseCheck>("database", tags: ["ready"])
    .AddCheck<QueueCheck>("queue", failureStatus: HealthStatus.Degraded, tags: ["ready"]);

app.MapHealthChecks("/health/live", new() { Predicate = _ => false });                          // process is up: no dependencies
app.MapHealthChecks("/health/ready", new() { Predicate = hc => hc.Tags.Contains("ready") });    // can serve traffic
```

- **Liveness** answers "restart me?": no dependency checks (a failing database must not restart every pod). **Readiness** answers "send me traffic?": checks required dependencies only.
- Optional dependencies -> `Degraded` (HTTP 200 by default), not `Unhealthy` (503), so they don't take instances out of rotation. Defaults: Healthy 200, Degraded 200, Unhealthy 503 (`ResultStatusCodes`).
- Overall status is the worst result. With no checks registered the endpoint is healthy whenever it responds.

## Behaviour to know

- Checks run **on each request** to the endpoint (not on a timer): keep them fast (timeouts of 1-3 s), cheap (a `SELECT 1`, not a migration), and cancellation-aware. A slow check amplified by a frequent probe is a self-inflicted load.
- Periodic evaluation + caching of results: `IHealthCheckPublisher` (defaults: 5 s delay, 30 s period, 30 s timeout) or cache inside the check.
- `AllowCachingResponses` is false by default (the middleware sets no-cache headers): keep it.
- Exclude health endpoints from rate limiting, authentication redirects and request timeouts; `.DisableHttpMetrics()` and set `Microsoft.AspNetCore.Diagnostics.HealthChecks` / `Microsoft.Extensions.Diagnostics.HealthChecks` log levels to Warning to avoid noise. `.ShortCircuit()` skips the remaining middleware.

## Exposure

- Probes from the orchestrator use the internal port/host: restrict with `.RequireHost("*:8081")` (Host headers can be spoofed: combine with network policy) or a separate management port; or `.RequireAuthorization()` where the probe can authenticate.
- The default response body is the status string only. Detailed JSON (check names, durations, exception messages) can leak topology/secrets: only on authorised/internal endpoints, never with exception details or connection strings.

## Writing a check

```csharp
public sealed class DatabaseCheck(IDbContextFactory<AppDbContext> factory) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken ct = default)
    {
        try
        {
            await using var db = await factory.CreateDbContextAsync(ct);
            return await db.Database.CanConnectAsync(ct) ? HealthCheckResult.Healthy() : HealthCheckResult.Unhealthy("cannot connect");
        }
        catch (Exception ex) { return HealthCheckResult.Unhealthy("database check failed", ex); }   // exception stays server-side
    }
}
```

- Use `IDbContextFactory` (health checks are singletons). Return short, non-sensitive descriptions.

## Background workers

- Track `LastSuccessUtc` and queue depth in a singleton; the check is `Degraded`/`Unhealthy` when stale beyond a threshold; also publish them as metrics (see `opentelemetry-metrics.md`).

## Startup and shutdown

- A startup probe/readiness gate should stay failing until warm-up (migrations done by the deployment job, caches primed if required). During shutdown flip readiness to unhealthy first so traffic drains, then stop (see `aspnet-resilience` background shutdown).

## Checklist

1. `/health/live` has no dependency checks; `/health/ready` checks only required ones (tagged).
2. Checks are fast, timeout-bounded and cancellation-aware.
3. Endpoints are not publicly detailed; no exception text in responses.
4. Excluded from rate limiting/auth redirects; metrics and logs not noisy.
5. Orchestrator probes (liveness/readiness/startup) point at the right endpoints.
