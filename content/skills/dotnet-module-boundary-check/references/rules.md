# Boundary rules

A _module_ is a bounded area (folder `Modules/<Name>/`, or projects `<Name>`, `<Name>.Contracts`, `<Name>.Tests`...). Module-level rules below are enforced by `scripts/check-boundaries.mjs`.

## BND001 - project reference into another module's implementation (high)

`Billing.csproj` -> `Orders.csproj`. Billing now compiles against Orders' internals: every refactor in Orders can break Billing, and tests of one need the other.
**Fix**: reference `Orders.Contracts`. If the type you need is not there, add the smallest contract member that serves the need (`dotnet-module-contract`); don't move the implementation type into contracts.

## BND002 - test project depends on another module's implementation (medium)

`Orders.Tests` -> `Billing`. The test couples Orders to Billing's internals.
**Fix**: test against `Billing.Contracts` with a fake, or put the cross-module scenario in a host-level integration test project that is allowed to reference everything.

## BND003 - dependency cycle between modules (medium)

`Orders -> Billing -> Orders` (even through contracts). The modules cannot be reasoned about, tested or extracted independently.
**Fix**: break one direction with an integration event (the consumer reacts instead of being called), or move the concept both need into a contract owned by one side. A cycle usually means the boundary is drawn wrong: consider merging or re-splitting.

## BND004 - InternalsVisibleTo to another module (high)

`[assembly: InternalsVisibleTo("Orders")]` in Billing (or the csproj item). It silently turns internals into a public API for exactly one consumer.
**Fix**: remove it; expose what is needed through the contract. `InternalsVisibleTo` for the module's **own** test assembly is fine.

## BND005 - contracts hygiene (medium)

- A `.Contracts` project referencing its own implementation creates a cycle and leaks internals.
- A `.Contracts` project referencing EF Core, ASP.NET Core, MassTransit or MediatR forces those dependencies on every consumer and invites entity/web types into the contract.
  **Fix**: contracts contain plain interfaces, immutable records and events only.

## BND006 - `using` into another module's non-contract namespace (medium)

`using Orders.Domain;` in a Billing file. Even without a project reference (e.g. via a shared project or global usings) this is a leak.
**Fix**: use `Orders.Contracts` types; if the type is missing from the contract, request it from the owner. The rule is a heuristic on namespace segments: confirm the namespace really belongs to the other module before changing code.

## BND008 - module without AGENTS.md (low)

Agents and newcomers cannot learn the module's purpose, contract or rules.
**Fix**: add `AGENTS.md` (`dotnet-conventions-bootstrap` drafts it from evidence).

## What the script cannot see (check by hand)

- **Data boundaries**: cross-module joins, foreign keys, a shared `DbContext`, raw SQL touching another module's tables/schema (`aspnet-data-efcore`).
- **Runtime coupling**: reflection, assembly scanning that registers another module's internals, `Type.GetType("...")`, service locator calls into another module's internal services.
- **Config coupling**: one module reading another's configuration section.
- **Semantic coupling**: a consumer depending on undocumented behaviour of a contract (ordering, timing, side effects).
- **Shared projects**: a "Common" project that has become a back door for domain types.

## Severity and policy

- `--strict` fails on **high** only (BND001, BND004). Treat medium findings as review items, and raise them to build failures once the codebase is clean (architecture tests, `references/architecture-tests.md`).
- An intentional exception is documented in the module's `AGENTS.md` with a reason and an end date; the script has no suppression comments on purpose.
