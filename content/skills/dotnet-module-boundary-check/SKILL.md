---
name: dotnet-module-boundary-check
description: Checks that modules in a .NET modular monolith only depend on each other through .Contracts, and reports violations (project references, internal types, shared tables, cross-module database access). Use after cross-module changes and during reviews.
---

# Check module boundaries

## Start here (module first)

1. Identify the module this task belongs to: the folder (usually a `src/Modules/<Name>` or `<Name>.*` project group) that owns the code you will change. If the repo has no modules, treat the whole repo as one module.
2. Read that module's `AGENTS.md` (or `CLAUDE.md`/README if there is none) and follow it.
3. Work only inside that module. Reach other modules only through their `.Contracts` project; never reference their internals.
   This skill is read-only unless the user asks for fixes.

## Checks

1. **Project references**: for every project, list its `ProjectReference`s (`dotnet list <proj> reference` or read the `.csproj`). A module may reference its own projects, shared building blocks, and **other modules' `.Contracts` only**. Flag any reference to another module's implementation or test project.
2. **Namespaces and types**: search for `using` of another module's non-contract namespaces; flag `InternalsVisibleTo` granted to another module.
3. **Data**: flag queries, joins, foreign keys or DbContexts that touch another module's tables or schema.
4. **Contracts**: flag contracts that reference implementation types, entities or ORM types; flag cycles between modules.
5. **Architecture tests**: if the repo has them (NetArchTest, ArchUnitNET), run them; if it has none, suggest adding one test per rule above.

## Report

A table per violation: module A -> module B, file and line, which rule, suggested fix (usually: add or extend a contract, or move the code). If clean, say what you checked. If the repo has no modules, report "single module, nothing to check".
