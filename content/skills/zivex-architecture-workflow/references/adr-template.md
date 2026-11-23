# ADR template and baseline set

File: `docs/adr/ADR-0NN-kebab-title.md`, plus an index row in `docs/adr/README.md`. Small decisions go in `docs/project/DECISIONS.md` (`D-NNN: decision - reason - date`). **Accepted ADRs are never edited in substance**: write a new ADR that supersedes the old one (mark it `Superseded by ADR-0xx` or `Superseded in part`).

```markdown
# ADR-0NN: <Title>

- **Status:** Proposed | Accepted (decided by <who> on <date>) | Superseded by ADR-0xx
- **Date:** YYYY-MM-DD
- **Masterplan:** section NN
- **Related:** ADR-0xx

## Context

The forces: requirements, constraints, what goes wrong without a decision. Facts, with sources.

## Decision

What we do, precise enough to implement and to test. Numbered points.

## Enforcement

Which test, analyzer, constraint or CI gate makes the decision mechanical. "Review" alone is not enforcement.

## Alternatives

Each real alternative and why not. At least two for XL decisions.

## Consequences

What gets easier, what gets harder, what we must now do, the migration and rollback path.

## Compliance

Controls this supports (for example ISO 27001 A.8.3, SOC 2 CC6.1, ASVS V8.2, GDPR art. 25). Omit if none.
```

## Baseline ADR set for every new system

Write them even when they confirm the house default: they are audit evidence and the agent's contract.

| #   | ADR                                           | Default answer                                                                                                                                     |
| --- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 001 | Technology baseline                           | .NET 10, EF Core, PostgreSQL, RabbitMQ, Valkey; React, Vite, Tailwind, TanStack Query, Zod; Astro for sites                                        |
| 002 | Modular monolith and persistence              | Modules with `.Contracts`, a schema and DbContext per module, a platform schema for outbox, inbox and audit                                        |
| 003 | Identity integration                          | The central identity provider through OIDC; web uses a backend-for-frontend (tokens never in the browser); native uses the system browser and PKCE |
| 004 | Authorization model                           | Capabilities checked first in every use case; 404 for invisible, 403 for not permitted; a permission-matrix test                                   |
| 005 | Tenancy and isolation                         | Tenant key, query filters, the raw-SQL rule, row-level security for the most critical tiers, cross-tenant negative tests                           |
| 006 | Data classification, retention and deletion   | Per-entity classes, retention, export and erasure paths (GDPR art. 15 to 22)                                                                       |
| 007 | Transactional outbox and idempotent consumers | Change, audit and event in one `SaveChanges`; inbox; at-least-once, unordered                                                                      |
| 008 | API conventions                               | Problem details with a stable `code`, CSRF on unsafe methods, `expectedVersion` -> 409, bounded lists                                              |
| 009 | Hosting, regions and subprocessors            | Hosting provider, EU default, regional option, the subprocessor list                                                                               |
| 010 | Observability and operations                  | OpenTelemetry, liveness and readiness, the never-log list, alerts, backups with restore drills                                                     |
| 011 | Accessibility                                 | WCAG 2.2 AA, a statement where applicable, automated and manual checks                                                                             |
| +   | Native client architecture                    | Only if apps: a headless core with thin platform edges                                                                                             |
| +   | Integration boundary                          | Only if integrations: an integration platform or an interim adapter with a migration path                                                          |
| +   | AI boundary                                   | Only if AI: human review, no direct vendor calls from modules                                                                                      |
| +   | Service extraction                            | Only if a service: why this is a Rust or Go service and not a module                                                                               |
