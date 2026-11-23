---
name: dotnet-module-boundary-check
description: Checks that modules in a .NET modular monolith depend on each other only through .Contracts - with a script that reads project references, InternalsVisibleTo and using directives and reports violations, cycles and contract hygiene - and shows how to enforce the rules with architecture tests. Use after cross-module changes, in reviews, and in CI.
---

# Check module boundaries

Boundaries erode one convenient reference at a time. Make the rules executable and run them on every change that crosses modules.

## Start here (module first)

1. Identify the modules involved (`node ../dotnet-module-context/scripts/module-context.mjs <Module>`), and read their `AGENTS.md` (the boundary rules the team agreed on).
2. This skill is read-only unless the user asks for fixes. Fix violations through contracts, never by relaxing the rule.
3. A repo with one module (or none) has no boundaries to check: the script says so and exits 0.

## Workflow

1. **Run the scanner**: `node scripts/check-boundaries.mjs <repo> [--strict] [--json]`. It detects modules (conventions: `Modules/<Name>/`, project name minus role suffix and company prefix; or `modules.json`, see `references/modules-json.md`) and reports:
   - `BND001` (high) a project references another module's **implementation** instead of its `.Contracts`
   - `BND002` (medium) a test project depends on another module's implementation
   - `BND003` (medium) a dependency **cycle** between modules
   - `BND004` (high) `InternalsVisibleTo` grants another module access to internals
   - `BND005` (medium) a contracts project references its own implementation or ORM/web packages
   - `BND006` (medium) a `using` reaches into another module's non-contract namespace
   - `BND008` (low) a module without `AGENTS.md`
     `--strict` exits 1 on any high finding: use it in CI.
2. **Confirm each hit** in context (`references/rules.md` explains every rule and the fix). The script reads project files and `using` lines: it cannot see runtime reflection, shared databases or dynamic loading.
3. **Check data boundaries by hand**: no cross-module joins, foreign keys, shared `DbContext`, or raw SQL against another module's schema (grep for other modules' table/schema names). See `aspnet-data-efcore`.
4. **Fix at the root**: missing type -> extend the owner's contract (`dotnet-module-contract`); cycle -> invert one direction with an integration event; shared concept -> put it in a contract both can use, not in a "Common" project.
5. **Make it permanent**: add architecture tests (`references/architecture-tests.md`) and run `check-boundaries.mjs --strict` in CI.
6. **Report**: a table per violation: module A -> module B, `file:line`, rule, fix. If clean, say what you checked and what the script cannot see.

## Rules

- Allowed: a module's own projects, shared building blocks (Shared/SharedKernel/BuildingBlocks/Common), and **other modules' `.Contracts` only**; the host composes everything.
- Never silence a finding with `InternalsVisibleTo`, a project reference "just for tests", or by moving code to a shared project.
- Don't create a new shared project to dodge a boundary: shared code needs a justification and an owner.

## References

- `references/rules.md` - each rule (BND001-BND008) with example, why it matters and the fix.
- `references/architecture-tests.md` - enforcing the same rules in tests (NetArchTest/ArchUnitNET style) and in CI.
- `references/modules-json.md` - describing modules explicitly when conventions do not fit.
