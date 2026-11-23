# Test levels, structure and data

## Levels (what each is for)

| Level           | Scope                                                                        | Speed      | Use for                                                                                 |
| --------------- | ---------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------- |
| Unit / handler  | one handler, service or domain object with fakes at the module edges         | ms         | business rules, calculations, state transitions, validation, edge cases                 |
| Integration     | real HTTP pipeline (`WebApplicationFactory`) + real database                 | 100s of ms | routing, binding, auth, filters, serialization, EF queries and migrations, transactions |
| Contract        | a module against another module's `.Contracts` (fake or real implementation) | ms-s       | that producers and consumers agree; events and DTO shapes                               |
| End-to-end / UI | deployed system                                                              | slow       | a few critical journeys only                                                            |

Keep many fast tests at the bottom and a deliberate few at the top. Every endpoint has at least one integration test (happy path + one failure); rules live in handler tests.

## Structure

- One test project per module (`<Module>.Tests`), plus a host-level integration project if the host composes modules. Test code sits next to the behaviour it checks: folder per feature mirroring the production slice.
- Name tests after behaviour: `Order_total_includes_discount_for_gold_customers`. Avoid `Test1`, `Works`, method-name-only names.
- Arrange-Act-Assert with blank lines; one act per test; one logical assertion group.
- Shared setup in builders/fixtures, not in inheritance chains. Keep fixtures per module so tests of one module never depend on another's internals.

## Test data

- **Builders** with sensible defaults and fluent overrides (`OrderBuilder.New().Paid().WithLines(3).Build()`); tests state only what matters to them.
- Synthetic, obviously fake data (never copies of production). Deterministic ids where assertions need them; `Guid.NewGuid()` is fine when the test does not assert on it.
- Auto-data libraries (Bogus, AutoFixture) are fine with a **fixed seed**; log the seed.
- For persistence: create data through the module's own API/handlers where possible so invariants hold, or through builders that respect invariants.

## What to assert

- Outcomes: return value, state in the database, emitted events, HTTP status + ProblemDetails body.
- Not implementation: avoid asserting the exact sequence of internal calls; avoid `Verify(...)` chains on mocks you could replace with a real collaborator.
- Time: inject `TimeProvider`; assert against a `FakeTimeProvider`.
- Errors: assert the error type/code/message the caller sees, not just "throws".

## Test doubles

- Fake what is slow, nondeterministic, external or owned by another module (HTTP APIs, clock, email, message bus, another module's contract).
- Prefer hand-written fakes or in-memory implementations of your own interfaces over mocks with setups; use a mocking library (NSubstitute, Moq, FakeItEasy: whatever the repo uses) for narrow interaction checks only.
- Don't mock `DbContext`; use a real database (see `integration-testing.md`). The EF InMemory provider ignores constraints, transactions and SQL translation, so passing tests can hide real bugs (`check-tests.mjs` flags it).

## Contract tests between modules

- Producer side: test the contract implementation behind `I<Module>Api` (inputs, outputs, errors) against a real database.
- Consumer side: test your code against a fake `I<Module>Api` that behaves like the contract documents (including failure modes), and keep one test that runs against the real implementation in the host integration project.
- Events: serialise and deserialise every integration event in a test (guards accidental breaking changes), and test idempotent handling (same event twice).
- Pair with `dotnet-module-contract` (`contract-diff.mjs`) so a breaking surface change is visible before tests run.

## Coverage

Coverage is a smell detector, not a goal: use it to find untested branches in code you changed. Don't chase a percentage with assertion-free tests (`check-tests.mjs` TST009 finds them).
