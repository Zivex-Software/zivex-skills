# Blast radius: what a change can break

Before editing, list what is affected **outside** the file you change. The script gives the module-level answer; this page tells you what to look at.

## Quick map

| You change                                                               | Look at                                                                                                        | Verify with                                                                                                        |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| A private/internal type of a module                                      | only that module's tests                                                                                       | `dotnet test` of the module's test project                                                                         |
| A public member of `<Module>.Contracts`                                  | **every** consumer module (`consumedBy` in the script output), their tests, serialized forms of events         | `node ../dotnet-module-contract/scripts/contract-diff.mjs <Module>`, then the consumers' tests                     |
| An integration event (shape or meaning)                                  | publisher, every handler, stored/outbox messages, schema fixtures                                              | the event round-trip and idempotency tests; old messages still deserialize                                         |
| An endpoint (route, status codes, payload)                               | OpenAPI document, the generated client, other modules or services calling it                                   | contract tests; client regeneration; `aspnet-api-design` checks                                                    |
| A table or column (migration)                                            | the owning module's queries, read models fed from it, reports, the previous app version running during rollout | expand/contract plan; `aspnet-data-efcore` review; migration applied to a real database in a test                  |
| A query filter, tenant or authorization rule                             | every query of that entity, background jobs, admin tools                                                       | cross-tenant and permission tests                                                                                  |
| Configuration (a key, a default)                                         | all environments, secrets, deployment config                                                                   | startup validation (`ValidateOnStart`), a config test                                                              |
| Shared build files (`Directory.Build.props`, `Directory.Packages.props`) | every project                                                                                                  | a full build and the whole test suite (`node ../dotnet-verify/scripts/affected.mjs --run` does this automatically) |

## Procedure

1. Run `node scripts/module-context.mjs <Module>`: note **Consumes contracts of** and **Contract consumed by modules**.
2. For a contract change: search the contract's namespace and the changed type names across the repository (not only the consumer modules listed: shared projects, the host and test projects may use them).
3. For data: find every reader of the table (`ToTable`, raw SQL, views, reports, exports) before changing it; cross-module readers are a boundary violation to fix first.
4. For runtime behaviour: list timers, background jobs and event handlers that react to the changed state.
5. Decide the **test set**: the module's tests, the consumers' tests, and the host-level integration tests for the flows you touched.
6. Write the blast radius into the context summary (`references/summary-template.md`) so reviewers can check it.

## Signs the radius is larger than it looks

- The type is used through reflection, `nameof` in configuration, or serialized to storage or the wire.
- The same table is read by a report or export outside the module (a hidden consumer).
- The change alters timing, ordering or retries (events, jobs), not just values.
- A "shared" project is involved: everything that references it is a consumer.

When unsure, widen the test set rather than narrow it, and say in the report what you did **not** run.
