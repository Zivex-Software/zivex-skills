# Tasks that cross modules

A task that needs more than one module is several tasks with an order. Name them, sequence them, and keep every change inside its own module.

## Decide the modules and the direction

1. List the modules involved and say which one **owns** the behaviour (the others consume it). The owner defines the contract; consumers adapt.
2. Draw the dependency direction: consumer -> owner's `.Contracts`. If two modules need each other, stop: that is a design question (an integration event or a different boundary), not a coding task (`dotnet-module-boundary-check`, rule BND003).
3. State it before starting: "Billing needs the order total. Orders owns it. Plan: (1) add `IOrdersApi.GetTotalAsync` to `Orders.Contracts`, (2) implement it in Orders with tests, (3) use it in Billing with a fake in Billing's tests."

## Order of work

1. **Contract first** (owner module): the smallest member that serves the consumer (`dotnet-module-contract`). Additive where possible.
2. **Owner implementation and tests**: green on its own before anything depends on it.
3. **Consumer**: code against the contract, test against a fake of it; add one host-level integration test that uses the real implementation.
4. **Cleanup**: remove adapters, temporary shims and unused contract members.

Commit per module so each step can be reviewed and reverted separately; a change that mixes modules should be split unless it is an atomic contract change with all consumers updated.

## Per-module context

Load the context of each module separately (`node scripts/module-context.mjs <Module>`): its `AGENTS.md` rules apply inside that module only. Do not copy one module's conventions into another; mirror each module's own slices and tests.

## Reporting

- Name the modules touched and the contract members added or changed.
- Report verification per module (`node ../dotnet-verify/scripts/affected.mjs --run` lists the modules it touched), plus the cross-module test.
- List what you did **not** change in other modules and why (for example: "Reporting also reads orders; not changed, tracked in the follow-up").

## Red flags

- A single method that touches two modules' `DbContext`s or tables.
- A `using` into another module's non-contract namespace (the boundary scanner flags it).
- A new shared project created to avoid choosing an owner.
- A transaction spanning modules: use an outbox and idempotent consumers instead (`dotnet-module-contract`, outbox reference).
