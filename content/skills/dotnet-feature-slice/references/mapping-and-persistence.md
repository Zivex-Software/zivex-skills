# Mapping and persistence inside a slice

## Mapping

- Map entity -> response with an explicit projection in the query (`Select`) for reads, or a small explicit method for writes. Hand-written mapping is boring and safe; reflection-based mappers hide missing/extra fields (and over-exposure).
- Never bind request bodies to entities (over-posting); map request -> command values explicitly.
- Keep enums, ids and money types consistent between entity, contract and API (money = `decimal` + currency code, never `double`).

## Loading aggregates

- Load the aggregate root and what it owns; modify through behaviour methods that enforce invariants; save once.
- Don't load for a decision that SQL can make: `ExecuteUpdateAsync` for set-based updates (note it bypasses the change tracker and concurrency tokens; add the token to `Where`).
- For reads, never load an entity graph to return a few fields: project.

## Concurrency and idempotency

- Concurrency token (`rowversion`/version column) on entities edited by several actors; expose the version to clients (ETag / field) and require it on update; map `DbUpdateConcurrencyException` to 409.
- Idempotent commands: unique index on an idempotency key; on duplicate return the stored outcome instead of repeating the work.

## Transactions

- `SaveChangesAsync` is one transaction. For several saves that must be atomic use an explicit transaction **inside** `CreateExecutionStrategy().ExecuteAsync(...)` if retries are enabled; keep it short; no external calls inside.
- Cross-module atomicity: don't. Write an outbox message in the same transaction and let the other module react (idempotently).

## Domain events inside a slice

- Collect events on the aggregate; after a successful `SaveChangesAsync` dispatch in-process handlers (same module) and write integration events (cross-module) to the outbox **in the same save**.
- Handlers that react must tolerate duplicates and out-of-order delivery.

## Validation split

- **Shape** (required, length, format, range) -> validator at the edge (400).
- **Rules** (uniqueness, state transitions, limits) -> handler/domain (409/422), using the database as the arbiter (unique index + catch violation) not check-then-insert.

## Reading list for details

`aspnet-data-efcore` (queries, concurrency, migrations), `aspnet-api-design` (contracts, errors), `dotnet-module-contract` (events, outbox).
