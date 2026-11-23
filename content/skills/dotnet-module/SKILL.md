---
name: dotnet-module
description: Creates a new module (bounded area) in a .NET modular monolith - or reshapes or extracts one - with sibling implementation, .Contracts and test projects, a registration extension, AGENTS.md and boundary checks, using a scaffolder that follows the repo's own modules. Use when adding a module, splitting code out of a module, or when a module's shape is unclear.
---

# Create or reshape a module

A module is a bounded area with its own data and a small public contract. Start small: one use case through to the database and a test.

## Start here (module first)

1. List the existing modules (`node scripts/new-module.mjs X` fails on an existing name; or `node ../dotnet-module-context/scripts/module-context.mjs --root .` prints the modules) and read the `AGENTS.md` of the most similar one: its layout is your template.
2. Decide the new module's name and **one-sentence responsibility** with the user. If you cannot say what it does **not** own, the boundary is not ready.
3. A new module has no `AGENTS.md` yet: writing it is part of the task. Existing modules are touched only through their `.Contracts`.

## Workflow

1. **Plan the scaffold** (writes nothing): `node scripts/new-module.mjs <Name>` prints the files it would create. Layout (siblings, never nested):
   `src/Modules/<Name>/<Name>/` (implementation), `src/Modules/<Name>/<Name>.Contracts/`, `tests/<Name>.Tests/`, plus `src/Modules/<Name>/AGENTS.md`.
   To follow an existing module's conventions use `--template <Module>`: it copies that module and renames it everywhere; then delete the business code that does not apply.
2. **Create it**: re-run with `--apply` (refuses to overwrite). Add the projects to the solution with the printed `dotnet sln add ... --include-references false` command, register in the host (`services.Add<Name>Module(); app.Map<Name>Endpoints();`).
3. **Verify the skeleton**: `dotnet build` and `dotnet test` (a starter test checks that the module registers and the container builds), then `node ../dotnet-module-boundary-check/scripts/check-boundaries.mjs . --strict`.
4. **Define the contract first** (`dotnet-module-contract`): the smallest interface/DTOs/events other modules need.
5. **Own the data**: its own schema/tables and (ideally) its own `DbContext` and migrations history table; no cross-module joins. See `references/module-anatomy.md`.
6. **Build the first slice** (`dotnet-feature-slice`) end to end with tests, then fill `AGENTS.md` (purpose, contract, layout, rules, test command) and add the module to the root map.
7. **Verify** with `dotnet-verify`.

## Rules

- Contracts project has no dependency on the implementation, ORM or web types; the implementation is `internal` except the registration extension.
- Other modules reference `<Name>.Contracts` only; the host references implementations to compose them.
- No "Common"/"Shared" dumping ground: promote code to a shared project only when two modules need it and the user agrees.
- Never move or rename code across modules in the same change as new behaviour; do the move as its own step with tests green before and after (`references/extracting-a-module.md`).

## References

- `references/module-anatomy.md` - project layout, registration, endpoints, data ownership, migrations, configuration, naming, what goes in the host.
- `references/extracting-a-module.md` - carving a module out of existing code step by step without a big bang.
- `references/module-checklist.md` - done-definition for a new or reshaped module.
