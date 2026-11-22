---
name: aspnet-data-efcore
description: Writes correct, fast and safe EF Core data access in ASP.NET Core - querying, tracking, N+1, pagination, DbContext lifetime and pooling, transactions, concurrency, migrations, multi-tenancy and soft-delete filters, bulk updates, and raw SQL safety - with a scanner script. Use when adding or changing entities, queries, migrations or repositories, or when queries are slow or wrong.
---

# EF Core data access

Target **EF Core 10 (LTS, supported until 10 Nov 2028; requires .NET 10)**. EF Core 11 docs could not be read in this pass: do not assume 11-only features. Notes mark differences for EF 8/9.

## Start here (module first)

1. Identify the module that owns the data and read its `AGENTS.md`. Each module owns its own tables/schema (and ideally its own `DbContext`).
2. Never query or join another module's tables, or reference its `DbContext`/entities. Cross-module data goes through that module's `.Contracts` (query interface/DTOs/events).
3. A repo without modules is one module; keep persistence behind the repo's existing pattern (repository, handler, or `DbContext` directly) - do not introduce a new layer.

## Workflow

1. **Understand the shape of the data**: cardinalities, expected volumes, the access pattern (read-heavy list vs single aggregate write). Read the existing entity configuration (`IEntityTypeConfiguration<T>`) and mirror it.
2. **Write the query to return only what is needed**: `Select` to a DTO for reads; `AsNoTracking` when you don't update; filter/sort/page in SQL. See `references/querying.md`.
3. **Check the SQL**: log it in development and count statements per request. One request should not run N similar queries.
4. **Writes**: load the aggregate, change it, `SaveChangesAsync(ct)` (one transaction). Add a concurrency token where lost updates matter. See `references/saving-concurrency-transactions.md`.
5. **Schema change**: add a migration, review the generated SQL, never edit applied migrations, deploy via bundle/script. See `references/migrations.md`.
6. **Tenant/soft-delete**: use global query filters and test that another tenant's data is invisible. See `references/multitenancy-filters.md`.
7. **Run the scanner**: `node scripts/check-efcore.mjs <path>` (regex-based candidates: N+1 in loops, raw SQL concatenation, startup migrations, singleton DbContext, ...). Confirm each hit.
8. **Test with a real provider** (Testcontainers/local DB, not only the in-memory provider: it doesn't enforce relational behaviour, constraints, or SQL translation). Verify with `dotnet-verify`; security aspects: `aspnet-security`.

## Defaults that prevent most bugs

- `DbContext` is scoped, **not thread-safe**: one operation at a time; parallel work uses `IDbContextFactory`. Never singleton/static.
- Project (`Select`) instead of `Include` for read models; `AsSplitQuery()` or projection when two collection includes would explode rows.
- Never `ToList()` before filtering/counting; `Any()` instead of `Count() > 0`; pass `CancellationToken`.
- Order every paged query with a **fully unique** ordering; prefer keyset pagination for large/live sets.
- Raw SQL only with `FromSql`/`ExecuteSql` (interpolated = parameterised); never concatenate; identifiers allow-listed.
- `ExecuteUpdate/ExecuteDelete` for set-based changes, but they bypass the change tracker and concurrency checks and each run in its own transaction.
- `EnableSensitiveDataLogging`/`EnableDetailedErrors` only in development.
- Apply migrations as a deployment step (bundle or reviewed script), not from every replica at startup.

## References

- `references/querying.md` - projection, tracking, N+1, Include vs split queries, cartesian explosion, streaming, compiled queries, raw SQL, pagination.
- `references/saving-concurrency-transactions.md` - `SaveChanges`, optimistic concurrency, transactions, retry strategies, `ExecuteUpdate/Delete`, bulk work.
- `references/migrations.md` - creating, reviewing, deploying and rolling back migrations; seeding; model-change checks in CI.
- `references/multitenancy-filters.md` - query filters (named filters in EF 10), tenant isolation, soft delete, pitfalls.
- `references/lifetime-pooling-performance.md` - DbContext lifetime, pooling and its caveats, factories, model/query caching, metrics.
