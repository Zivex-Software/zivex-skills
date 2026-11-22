---
name: dotnet-verify
description: Checklist and procedure to verify .NET work before calling it done - build, affected tests, boundaries, migrations, security. Use before reporting a feature or fix complete, and when reviewing a diff.
---

# Verify .NET work

## Start here (module first)

1. Identify the module this task belongs to: the folder (usually a `src/Modules/<Name>` or `<Name>.*` project group) that owns the code you will change. If the repo has no modules, treat the whole repo as one module.
2. Read that module's `AGENTS.md` (or `CLAUDE.md`/README if there is none) and follow it.
3. Work only inside that module. Reach other modules only through their `.Contracts` project; never reference their internals.

## Procedure

1. **Scope the change**: `git status` and `git diff`; list the modules and projects touched.
2. **Build**: use the repo's command if it has one; otherwise `dotnet build` on the affected solution/projects. Warnings you introduced count.
3. **Test**: run the tests of the affected module (and of modules that consume its contract if the contract changed). Default: `dotnet test <test project>`. Do not run only a subset you chose to pass.
4. **Format**: `dotnet format --verify-no-changes` if the repo enforces it.
5. **Walk the checklist**:
   - Behaviour is covered by a test that fails without the change.
   - No unrelated edits; no leftover debug code, commented-out code or TODOs without an issue.
   - Module boundaries: no new reference to another module's internals (see `dotnet-module-boundary-check`).
   - Contracts: public changes are intentional, versioned or backwards compatible, consumers updated.
   - Migrations: present when the model changed, reversible, reviewed, not applied to a shared database.
   - Security: input validated at the boundary, authorization and tenant/ownership checks on new endpoints and queries, no secrets or personal data in code or logs.
   - Deep checks when the matching skill is installed: `aspnet-security` (its `check-security.mjs` scanner), `aspnet-data-efcore` (`check-efcore.mjs`: N+1, raw SQL, migrations), `aspnet-performance` (`check-performance.mjs`: blocking calls, allocations, caching), `aspnet-api-design` (error contract, ProblemDetails), `aspnet-resilience` and `aspnet-observability` (timeouts, retries, logging, health). Run the scanners on the changed module and confirm each hit; they are heuristics.
6. **Report** exactly what you ran (commands and results), what you did not run and why, and any open risk.

If anything fails, fix it and re-run the failed step; do not report success on a partial run.
