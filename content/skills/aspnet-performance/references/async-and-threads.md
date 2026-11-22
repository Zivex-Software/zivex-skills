# Async, threads and request lifetime

Sources: learn.microsoft.com/aspnet/core/fundamentals/best-practices (checked, updated Nov 2026).

## Never block

- Don't call `Task.Wait`, `Task<T>.Result`, `GetAwaiter().GetResult()`; don't take locks on common code paths; don't `Task.Run` then await it, and don't use `Task.Run` to fake an async API over sync work. Blocking threads under load causes thread-pool starvation and timeouts that look like "random slowness".
- Make controller actions, handlers, middleware and data access async end to end.
- **Kestrel does not support synchronous reads/writes**: use `ReadToEndAsync`, `ReadFormAsync` (not `Request.Form[...]`), `DeserializeAsync(Request.Body)` / `ReadFromJsonAsync`.
- No `async void` (except event handlers): exceptions crash the process or vanish.
- A sync API that must be called from async code and does real I/O: wrap at the lowest level with a proper async API, not `Task.Run` at the top.

## Cancellation

- Accept `CancellationToken` in endpoints (bound to `HttpContext.RequestAborted`) and pass it to EF (`ToListAsync(ct)`), `HttpClient`, `Task.Delay(..., ct)`, channels.
- Request timeouts (`AddRequestTimeouts`/`UseRequestTimeouts`, after `UseRouting`) only **cancel the token**; your code must observe it. An unhandled timeout returns 504 by default.

## Parallelism

- Independent I/O: `await Task.WhenAll(a, b)` (each using its own scoped dependencies; a `DbContext` is not thread-safe: one operation at a time per context, use `IDbContextFactory` for parallel queries).
- Many items: `Parallel.ForEachAsync` with `MaxDegreeOfParallelism`; never an unbounded `Task.WhenAll` over thousands of HTTP calls.
- Don't parallelise CPU-bound work inside request handlers without a limit: it steals cores from other requests.

## HttpContext and request-scoped state

- `HttpContext` is not thread-safe and invalid after the request completes. Don't store it in fields, don't use it from background threads, don't capture it in fire-and-forget work: copy the values you need.
- Don't keep `IHttpContextAccessor.HttpContext` in a field; read it at the point of use.
- Background work needs its own scope: `IServiceScopeFactory.CreateAsyncScope()`.
- `HttpRequest.ContentLength` can be null: `> 1024` is false for null.
- Don't call `next()` after you've started writing the response; set headers via `Response.OnStarting` or check `HasStarted`.
- Don't use exceptions for control flow on hot paths (expensive); use `TryParse`-style APIs and result types.

## Long-running work

- Don't make the HTTP request wait for it: `BackgroundService` + `Channel<T>` queue, a message broker, or a job runner; return 202 with a status resource. See `aspnet-resilience` for shutdown and error behaviour.

## Quick triage for "the API is slow under load"

1. CPU low, latency high, thread count rising -> blocking calls / starvation (`dotnet-counters`: `ThreadPool Queue Length`, `ThreadPool Thread Count`).
2. Many identical SQL statements per request -> N+1 (`aspnet-data-efcore`).
3. Memory climbing, frequent gen2 GCs -> large allocations, unbounded caches, or leaks (`memory-and-allocations.md`).
4. One slow dependency stalls everything -> missing timeouts/bulkheads (`aspnet-resilience`).
