---
name: aspnet-performance
description: Makes ASP.NET Core code fast and scalable - async correctness, allocations, caching (HybridCache, output caching), HTTP and JSON settings, pagination, GC/container settings and measurement - and checks it with a scanner script. Use when writing hot paths, fixing slowness or high memory, adding caching, or reviewing performance.
---

# ASP.NET Core performance

Target **.NET 10 (LTS)**. Rule zero: **measure first** (profile, benchmark, metrics); never optimise from a hunch. Notes mark .NET 11 (STS) differences; "11+" items must not be used on .NET 10.

## Start here (module first)

1. Identify the module that owns the slow path and read its `AGENTS.md`.
2. Optimise inside the module. Cross-module speedups (batching, caching a contract call) go through the other module's `.Contracts`, never its internals.
3. Record the baseline (latency percentiles, allocations, query count) before and after in the change description.

## Workflow

1. **Reproduce and measure**: pick the metric (p95 latency, throughput, memory, queries per request). Tools: `dotnet-counters` (`System.Runtime`, `Microsoft.AspNetCore.Hosting`), `dotnet-trace`, BenchmarkDotNet for micro-benchmarks, EF logging for query counts. See `references/measuring.md`.
2. **Find the bottleneck** before changing code: usually (a) database round trips and queries, (b) blocking/sync-over-async, (c) over-fetching/large payloads, (d) missing caching, (e) allocations on hot paths.
3. **Run the scanner** for known anti-patterns: `node scripts/check-performance.mjs <path>`. Regex-based candidates: confirm each in context.
4. **Fix the highest-impact item first** using the matching reference below, one change at a time, re-measuring.
5. **Guard it**: add a test or benchmark for the hot path where practical, and keep the result cheap to read in review.
6. **Verify** with `dotnet-verify`; performance work must not change behaviour. For queries see `aspnet-data-efcore`.

## High-value defaults

- Async all the way; never `.Result`, `.Wait()`, `GetAwaiter().GetResult()`, `Thread.Sleep`, `async void`, `Task.Run` around async work. Pass `CancellationToken` (request abort) down to EF/HttpClient.
- Return **pages**, not whole tables: cap `pageSize`, keyset pagination for large sets, never return `IEnumerable<T>` that streams a lazy query synchronously.
- Project to DTOs with `Select`; `AsNoTracking` for reads; no N+1 (see `aspnet-data-efcore`).
- Cache deliberately: `HybridCache` for expensive reads (stampede protection, L1+L2), output caching for cacheable GETs; always define invalidation and a size/lifetime bound.
- `IHttpClientFactory`, never `new HttpClient()` per call; source-generated System.Text.Json for hot DTOs; response compression where the proxy does not.
- Don't hold `HttpContext` beyond the request; don't capture it in background work.
- Avoid allocations on hot paths only after measuring: `Span<T>`, `ArrayPool<T>`, pooling, `StringBuilder`, `[GeneratedRegex]`, `FrozenDictionary` for read-mostly lookups.
- Background/long work out of the request: `BackgroundService` + `Channel<T>` or a message broker.

## References

- `references/async-and-threads.md` - blocking calls, thread-pool starvation, sync IO, cancellation, parallelism, `HttpContext` rules.
- `references/memory-and-allocations.md` - LOH, pooling, spans, collections, strings, JSON, regex, struct/class choices, GC and container settings.
- `references/caching.md` - HybridCache, output caching, response caching, `IMemoryCache` pitfalls, invalidation, what to cache and what never.
- `references/http-and-serialization.md` - compression, protocols, Kestrel limits, timeouts, `HttpClient`, JSON source generation, Native AOT, pagination.
- `references/measuring.md` - how to measure and read results: counters, traces, BenchmarkDotNet, load tests, EF query logging, performance review template.
