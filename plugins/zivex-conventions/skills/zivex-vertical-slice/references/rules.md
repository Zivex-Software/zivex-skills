# Rules

## Architecture

- **One** API project (`src/Api/Api.csproj`, namespace `Api`). Modules are folders (for example Catalog, Orders, Billing).
- Vertical slice: one file per feature, `Features/{Module}/{Action}.cs`, with top-level `{Action}Request` and `{Action}Response` records, validation (FAST validator class or STRICT `Validate()`), `public sealed class {Action} : IFeature` (a static `Map` and `HandleAsync`), and a direct EF Core query.
- Shared code only in `Common/` (TenantContext, ITenantEntity, AppDbContext, ModuleAuthorization, CacheKeys, ApiResults, IFeature). Events in `Contracts/{Module}/`. **Modules talk through events and contracts, never into another module's `Features/`.**
- Forbidden: repositories, `IXxxService` layers, AutoMapper/Mapster, MediatR, controllers, extra projects per module, `IgnoreQueryFilters()`, float or double money.
- FAST additionally allows **only** MassTransit and FluentValidation. STRICT forbids them: its own transactional outbox plus consumers with an inbox, hand-written validation, capability check first, warnings as errors, architecture tests.

## Multi-tenancy

- Every entity implements `ITenantEntity { Guid TenantId; Guid? BranchId; }`.
- A global query filter per entity on `TenantId`; `BranchId == null` means organisation-wide, a value means visible to that branch (or the organisation scope).
- Stamp `TenantId`/`BranchId` from the tenant context on insert; throw on cross-tenant writes; **never accept them from the request**.
- Raw SQL names `tenant_id` and `branch_id` and is parameterised. Unique indexes lead with `tenant_id`.
- Every resource gets a cross-tenant negative test (404).

## Authorization

- A policy `Module:{Name}` per module; every endpoint `.RequireModule(ModuleNames.X)`. Anonymous only for health and OpenAPI. 403 for not permitted, 404 for another tenant's row.

## Values

- `decimal` for money, VAT and lease amounts with explicit precision; currency code next to every amount.
- UUIDv7 ids; `TimeProvider`; UTC `DateTimeOffset`. Errors are RFC 9457 problem details with a stable `code`.

## Infrastructure

- Connection strings only through `ConnectionStrings` with agreed names (`postgres`, `rabbitmq`, `valkey`): injected by your local orchestrator in development and by environment variables (`ConnectionStrings__postgres`) in production.
- MassTransit (FAST): event records `{Thing}{PastTense}Event` in `Contracts/{Module}/`, ids and minimal facts, publish after save, idempotent consumers.
- HybridCache keys through `CacheKeys`, always prefixed `tenant:{TenantId}:branch:{BranchId}:` (`all` for a null branch); invalidate in the write slice. Check current library licensing before adopting a messaging library.
- Health: `/health/live` (no dependencies) and `/health` (database, broker, cache); no details in the response.
- Migrations are an explicit deploy step, never at startup in production.
- OpenAPI at `/openapi/v1.json`, written at build time to a committed `openapi/openapi.json`; the web client is generated from it.
