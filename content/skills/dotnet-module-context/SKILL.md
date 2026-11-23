---
name: dotnet-module-context
description: Loads just enough context about the module a task belongs to - its AGENTS.md, projects, public contract types, consumed and consuming modules and test commands - using a script, before any change. Use at the start of every task in a modular .NET repo, or when unsure where code belongs.
---

# Load module context

Read the right 5-10 things, not the whole repo. The goal is to be able to say where the change goes, what it may touch, and how to test it.

## Start here (module first)

This skill **is** the module-first step. For a repo without modules the script reports "(none: whole repository treated as one module)" and lists the projects: use that as your map.

## Workflow

1. **Locate the module** for the task: `node scripts/module-context.mjs --find <type, route, table or message name> --root <repo>` groups the hits by module, shows where the term is defined and names the likely owner (`references/locating-the-module.md` covers routes, tables, configuration keys and events). The file's project tells you the module.
2. **Run the script** with the module name or a path:
   `node scripts/module-context.mjs <Module | path/to/file.cs> --root <repo>` (add `--json` for tooling). It prints: the module's `AGENTS.md` (first 60 lines), projects and roles, public contract types, contracts it **consumes**, modules that **consume** its contract, and the test commands.
   If the module is not detected as you expect, add a `modules.json` at the repo root (see the modules-json reference of `dotnet-module-boundary-check`).
3. **Read in order** (`references/reading-order.md`): `AGENTS.md` -> `.Contracts` -> the entry points for the task -> the closest existing slice and test.
4. **Check the neighbours**: if the task changes the contract, the **consumed by** list is your blast radius; if it needs other modules, you may use only their contracts listed under **consumes** (or ask to extend one).
5. **Summarise** (5-10 lines, `references/summary-template.md`): module, purpose, files you will touch, contracts involved, test commands, anything unusual from `AGENTS.md`. Share it before editing when the task is non-trivial.

## Rules

- Don't read the whole repo: stop when you can state where the change goes and how to verify it.
- If the task spans several modules, name them, handle one at a time through contracts, and say so before starting.
- If `AGENTS.md` is missing or contradicts the code, say so and offer `dotnet-conventions-bootstrap`; don't silently follow either.
- The script is a heuristic (project names and folders): confirm module membership by opening a file when it matters.

## References

- `references/reading-order.md` - what to open first and why, how to find the right slice, test and contract quickly.
- `references/summary-template.md` - the context summary to write before changing code.
- `references/locating-the-module.md` - find the owning module from a type, route, table, config key or event, including the `--find` mode.
- `references/blast-radius.md` - what a change can break beyond its module: consumers, events, data, tests to run.
- `references/multi-module-tasks.md` - ordering and reporting when a task crosses modules.
