# DbContext lifetime, pooling, factories, caching

Sources: learn.microsoft.com/ef/core/performance/advanced-performance-topics, /ef/core/performance (checked).

## Lifetime

- `AddDbContext` -> **scoped** (per request/scope). A `DbContext` is **not thread-safe**: no concurrent operations on one instance; no singleton/static contexts; don't share across requests.
- Singletons, `BackgroundService`s and parallel work: inject `IDbContextFactory<T>` (`AddDbContextFactory`) and create short-lived contexts (`await using var db = await factory.CreateDbContextAsync(ct)`).
- Keep contexts short-lived; many tracked entities slow `DetectChanges` and use memory (use `AsNoTracking` or a fresh context per unit of work).

## DbContext pooling

- `AddDbContextPool<T>(...)` / `AddPooledDbContextFactory<T>` reuses instances (default pool size 1024; beyond that new instances are created and not cached). Saves allocation/setup per request in high-throughput services; measure before adopting.
- Caveats from the docs: the pool behaves as a **singleton** registration; `OnConfiguring` runs once; EF resets its own state but **not the state of the underlying driver** (reset ADO.NET state you changed); **per-request state (e.g. tenant id)** must be applied each time via a pooled factory registered as singleton plus a scoped wrapper that sets the state on every context it hands out. The docs show the workaround but do not explicitly forbid injecting scoped services into a pooled context: treat it as unsupported and verify.
- Don't pool when contexts carry per-request mutable state you can't reliably reset.

## Compiled models and startup

- `dotnet ef dbcontext optimize` (compiled model) reduces startup time for large models; limitations include no global query filters and no lazy-loading proxies: only adopt if startup is measured to be a problem.
- Query caching works on query **shape**: parameterise instead of inlining constants (a changing constant = a new plan). Watch the "Query Cache Hit Rate" metric; default cache limits are enough for most apps.

## Round trips

- Fewer statements beat faster statements: one projection query instead of several; `ExecuteUpdate/Delete` instead of load-modify-save loops; batch `SaveChanges`.
- Connection pooling is provider-level (ADO.NET): keep `Max Pool Size` aligned with instance count x concurrency; leaked contexts exhaust it.
- Prefer async everywhere; the docs warn about known SqlClient async issues in specific versions: if async shows unexpected overhead, measure and, only with evidence, compare a sync path.

## Observability

- Log SQL in development via `LogTo` / ILogger category `Microsoft.EntityFrameworkCore.Database.Command` at Information; in production log slow queries (interceptor/`CommandExecuted` duration) without parameter values.
- `EnableSensitiveDataLogging()` writes parameter values into logs: development only (it is also a privacy issue). EF 10 redacts inlined constants in logs as `?` unless sensitive logging is on.
- Export EF/ADO.NET metrics and traces with OpenTelemetry (see `aspnet-observability`).
