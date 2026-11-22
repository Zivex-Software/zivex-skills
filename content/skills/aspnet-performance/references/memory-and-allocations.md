# Memory and allocations

Sources: learn.microsoft.com/aspnet/core/fundamentals/best-practices, /dotnet/core/runtime-config/garbage-collector, /dotnet/standard/memory-and-spans/memory-t-usage-guidelines (checked).

## Large objects and buffers

- Objects of 85,000 bytes or more go on the **LOH** (collected only in gen2): avoid many short-lived large allocations on hot paths. Cache large objects you reuse; pool buffers with `ArrayPool<T>.Shared` (return in `finally`; don't use after return; clear if it held secrets).
- Don't read whole request/response bodies into memory: stream (`Stream`, `IAsyncEnumerable<T>`, `PipeReader`); large bodies are an OOM/DoS risk.
- Return `IAsyncEnumerable<T>` or a materialised list (`ToListAsync`) from endpoints, never a lazy `IEnumerable<T>` backed by a query (serialised synchronously).

## Spans and memory

- `Span<T>`/`ReadOnlySpan<T>` are stack-only: not usable across `await` or as fields of classes. Use `Memory<T>`/`ReadOnlyMemory<T>` when async or stored.
- For synchronous APIs prefer `ReadOnlySpan<char>`/`Span<T>` parameters (parsing, slicing) over substrings.
- `IMemoryOwner<T>`: dispose or transfer ownership, not both; don't use a `Memory<T>` after the owning call/Task completes.

## Collections, strings, LINQ (hot paths only, after measuring)

- Pre-size collections (`new List<T>(capacity)`), `HashSet`/`Dictionary` for lookups instead of `List.Contains` in loops; `FrozenDictionary`/`FrozenSet` for read-mostly lookup tables built at startup.
- Strings: `StringBuilder` or `string.Create` for many concatenations; avoid `+=` in loops; `string.Join`; avoid `ToLower()` for comparisons (use `StringComparison.OrdinalIgnoreCase`).
- LINQ is fine in most code; on proven hot paths replace multiple enumerations and `ToList()`-then-filter with one pass. Never `ToList()` before `Where`/`Count`/`Any` on a database query: filter in SQL.
- `struct` only for small immutable values; large structs copied by value cost more than a class. `readonly record struct` for small value objects. `sealed` classes help the JIT and HybridCache reuse.
- Boxing: avoid in generic hot paths (`IEquatable<T>`, generic constraints); avoid `params object[]` logging in loops (use `[LoggerMessage]`).
- Regex: `[GeneratedRegex]` (source-generated), static, with a match timeout; never construct `Regex` per call.

## JSON

- Reuse `JsonSerializerOptions` (caches metadata): configure once via `ConfigureHttpJsonOptions`/static field.
- .NET 10 MVC/minimal APIs/`ReadFromJsonAsync` use a stream-based JSON path (release notes); there is a temporary switch if a custom converter breaks.
- Source generation (`JsonSerializerContext`, `[JsonSerializable]`) removes reflection cost and is required for Native AOT; see `http-and-serialization.md`.

## Pooling

- `ObjectPool<T>` (Microsoft.Extensions.ObjectPool) for expensive reusable objects (verify package/API in current docs: the docs page could not be fetched in this pass). `DbContext` pooling: see `aspnet-data-efcore`.
- Pool only when allocation shows up in profiles; pooled objects must be reset and must not leak state across requests.

## GC and containers

- Default is workstation GC unless the host chooses otherwise; **Server GC** (`System.GC.Server` / `<ServerGarbageCollection>`) raises throughput on multi-core servers but uses more memory and dedicated threads per core; with many small instances per machine workstation non-concurrent GC can cause less context switching. Whether ASP.NET Core defaults to Server GC for your host: verify (not stated in the docs read).
- In containers the heap hard limit defaults to 75% of the container limit when unset (larger of 20 MB and that percentage): set container memory limits deliberately; leave headroom for native memory.
- DATAS (dynamic adaptation) is on by default since .NET 9: `System.GC.DynamicAdaptationMode` controls it; measure before disabling.
- `System.GC.ConserveMemory` (0-9), `RetainVM`, `HighMemoryPercent` exist; change only with data. Never call `GC.Collect()` in request paths.

## Signs of trouble

- Gen2 collections frequent, `% Time in GC` high, working set grows without bound: unbounded cache (`IMemoryCache` without `SizeLimit`), static collections, event-handler/`HttpClient` leaks, large LOH churn, `DbContext` kept alive with tracking of thousands of entities.
