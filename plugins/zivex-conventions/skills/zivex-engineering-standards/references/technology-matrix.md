# Technology matrix (house defaults)

Defaults, not laws: adapt them to your organisation, record deviations in an ADR. The matrix reflects what the Zivex codebases use.

| Concern                       | Default                                                                                                    | Notes                                                                                            |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Business backends             | **C# / .NET 10 (LTS)**, ASP.NET Core minimal APIs, EF Core, **PostgreSQL**                                 | Modular monolith plus a worker host (outbox relay, consumers, scheduled jobs, `migrate` command) |
| Messaging and jobs            | RabbitMQ (outbox relay + consumers); a workflow engine only for long-running processes                     | A log-based broker only for high-volume data planes, with an ADR                                 |
| Cache and sessions            | Valkey/Redis-compatible store, ephemeral only                                                              | One cache technology per system                                                                  |
| Analytical data plane         | ClickHouse                                                                                                 | Only when volume needs it (ADR)                                                                  |
| Object storage                | S3-compatible (MinIO locally)                                                                              |                                                                                                  |
| Web apps and portals          | React + TypeScript + Vite + a router + Tailwind + TanStack Query + Zod; npm workspaces; exact version pins | Own design-system package; primitives and animation libraries only when approved by name         |
| Websites and shops            | Astro with React islands for interactivity                                                                 | Content from a headless content platform                                                         |
| Mobile                        | Rust headless core + SwiftUI and Jetpack Compose edges (UniFFI)                                            | No new cross-platform-runtime apps                                                               |
| Desktop                       | Rust core, UI framework chosen per project                                                                 | Re-verify the UI framework choice per project: the field moves fast                              |
| Services outside the monolith | Rust (performance/security critical, edge, proxies, ingest) or Go (network services, ops tooling, CLIs)    | Only with an extraction ADR                                                                      |
| Identity                      | One central identity provider, always (OIDC)                                                               | Backend-for-frontend for web; PKCE + system browser for native                                   |
| Hosting                       | EU by default, with an option per tenant region                                                            | Container platform of your choice; document subprocessors                                        |
| Local development             | A task runner (`task`), containers on loopback with unique ports                                           | `task check` runs exactly what CI runs                                                           |
| CI                            | GitHub Actions; images to an EU registry                                                                   | Required checks on the protected main branch                                                     |

## Not without an ADR

MediatR, MassTransit, AutoMapper, FluentValidation, FluentAssertions, Redux, a second UI kit, GraphQL, MongoDB, Elasticsearch, Kubernetes, microservices, Next.js, another ORM, Python or Node in production services, Electron, cross-platform runtimes for new apps, generic repositories (`IRepository<T>`), and any service outside the agreed region.

Why the list exists: each item adds a framework to learn, a dependency to patch, or a second way of doing something. The ADR forces a concrete reason (a measured problem, a hard requirement) and a plan for the cost.

Profile exception: in the FAST profile of `zivex-vertical-slice`, the list is lifted for MassTransit and FluentValidation only; everything else stays forbidden.

## Choosing something new (checklist)

1. Does the existing stack already solve it? 2. Is the dependency maintained, with a permissive licence (MIT/Apache/BSD), and without runtime telemetry? 3. Is it pinned centrally with a lock file? 4. What is the exit path? 5. Which ADR records the decision and which test or gate keeps the decision true?
