# Contributing

Thanks for helping. `content/` is the single source of truth (skills, rules, hooks, agents, packs); `src/` is the installer.

## Setup

```sh
npm ci
npm run lint && npm run typecheck && npm run format:check && npm test && npm run build
npm run smoke      # packs the tarball and runs it with npm (also: node scripts/smoke.mjs pnpm|yarn|bun)
```

Node 22+ is required. The hook integration tests use a real .NET SDK when one is installed (CI has one on every OS); without it they are skipped.

## Generated files

Some files are generated from sources and committed. After changing a rule set (`scripts/gen/*.rules.js`), a hook sidecar (`content/hooks/*.yaml`) or the package version, run:

```sh
npm run gen
```

CI fails when generated files are stale. Edit the sources, never the generated files (`content/skills/*/scripts/check-*.mjs`, `plugin/hooks.json`, the plugin version).

## Content rules (skills, rules, hooks)

1. **Facts come from official docs.** Verify framework, agent and tool behaviour against current official documentation before writing it, and put the doc URL in the file. Mark anything you could not confirm as "verify". Do not rely on memory.
2. **Module-first, generic.** Every skill starts by identifying the module and reading its `AGENTS.md`, works inside that module, and uses other modules only through their `.Contracts`. Skills never assume Zivex-specific infrastructure: "if the repo has X, follow X; otherwise default Y".
3. **Valid Agent Skills.** `SKILL.md` has `name` (= directory) and `description`, stays under 500 lines, and loads details from one-level-deep `references/`. Scripts are Node (`.mjs`), never bash, and cross-platform.
4. **Scanners are heuristics.** A scanner rule needs a test with a true positive and, where useful, a true negative; keep false positives low (run it on a stock `dotnet new webapi`).
5. **Hooks never break the agent.** They no-op outside .NET repositories, never crash on unexpected input, and any blocking behaviour is covered by a test, ideally against a real SDK.
6. **English only** for everything user-facing; CLI strings live in `src/messages.ts` (always "pack", never "bundle").

## Pull requests

- Keep changes focused; add or update tests for new behaviour; update `CHANGELOG.md`.
- Run the full gate above plus `npm run smoke` before pushing a change that affects installed output.
- Idempotency is a requirement: running any command twice must change nothing.
