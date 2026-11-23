# The 16 engineering rules

Each rule: what, why, mechanism (what makes it true), test (what fails when it breaks).

## 1. Identity: consume it, never build it

- **What**: no own auth, users, organisations or memberships; use the central identity provider via OIDC. Web apps use a backend-for-frontend so tokens never reach browser JavaScript and never sit in `localStorage`/`sessionStorage`. Native apps use PKCE with the system browser. Product permissions and entitlements are never put inside tokens.
- **Why**: authentication is the most expensive thing to get subtly wrong; one provider means one place to fix, audit and harden.
- **Mechanism**: OIDC client library, BFF endpoints, cookie settings (`HttpOnly`, `Secure`, `SameSite`).
- **Test**: OIDC integration tests; a frontend bundle check that no token handling exists in browser code.

## 2. Authorization first

- **What**: every use case starts with a capability check (`EnsureAsync(Capabilities.X)`), never with role names, and nothing parses or validates input before it. Invisible resource -> 404; visible but not permitted -> 403.
- **Why**: validation before authorization leaks existence and behaviour to unauthorised callers (found three times in one codebase).
- **Mechanism**: the check is the first statement of the use case; query parameters are nullable and validated inside the use case after the check; uploads are read after it.
- **Test**: a permission-matrix test per endpoint (401 anonymous, 403 wrong capability, 404 foreign tenant).

## 3. Tenant isolation is absolute

- **What**: every tenant-owned entity carries the tenant key and is filtered globally; raw SQL names the tenant column; unique indexes lead with it; new multi-tenant systems add PostgreSQL **FORCE row-level security** with a restricted application role as a second layer.
- **Why**: one missed filter is a data breach; two independent layers make a single mistake survivable.
- **Mechanism**: `ITenantEntity`, global query filter, stamping on save (never from the request), RLS policies, `IgnoreQueryFilters()` forbidden.
- **Test**: every new resource gets a cross-tenant negative test; RLS tests connect as the restricted role.

## 4. Atomic change

- **What**: state change + audit entry + outbox event in **one** transaction. Consumers are idempotent (inbox table). Delivery is at-least-once and unordered. Events carry ids and minimal facts, never secrets, content or personal data.
- **Why**: publishing after commit loses events on a crash; publishing before commit announces changes that never happened.
- **Mechanism**: outbox table written by `SaveChangesAsync`, relay worker, inbox with unique message id.
- **Test**: transaction-rollback test (no outbox row); duplicate-delivery test (effect once).

## 5. No silent overwrites

- **What**: editable aggregates take `expectedVersion`; a mismatch returns 409 `version_conflict` with a message that tells the user to reload and re-apply.
- **Mechanism**: a version column and an `EnsureVersion` check. **Test**: two concurrent updates -> one 409.

## 6. Values

- **What**: ids are UUIDv7 (`Guid.CreateVersion7(time.GetUtcNow())`); human-readable numbers (`CUS-000123`) are never keys. Time comes from an injected `TimeProvider`, is stored in UTC and shown in the user's zone. Money is `decimal` plus a currency code, never floating point.
- **Mechanism**: analyzers banning `DateTime.Now/UtcNow` and `double` in money types; id factory. **Test**: fake clock tests, rounding tests.

## 7. Errors

- **What**: problem details (RFC 9457) with a stable machine `code` (new repositories: `area.snake_reason`) that clients switch on, and a sentence that tells the user what to do ("Someone else changed this job since you opened it. Reload it and apply your change again.").
- **Mechanism**: typed exceptions or outcome types mapped in one handler. **Test**: contract tests on codes; no stack traces or internals in bodies.

## 8. Never log

- **What**: secrets, tokens, cookies, passwords, codes, personal data, free-text bodies, request bodies. Structured, source-generated logging; metric tags low-cardinality.
- **Mechanism**: `[LoggerMessage]` with ids only; forbidden-pattern tests. **Test**: sentinel strings pushed through the system must not appear in logs.

## 9. Secrets

- **What**: secrets only in the host secret store; application-level secrets encrypted with a purpose-bound protector (AES-256-GCM); write-only in APIs; shown once.
- **Mechanism**: secret store, secret scanning in CI. **Test**: scanner in CI; API tests that secrets are never returned.

## 10. Outbound requests to user-supplied URLs

- **What**: only through an SSRF-safe client: DNS checked at connect time, no redirects into private ranges, bounded in size and time.
- **Test**: SSRF tests against loopback, link-local and metadata addresses.

## 11. Development-only code

- **What**: dev identity and fakes cannot run outside Development: startup guards, tests, and a production bundle check.

## 12. Migrations

- **What**: an explicit deploy step (a worker `migrate` command or pipeline job), never at API startup; expand -> migrate -> contract so old and new versions can run together.

## 13. Dependencies

- **What**: needed? maintained? permissive licence? pinned centrally with lock files? no runtime telemetry? `dotnet restore --locked-mode` in CI; vulnerability scan per release.

## 14. Accessibility

- **What**: WCAG 2.2 AA on every UI: keyboard, focus, contrast, labels, 390 px width, reduced motion; automated (axe) and manual checks.

## 15. Honest status

- **What**: `STATUS.md` as an `Item | Status | Evidence` table with `VERIFIED / TESTED / IMPLEMENTED / DESIGNED / NOT_STARTED`, generated test counts, and "written, not yet run" when tests did not run. Never claim more than the evidence.

## 16. Git

- **What**: commit messages are a plain sentence stating what now holds, with an optional `Area:` prefix, ADR or section references and honesty markers (`(tests written, not yet run)`); no conventional-commit prefixes unless the repo already uses them. Agents commit on worktree branches with a `Co-Authored-By` trailer where the repo allows; **a human maintainer pushes, merges and deploys**.
