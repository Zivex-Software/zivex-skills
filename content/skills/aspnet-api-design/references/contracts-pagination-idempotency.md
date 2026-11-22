# Contracts, pagination, idempotency, long operations

Sources: learn.microsoft.com/aspnet/core/fundamentals/best-practices, /ef/core/querying/pagination, /release-notes/aspnetcore-10.0 (checked).

## Pagination shapes

- **Offset**: `GET /orders?page=2&size=50` -> `{ items, page, size, total }`. Simple, random access, but slower deep pages and unstable under concurrent writes; `total` costs a `COUNT(*)`: make it optional.
- **Keyset/cursor** (recommended for large/live data): `GET /orders?after=<opaque cursor>&size=50` -> `{ items, next }`. Cursor = encoded last sort key(s) (opaque, signed or at least validated); ordering must be unique; see `aspnet-data-efcore`.
- Always cap `size` (e.g. max 100) and default it; never return an unbounded collection; return a `Link`/`next` rather than making clients compute URLs.
- Document sort and filter whitelists (`sort=-createdAt`, `status=open`): map them to fixed expressions; never concatenate into SQL.

## Resource design

- Nouns, plural, hierarchical only when ownership is real (`/orders/{id}/lines`); actions that aren't CRUD as sub-resources or `POST /orders/{id}/cancel`.
- `PUT` full replace (idempotent), `PATCH` partial: use JSON Merge Patch (`application/merge-patch+json`) or .NET 10's `Microsoft.AspNetCore.JsonPatch.SystemTextJson` for RFC 6902; validate the **result**; never patch entities directly.
- Dates in ISO 8601 UTC; money as decimal + currency code (string/decimal, never double); ids as strings/GUIDs; enums as strings; avoid leaking DB surrogate details if ids must not be guessable (authorization still required).
- Response records are stable: add fields, don't repurpose. Nullable vs missing is a contract: document it.

## Concurrency control

- Return an `ETag` (row version) on GET; require `If-Match` on PUT/PATCH/DELETE; 412 Precondition Failed when stale (or 409). Pairs with EF concurrency tokens.
- Conditional GET with `If-None-Match` -> 304 (output caching revalidation does this automatically).

## Idempotency

- Safe retries need idempotent operations: `PUT`/`DELETE` by design; for `POST` accept `Idempotency-Key: <uuid>`: store (key, request hash, response) for a window; same key + same body -> replay the stored response; same key + different body -> 422/409.
- Unique constraint on the key makes concurrent duplicates fail safely. Required when clients/gateways retry (see `aspnet-resilience`: resilience handlers retry **all** methods unless disabled).

## Long-running operations

- Return **202 Accepted** with `Location: /operations/{id}` and a status resource (`pending|running|succeeded|failed`, result link, error ProblemDetails); work runs in a `BackgroundService` + `Channel<T>` or a broker, not in the request. Optional webhook callback with signature.
- Don't keep HTTP requests open for minutes; request timeouts only cancel the token.

## Streaming

- Large exports: `IAsyncEnumerable<T>` (JSON array streamed) or NDJSON; never build the whole payload in memory.
- Server push: .NET 10 `TypedResults.ServerSentEvents(IAsyncEnumerable<SseItem<T>>)` (minimal APIs and controllers); include event ids for resumption; apply auth and a per-user connection limit.

## Bulk operations

- Prefer `POST /orders/batch` with per-item results (207-style body or an array of results) and a max batch size; keep each item's validation/authorization independent; document partial-failure semantics.

## Contract hygiene checklist

1. Request/response records only; no entities; no internal ids/paths/stack traces.
2. Status codes + ProblemDetails documented in OpenAPI.
3. Pagination capped; sort/filter whitelisted.
4. Auth policy on the group; ownership checks in the handler.
5. Idempotency/ETag where clients may retry or edit concurrently.
6. Backwards compatibility reviewed (OpenAPI diff) before merge.
