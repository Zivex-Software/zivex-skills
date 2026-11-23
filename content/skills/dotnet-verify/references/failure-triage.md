# Failure triage

## Read first, fix once

1. Find the **first** error in the output (later errors are usually fallout). For MSBuild: the first `error CSxxxx` line; for tests: the first failing test and its message and stack top.
2. Fix the cause, not the symptom. Re-run only the failed step, then the whole plan.
3. If you cannot explain the failure, stop guessing: reproduce it smaller (one test: `dotnet test <proj> --filter "FullyQualifiedName~Name"`), read the code path, add temporary logging, then remove it.

## Build failures

| Symptom                                 | Likely cause                                                               | Action                                                                                                   |
| --------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `CS0246` type not found                 | missing `using`, missing project/package reference, wrong target framework | add the reference where the layer allows it; **never** add a reference across modules (use the contract) |
| `CS8618`/nullability warnings as errors | nullable annotations violated                                              | fix the model; do not blanket-disable nullable                                                           |
| restore errors                          | feed/auth, lock file, central package versions                             | `dotnet restore` output; check `nuget.config`, `Directory.Packages.props`                                |
| analyzer errors                         | repo rules                                                                 | fix the code; suppress only with a justified, narrow `#pragma`/`SuppressMessage`                         |
| works locally, fails in CI              | SDK version (`global.json`), OS path casing, missing generated files       | compare SDK and OS; clean `bin/obj`; check case-sensitive paths                                          |

## Test failures

- **Deterministic failure** (fails every time): a real bug or a stale test. Decide which by reading the requirement; fix the code or update the test deliberately and say why.
- **Flaky** (passes on re-run): never "fix" by retrying. Find the nondeterminism: time, ordering, shared state, async races, ports, leftover data. See the flaky-and-slow-tests reference of `dotnet-testing`. Record flaky tests in an issue; do not report them as passing.
- **Timeouts**: a hang is a bug (deadlock, un-awaited task, waiting on a container that never started). Get a stack/dump instead of raising the timeout.
- **Environment** (Docker, database, network not available): report as "not run", with the exact command the user can run.

## Format failures

- `dotnet format --verify-no-changes` lists the files; run `dotnet format <project>` (without verify) on **only** the changed project and review the diff; do not format unrelated files.
- Don't weaken `.editorconfig` to pass.

## Bisecting a regression

`git bisect` with a test command (`git bisect run dotnet test <proj> --filter ...`) finds the commit; fix forward, add a regression test.

## Never

- Delete/skip/`[Fact(Skip=...)]` a failing test to get green.
- Comment out an assertion, widen a tolerance, or add `Thread.Sleep` to hide a race.
- Disable an analyzer or warnings-as-errors project-wide for one failure.
- Use `--no-verify`/skip hooks, or report "tests pass" when you ran a subset.
