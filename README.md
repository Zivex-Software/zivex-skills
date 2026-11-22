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
node .claude/skills/aspnet-security-audit/scripts/audit.mjs .       # pipeline order, endpoint -> authorization map, vulnerable packages
```

The scanners are regex-based: they find candidates, not proof, and the agent confirms every hit in context. Use `--strict` to fail CI on high findings and `--json` for tooling. Facts in the skills come from the official Microsoft Learn pages; anything the docs did not confirm is marked "verify" in the text.

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

Cursor has no global rules file, so its rules always go to the project. `.claude/settings.local.json` is never touched.

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
