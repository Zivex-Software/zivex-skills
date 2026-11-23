# Integration events and the outbox

## Integration events

- Defined in the **publisher's** `.Contracts`; consumers reference that contract. Immutable record, past tense, carries the ids and the facts consumers need (not the whole aggregate): `OrderPaid(Guid OrderId, Guid TenantId, decimal Amount, string Currency, DateTimeOffset PaidAt)`.
- Include: a unique **event id** (dedupe), **occurred-at**, the business id(s), tenant, and a schema **version** if events are persisted or leave the process.
- Never include secrets or more personal data than consumers need; events are copied around and stored.
- Meaning never changes. If meaning must change, publish a new event type.

## Delivery guarantees

- In-process publishing (a handler call after commit) loses events if the process crashes between commit and publish. If an event matters (money, stock, notifications that must happen), use the **transactional outbox**.
- Assume **at-least-once** delivery: consumers will see duplicates and sometimes out-of-order events.

## Outbox pattern

1. In the same database transaction as the state change, insert an `OutboxMessage` row (id, type, payload JSON, occurred-at, processed-at null).
2. A background worker (`BackgroundService`) reads unprocessed rows (in order, in batches), publishes them (in-process dispatch or broker), then marks them processed. Use `SELECT ... FOR UPDATE SKIP LOCKED` (or equivalent) or a single active worker so rows aren't double-published.
3. Failures: retry with backoff; after N attempts move to a dead-letter state and alert.
4. Housekeeping: delete or archive processed rows after a retention period.

```csharp
// inside the handler, same SaveChangesAsync as the state change
db.Outbox.Add(OutboxMessage.From(new OrderPaid(order.Id, order.TenantId, order.Total, order.Currency, now)));
await db.SaveChangesAsync(ct);
```

Many libraries provide this (MassTransit, Wolverine, NServiceBus, CAP): use the repo's choice; if none, a small hand-written outbox per module is fine. Check the library's current docs before adopting.

## Idempotent consumers

- Store processed event ids (inbox table with a unique index) **in the same transaction** as the consumer's effect, or make the effect naturally idempotent (upsert, set-to-value, unique constraint).
- Handle: duplicates (skip), out-of-order (compare version/occurred-at; or design commutative updates), unknown event versions (log and skip safely), poison messages (dead-letter).
- A consumer must not call back into the publisher synchronously from its handler in a way that can cycle; if it needs to react, it publishes its own event.

## Testing events

- Serialisation round-trip test for every event type (guards accidental breaking changes: field renamed = test fails).
- Consumer test: deliver the same event twice -> effect once; deliver old-version payload -> still handled.
- Publisher test: the outbox row is written in the same transaction (roll back the transaction -> no row).
- Integration test across modules in the host project: publish -> consume -> observable result.

## Operational signals

- Metrics: outbox backlog size and age, publish failures, dead-letter count, consumer lag. Alert on age, not just count. See `aspnet-observability`.
- Logs: event id and type with every publish/consume (no payloads).
