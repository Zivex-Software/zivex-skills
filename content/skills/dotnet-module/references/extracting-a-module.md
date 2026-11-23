# Extracting a module from existing code

Never a big bang. Each step leaves the build and tests green and is its own commit.

1. **Characterise** the area to extract: list the types, tables, endpoints, background jobs and configuration that belong together; list who calls into it and what it calls out to. `grep`/IDE "find usages" on the key entry points; `dotnet-module-boundary-check` shows existing references.
2. **Write tests first** around current behaviour at the edges you will keep (endpoints, public services). These are your safety net; run them before and after every step.
3. **Create the empty module** (`scripts/new-module.mjs <Name> --apply`) and register it in the host. Nothing moves yet.
4. **Define the contract** the rest of the system will use: start from how callers use the area today, then shrink (`dotnet-module-contract`). Callers that only need a value get a query method, not an entity.
5. **Introduce the contract inside the old code** (a thin adapter implementing the interface over the existing classes) and switch callers to it, one caller at a time. Tests stay green.
6. **Move code behind the contract**: projects/folders into `src/Modules/<Name>/<Name>/`, namespaces renamed, types made `internal`. Move tests with it. Use `git mv` to preserve history; keep behavioural edits out of move commits.
7. **Move the data**: new schema and `DbContext`; create tables via migration (expand/contract): copy data, dual-write if needed, switch reads, then drop the old tables in a later release. Remove cross-module joins by calling the contract or keeping a read model.
8. **Cut the remaining references**: any project reference or `using` into the module's internals is a bug now (`check-boundaries.mjs --strict` must be clean).
9. **Delete the adapter and dead code**, update `AGENTS.md` (module and root map), and record the decision (ADR) if it was non-obvious.

## Smells during extraction

- The contract keeps growing: the boundary is wrong; merge back or split differently.
- Two modules need each other's data constantly: they are one module, or one owns the concept and the other keeps a read model.
- A shared `Common` project accumulates domain types: those types belong to a module's contract.
- Circular dependencies between modules: introduce an integration event to invert one direction.
