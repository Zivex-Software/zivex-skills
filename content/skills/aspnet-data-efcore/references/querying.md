# Querying

Sources: learn.microsoft.com/ef/core/performance/efficient-querying, /ef/core/querying/{single-split-queries,pagination,sql-queries}, /ef/core/what-is-new/ef-core-10.0/whatsnew (checked).

## Return only what you need

```csharp
var rows = await db.Orders
    .Where(o => o.TenantId == tenantId && o.Status == OrderStatus.Open)
    .OrderByDescending(o => o.CreatedAt).ThenBy(o => o.Id)          // unique ordering
    .Select(o => new OrderRow(o.Id, o.Number, o.Customer.Name, o.Lines.Count))
    .Take(pageSize)                                                  // capped server-side
    .ToListAsync(ct);
```

- Projection (`Select`) selects only needed columns and needs no tracking: the default for read endpoints. It cannot be used for updates (load the entity for those).
- Filter, sort, paginate and aggregate in SQL. **Never** `ToList()` then `Where/Count/Any/OrderBy` (client-side). `Any()` instead of `Count() > 0`.
- `AsEnumerable()`/`ToList()` end the translatable part of the query: do it last.

## Tracking

- Tracking snapshots entities and resolves identity; for read-only queries use `AsNoTracking()` (benchmark in the docs: 1.41 ms vs 0.99 ms for a small query; larger sets differ more). `UseQueryTrackingBehavior(NoTracking)` sets it per context.
- `AsNoTrackingWithIdentityResolution()` when the graph shares entities and you don't want duplicates.
- Don't keep tracking thousands of entities in one long-lived context (memory + slow `DetectChanges`).

## N+1

- Lazy loading or a query inside a loop runs one query per row: `foreach (var o in orders) { await db.Lines.Where(l => l.OrderId == o.Id)... }`. Fix: one query with `Include`/projection, or `Where(l => ids.Contains(l.OrderId))` then `ToLookup`.
- Detect: log SQL per request; N similar statements = N+1. Avoid lazy-loading proxies in services (they hide N+1).
- Collections passed to `Contains` become parameters (EF 10 default: one scalar parameter per value, padded); very large lists (thousands) still hurt: batch or use a join with a table-valued/temp structure.

## Include, cartesian explosion, split queries

- One query with two sibling collection `Include`s returns the cross product of their rows (cartesian explosion) and duplicates large columns. EF warns when it detects multiple collection includes without a configured mode.
- Options: project with `Select` (best), or `AsSplitQuery()` (one query per collection) or `UseQuerySplittingBehavior(SplitQuery)` globally. Trade-offs: split queries may be inconsistent under concurrent writes, cost an extra round trip each and buffer results; one-to-one navigations always use JOINs.
- Skip/Take with split queries needs a fully unique ordering (the docs note this for versions before EF 10's ORDER BY fix).
- Required navigations with a query filter on the parent can drop child rows (INNER JOIN): align filters or make the navigation optional.

## Streaming vs buffering

- `ToList/ToArray` buffer; `AsAsyncEnumerable()` streams (keep the connection open: process quickly, no nested queries on the same context unless MARS). A retrying execution strategy buffers results internally (more memory).

## Pagination

- **Offset** (`Skip/Take`): simple; cost grows with the offset (the database still reads the skipped rows); concurrent inserts can duplicate/skip items. Fine for small bounded sets.
- **Keyset**: remember the last key and query `Where(x => x.Id > lastId)` with a unique ordering; recommended for large/live data and "next/previous" navigation; no random page access (combine: keyset for next/previous, offset for jumps). Multi-column keysets: `OrderBy(a).ThenBy(id)` + compound `Where` (row-value comparison isn't translatable). Index the ordering columns.
- Always order before `Skip/Take`: relational databases have no default order.
- Cap `pageSize` server-side; return a next-cursor.

## Raw SQL

- Last resort: prefer LINQ, views, UDFs. Safe: `db.Set<T>().FromSql($"SELECT ... WHERE x = {value}")`, `ExecuteSql($"...")`, `SqlQuery<T>($"...")`: interpolation becomes parameters. `FromSqlRaw/ExecuteSqlRaw` are safe **only** with explicit `DbParameter`s: never interpolate/concatenate user data (EF 10 ships an analyzer warning for concatenation in `FromSqlRaw`).
- Column/table names can't be parameters: map user choices to fixed identifiers with a `switch`.
- `FromSql` composes only directly on a `DbSet`; later LINQ wraps it in a subquery.

## Compiled queries

- `EF.CompileAsyncQuery` for very hot, simple queries after profiling. Constraints from the docs: single model, simple scalar parameters; delegates are thread-safe. EF already caches the query _shape_: write parameters as variables, not inlined constants, so the cache hits (watch the query-cache hit-rate metric).

## Functions and translation

- Prefer `EF.Functions.*` over client-side methods; check the generated SQL when using string/date functions, `GroupBy`, `Contains` on large sets.
- Case-insensitive search: use the column collation or `EF.Functions.ILike`/`Like`; don't `ToLower()` both sides (kills indexes).
- Avoid querying with `Include` just to read one field.

## Checklist per query

1. Filters, sorting and paging in SQL; unique ordering; page size capped.
2. Projection or `AsNoTracking`; no N+1; at most one collection `Include` (or split/projection).
3. Indexes exist for filter and sort columns (check the plan on realistic data).
4. `CancellationToken` passed; async API.
5. Tenant/soft-delete filters apply (see `multitenancy-filters.md`).
