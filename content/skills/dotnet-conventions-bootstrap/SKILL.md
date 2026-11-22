---
name: dotnet-conventions-bootstrap
description: Inspects a .NET repository and writes down its real conventions (structure, naming, testing, build, modules) in AGENTS.md files so every later task follows them. Use on first setup of a repo, or when AGENTS.md is missing or stale.
---

# Bootstrap .NET conventions

Goal: capture what the repo **actually does** so agents stop guessing. Describe, do not invent.

## Start here (module first)

1. Identify the module this task belongs to: the folder (usually a `src/Modules/<Name>` or `<Name>.*` project group) that owns the code you will change. If the repo has no modules, treat the whole repo as one module.
2. Read that module's `AGENTS.md` (or `CLAUDE.md`/README if there is none) and follow it.
3. Work only inside that module. Reach other modules only through their `.Contracts` project; never reference their internals.
   For this skill the "module" is the whole repo first, then each module in turn.

## Steps

1. **Map the repo**: solution file(s), projects, target framework, `Directory.Build.props`, `Directory.Packages.props`, `global.json`, `.editorconfig`, CI workflows.
2. **Find the modules**: if projects group into bounded areas (e.g. `Orders`, `Billing` each with `.Contracts`, domain, infrastructure, tests), list them and how they talk to each other. If not, record "single module".
3. **Detect conventions** by reading 3-5 representative files per area: folder layout (feature slices vs layers), naming, how endpoints/handlers/validation/persistence are written, error handling, logging, DI registration, test framework and style, test data approach.
4. **Find the commands**: build, test, format, run, migrations. Prefer the repo's own scripts; otherwise `dotnet build` / `dotnet test` / `dotnet format`.
5. **Write**: a root `AGENTS.md` (overview, commands, global conventions, module map) and one short `AGENTS.md` per module (purpose, public contract, layout, rules, how to test). Keep each under ~80 lines. If `AGENTS.md` already exists, merge: keep user text, update only what is wrong, and show what changed.
6. If the repo uses Claude Code and has no `CLAUDE.md`, create one containing only `@AGENTS.md`.

## Rules

- Cite evidence ("see `src/Orders/...`") for each convention; mark guesses as "unverified".
- Ask the user about conflicts (two styles in use) instead of choosing silently.
- Never record secrets, connection strings or personal data.
