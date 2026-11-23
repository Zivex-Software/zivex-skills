---
name: dotnet-verify
description: Verifies .NET work before it is called done - works out what a change affects, builds and tests exactly that, checks formatting, boundaries, contracts, migrations and security, and reports honestly what was and was not run. Use before reporting a feature or fix complete, before a commit or PR, and when reviewing a diff.
---

# Verify .NET work

"Done" means: built, tested, checked, and reported with evidence. A claim without a command and its output is not verification.

## Start here (module first)

1. Identify the module(s) the change touches and read each module's `AGENTS.md` (it names the test command and module rules). A repo without modules is one module.
2. Verify inside those modules first; then the modules that **consume** a contract you changed.
3. Other modules are touched only through `.Contracts`; if the diff reaches further, that is a finding.

## Procedure

1. **Plan what is affected** (read-only): `node scripts/affected.mjs` (add `--base origin/main` to include committed changes). It lists changed files, modules, projects to build, test projects covering them (by naming convention or `<ProjectReference>`), and projects to format-check.
2. **Run it**: `node scripts/affected.mjs --run` (add `--no-format` if the repo has no format gate, `--json` for tooling). Exit code 1 when any step fails; failing output is shown, not hidden. Prefer the repo's own scripts/CI commands when they exist (see the module's `AGENTS.md`).
3. **Widen when needed**: contract changed -> also run the consumers' tests (`node ../dotnet-module-context/scripts/module-context.mjs <module>` lists them); shared/build files (`Directory.Build.props`) changed -> build everything and run all tests.
4. **Walk the checklist** in `references/checklist.md` for the diff: behaviour covered by a test that fails without the change, no unrelated edits, boundaries, contracts, migrations, security, data, performance, logging.
5. **Run the deep checks of the installed skills** on the changed module and confirm each hit (they are heuristics): `dotnet-module-boundary-check`, `dotnet-testing`, `aspnet-security`, `aspnet-data-efcore`, `aspnet-performance`, `aspnet-api-design`, `aspnet-resilience`, `aspnet-observability` (each has a `check-*.mjs`).
6. **Report** with `references/report-template.md`: commands run and results, what was not run and why, open risks.

## Rules

- If something fails: read the **first** error, fix the cause, re-run the failed step and then the whole plan. Never report success on a partial run. See `references/failure-triage.md`.
- Never weaken a test, disable an analyzer, raise a threshold or skip a hook to get green. If a test is wrong, say so and change it deliberately.
- Don't commit/push unless asked. Don't apply migrations to a shared database.
- State limits honestly: integration tests that need Docker/network you could not run are "not run", not "passed".

## References

- `references/checklist.md` - detailed pre-merge checklist (behaviour, tests, boundaries, contracts, migrations, security, data, performance, operability, docs).
- `references/failure-triage.md` - reading build/test/format failures, flaky vs real, bisecting, what never to do.
- `references/report-template.md` - the verification report to put in the PR or final message.
