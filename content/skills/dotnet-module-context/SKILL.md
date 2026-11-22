---
name: dotnet-module-context
description: Loads just enough context about the module a task belongs to - its AGENTS.md, public contract, layout, dependencies and tests - before any change. Use at the start of every task in a modular .NET repo, or when unsure where code belongs.
---

# Load module context

## Start here (module first)

1. Identify the module this task belongs to: the folder (usually a `src/Modules/<Name>` or `<Name>.*` project group) that owns the code you will change. If the repo has no modules, treat the whole repo as one module.
2. Read that module's `AGENTS.md` (or `CLAUDE.md`/README if there is none) and follow it.
3. Work only inside that module. Reach other modules only through their `.Contracts` project; never reference their internals.

## Steps

1. **Locate** the module for the task: search for the type, endpoint or table named in the request; map the file to its module folder/project.
2. **Read** the module's `AGENTS.md`, then its `.Contracts` project (what it offers other modules), then the entry points related to the task.
3. **Find dependencies**: project references and `.Contracts` it consumes from other modules; note which contracts the task may need.
4. **Find tests**: the module's test project and the closest existing test to the task.
5. **Summarise** in 5-10 lines: module, purpose, the files you will touch, contracts involved, how to run its tests, anything unusual from `AGENTS.md`.

If the task spans several modules, name them, handle one at a time through contracts, and say so before starting.
Do not read the whole repo; stop when you can state where the change goes.
