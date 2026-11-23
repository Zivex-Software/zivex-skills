---
name: dotnet-conventions-bootstrap
description: Inspects a .NET repository with a script and writes down its real conventions (structure, modules, naming, testing, build, CI) in AGENTS.md files so every later task follows them. Use on first setup of a repo, when AGENTS.md is missing or stale, or before a large change in an unfamiliar codebase.
---

# Bootstrap .NET conventions

Goal: capture what the repo **actually does** so agents stop guessing. Describe, never invent. Evidence first, prose second.

## Start here (module first)

1. Treat the whole repo as one module first (map it), then each module in turn.
2. Read any existing `AGENTS.md`/`CLAUDE.md`/`.cursor/rules` before writing: you are updating them, not replacing them.
3. Write per module: a module's `AGENTS.md` describes only that module; repo-wide rules live in the root file.

## Workflow

1. **Map the repo** (scripted, read-only): `node scripts/inspect-repo.mjs <repo> --json`. It reports solutions, projects and detected modules, target frameworks, pinned SDK, build settings (`Nullable`, `TreatWarningsAsErrors`, central package management), test and library stack, layout style (feature slices vs layers), endpoint style, CI, containers and existing agent docs.
2. **Verify the map against code**: open 3-5 representative files per area (an endpoint/handler, a validator, a persistence class, a test). The script finds facts; you find conventions: naming, error handling, how DI is registered, how tests arrange data.
3. **Resolve conflicts with the user**: two styles in use (controllers and minimal APIs, two test frameworks, two logging libraries) -> ask which is the target; record "legacy" vs "preferred".
4. **Find the commands** the team really uses (scripts, `Makefile`, CI workflow steps) before falling back to `dotnet build`/`dotnet test`/`dotnet format --verify-no-changes`.
5. **Write the files** with `references/agents-md-template.md`: a root `AGENTS.md` (overview, commands, global conventions, module map) and one short `AGENTS.md` per module (purpose, public contract, layout, rules, test command). Keep each under about 80 lines. Merge into existing files: keep user text, change only what is wrong, show the diff.
6. **Wire the agents**: see `references/agent-files.md` (Claude Code reads `AGENTS.md` only when no `CLAUDE.md` exists; a `CLAUDE.md` containing `@AGENTS.md` fixes that).
7. **Check**: run the module scripts of `dotnet-module-boundary-check` and `dotnet-module-context` to confirm the module map you wrote matches reality; re-read the files as a newcomer would.

## Rules

- Every convention cites evidence ("see `src/Orders/Features/...`"); anything unverified is marked "unverified".
- No secrets, connection strings, hostnames or personal data in any file.
- Do not describe aspirations as facts. A rule the code violates in 30 places is "target", not "current".
- Don't paste the script output wholesale into AGENTS.md: distil it.
- Small, stable facts only: things that change weekly belong in code or CI, not in AGENTS.md.

## References

- `references/agents-md-template.md` - root and per-module `AGENTS.md` skeletons with example content and what to leave out.
- `references/evidence-checklist.md` - what to inspect per area and how to record uncertainty and conflicts.
- `references/agent-files.md` - how `AGENTS.md`, `CLAUDE.md` and Cursor rules relate, size limits, and keeping them in sync.
