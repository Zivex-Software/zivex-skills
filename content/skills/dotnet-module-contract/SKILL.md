---
name: dotnet-module-contract
description: Designs and changes a module's public .Contracts project - interfaces, DTOs and integration events - and updates consumers safely. Use when one module must call, query or notify another, or when a contract changes.
---

# Work with module contracts

## Start here (module first)

1. Identify the module this task belongs to: the folder (usually a `src/Modules/<Name>` or `<Name>.*` project group) that owns the code you will change. If the repo has no modules, treat the whole repo as one module.
2. Read that module's `AGENTS.md` (or `CLAUDE.md`/README if there is none) and follow it.
3. Work only inside that module. Reach other modules only through their `.Contracts` project; never reference their internals.

## Rules for a contract

- The `.Contracts` project is the only thing other modules may reference. It has no dependency on the module's implementation.
- Contents: interfaces for synchronous calls/queries, immutable DTOs (records), and integration events for asynchronous notification. No entities, no framework or ORM types, no business logic.
- Keep it minimal and stable: expose what a consumer needs, not what is convenient.

## Adding or changing

1. **Check what exists** in the module's `.Contracts`; extend before adding a new interface.
2. **Choose the style** the repo uses for module communication (direct interface call, mediator, message bus/outbox). Default: interface for queries and commands that need an answer, integration event for "something happened".
3. **Backwards compatibility**: prefer additive changes (new members, optional fields). For breaking changes, list every consumer (search for the contract's namespace), update them in the same change, and tell the user.
4. **Implement** the contract inside the owning module (`internal` implementation, registered in the module's DI extension).
5. **Test** the contract behaviour in the owning module; consumers test against a fake or the real implementation via the contract.
6. Update the owning module's `AGENTS.md` contract section. Run `dotnet-module-boundary-check` and `dotnet-verify`.
