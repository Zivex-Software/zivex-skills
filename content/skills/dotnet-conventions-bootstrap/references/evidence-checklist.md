# Evidence checklist

Use the output of `scripts/inspect-repo.mjs` as the starting point, then confirm in code. Record **what you saw**, where, and how sure you are.

| Area                    | Look at                                                                                 | Record                                                                       |
| ----------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Solution and projects   | `*.sln/.slnx`, `*.csproj`, `Directory.Build.props`, `global.json`                       | solution to build, target frameworks, pinned SDK, central package management |
| Modules                 | `modules.json` (if any), `Modules/` folders, `*.Contracts` projects, project references | module list, which contracts each consumes, who consumes theirs              |
| Structure               | folder names (`Features`, `UseCases` vs `Controllers`, `Services`, `Repositories`)      | slices or layers; where a new feature goes                                   |
| Endpoints               | a few `Map*` calls or `[ApiController]` classes                                         | minimal API vs controllers, route naming, groups, auth policy placement      |
| Validation and errors   | validators, exception handlers, `AddProblemDetails`                                     | library, where it runs, how errors map to HTTP                               |
| Persistence             | DbContexts, entity configurations, migrations folder, `FromSql` use                     | ORM, one context per module?, migration workflow, tenant/soft-delete filters |
| Messaging               | MassTransit/MediatR/outbox classes                                                      | how modules notify each other, delivery guarantees                           |
| Config and secrets      | `appsettings*.json`, user-secrets id, options classes                                   | pattern, where secrets come from (never record values)                       |
| Logging and telemetry   | `ILogger` usage, Serilog/OpenTelemetry setup                                            | structured templates?, correlation ids, exporters                            |
| Tests                   | test projects, base classes, builders, `WebApplicationFactory`, Testcontainers          | framework, naming, data approach, what needs Docker                          |
| Build and CI            | `.github/workflows`, pipelines, Dockerfile                                              | the exact steps; what must pass before merge                                 |
| Formatting and analysis | `.editorconfig`, analyzers, `TreatWarningsAsErrors`                                     | the style the build enforces                                                 |

## Recording uncertainty

- **Observed** (seen in N files / in CI) -> state it plainly.
- **Inferred** (one example, or from naming) -> "appears to ... (unverified)".
- **Conflict** (two styles) -> list both, say which is newer or more used, and ask the user which is the target.
- **Unknown** -> write the question, not a guess.

## Merging into existing docs

1. Read the existing file fully. Keep sections the team wrote.
2. Add only missing facts; correct statements the code contradicts and say what you changed.
3. Never delete user content without asking. Show the final diff.
4. Keep each file under ~80 lines; move long material to `docs/` and link it.
