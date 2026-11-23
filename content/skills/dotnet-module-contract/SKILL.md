---
name: dotnet-module-contract
description: Designs and changes a module's public .Contracts project - interfaces, DTOs and integration events - classifies changes as breaking or additive with a script that diffs the public surface against git, and updates consumers safely. Use when one module must call, query or notify another, or whenever a contract changes.
---

# Work with module contracts

The `.Contracts` project is the only thing other modules may reference. Keep it small, stable and boring.

## Start here (module first)

1. Identify the **owning module** and read its `AGENTS.md`; identify the **consumers** (`node ../dotnet-module-context/scripts/module-context.mjs <Module>` lists "consumed by").
2. Change the contract in the owning module only; adapt consumers through the updated contract, never by reaching into internals.
3. A repo without modules has no contract boundary; treat the public API (endpoints) as the contract and use `aspnet-api-design`.

## Workflow

1. **Start from the consumer's need**: what exactly must the other module know or do? Give it the smallest interface/DTO/event that serves that. See `references/contract-design.md` (interface vs event, shapes, naming, what never goes in a contract).
2. **Check what exists**: extend an existing contract before adding a new one; avoid duplicating concepts.
3. **Make the change** in `<Module>.Contracts` (no implementation, no ORM/web packages) and implement it **inside** the owning module (`internal` class, registered in the module's DI extension).
4. **Classify the change**: `node scripts/contract-diff.mjs <Module> --base HEAD` (or `--base origin/main`) compares the public surface with git: removed/changed members are **BREAKING**, new ones **ADDITIVE**. Use `--strict` in CI to fail on breaking changes. It is a text heuristic: read `references/breaking-change-checklist.md` for what it cannot see (semantics, nullability, behaviour, event meaning).
5. **If breaking**: list every consumer (search the contract namespace; the script prints the modules), update them **in the same change**, or version the contract (`references/contract-design.md`, "Evolving"). Say so in the PR.
6. **Test** both sides: the owning module's implementation of the contract, and each consumer against a fake of it; serialise/deserialise events. See `dotnet-testing`.
7. **Run** `node ../dotnet-module-boundary-check/scripts/check-boundaries.mjs . --strict` and `dotnet-verify`; update the module's `AGENTS.md` contract section.

## Rules

- No entities, EF types, `HttpContext`, framework request/response types or business logic in a contract.
- DTOs are immutable records; collections are read-only; money is `decimal` + currency; time is `DateTimeOffset` (or `DateOnly` for dates); ids are explicit types or `Guid`/`string`.
- Contracts must not reference their own implementation or another module's implementation.
- Prefer additive change; removing or repurposing a member is a breaking change, whatever the compiler says.
- Events are facts about the past, named in past tense (`OrderPaid`), carry ids and the data consumers need, and are never changed in meaning.

## References

- `references/contract-design.md` - synchronous interface vs asynchronous event, shape rules, errors, pagination, versioning and deprecation.
- `references/events-and-outbox.md` - integration events, the outbox pattern, idempotent consumers, ordering and failure handling.
- `references/breaking-change-checklist.md` - what counts as breaking (including what the script cannot detect) and the consumer update procedure.
