# Checklists

## Feedback loop (after EVERY C# change, in order)

1. `dotnet build --no-restore` -> 0 warnings, 0 errors.
2. Regenerate the web client when any endpoint, request, response or contract changed (`npm run generate-api`, or your `sync` script).
3. `npm run typecheck` in the web project.
4. Targeted tests only: `dotnet test --project tests/<Project> --filter-class "*X"` (Microsoft.Testing.Platform syntax; with the default VSTest runner use `dotnet test <path> --filter "FullyQualifiedName~X"`).

Never say "done" without 1 to 3 green; otherwise say "written, not yet run".

## Definition of done (a slice)

- The anatomy equals the golden example; `RequireModule` present; no forbidden constructs.
- Tenant and branch are stamped and filtered; a cross-tenant test expects 404.
- `decimal` money; cache keys through `CacheKeys`; the event contract is in `Contracts/{Module}/`.
- Feedback loop 1 to 3 green; targeted tests green.
- `openapi/openapi.json` is committed with the change and the generated client is regenerated.
- No secrets; connection strings only from `ConnectionStrings`.

## Review of a slice

Path and one-per-file; anatomy order; policy; profile consistency; tenant rules; decimal, UUIDv7, `TimeProvider`; cache keys; event after save (FAST) or in the same save (STRICT); problem details `code`; bounded lists; tests.

## Deploy checklist

Two container applications (API with health `/health/live`, web with its own health endpoint); environment variables `ConnectionStrings__postgres|rabbitmq|valkey`; rolling update; migrations as a separate expand -> migrate -> contract step; a backup before a migration; note the previous image digest for rollback.

## Common mistakes

A repository or service layer added; `IgnoreQueryFilters()`; an unprefixed cache key; `TenantId` taken from the request; `double` money; a hand-edited generated client; forgetting client generation; a hard-coded host; an endpoint without a policy; mixed profiles; a new project per module.
