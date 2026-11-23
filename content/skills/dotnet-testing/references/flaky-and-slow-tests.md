# Flaky and slow tests

A test that sometimes fails is a bug report about nondeterminism: find the source, don't retry it away.

## Usual suspects (check in this order)

1. **Time**: `DateTime.Now/UtcNow`, `Task.Delay`, `Thread.Sleep`, timeouts around real clocks. Inject `TimeProvider`; use `FakeTimeProvider` and advance explicitly.
2. **Shared state**: static fields, singletons, a shared database with leftover rows, files in a shared temp dir, ports. Give each test its own data/identifiers; reset or isolate.
3. **Test order and parallelism**: xUnit runs different test _classes_ in parallel by default; collections/fixtures share state. If tests share a resource, put them in one collection or isolate the resource.
4. **Async races**: un-awaited tasks, `async void`, fire-and-forget, `.Result`/`.Wait()`. Await everything; wait for a **condition** (poll with a timeout) not a fixed delay.
5. **Randomness and ordering**: unseeded `Random`, `Guid` ordering, dictionary/`HashSet` enumeration order, unordered database results (add `ORDER BY` in the code under test or sort in the assertion).
6. **Environment**: culture/timezone (set explicitly: `CultureInfo.InvariantCulture`, UTC), line endings, case-sensitive paths, machine speed.
7. **External dependencies**: real network/third-party services in tests; replace with fakes.

## Making a flaky test deterministic

- Reproduce: run it in a loop (`dotnet test --filter ... ` repeatedly, or a `[Theory]` with many iterations), under load, and in parallel with the rest.
- Log the seed/ids used; fail with a message that shows the data.
- Replace the nondeterministic input with a controlled one; assert the final state, not intermediate timing.
- Never "fix" by adding retries, longer timeouts or `Sleep`. A retry attribute hides the bug and slows CI.

## Quarantine policy

If a flaky test cannot be fixed immediately: open an issue, mark it with a reason and the issue link (`Skip = "flaky: #123"`), keep it out of the required gate, and fix it within an agreed time. Report it in verification as "skipped (flaky)", never as passing.

## Slow suites

- Measure: `dotnet test --logger "console;verbosity=normal"` or the trx output to find the slowest tests; look at fixture startup (containers, host) first.
- Share expensive fixtures (host, container) across a class/collection; start a container once per run.
- Reduce integration tests to what needs the pipeline/database; move rules to handler tests.
- Parallelise safely (isolated data per test/class); avoid global `[Collection]` serialisation unless required.
- Avoid heavy per-test seeding: seed reference data once, create per-test data minimal.
- Keep a fast "affected only" loop for development (`node ../dotnet-verify/scripts/affected.mjs --run`) and the full suite in CI.
