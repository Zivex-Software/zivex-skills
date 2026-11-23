# Saving, concurrency, transactions, bulk

Sources: learn.microsoft.com/ef/core/saving/{concurrency,transactions,execute-insert-update-delete}, /ef/core/miscellaneous/connection-resiliency (checked).

## SaveChanges

- One `SaveChangesAsync(ct)` call applies all tracked changes **in one transaction** (when the provider supports it). Batch changes in one call rather than many.
- `AutoTransactionBehavior` defaults to `WhenNeeded`; `Never` can leave partial changes: avoid it.
- Keep units of work small and per request; don't hold a context (and transaction) open across user think-time or slow external calls.

## Optimistic concurrency (lost updates)

- Add a concurrency token to entities that several users/processes update: `[Timestamp] byte[] RowVersion` (SQL Server `rowversion`) or `IsConcurrencyToken()` on an app-managed column (Guid you change on every write) for other providers.
- UPDATE/DELETE get `WHERE Id = @id AND RowVersion = @original`; zero rows -> `DbUpdateConcurrencyException`. Inserts don't raise it (unique violations are provider exceptions).
- Round-trip the token through the API (ETag/`If-Match` or a `rowVersion` field): without the **client's** original value the check is meaningless.
- Handling: catch `DbUpdateConcurrencyException`, then either return 409 Conflict (best for APIs; client reloads/merges) or reload (`GetDatabaseValuesAsync`), merge and retry **with a bounded number of attempts** (the docs sample loops without a cap: add one). Don't retry blindly on user-visible edits.
- Alternative: higher isolation levels (repeatable read/snapshot) in an explicit transaction; heavier, deadlock-prone.

## Transactions

- Default (single `SaveChanges`) is enough for one aggregate. For several `SaveChanges` that must be atomic: `await using var tx = await db.Database.BeginTransactionAsync(ct); ...; await tx.CommitAsync(ct);`.
- Savepoints are created automatically when `SaveChanges` runs inside an existing transaction (not with MARS).
- Cross-context/cross-module atomicity: avoid distributed transactions; use an **outbox** (write the event in the same transaction, publish asynchronously) and idempotent consumers.
- `TransactionScope` has no async commit/rollback; prefer `BeginTransactionAsync`.

## Retries and transactions (connection resiliency)

- `UseSqlServer(cs, o => o.EnableRetryOnFailure())` retries each query and each `SaveChanges` as a unit and **buffers results** (more memory). The SQL Server defaults are 6 retries and a 30-second maximum delay (`EnableRetryOnFailure` API reference); set them explicitly if it matters.
- With a retrying strategy a user-initiated transaction throws ("does not support user-initiated transactions"). Wrap the whole unit:

```csharp
var strategy = db.Database.CreateExecutionStrategy();
await strategy.ExecuteAsync(async () =>
{
    await using var tx = await db.Database.BeginTransactionAsync(ct);
    // ... changes + SaveChangesAsync ...
    await tx.CommitAsync(ct);
});
```

- Everything inside the delegate may run **more than once**: make it idempotent, don't send emails/publish messages inside it. For commit-ambiguity use `ExecuteInTransactionAsync(..., verifySucceeded)` (see the connection-resiliency page).

## ExecuteUpdate / ExecuteDelete (set-based)

- Great for "mark all expired", "delete where": one statement, no entity loading. EF 10: `ExecuteUpdateAsync` accepts a regular (non-expression) lambda for conditional setters and can update JSON complex-type properties.
- Caveats from the docs: the **change tracker is not updated** (a tracked entity keeps its old values and a later `SaveChanges` may overwrite the bulk change: don't mix on the same entities); **no implicit transaction** (each call is its own transaction: wrap multiple calls in `BeginTransactionAsync`); **no automatic concurrency check** (add the token to `Where` and check the returned row count); one table only, no batching of several calls; no navigation in `SetProperty` (project first).
- Inserts remain `Add/AddRange` + `SaveChanges`. For very large imports use provider bulk APIs (e.g. `SqlBulkCopy`) outside EF, in their own module code, with validation.

## Patterns

- Aggregates: load the root (with children it owns), apply behaviour methods, save once. Don't expose `DbSet`s outside the module.
- Idempotent commands: unique index on an idempotency key; catch the unique violation and return the earlier result.
- Soft delete: `IsDeleted` + filter; hard-delete jobs for retention/GDPR erasure are separate, audited jobs.
- Audit fields (`CreatedAt/By`, `UpdatedAt/By`): set in a `SaveChangesInterceptor`, not scattered in handlers.
- Domain events: collect on entities, dispatch after a successful commit (outbox if delivery must be guaranteed).
