# Structure

- Identify the module you are working in before you change anything, and read its `AGENTS.md` if it has one. A repo without modules is one module.
- Stay inside that module. Touch another module only through its `.Contracts` project (interfaces, DTOs, events), never its internals.
- Follow the layout and naming the repo already uses. Only when there is no convention, prefer feature slices (one folder per use case) over technical layers.
- Prefer small, focused files and types. Do not add a new project, package or abstraction without a concrete need in the current task.
