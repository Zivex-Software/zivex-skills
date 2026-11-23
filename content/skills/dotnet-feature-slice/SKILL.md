---
name: dotnet-feature-slice
description: Implements one use case as a vertical slice inside a .NET module - request, validation, authorization, handler, persistence, endpoint, error mapping and tests together, mirroring the module's existing slices. Use when adding or changing a feature or endpoint.
---

# Build a feature slice

A slice is one use case from HTTP edge to database, in one folder, with its tests. Mirror the module's existing slices; only default when there are none.

## Start here (module first)

1. Identify the module and read its `AGENTS.md`; open **one existing slice** and treat it as the pattern (folder layout, handler style, result type, validation library, endpoint style).
2. Stay inside the module. If the feature needs another module's data or behaviour, use its `.Contracts` interface (`dotnet-module-contract`); never its internals or tables.
3. If the use case belongs in another module, say so before writing code.

## Workflow

1. **Pin the use case**: actor, input, output, rules, who may do it, what happens on each failure, idempotency, volumes. Ask if any is unclear. Write the contract (route, request/response, status codes) down first (`aspnet-api-design`).
2. **Mirror the pattern** in `Features/<UseCase>/` (see `references/slice-anatomy.md` for the default shape): request record, validator, handler, endpoint mapping. Keep types `internal` unless another module needs them (then expose via the contract).
3. **Implement edge to edge**: bind -> validate -> authorize (policy + ownership/tenant on the loaded resource) -> handler (rules, persistence) -> map to a response DTO -> typed result. Endpoints stay thin.
4. **Persistence**: query only what you need (`Select`, `AsNoTracking`), one `SaveChangesAsync`, concurrency token where lost updates matter, a migration if the model changed (`aspnet-data-efcore`).
5. **Errors**: throw/return domain errors; one global handler maps them to ProblemDetails; no exception text to the client.
6. **Tests** (`dotnet-testing`): handler tests for rules and failures, one integration test through the real pipeline and database for the happy path, plus the negative authorization test.
7. **Apply the installed ASP.NET skills**: `aspnet-security` (authz, input), `aspnet-performance` (async, caching), `aspnet-resilience` (outbound calls), `aspnet-observability` (logging/metrics for the use case).
8. **Verify** with `dotnet-verify` (`node ../dotnet-verify/scripts/affected.mjs --run`).

## Rules

- Never leak persistence entities through the endpoint or contract; map to DTOs.
- No business logic in the endpoint lambda; no HTTP concepts in the handler.
- One use case per slice; shared helpers only after the second real use, and inside the module.
- Don't touch unrelated slices; refactors are separate commits.
- State changes are never GET; creating returns 201 with `Location`; caller mistakes are 4xx.

## References

- `references/slice-anatomy.md` - folder layout, a complete worked slice (request, validator, handler, endpoint, test), result and error handling, variations (queries vs commands, events).
- `references/slice-checklist.md` - done-definition per slice.
- `references/mapping-and-persistence.md` - DTO mapping, loading aggregates, concurrency, transactions and outbox inside a slice.
