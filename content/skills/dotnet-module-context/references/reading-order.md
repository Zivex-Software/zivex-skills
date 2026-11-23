# Reading order

Open things in this order and stop as soon as you can answer: _where does the change go, what may it touch, how do I verify it?_

1. **The module's `AGENTS.md`** - purpose, rules, layout, test command. Treat it as the module's contract with you. (Missing? run `dotnet-conventions-bootstrap`.)
2. **The module's `.Contracts`** - the public surface: interfaces, DTOs, events. It tells you what other modules rely on (what you must not break) and what is private (what you may change freely).
3. **The entry point for the task** - the endpoint/handler/consumer/job named in the request. Find it with a search for the route, type or message name rather than browsing folders.
4. **The closest existing slice** - the nearest similar use case. It is your pattern for layout, validation, results, error mapping and tests.
5. **Its test** - how the module arranges data, fakes dependencies and asserts. Your new tests copy this.
6. **Direct dependencies of the code you will change** - only the types it calls; follow a call one level, not ten.
7. **Persistence for the data involved** - entity configuration, migrations, query filters (tenant/soft delete).
8. **Callers** (for changes to anything shared) - search usages; for contract changes use the script's "consumed by" list.

## Finding things fast

- Route -> endpoint: search the literal route string and `Map(Get|Post|...)`.
- Message/event -> consumers: search the type name in `Consume`/`Handle` signatures.
- Table -> entity: search the table name or the `ToTable("...")` configuration.
- Config key -> options class: search the section name.
- Test for a class: same name with `Tests`, same folder structure in the test project.

## What not to read

- Unrelated modules' internals (you may not use them anyway).
- Generated code, migrations snapshots, `bin/obj`, lock files (unless the task is about them).
- Whole directories "to get a feel": use search and follow references.

## When context is thin

- No `AGENTS.md`, no tests, no slices: say so; propose the smallest safe change and the verification you can do; ask before inventing conventions.
- Conflicting patterns in the module: pick the newer/more common one, state it, and mention the other.
