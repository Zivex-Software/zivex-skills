# Changelog

## 0.1.0

First release (Phase 1).

- CLI: `init`, `add`, `remove`, `list`, `update`, `sync`, `doctor`; scopes `hybrid`, `project`, `global`; `--dry-run`, `--yes`, `--force`, `--pin`; non-interactive mode for CI and agents.
- Targets: Claude Code (skills, subagents, hooks, rules), Cursor (rules, skills), Codex (AGENTS.md rules, skills, subagents), generic `.agents/skills`.
- Content: 6 foundation rules, 3 Claude Code hooks (format-on-edit, verify-before-stop, guard-destructive), the `dotnet-reviewer` subagent, 8 module-first skills, 6 packs.
- ASP.NET skills (7): `aspnet-security`, `aspnet-security-audit`, `aspnet-performance`, `aspnet-data-efcore`, `aspnet-api-design`, `aspnet-resilience`, `aspnet-observability`, each with references and a self-contained Node scanner (`scripts/check-*.mjs`, `audit.mjs`); packs `aspnet-security`, `aspnet-performance`, `aspnet-data`, `aspnet-api`, pulled in by the workflow packs.
- `verify-before-stop` selects tests by naming convention **or** by `<ProjectReference>` to a changed project (`ZIVEX_VERIFY_PLAN=1` prints the plan).
- Wizard asks whether Cursor rules go into the repository when the scope is hybrid (Cursor has no global rules file); the answer is stored in `zivex.json` (`noRules`).
- `doctor` warns when a skill is installed for both Claude Code and Cursor (Cursor reads `.claude/skills` and `.agents/skills`).
- Cursor: no separate hooks are installed because Cursor runs the hooks in `.claude/settings.json` (Third-Party Imports, on by default); the install notice says so.
- Codex hooks are intentionally not installed (documented in the README and the install notice).
- Fix: `format-on-edit` now actually formats (`dotnet format` silently ignores an absolute `--include`; the hook runs from the project folder with a relative path). Found by running the hooks against a real .NET SDK; covered by an integration test that runs on every OS in CI.
- Fix: `verify-before-stop` no longer silently does nothing on Windows (git prints forward slashes).
- Claude Code plugin and marketplace (`.claude-plugin/`, `plugin/`): one plugin with all skills, the reviewer subagent, the hooks and the foundation rules as SessionStart context; generated from `content/` (`npm run gen`), version kept in sync with the package, validated with `claude plugin validate`.
- Repository hygiene: SECURITY.md (private vulnerability reporting), CONTRIBUTING.md (content rules), issue and PR templates, Dependabot, CodeQL, least-privilege CI permissions with concurrency control.
- The eight `dotnet-*` skills now have `references/` and scripts (`module-context`, `check-boundaries`, `contract-diff`, `new-module`, `inspect-repo`, `affected`, `check-tests`), with shared module detection (`modules.json` to override conventions). Verified against a real .NET SDK: generated modules build and pass their starter test, `affected --run` builds and tests only what changed, and a boundary violation or contract change is detected.
- Fix: `new-module` generated a module that did not compile (missing `using` for `WithTags`); found by building it with the real SDK.
- Hardening of the `dotnet-*` scripts after an independent review (19 regression tests, each failing before its fix): `contract-diff` now works from a subdirectory, reads multi-line declarations, CRLF files, same-line attributes, delegates, default interface members, default values, constants, namespaces and braces inside strings; `check-boundaries` ignores commented-out references, treats host projects as the composition root, respects `modules.json` path boundaries, scans deep trees, uses linear-time cycle detection, and recognises more `InternalsVisibleTo`/`using` forms; `affected` includes transitive test dependents, handles renamed files with spaces and fails with a clear message on a bad ref; `new-module --template` no longer copies the whole `Modules` folder. Remaining limits are listed in the skills' references.
- Tooling: TypeScript 7.0.2.
- Safety: backups before merging into user files, content hashes to detect local edits, idempotent installs, complete removal.
