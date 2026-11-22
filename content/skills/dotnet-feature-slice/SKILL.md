---
name: dotnet-feature-slice
description: Implements one use case as a vertical slice inside a .NET module - request, validation, handler, persistence, endpoint and tests together. Use when adding or changing a feature.
---

# Build a feature slice

## Start here (module first)

1. Identify the module this task belongs to: the folder (usually a `src/Modules/<Name>` or `<Name>.*` project group) that owns the code you will change. If the repo has no modules, treat the whole repo as one module.
2. Read that module's `AGENTS.md` (or `CLAUDE.md`/README if there is none) and follow it.
3. Work only inside that module. Reach other modules only through their `.Contracts` project; never reference their internals.

## Steps

1. **Understand the use case**: input, output, rules, who may do it. Ask if any of these is unclear.
2. **Find the pattern**: open one existing slice in this module and mirror it (folder per feature, handler style, mediator or plain services, validation library, result/error type, endpoint style: minimal API or controller). If the module has no slices yet, default to a folder `Features/<UseCase>/` containing request, validator, handler and endpoint.
3. **Implement the slice end to end**: validate at the boundary, authorize, run the handler, persist, return the repo's result shape. Keep types `internal` unless another module needs them (then expose via `.Contracts`, see `dotnet-module-contract`).
4. **Persistence**: if the model changes, add a migration the way the repo does; never apply it to a shared database.
5. **Tests** (see `dotnet-testing`): handler-level tests for rules and failures, one endpoint/integration test for the happy path.
6. **Verify** with `dotnet-verify` before reporting done.

## Rules

- Do not leak persistence entities through the endpoint or contract; map to DTOs.
- No logic in endpoints beyond translating HTTP to the request and the result to HTTP.
- Touch only this module; if the feature needs another module, use its contract or ask for one.
