# Contract design

## Interface or event?

| Need                                            | Use                                                            | Notes                                                                                          |
| ----------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| "Give me X now" / "do Y and tell me the result" | synchronous **interface** call (`IBillingApi.GetInvoiceAsync`) | in-process; the caller depends on the owner being available; keep calls coarse, not chatty     |
| "Something happened, whoever cares can react"   | **integration event** (`OrderPaid`)                            | asynchronous, at-least-once, consumers are idempotent; decouples availability and deploy order |
| Need data from another module on every request  | a local **read model** fed by its events                       | removes runtime coupling and cross-module joins                                                |

Default to events for notification and to interfaces for queries/commands that need an answer. Avoid request/response over events.

## Shape rules

- **DTOs**: immutable `record`s with `init`/primary-constructor members; explicit nullability (`string?` means optional); no behaviour, no entity or ORM types.
- **Collections**: `IReadOnlyList<T>`/`IReadOnlyCollection<T>`, never `List<T>` or arrays you expect callers to mutate; bound them (page size).
- **Identifiers**: `Guid`/`string` ids (or strongly typed wrappers) - never surrogate integer ids that leak storage details; include the owning tenant where relevant.
- **Money**: `decimal` + currency code. **Time**: `DateTimeOffset` (UTC) or `DateOnly`; never local `DateTime`.
- **Enums**: add values only at the end; consumers must tolerate unknown values (treat as "other"); never reorder or renumber. Serialised as strings in events.
- **Cancellation**: every async method takes a `CancellationToken`.
- **Naming**: `I<Module>Api` or narrow interfaces per capability (`IOrderQueries`, `IOrderCommands`); events past tense (`OrderCancelled`); DTOs `<Thing>Dto`/`<Thing>Summary`.

## Errors

- Expected failures are part of the contract: return a result type (`Result<T>` with error codes) or define documented exceptions in the contracts project. Unexpected failures throw.
- Don't leak implementation exceptions (EF, SQL) across the boundary; map them in the implementation.
- Authorization: the contract takes the **caller context** it needs (user/tenant id) explicitly; the owning module enforces its own rules.

## Granularity

- One interface per consumer need beats a god-interface; 3-7 members is healthy. A contract that keeps growing signals a wrong boundary (see the extracting-a-module reference of `dotnet-module`).
- Batch operations over loops of calls; no N+1 across modules (`GetByIdsAsync`).

## Evolving a contract

- **Additive first**: new optional members, new interface methods only if consumers don't implement the interface (otherwise add a new interface or default interface members), new event fields with safe defaults for old messages, new enum values at the end.
- **Replace, don't change**: to change meaning, add `V2` (new event/method), migrate consumers, then remove the old one in a later release.
- **Deprecate**: mark `[Obsolete("Use X; removal planned for <date/release>")]`, keep it working, track remaining consumers (`contract-diff.mjs`, search for usages), remove when none are left.
- **Event versions**: keep old and new event types side by side during migration; publish both until all consumers moved.
- Inside a monolith a coordinated breaking change is possible (all consumers compile together): do it **in one change** with all consumers updated and tests green, and call it out in the PR. Once a contract is exposed outside the repo (public API, shared package), it needs real versioning.

## Documentation

- XML doc comments on every public member: preconditions, errors, idempotency, ordering guarantees, null/empty semantics.
- Record the contract in the module's `AGENTS.md` (purpose + list of public types) so agents and humans can find it.
