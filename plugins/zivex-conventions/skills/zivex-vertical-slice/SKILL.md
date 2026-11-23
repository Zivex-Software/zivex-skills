---
name: zivex-vertical-slice
description: The Zivex ASP.NET Core vertical-slice profile - one API project with modules as folders, one file per feature, multi-tenancy rules, module authorization policies, HybridCache key rules, a forbidden list, and two profiles (FAST with MassTransit/FluentValidation, STRICT with own outbox, hand-written validation and architecture tests) with a worked example, checklists and prompts. Opt-in, use when adding or changing features in a Zivex-style ASP.NET Core API.
---

# Zivex vertical slice

Fast, consistent, AI-friendly ASP.NET Core development: **one API project, modules are folders, one feature is one file**. Opt-in: use it for systems that follow this profile; for other architectures use `dotnet-feature-slice` and the module skills.

## Start here (module first)

1. Find the project's `Active profile: FAST|STRICT` line in its `AGENTS.md`/`CLAUDE.md` (default **STRICT** when absent) and follow that profile only. **Never mix profiles in one project.**
2. Identify the module (a folder under `Features/` and `Contracts/`) and read its docs. Modules talk through events and contracts, never into another module's `Features/`.
3. Copy the **golden example** (`references/slice-anatomy.md`) or the closest existing slice: "same shape as X" beats any description of structure. Never invent a new shape.

## Workflow

1. **Pick** module and action; **copy** the profile's golden slice (writes) or the list slice (reads).
2. **Replace** the domain parts, keep the anatomy and its order (`references/slice-anatomy.md`).
3. **Data**: a new entity implements `ITenantEntity`, gets a `DbSet` and a migration; a new event goes in `Contracts/<Module>/`.
4. **Rules**: apply `references/rules.md` (tenancy, authorization, values, cache keys, configuration, forbidden list).
5. **Tests**: a happy-path test and a cross-tenant test that expects 404.
6. **Feedback loop** after every C# change, in order (`references/checklists.md`): build with warnings as errors, regenerate the API client if contracts changed, type-check the web client, run targeted tests only. Never say "done" without the first steps green; otherwise say "written, not yet run".
7. **Verify** with `dotnet-verify`; shape the prompt for speed with `references/prompts.md`.

## Hard rules (summary)

| Rule            | Detail                                                                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One API project | Modules are folders; one feature = one file `Features/{Module}/{Action}.cs`                                                                             |
| Forbidden       | Repositories, `IXxxService` layers, AutoMapper/Mapster, MediatR, controllers, a project per module, `IgnoreQueryFilters()`, float or double money       |
| FAST only       | MassTransit and FluentValidation are allowed. STRICT forbids both (own outbox/inbox, hand-written validation)                                           |
| Tenancy         | `ITenantEntity { TenantId, BranchId? }`, global filters, stamped on save, never from the request, raw SQL names the column, unique indexes lead with it |
| Authorization   | A policy `Module:{Name}` on every endpoint (STRICT: plus a capability check first)                                                                      |
| Money           | `decimal` with explicit precision and a currency code                                                                                                   |
| Cache           | `HybridCache`, keys prefixed `tenant:{TenantId}:branch:{BranchId}:`                                                                                     |
| Config          | Connection strings only from `ConnectionStrings`                                                                                                        |
| Frontend        | The API client is generated from the OpenAPI document and never hand-edited                                                                             |

## Choosing the profile

STRICT when a lost event, an audit gap or a tenant leak would be an incident; FAST when speed matters more. Unsure: STRICT. Details and switching: `references/profiles.md`.

## Pitfalls

- Mixing profiles in one project.
- Hand-editing the generated client or the OpenAPI file; skipping client generation after changing a request or response record.
- Publishing an event before the save succeeded (FAST), or losing it between save and publish: use the STRICT outbox when loss is unacceptable.
- Running the whole test suite after every change: run targeted tests.
- House rules that still apply: capability check first, problem details with a stable `code`, UUIDv7, `TimeProvider` (see `zivex-engineering-standards`).

## References

- `references/slice-anatomy.md` - the slice anatomy, a complete worked example for each profile, read slices, a six-step recipe.
- `references/rules.md` - architecture, multi-tenancy, authorization, values, infrastructure rules.
- `references/profiles.md` - FAST vs STRICT in detail and how to switch.
- `references/checklists.md` - feedback loop, definition of done, slice review, deploy checklist, common mistakes.
- `references/prompts.md` - prompt patterns that make agents fast.
