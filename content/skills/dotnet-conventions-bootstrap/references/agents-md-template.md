# AGENTS.md templates

Keep each file short and verifiable. Replace every `<...>`; delete sections that do not apply.

## Root `AGENTS.md`

```markdown
# <Product> - agent guide

## What this is

<2-3 lines: what the system does, who uses it. Modular monolith with N modules.>

## Commands

- Build: `<dotnet build Shop.slnx>`
- Test (all): `<dotnet test Shop.slnx>`; one module: `dotnet test tests/<Module>.Tests`
- Format: `<dotnet format --verify-no-changes>`
- Run: `<dotnet run --project src/Host>` (needs: <local database via docker compose up>)
- Migrations: `<how the repo creates and applies them>`

## Repository map

| Path                   | Contents                                             |
| ---------------------- | ---------------------------------------------------- |
| `src/Host`             | composition root: registers modules, maps endpoints  |
| `src/Modules/<Module>` | one folder per module (implementation, `.Contracts`) |
| `tests/`               | test projects, one per module + integration          |

## Global conventions

- Target framework <net10.0>; nullable enabled; warnings as errors: <yes/no>.
- Style: <feature slices | layers>; endpoints: <minimal APIs | controllers>.
- Errors: <ProblemDetails via IExceptionHandler>; validation: <library>.
- Logging: <ILogger with templates / Serilog>; config: <options pattern, secrets from X>.
- Tests: <xunit + ...>; data: <builders>; integration: <WebApplicationFactory + Testcontainers>.

## Modules

| Module | Purpose    | Contract           | Depends on (contracts) |
| ------ | ---------- | ------------------ | ---------------------- |
| Orders | <one line> | `Orders.Contracts` | Billing                |

## Rules

- Modules talk to each other only through `.Contracts`.
- <repo-specific hard rules: money as decimal, tenant filter on every query, ...>

## Not allowed / known traps

- <things that burned the team before, with the reason>
```

## Module `AGENTS.md`

```markdown
# <Module> module

## Purpose

<one sentence: what this module owns and what it does not>

## Public contract

`<Module>.Contracts`: <interfaces/DTOs/events>. Everything else is internal.

## Layout

- `<Module>/Features/<UseCase>/`: request, validator, handler, endpoint
- `<Module>/Persistence/`: DbContext, configurations, migrations (schema `<schema>`)
- `<Module>.Contracts/`: public contract
- `tests/<Module>.Tests/`: tests

## Rules

- <module-specific invariants: "an Order is never deleted, only cancelled">
- Data: own schema/tables; no cross-module joins.

## Test

`dotnet test tests/<Module>.Tests` (<needs Docker for integration tests>)
```

## Leave out

- Anything the code or CI already states precisely (package versions, full dependency lists).
- Secrets, hostnames, personal data, internal URLs that do not belong in a repository.
- Long prose and history; one line plus a link beats a paragraph.
- Aspirations written as facts.
