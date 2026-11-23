# Reviewing a slice

Review in this order; stop and ask when one step fails, because later steps depend on it.

## 0. Inventory

```text
node scripts/slice-inventory.mjs <repo> --module <Module>
```

The table shows per slice: endpoint, handler, validation, authorization hint, cancellation token, and the number of test files that mention the slice. The heuristics look at text: a gap means "look here", not "this is broken". A `--strict` run is a cheap CI gate (it fails on a slice with no endpoint or handler, no authorization hint or no tests).

## 1. Contract

- Route, method and status codes make sense; creating returns 201 with `Location`; failures are 4xx problem details with a stable `code`.
- Request and response are dedicated records; no entity in or out (`aspnet-api-design`).
- Lists are paginated with a capped page size.

## 2. Authorization before anything else

- A policy or capability check is the first statement (or the endpoint/group carries the policy), and nothing validates or parses before it.
- Ownership: the loaded record is tied to the caller (tenant or owner in the query, a global filter, or an `AuthorizeAsync`). See the authorization review in `aspnet-security-audit`.

Red flag and fix:

```csharp
// before: the id alone decides, and validation runs before authorization
var errors = Validate(request);
var order = await db.Orders.FindAsync(id);

// after: capability first, then validate, then a tenant-scoped load
await access.EnsureAsync(Capabilities.OrdersManage, ct);
var order = await db.Orders.SingleOrDefaultAsync(o => o.Id == id && o.TenantId == tenant.Id, ct)
    ?? throw new NotFoundException("order");
```

## 3. Behaviour and data

- Business rules live in the domain object, not the endpoint or a chain of `if`s in the handler.
- One `SaveChangesAsync`; audit and outbox event in the same save when the profile requires it; no event published before the save succeeds.
- A concurrency token where lost updates matter, mapped to 409; unique-index races handled as 409, not as a check-then-insert.
- Reads project with `Select`/`AsNoTracking`; no N+1 (`aspnet-data-efcore`).

## 4. Operations

- `CancellationToken` reaches every I/O call; outbound calls have timeouts and (idempotent) retries only.
- Logging uses templates and ids; nothing secret or personal is logged.

## 5. Tests

- Handler tests: success, each rule failure, edge cases. One integration test through the real pipeline and database. The negative authorization test (another tenant or user gets 404).
- The inventory shows at least one test file mentioning the slice; open it and check it asserts behaviour, not just that code runs (`dotnet-testing/scripts/check-tests.mjs` flags tests without assertions).

## Comment template

```markdown
**Slice**: CancelOrder (Orders)
**Blocking**: ownership is not checked on load (`CancelOrder.cs:31`): another tenant's order can be cancelled. Add the tenant to the query and a negative test.
**Should fix**: no cancellation token passed to `SaveChangesAsync`; the endpoint returns the entity (use `OrderResponse.From`).
**Nit**: rename `Req` to `CancelOrderRequest` (names become schema names in OpenAPI).
**Checked**: inventory run (no gaps after the fixes), `dotnet test` of the Orders tests.
```
