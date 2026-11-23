# Background work

Sources: learn.microsoft.com/aspnet/core/fundamentals/host/hosted-services, /aspnet/core/fundamentals/best-practices (checked).

## BackgroundService

```csharp
public sealed class OrderWorker(Channel<OrderJob> queue, IServiceScopeFactory scopes, ILogger<OrderWorker> log)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var job in queue.Reader.ReadAllAsync(stoppingToken))
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();     // no scope exists by default
                await scope.ServiceProvider.GetRequiredService<IOrderProcessor>().RunAsync(job, stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                log.LogError(ex, "Job {JobId} failed", job.Id);          // per-item isolation: one bad job must not kill the loop
            }
        }
    }
}
// registration: AddSingleton(Channel.CreateBounded<OrderJob>(new BoundedChannelOptions(1000) { FullMode = BoundedChannelFullMode.Wait }));
//               AddHostedService<OrderWorker>();
```

Facts from the docs:

- Hosted services start in registration order and stop in reverse (`HostOptions.ServicesStartConcurrently/ServicesStopConcurrently` change that). `StartAsync` must be short.
- **No scope** is created for a hosted service: scoped services (DbContext, repositories) need an explicit scope (`IServiceScopeFactory.CreateAsyncScope()`; the docs example uses `CreateScope()` on the provider).
- Shutdown: `StopAsync` token has a default **30 s** timeout (`HostOptions.ShutdownTimeout`); `ExecuteAsync` must return promptly after the token fires. Long work must checkpoint and be resumable.
- Unhandled exceptions in `ExecuteAsync`: `HostOptions.BackgroundServiceExceptionBehavior` decides, and its **default is `StopHost`** (an unhandled exception stops the host); decide deliberately, catch per iteration, and never rely on silent loop death.
- Don't use string interpolation in log calls (the docs sample does: don't copy that).

## Queues

- In-process: bounded `Channel<T>` (back-pressure with `Wait`, or reject with 429/503 when full). Unbounded channels hide overload until memory runs out.
- Durable: broker/outbox when jobs must survive restarts. In-memory queues **lose work on shutdown/crash**.
- Outbox: write the message in the **same DB transaction** as the state change; a worker publishes and marks it sent; consumers are idempotent. This is how modules communicate reliably without distributed transactions.

## Rules

- Never `_ = Task.Run(...)`/unobserved tasks in request handlers: failures are lost, shutdown kills them, `HttpContext` is gone.
- Copy the data the job needs (ids, not entities or `HttpContext`); load fresh inside the scope.
- Idempotent handlers (unique key / upsert): at-least-once delivery will repeat jobs.
- Retry with backoff and a **dead-letter** destination after N failures; alert on dead letters.
- Use `PeriodicTimer` (not `while(true)` + `Thread.Sleep`) for schedules; pass the token to every await.
- Multiple instances: one scheduler only (leader election/distributed lock, or a job runner like Hangfire/Quartz) or make jobs safe to run concurrently.
- Limit concurrency (`SemaphoreSlim`/`Parallel.ForEachAsync(MaxDegreeOfParallelism)`) so background load doesn't starve requests; separate pools/instances for heavy jobs.
- Tenant context is not available in the background: carry the tenant id in the message and set it in the scope.

## Graceful shutdown

- On SIGTERM: stop accepting new work (token cancelled), finish or checkpoint in-flight work within `ShutdownTimeout` (raise it if jobs need longer, and match the orchestrator's termination grace period), flush telemetry. Test by cancelling mid-job.

## Health

- Expose worker liveness/lag (queue depth, last success time) as metrics and a readiness/health check (see `aspnet-observability`).
