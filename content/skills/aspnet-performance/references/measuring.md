# Measuring performance

Sources: learn.microsoft.com/dotnet/core/diagnostics/{dotnet-counters,dotnet-trace}, /aspnet/core/log-mon/metrics/metrics, /ef/core/performance (checked).

## Pick the question

- "Is it slow?" -> percentile latency (p50/p95/p99) of the real endpoint under realistic load, not averages.
- "Why?" -> trace/profile the slow requests; count SQL statements; look at GC and thread-pool counters.
- "Did my change help?" -> same load, same data, before/after, several runs.

## Built-in tools

```text
dotnet tool install --global dotnet-counters      # or: dnx dotnet-counters (.NET 10 SDK)
dotnet-counters monitor --process-id <pid> --counters System.Runtime,Microsoft.AspNetCore.Hosting,Microsoft.AspNetCore.Server.Kestrel
dotnet-counters collect --format json --counters System.Runtime -- dotnet run

dotnet tool install --global dotnet-trace
dotnet-trace collect --process-id <pid> --profile dotnet-sampled-thread-time,dotnet-common   # (cpu-sampling was removed from `collect`)
dotnet-trace collect --process-id <pid> --profile gc-verbose                                 # allocation/GC investigation
```

- Open `.nettrace` in PerfView/Visual Studio (Windows) or convert with `--format Speedscope` on macOS/Linux.
- ASP.NET Core meters: `Microsoft.AspNetCore.Hosting` (`http.server.request.duration`), `Microsoft.AspNetCore.Server.Kestrel`; EF Core exposes query-cache hit rate. Export them with OpenTelemetry (see `aspnet-observability`) and graph p95.
- `System.Runtime` counters to watch: CPU %, working set, GC heap size, gen0/1/2 collections, `% Time in GC`, allocation rate, **ThreadPool Queue Length** and **Thread Count**, monitor lock contention.
- Run tools as the same user as the process; on Linux/macOS share `TMPDIR`. Timeouts are not enforced under a debugger: measure without one.

## Micro-benchmarks (BenchmarkDotNet)

- For comparing two implementations of a small function. Use `[MemoryDiagnoser]`, Release build, realistic input sizes, `[Params]` for sizes; never benchmark with a debugger; don't let the JIT remove your code (return/consume the result).
- Not for end-to-end latency: use load tests for that. Keep benchmarks in a separate `*.Benchmarks` project (excluded from normal test runs).

## Load tests

- Use a tool you can script in CI (k6, NBomber, Bombardier, wrk). Warm up first; fixed arrival rate (open model) for latency, fixed concurrency for capacity; production-like data volumes and indexes; run against Release, same CPU/memory limits as production (container limits change GC behaviour).
- Record: throughput, error rate, p50/p95/p99, CPU, memory, GC time, DB connections, SQL statements per request.

## Database

- Log SQL in development (`LogTo`/ILogger category `Microsoft.EntityFrameworkCore.Database.Command`) and count statements per request: >N identical statements = N+1. Use the DB's execution plans for slow statements; check indexes support filter and sort columns. See `aspnet-data-efcore`.

## Performance review template (put in the PR)

```markdown
**Scenario**: endpoint/job, data volume, concurrency.
**Baseline**: p95 <x> ms, <y> SQL statements, <z> MB allocated per request (tool + date).
**Change**: <what and why>.
**After**: p95 <x'> ms, <y'> statements, <z'> MB.
**Risk**: cache invalidation / behaviour change / memory growth: <how handled>.
```

## Rules of thumb

- Fix algorithmic and I/O problems before micro-optimisations: one removed round trip beats a thousand saved allocations.
- Add caching last, with invalidation and metrics; a cache hides problems and can serve stale/foreign data.
- Don't tune GC/Kestrel settings without a measured reason; revert the ones that don't show up in the numbers.
