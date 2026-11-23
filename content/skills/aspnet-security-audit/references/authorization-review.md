# Authorization review (access control)

Most serious API findings are authorization flaws, and scanners cannot prove their absence. Review them by tracing three questions for every endpoint.

1. **Object level**: may _this caller_ touch _this record_? (broken object-level authorization, BOLA)
2. **Function level**: may this caller use _this operation_ at all? (broken function-level authorization, BFLA)
3. **Property level**: may this caller read or set _this field_? (broken object property level authorization, BOPLA, and mass assignment)

## Step 1: build the map

`node scripts/audit.mjs <path> --no-packages` gives the endpoint table (`NONE` = no policy, no fallback, no `AllowAnonymous`) and the **ownership-check candidates**. Treat both as leads, not findings.

## Step 2: object level (BOLA)

For each endpoint that takes an id (route, query or body) find where the record is loaded and ask what ties it to the caller.

Vulnerable: the id alone decides.

```csharp
app.MapGet("/orders/{id:guid}", async (Guid id, AppDbContext db) =>
    await db.Orders.FirstOrDefaultAsync(o => o.Id == id) is { } o ? Results.Ok(o) : Results.NotFound());
```

Fixed (query carries the tenant; a foreign id is simply not found):

```csharp
app.MapGet("/orders/{id:guid}", async (Guid id, AppDbContext db, ITenantContext tenant, CancellationToken ct) =>
    await db.Orders.Where(o => o.TenantId == tenant.Id && o.Id == id).Select(OrderDto.From).FirstOrDefaultAsync(ct)
        is { } dto ? Results.Ok(dto) : Results.NotFound());
```

Acceptable alternatives: a global query filter on the tenant (check that `IgnoreQueryFilters()` is not used), or `IAuthorizationService.AuthorizeAsync(user, order, "OrderOwner")` after loading. **A hit from the script is a false positive when one of these exists in another layer**: say which one and where.

Check also:

- Lists: filtered by tenant/owner, paginated, cap on page size.
- Writes: update/delete load the same way; the tenant is **stamped** on insert from the context, never taken from the request.
- Indirect references: `orderId` inside a payload, parent/child routes (`/customers/{c}/orders/{o}`: does `o` belong to `c`, and `c` to the caller?), file and export download ids.
- Background jobs and message consumers: they run without a user; the tenant must come from the message and be applied explicitly.
- 404 vs 403: a foreign id should look like "not found" so existence does not leak.

## Step 3: function level (BFLA)

- Every endpoint has a policy (or a fallback policy plus an explicit `AllowAnonymous`); admin and management routes have their own, stricter policy.
- Check route groups: a policy on `MapGroup` covers its endpoints; endpoints mapped on the root do not inherit it.
- Compare HTTP methods on one route: `GET` open but `DELETE` unprotected happens when only one verb got a policy.
- Look for "hidden" operations: debug, seed, export, impersonation, health endpoints with detail.
- Policies check **claims/scopes** that the identity provider actually issues, not role strings typed by a client.

## Step 4: property level (BOPLA, mass assignment)

- Request types are dedicated records; no entity is bound from the body (an attacker could set `IsAdmin`, `TenantId`, `Price`).
- Responses are DTOs built with `Select`; no entity, navigation graph or serializer attribute magic that leaks columns (password hashes, internal notes, other tenants' ids).
- PATCH/merge endpoints validate the **result** and allow-list fields.
- Different roles seeing different fields: enforce in the mapping (per-role DTO), not in the UI.

## Step 5: prove it with tests

For each confirmed or suspected item write a **negative test** and attach it (or the missing-test finding) to the report:

- Anonymous -> 401; wrong role/scope -> 403; **another tenant's id -> 404** (and no data in the body); wrong parent in the route -> 404.
- A write with a foreign `TenantId`/owner in the payload is ignored or rejected.
- Property level: a request that sets a protected field does not change it.

## What a good answer looks like

Every endpoint maps to a policy and (where it takes an id) to the line that enforces ownership; every exception has a reason; the negative tests exist and run in CI. If you cannot trace one of these, that is the finding.
