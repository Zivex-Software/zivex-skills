# FAST vs STRICT

|                      | FAST                                     | STRICT                                                  |
| -------------------- | ---------------------------------------- | ------------------------------------------------------- |
| Validation           | FluentValidation                         | hand-written, after authorization                       |
| Events               | MassTransit (publish after save)         | own outbox (same transaction) + consumers with an inbox |
| Authorization        | module policy                            | policy + capability check first                         |
| Gates                | warnings as errors                       | + architecture tests                                    |
| Local infrastructure | an orchestrator such as Aspire           | task runner + containers (orchestrator optional)        |
| Packages             | MassTransit and FluentValidation allowed | forbidden (an ADR for any new package)                  |

## Choosing

- **STRICT** when a lost event, an audit gap or a tenant leak is an incident (money, personal data, access control).
- **FAST** when speed matters more and an occasional lost event is acceptable (internal tools, prototypes that may harden later).
- **Unsure: STRICT.** **Never mix** profiles in one project.

## New projects

Generate or copy the starter once, then prune to the chosen profile: for STRICT delete the FAST slice, the validation filter and its tests, strip profile-marked regions (including packages), and rename the STRICT golden slice to the default name. Keep a single `Active profile: FAST|STRICT` line in the project's `AGENTS.md`.

## Switching later

Edit the `Active profile:` line, port slices one by one (validation, events, authorization), add or remove the packages, and run the full checks. Plan it as its own change; never switch a few slices only.
