---
name: aspnet-resilience
description: Makes ASP.NET Core services resilient - HttpClient resilience handlers (timeouts, retries, circuit breakers, hedging), rate limiting and request timeouts, background services and queues, graceful shutdown, idempotency and failure isolation - with a scanner script. Use when calling other services, adding background work, or hardening a service against slow or failing dependencies.
---

# ASP.NET Core resilience

Target **.NET 10 (LTS)** with `Microsoft.Extensions.Http.Resilience` / `Microsoft.Extensions.Resilience` (Polly v8 based; `Microsoft.Extensions.Http.Polly` is deprecated).

## Start here (module first)

1. Identify the module and read its `AGENTS.md`. Resilience policy belongs to the module that owns the **dependency** (the HTTP client or queue it talks to); the host registers shared defaults.
2. Calls to other modules go through their `.Contracts` in-process: they don't need retries/circuit breakers (they fail together); calls to **external** systems always do.
3. Don't hide failures across modules: surface a typed error/result through the contract.

## Workflow

1. **List every dependency** the change touches (HTTP APIs, DB, queue, cache, file/blob, email/SMS) and answer for each: timeout? retry safe (idempotent)? what happens when it is down (fail fast, degrade, queue)? who is told?
2. **Outbound HTTP**: `AddHttpClient<T>(...).AddStandardResilienceHandler(...)`, then **disable retries for unsafe methods** unless the call is idempotent. See `references/http-resilience.md`.
3. **Inbound protection**: rate limits per client, concurrency limits on expensive endpoints, request timeouts, sane body limits (see `aspnet-security` for the middleware order).
4. **Background work**: `BackgroundService` + `Channel<T>` (or a broker) with per-iteration try/catch, scopes via `IServiceScopeFactory`, honouring `stoppingToken`, idempotent handlers. See `references/background-work.md`.
5. **Run the scanner**: `node scripts/check-resilience.mjs <path>` (new `HttpClient`, no resilience handler, infinite timeouts, empty catch, fire-and-forget, background service pitfalls). Confirm each hit.
6. **Test failure paths**: simulated timeout, 500, slow response, cancelled request, shutdown during work. Use `dotnet-testing`; verify with `dotnet-verify`.

## Rules

- Every outbound call has a **timeout** (per attempt **and** total) and receives the request `CancellationToken`.
- Retries only for **transient** failures and **idempotent** operations; exponential backoff with jitter; bounded attempts. The standard handler retries every HTTP method by default: call `options.Retry.DisableForUnsafeHttpMethods()` for POST/PATCH/PUT/DELETE unless protected by an idempotency key.
- One resilience handler per client; don't stack handlers or add retries at several layers (retry storms multiply: 3 x 3 x 3).
- Circuit breakers protect the dependency and your threads; decide the **fallback** (cached value, default, 503 + `Retry-After`) explicitly.
- Never fire-and-forget (`_ = DoAsync()`); queue it instead.
- Never swallow exceptions silently; `catch` + log with the exception object, or let it propagate.
- Resilience hides problems: emit metrics/logs for retries, breaker state and timeouts (see `aspnet-observability`).

## References

- `references/http-resilience.md` - standard resilience handler defaults, customising, hedging, idempotency, Polly pipelines, testing.
- `references/background-work.md` - `BackgroundService`, queues with `Channel<T>`, scopes, shutdown and exception behaviour, outbox, scheduling and idempotent consumers.
- `references/rate-limiting-timeouts.md` - inbound rate limiting, concurrency limits, request timeouts, load shedding, health-based degradation.
