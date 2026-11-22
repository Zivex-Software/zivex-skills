---
name: dotnet-testing
description: Writes and runs focused tests for .NET changes - unit, integration, and module contract tests - following the repo's existing test framework and style. Use when adding behaviour, fixing a bug, or finding test gaps.
---

# Test .NET code

## Start here (module first)

1. Identify the module this task belongs to: the folder (usually a `src/Modules/<Name>` or `<Name>.*` project group) that owns the code you will change. If the repo has no modules, treat the whole repo as one module.
2. Read that module's `AGENTS.md` (or `CLAUDE.md`/README if there is none) and follow it.
3. Work only inside that module. Reach other modules only through their `.Contracts` project; never reference their internals.

## Approach

1. **Match the repo**: find the module's test project and copy its framework (xUnit, NUnit, MSTest), assertion library, naming and arrange/act/assert style. If the repo has none, default to xUnit with plain asserts, one test project per module named `<Module>.Tests`.
2. **Bug fix**: write a failing test that reproduces it first, see it fail, then fix.
3. **New behaviour**: test through the module's public surface (handler, service, endpoint) rather than private helpers. Cover the happy path, validation failures, authorization failure, and the edge cases the change introduces.
4. **Integration tests**: use what the repo uses (WebApplicationFactory, Testcontainers, an in-memory or local database). Never point tests at a shared or production database. Reset state per test.
5. **Cross-module**: test against the other module's `.Contracts` (or a fake of it), not its internals.
6. **Data**: synthetic data only; builders or helpers if the repo has them.
7. **Run**: `dotnet test <project> --filter <name>` while iterating, then the whole affected project.

## Avoid

- Tests that only assert mocks were called, sleeping instead of waiting on a condition, order-dependent tests, snapshots nobody reads.
- Deleting or loosening an existing test to make a change pass; explain and ask instead.
