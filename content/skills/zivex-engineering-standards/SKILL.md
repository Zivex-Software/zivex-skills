---
name: zivex-engineering-standards
description: The Zivex house engineering standards for .NET systems - strict-by-default tooling, the default technology matrix, what needs an ADR, and 16 non-negotiable rules (authorization first, tenant isolation, atomic change with outbox, versioned updates, UUIDv7, problem details with stable codes, safe logging, secrets, migrations, honest status). Opt-in, use when a team wants to code the Zivex way, or to review code against it.
---

# Zivex engineering standards

An **opt-in** house style: strict languages, a compiler and tests that catch mistakes (including an AI's), and rules that are enforced by mechanisms, not good intentions. Adopt it as a whole or take the rules you like; the generic `dotnet-*` and `aspnet-*` skills work without it.

## Start here (module first)

1. Identify the module you work in and read its `AGENTS.md`. **The repository's existing conventions and ADRs win over these defaults**: follow the closest existing code, and write an ADR instead of silently deviating.
2. When this skill is installed it **overrides generic defaults** of the other skills where they differ (for example: no generic repositories, no MediatR/AutoMapper without an ADR, plain xUnit asserts).
3. Work inside one module; touch others only through their `.Contracts`.

## Guiding principle: strict by default

- Warnings are errors, nullability and analysis are at their strictest, and architecture rules are executable (architecture tests, analyzers, database constraints, CI gates). Settings: `references/strictness.md`.
- Never weaken a check to make code pass: fix the code, or write an ADR that explains the exception.
- A rule without an enforcement mechanism is a wish. Say which test, analyzer, constraint or gate enforces each rule you add.

## How to apply

1. **Choosing technology**: start from `references/technology-matrix.md` (house defaults, adapt them to your organisation). Anything on its "Not without an ADR" list needs an ADR first.
2. **Writing or reviewing code**: walk the 16 rules in `references/engineering-rules.md` for the change; each rule names its mechanism and test. The most violated ones, in order: authorization before validation, tenant filter on every query, state change + audit + outbox event in **one** save, no secrets or personal data in logs.
3. **How the code looks**: `zivex-dotnet-code-style` (layout, classes, endpoints, errors, EF, tests).
4. **Slice shape and profiles**: `zivex-vertical-slice`. **Design and build workflow**: `zivex-architecture-workflow`, `zivex-build-workflow`. **Controls and evidence**: `zivex-compliance-by-construction`.
5. **Verify** with `dotnet-verify`; report honestly what was and was not run.

## The rules at a glance (full text in the reference)

1. Never build auth, users or organisations: consume the central identity provider (OIDC); no tokens in browser JS; no product permissions inside tokens.
2. Authorization first: every use case starts with a capability check; nothing parses or validates input before it; invisible resource -> 404, not permitted -> 403.
3. Tenant isolation is absolute: tenant key on every tenant-owned entity, global filters, raw SQL names it, unique indexes lead with it, database row-level security as a second layer, cross-tenant negative tests.
4. Atomic change: state + audit entry + outbox event in one transaction; idempotent consumers; at-least-once, unordered delivery; events carry ids and minimal facts.
5. No silent overwrites: `expectedVersion` -> 409.
6. Values: UUIDv7 ids, injected `TimeProvider`, UTC storage, `decimal` + currency for money.
7. Errors: problem details with a stable machine `code` and a sentence that says what to do.
8. Never log secrets, tokens, personal data or request bodies; source-generated, structured logging.
9. Secrets only in the host secret store; write-only in APIs; purpose-bound encryption.
10. Outbound requests to user-supplied URLs only through an SSRF-safe client.
11. Development-only code cannot exist outside Development (guards + tests + bundle check).
12. Migrations are an explicit deploy step (expand -> migrate -> contract), never at API startup.
13. Dependencies: needed, maintained, permissively licensed, pinned centrally with lock files, no runtime telemetry.
14. Accessibility: WCAG 2.2 AA on every UI.
15. Honest status: an `Item | Status | Evidence` table; "written, not yet run" when tests did not run.
16. Git: commit messages state what now holds; agents never push or merge to the main branch.

## Pitfalls seen in practice

- Binding or validating input before the authorization check (three times in one codebase). Query parameters are nullable and checked inside the use case after authorization; uploads are read after authorization.
- EF Core JSON columns are change-tracked by reference: replace lists and records, never mutate them in place.
- Local ports collide between stacks: choose unique ports per project and write them in `AGENTS.md`.
- Container-backed test suites are heavy: run one or two at a time on a shared machine.
- Newer .NET test projects use the Microsoft.Testing.Platform runner: use `dotnet test --project <path>` there (check your SDK's docs).

## References

- `references/technology-matrix.md` - house technology defaults and the "not without an ADR" list.
- `references/engineering-rules.md` - the 16 rules with rationale, mechanism and test.
- `references/strictness.md` - strict build settings for C# (and the same principle for other languages), CI gates.
