# Query filters, multi-tenancy, soft delete

Source: learn.microsoft.com/ef/core/querying/filters, EF 10 what's new (checked). The filters page labels named filters "in preview" while the EF 10 what's-new page lists them as released: verify against your SDK.

## Global query filters

- Define per entity: `modelBuilder.Entity<Order>().HasQueryFilter(o => o.TenantId == _tenantId && !o.IsDeleted);` where `_tenantId` is a member of the `DbContext` (evaluated per context instance/query, not baked into the model).
- **EF 10 named filters**: several filters per entity, individually disableable: `.HasQueryFilter("Tenant", o => o.TenantId == _tenantId)` and `.HasQueryFilter("SoftDelete", o => !o.IsDeleted)`; `IgnoreQueryFilters(["SoftDelete"])` to see deleted rows **without** dropping tenant isolation. On EF 8/9 there is one filter per entity and `IgnoreQueryFilters()` drops everything.
- Filters apply to the **root entity of an inheritance hierarchy** only; filter cycles aren't detected; navigation `Include`s are filtered too.
- Required navigation + filter on the parent: INNER JOIN can silently drop child rows; align filters on both ends or make the navigation optional.

## Multi-tenancy patterns

| Pattern                                    | Isolation | Notes                                                                                              |
| ------------------------------------------ | --------- | -------------------------------------------------------------------------------------------------- |
| Shared tables + `TenantId` + global filter | logical   | simplest; **every** table has the column and the filter; add `TenantId` to indexes and unique keys |
| Schema per tenant                          | stronger  | per-tenant migrations; model cache keyed by tenant                                                 |
| Database per tenant                        | strongest | connection string per request; pool per tenant; migration orchestration                            |

- Resolve the tenant once per request (claim/host/header validated against the user's allowed tenants: never trust a raw header) and expose it through a scoped `ITenantContext`. The `DbContext` reads it in its filter.
- With **DbContext pooling** per-request state (tenant) must be set by a scoped factory wrapper each time (see `lifetime-pooling-performance.md`); a pooled context keeps the first tenant otherwise: cross-tenant leakage.
- Writes: set `TenantId` in a `SaveChangesInterceptor` and **reject** entities whose `TenantId` differs from the current tenant. Filters protect reads only.
- `IgnoreQueryFilters()` is a security-sensitive call: grep for it in reviews, keep it in admin/maintenance code, and re-apply tenant checks manually.
- Background jobs/consumers have no request: set the tenant explicitly from the message and create a scope per message.
- LINQ queries (including `ExecuteUpdate/ExecuteDelete`) go through the filters; **hand-written SQL (`FromSql`, `ExecuteSql`, views, stored procedures) does not**: add the tenant predicate yourself.
- Unique constraints are per tenant: `HasIndex(x => new { x.TenantId, x.Email }).IsUnique()`.
- Tests: a test that creates data in tenant A and asserts tenant B cannot read, update or delete it through every endpoint of the module.

## Soft delete

- `IsDeleted` (+ `DeletedAt/By`) with a filter; `Delete` is intercepted and converted to an update (interceptor) or done explicitly.
- Unique indexes need `WHERE IsDeleted = 0` (filtered index) so a deleted row doesn't block reuse.
- Retention/GDPR: soft delete is **not** erasure. Add a purge job that hard-deletes after the retention period and on verified erasure requests.
- Cascade: soft-deleting a parent doesn't delete children: filter them too or cascade explicitly.

## Pitfalls

- Filter uses a captured `static` or constant: tenant baked in forever; use a context member.
- Filter plus `Include` of an entity without the same filter: data of other tenants joins in.
- `FindAsync` looks up by key (and the change tracker first); do not assume it applies your filters (verify for your EF version). When tenant isolation matters use `FirstOrDefaultAsync(x => x.Id == id)` so the filter is in the SQL, and test it.
- Projections through navigations from an unfiltered entity can read cross-tenant rows: filter every entity in the graph.
