# Outbound HTTP resilience

Sources: learn.microsoft.com/dotnet/core/resilience/http-resilience, /dotnet/core/resilience/ (checked, .NET 10).

## Standard handler

```csharp
// package: Microsoft.Extensions.Http.Resilience
builder.Services.AddHttpClient<PaymentsClient>(c => c.BaseAddress = new(config["Payments:BaseUrl"]!))
    .AddStandardResilienceHandler(o =>
    {
        o.Retry.DisableForUnsafeHttpMethods();                 // POST, PATCH, PUT, DELETE, CONNECT
        o.AttemptTimeout.Timeout = TimeSpan.FromSeconds(5);
        o.TotalRequestTimeout.Timeout = TimeSpan.FromSeconds(20);
        o.CircuitBreaker.SamplingDuration = TimeSpan.FromSeconds(60); // must be >= 2 x AttemptTimeout
    });
```

Defaults (outermost -> innermost): **rate limiter** (1,000 permits, queue 0) -> **total timeout 30 s** -> **retry** (3 attempts, exponential backoff, jitter, 2 s base) -> **circuit breaker** (10 % failure ratio, minimum throughput 100, sampling 30 s, break 5 s) -> **attempt timeout 10 s**.

- Retry and breaker handle HTTP 500+, 408, 429, `HttpRequestException` and `TimeoutRejectedException` (Polly throws that, **not** `TimeoutException`: catch/log accordingly).
- **Retries apply to every HTTP method by default.** The docs' warning: retrying a POST that inserts a record can duplicate data. Use `Retry.DisableForUnsafeHttpMethods()` / `DisableFor(HttpMethod.Post, ...)` or protect the call with an idempotency key the downstream honours.
- Use **one** resilience handler per client; for several strategies use `AddResilienceHandler("name", b => ...)` with `AddRetry`, `AddCircuitBreaker`, `AddTimeout` in the order you want (order matters).
- Tune from data (latency percentiles of the dependency), not defaults copied around. Attempt timeout < total timeout; total timeout < the caller's own deadline (request timeout).
- Known interactions: older `Grpc.Net.ClientFactory` (<= 2.63) and Application Insights (<= 2.22) need updates when resilience is registered first.

## Hedging (latency-sensitive, idempotent reads only)

`AddStandardHedgingHandler()` sends parallel attempts to (possibly different) endpoints after a delay (defaults: up to 10 attempts, 2 s hedge delay, 30 s total). It multiplies load on the dependency: use only for idempotent reads with spare capacity, never for writes.

## Custom pipelines (non-HTTP)

```csharp
builder.Services.AddResiliencePipeline("db-read", static b => b
    .AddRetry(new() { MaxRetryAttempts = 2, BackoffType = DelayBackoffType.Exponential, UseJitter = true })
    .AddTimeout(TimeSpan.FromSeconds(3)));
// inject ResiliencePipelineProvider<string>; await provider.GetPipeline("db-read").ExecuteAsync(...)
```

Builder strategies: retry, circuit breaker, timeout, fallback, hedging, rate limiter (inbound), concurrency limiter (outbound). `AddResilienceEnricher()` adds `error.type`/`request.dependency.name` dimensions to telemetry.

- For EF/database use the provider's own retry (`EnableRetryOnFailure`) and read `aspnet-data-efcore` about its interaction with transactions.

## Idempotency for safe retries

- Send an `Idempotency-Key` header on POSTs that retries may repeat; the downstream must dedupe. Inside your own API, accept the key too (see `aspnet-api-design`).
- Make consumers idempotent (unique key + upsert/ignore duplicates) because at-least-once delivery means duplicates.

## Failure modes to design for

| Dependency state                   | Behaviour                                                                           |
| ---------------------------------- | ----------------------------------------------------------------------------------- |
| Slow                               | per-attempt timeout; fail fast; do not hold threads/connections                     |
| Down                               | circuit opens; fallback (cached value / degraded feature) or 503 with `Retry-After` |
| Flapping                           | breaker + jittered backoff avoids retry storms                                      |
| Returns 4xx                        | no retry (except 408/429); log and surface the error                                |
| Overloaded (429/503 + Retry-After) | back off, honour the header                                                         |

## Testing

- Use a fake `HttpMessageHandler` returning 500/timeout/delays to assert: retries happen for GET, **not** for POST, the breaker opens, the total timeout holds, cancellation propagates. Use `Microsoft.Extensions.Time.Testing` `FakeTimeProvider` to avoid real delays.
