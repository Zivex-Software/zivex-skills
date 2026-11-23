# Pre-merge checklist

Tick each line or write why it does not apply. Items link to the skill that goes deeper.

## Behaviour and tests

- [ ] The change does what the request says (re-read the request, not your summary of it).
- [ ] A test fails without the change and passes with it (bug fix: reproduces the bug first). `dotnet-testing`
- [ ] Happy path, validation failure, authorization failure and the edge cases the change introduces are covered.
- [ ] Existing tests were not deleted, skipped or loosened to pass; if one changed, the reason is stated.
- [ ] Tests are deterministic (no sleeps, wall-clock, random, order dependence). `dotnet-testing/scripts/check-tests.mjs`

## Build, format, analyzers

- [ ] `dotnet build` of every affected project: 0 errors, no new warnings you introduced.
- [ ] Format check passes (`dotnet format --verify-no-changes`) where the repo enforces it.
- [ ] No leftover debug code, commented-out code, `TODO` without an issue, or stray files.

## Scope and structure

- [ ] Only the files the task needs were changed; no drive-by renames or reformatting.
- [ ] Work stayed inside the module; other modules are touched only through `.Contracts`. `dotnet-module-boundary-check`
- [ ] New code follows the module's slice/layout and the repo's conventions (`AGENTS.md`). `dotnet-feature-slice`

## Contracts

- [ ] Public contract changes are intentional; `contract-diff.mjs` shows only additive changes, or every consumer was updated in the same change. `dotnet-module-contract`
- [ ] API changes (routes, status codes, payloads) are reflected in OpenAPI and are backwards compatible or versioned. `aspnet-api-design`

## Data

- [ ] A migration exists when the model changed; it was reviewed (SQL), is safe for the previous app version (expand/contract), and was **not** applied to a shared database. `aspnet-data-efcore`
- [ ] No N+1, unbounded queries, client-side filtering; concurrency/transaction needs considered.
- [ ] Tenant/soft-delete filters apply; no `IgnoreQueryFilters()` without justification.

## Security and privacy

- [ ] Input validated at the boundary; authorization and ownership/tenant checks on new endpoints and queries. `aspnet-security`
- [ ] No secrets, tokens, connection strings or personal data in code, config, tests or logs.
- [ ] `check-security.mjs` run on the module; every hit confirmed or dismissed with a reason.

## Reliability, performance, operability

- [ ] Outbound calls have timeouts, cancellation and (idempotent) retries only. `aspnet-resilience`
- [ ] No blocking calls (`.Result`, `.Wait()`), no `HttpContext` captured in background work. `aspnet-performance`
- [ ] Logging uses templates, the exception object, ids (no PII); health/metrics updated where behaviour is operationally relevant. `aspnet-observability`

## Documentation and handover

- [ ] The module's `AGENTS.md`, README and OpenAPI reflect new public behaviour.
- [ ] The verification report lists commands run, what was not run, and open risks. `references/report-template.md`
