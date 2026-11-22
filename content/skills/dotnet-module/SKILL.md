---
name: dotnet-module
description: Creates a new module (bounded area) in a .NET modular monolith, or restructures one - projects, .Contracts project, registration, tests, AGENTS.md. Use when adding a module or when a module's shape is unclear.
---

# Create or reshape a module

## Start here (module first)

1. Identify the module this task belongs to: the folder (usually a `src/Modules/<Name>` or `<Name>.*` project group) that owns the code you will change. If the repo has no modules, treat the whole repo as one module.
2. Read that module's `AGENTS.md` (or `CLAUDE.md`/README if there is none) and follow it.
3. Work only inside that module. Reach other modules only through their `.Contracts` project; never reference their internals.
   When creating a new module, step 1 is deciding its name and responsibility with the user; there is no AGENTS.md to read yet.

## New module

1. **Follow existing modules**: copy the layout, project naming, target framework, package references and registration pattern of the most similar existing module. If there are none, default to:
   - `<Module>` (implementation: domain, application, infrastructure; internals stay `internal`)
   - `<Module>.Contracts` (public interfaces, DTOs, integration events; no dependencies on the implementation)
   - `<Module>.Tests`
2. **Registration**: one public extension method (e.g. `Add<Module>Module`) that wires the module's services; call it from the host.
3. **Boundaries**: the implementation references only its own `.Contracts` and shared building blocks. Other modules reference `<Module>.Contracts` only.
4. **Persistence**: own schema/tables (or DbContext) per module; no cross-module joins. Use the repo's migration approach.
5. **Docs**: write the module's `AGENTS.md` (purpose, contract, layout, rules, test command) and add the module to the root map.
6. Add it to the solution, build, and run the tests. Verify with `dotnet-verify`.

## Rules

- Keep the module small at first: one use case through to the database and a test.
- Do not create shared "Common" dumping grounds; promote code to a shared project only when two modules need it and the user agrees.
