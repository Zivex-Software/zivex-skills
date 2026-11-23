<p align="center"><img src="assets/logo.png" alt="Zivex" width="96" height="96"></p>

# zivex-skills

Install AI-agent skills, always-on rules, hooks and subagents for **.NET modular-monolith** development into **Claude Code**, **Cursor** and **Codex**. Built on the open [Agent Skills](https://agentskills.io) standard, so the skills also work with `npx skills`.

```sh
npx zivex-skills init
```

Works with `npx`, `pnpm dlx`, `yarn dlx` and `bunx`. Requires Node 22+. No telemetry.

## What you get

| Pack                           | Contents                                                                                                                                            |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `foundation` (always included) | 6 always-on rules: data handling, structure, verification, change safety, context hygiene, security baseline                                        |
| `dotnet-core`                  | conventions bootstrap, verify, testing, destructive-command guard                                                                                   |
| `dotnet-modules`               | module, module context, module contract, boundary check                                                                                             |
| `aspnet-security`              | `aspnet-security` (secure coding, hardening, OWASP checklist) and `aspnet-security-audit` (pipeline, endpoint and package audit with a report)      |
| `aspnet-performance`           | async, allocations, caching (HybridCache, output caching), HTTP/JSON, measuring                                                                     |
| `aspnet-data`                  | EF Core: queries, N+1, concurrency, transactions, migrations, multi-tenancy                                                                         |
| `aspnet-api`                   | API design (minimal APIs, ProblemDetails, OpenAPI, versioning), resilience, observability (OpenTelemetry, health checks)                            |
| `workflow-features`            | feature slices with format-on-edit and verify-before-stop hooks, the `dotnet-reviewer` subagent, plus the security, data, API and performance packs |
| `workflow-review-qa`           | independent review, boundary checks, plus the security, performance and data packs                                                                  |
| `workflow-greenfield`          | bootstrap conventions, create modules and first slices, plus the security, data and API packs                                                       |

Every skill is module-first: it identifies the module, reads its `AGENTS.md`, works only inside it, and touches other modules only through their `.Contracts` project. A repo without modules is treated as one module.

## The ASP.NET skills

Seven in-depth skills for ASP.NET Core on **.NET 10 (LTS)**, with notes for .NET 8/9 (out of support since 10 Nov 2026) and .NET 11 (STS). Each has a short `SKILL.md` (workflow and rules), `references/` with details and examples that the agent loads only when needed, and a `scripts/` scanner you can also run yourself:

```sh
node .claude/skills/aspnet-security/scripts/check-security.mjs .   # also: check-performance, check-efcore, check-api, check-resilience, check-observability
node .claude/skills/aspnet-security-audit/scripts/audit.mjs .       # pipeline order, endpoint -> authorization map, ownership-check candidates, vulnerable packages
```

The scanners are regex-based: they find candidates, not proof, and the agent confirms every hit in context. Use `--strict` to fail CI on high findings and `--json` for tooling. Facts in the skills come from the official Microsoft Learn pages; anything the docs did not confirm is marked "verify" in the text.

## The module skills

The eight `dotnet-*` skills run on any .NET repository (a repo without modules is treated as one module). Each has `references/` and a script, all Node and cross-platform:

| Skill                          | Script                 | What it does                                                                                                                                 |
| ------------------------------ | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `dotnet-module-context`        | `module-context.mjs`   | AGENTS.md, projects, public contract types, consumed/consuming modules, test commands; `--find <type, route, table>` names the owning module |
| `dotnet-module-boundary-check` | `check-boundaries.mjs` | cross-module references, cycles, `InternalsVisibleTo`, contract hygiene (`--strict` for CI)                                                  |
| `dotnet-module-contract`       | `contract-diff.mjs`    | breaking vs additive changes of a `.Contracts` project against a git ref                                                                     |
| `dotnet-module`                | `new-module.mjs`       | plans or creates a module (siblings, contract, tests, AGENTS.md) or copies one as a template                                                 |
| `dotnet-conventions-bootstrap` | `inspect-repo.mjs`     | maps solutions, modules, build settings, test and library stack, CI, existing agent docs                                                     |
| `dotnet-verify`                | `affected.mjs`         | what a change affects; `--run` builds, tests and format-checks exactly that                                                                  |
| `dotnet-testing`               | `check-tests.mjs`      | weak tests: no assertions, sleeps, wall-clock time, skipped tests, InMemory provider                                                         |
| `dotnet-feature-slice`         | `slice-inventory.mjs`  | every slice with its endpoint, handler, validation, authorization hint, cancellation token and tests; shows the gaps                         |

Modules are found by convention (`Modules/<Name>/`, or the project name minus role suffix and company prefix) or described in a `modules.json` at the repo root. The scripts are tested against a real .NET SDK in CI.

## Zivex conventions (opt-in)

Six extra skills encode the **Zivex house style** for teams that want to code the Zivex way. They are an **opt-in pack**: nothing installs them unless you ask, and the other skills work without them. They are plain, generic conventions (no internal names), published under the same MIT licence.

| Skill                              | What it covers                                                                                                  |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `zivex-engineering-standards`      | strict-by-default tooling, the technology matrix, what needs an ADR, and 16 non-negotiable rules                |
| `zivex-dotnet-code-style`          | how .NET code looks: layout, classes, endpoints, errors, events, EF Core, logging, comments, test style         |
| `zivex-vertical-slice`             | the ASP.NET Core vertical-slice profile (FAST and STRICT), tenancy rules, a worked example, checklists, prompts |
| `zivex-architecture-workflow`      | idea to build-ready architecture: intake, masterplan, ADRs, delivery readiness, one approval gate               |
| `zivex-build-workflow`             | the vertical-slice build loop, definition of done per kind of work, hard stops, honest phase reports            |
| `zivex-compliance-by-construction` | control to mechanism to test to evidence, a 30-control baseline, the evidence pack, a strict claims policy      |

```sh
npx zivex-skills add zivex-conventions            # CLI: adds the pack to what you already have
npx zivex-skills init --packs zivex-conventions,workflow-features --agents claude-code --scope project
```

```text
/plugin install zivex-conventions --marketplace Zivex-Software/zivex-skills     # Claude Code plugin (separate from zivex-skills)
```

`init --yes` and the wizard never select it by default (`optIn: true` in the pack), and no other pack requires it. When it is installed, these rules take precedence over the generic defaults where they differ (for example no generic repositories and no MediatR without an ADR); an existing repository's own conventions always win.

## Install

```sh
# Guided
npx zivex-skills init

# Non-interactive (CI, or an agent running the CLI)
npx zivex-skills init --yes --agents claude-code,cursor --packs workflow-features --scope project

# pnpm / yarn / bun
pnpm dlx zivex-skills init
yarn dlx zivex-skills init
bunx zivex-skills init
```

After installing, ask your agent to run `dotnet-conventions-bootstrap`. Teammates run `npx zivex-skills sync` to match `zivex.json`.

## Install as a Claude Code plugin (no npm needed)

```text
/plugin marketplace add Zivex-Software/zivex-skills
/plugin install zivex-skills --marketplace Zivex-Software/zivex-skills
```

The plugin bundles the 15 core skills, the `dotnet-reviewer` subagent, the three hooks (they do nothing outside .NET repositories) and the always-on foundation rules (injected at session start, because plugins cannot ship a `CLAUDE.md`). Skills appear as `zivex-skills:<skill>`. The opt-in Zivex conventions are a second plugin (below). Use **either** the plugin **or** `npx zivex-skills init` for Claude Code, not both: both install the same hooks and rules. The CLI is the choice when you want per-pack selection, Cursor/Codex targets, project-committed files and `sync` for teammates.

## Scopes

| Scope     | Where                                                                | Default           |
| --------- | -------------------------------------------------------------------- | ----------------- |
| `hybrid`  | foundation rules in your user directory, everything else in the repo | inside a git repo |
| `project` | everything in the repo (commit it)                                   |                   |
| `global`  | everything in your user directory                                    | outside a repo    |

Flags: `-g/--global`, `--project`, `--scope <hybrid|project|global>`. A project install is skipped when the same version is already global, unless `--pin`. `doctor` reports duplicates and version drift. Global hooks do nothing outside .NET repositories.

## Where things go

| Agent             | Rules                  | Skills                                         | Subagents              | Hooks                                           |
| ----------------- | ---------------------- | ---------------------------------------------- | ---------------------- | ----------------------------------------------- |
| Claude Code       | section in `CLAUDE.md` | `.claude/skills`                               | `.claude/agents`       | `.claude/settings.json` + `.claude/hooks/zivex` |
| Cursor            | `.cursor/rules/*.mdc`  | `.agents/skills` (project), `~/.cursor/skills` | not installed          | not installed                                   |
| Codex             | section in `AGENTS.md` | `.agents/skills`                               | `.codex/agents/*.toml` | not installed                                   |
| Other (`generic`) | not installed          | `.agents/skills`                               | not installed          | not installed                                   |

Hooks are installed for Claude Code only. Cursor runs the hooks from `.claude/settings.json` itself (Third-Party Imports, on by default), so select Claude Code as well to get them in Cursor. Codex hooks are intentionally not installed: Codex requires each user to review project hooks, cannot ask for confirmation, and reports file edits as patches without file paths.

Cursor has no global rules file, so in hybrid scope the wizard asks whether its rules may go into the repository (non-interactive runs write them to the project). `.claude/settings.local.json` is never touched.

## Commands

```text
init                      guided installer
add <pack|skill>          add a pack or one skill
remove [name] [--all]     remove a pack or skill, or everything
list [--available]        what is installed (project and global); --available lists packs
update [--all]            update to this version (asks before overwriting your edits)
sync                      make the project match zivex.json
doctor                    check paths, hooks, duplicates, version drift
```

Common flags: `--dry-run` (print the plan, write nothing), `--yes`, `--force` (overwrite your edits, after a backup), `--json` on `list` and `doctor`. Set `NO_COLOR` to disable colour.

## Safety

- Idempotent: running a command twice changes nothing.
- Files you edit are never overwritten silently; `update` reports them and `--force` makes a backup first.
- Before merging into `CLAUDE.md`, `AGENTS.md` or `settings.json`, a `.zivex-bak-<timestamp>` copy is made. `remove` restores your content exactly.

## Use the skills without this CLI

The skills are plain Agent Skills in `content/skills`:

```sh
npx skills add zivex-software/zivex-skills --list
```

## Development

```sh
npm ci
npm run lint && npm run typecheck && npm run format:check && npm test
npm run gen          # regenerate the skills' check scripts from scripts/gen (CI fails if they are stale)
npm run smoke        # packs the tarball and runs it through npm, pnpm, yarn, bun (node scripts/smoke.mjs <pm>)
```

`content/` is the single source of truth; CI fails on an invalid pack or `SKILL.md`. New commands are lazy-loaded from `src/commands/index.ts`; that is also where the Phase 2 `mcp` command plugs in.

## License

MIT
