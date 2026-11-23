---
name: dotnet-testing
description: Writes and runs focused, deterministic tests for .NET changes - unit, handler, integration (WebApplicationFactory, real databases) and contract tests - in the repo's own framework and style, and scans test code for weak tests. Use when adding behaviour, fixing a bug, finding test gaps, or when tests are flaky or slow.
---

# Test .NET code

A test earns its place by failing when the behaviour breaks. Match the repo first; default only when it has no convention.

## Start here (module first)

1. Identify the module and read its `AGENTS.md` (test command, test data approach, what needs Docker).
2. Find the module's test project and the closest existing test: copy its framework, naming, structure and helpers.
3. Test through the module's **public surface** (handler, service, endpoint). Other modules are faked or used through their `.Contracts`, never through internals.

## Workflow

1. **Choose the level** (`references/test-pyramid.md`): handler/unit tests for rules and edge cases; one integration test per endpoint/flow through the real pipeline and a real database; contract tests where modules meet.
2. **Bug fix**: write the failing test first, watch it fail for the right reason, then fix.
3. **Cases**: happy path, validation failure, authorization failure (401/403 and wrong tenant/owner), not-found, conflict/concurrency, and the edge cases the change introduces. Boundary values, not just typical ones.
4. **Integration tests**: `WebApplicationFactory<Program>` against a real database (Testcontainers or the repo's approach); never a shared or production database; reset state per test. See `references/integration-testing.md`.
5. **Determinism**: inject time (`TimeProvider`), no sleeps, no unseeded randomness, no order dependence, no shared mutable statics. See `references/flaky-and-slow-tests.md`.
6. **Scan your tests**: `node scripts/check-tests.mjs <path>` flags tests with no assertion, always-true assertions, sleeps, wall-clock time, skipped tests, blocking on tasks, the EF InMemory provider and repos without any pipeline/database test. Heuristic: confirm each hit.
7. **Run**: `dotnet test <project> --filter "FullyQualifiedName~Name"` while iterating, then the whole affected project (or `node ../dotnet-verify/scripts/affected.mjs --run`).

## Rules

- One behaviour per test; name it after the behaviour (`Cancelled_order_cannot_be_paid`), arrange-act-assert, assert the outcome not the implementation.
- Synthetic data only (builders/factories); never real customer data or secrets.
- Don't assert that a mock was called when you can assert the result; don't mock what you own (use the real thing with a real database).
- Never delete, skip or loosen a test to get green; if it is wrong, change it deliberately and say why.
- A test that cannot fail is worse than no test: remove it or make it assert something.

## References

- `references/test-pyramid.md` - levels, what to test where, naming, structure, test data builders, per-module test projects, contract tests.
- `references/integration-testing.md` - WebApplicationFactory, authentication in tests, real databases with Testcontainers, resetting data, faking time and HTTP dependencies, asserting logs/metrics.
- `references/flaky-and-slow-tests.md` - finding nondeterminism, parallelism pitfalls, speeding the suite up, quarantine policy.
