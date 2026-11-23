# Agent instruction files

Facts checked against the Claude Code, Cursor and Codex docs (Nov 2026); re-verify when versions change.

| File                                        | Read by                                                                                                     | Notes                                                                                      |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `AGENTS.md` (repo root, and nested folders) | Cursor, Codex (and tools following the open `AGENTS.md` convention); Claude Code when no `CLAUDE.md` exists | plain Markdown, no frontmatter; nested files combine and the closer one wins               |
| `CLAUDE.md` / `.claude/CLAUDE.md`           | Claude Code                                                                                                 | supports `@path` imports (relative to the importing file, nested up to four hops)          |
| `~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md` | user-level for Claude Code / Codex                                                                          | personal, not for the team                                                                 |
| `.cursor/rules/*.mdc`                       | Cursor                                                                                                      | frontmatter `description`, `globs`, `alwaysApply`; user rules live only in Cursor settings |

## Recommended setup

1. Write the content once in `AGENTS.md` (root + per module).
2. For Claude Code add a `CLAUDE.md` that contains only `@AGENTS.md` (Claude Code reads `AGENTS.md` only when no `CLAUDE.md` or `CLAUDE.local.md` exists, so otherwise it would be skipped once any `CLAUDE.md` appears).
3. Do not duplicate content into `.cursor/rules`: Cursor reads `AGENTS.md`. Use `.cursor/rules` only for glob-scoped or Cursor-specific rules.
4. If `zivex-skills` is installed it adds its foundation rules as marked sections (`<!-- zivex-skills:begin ... -->`) in `CLAUDE.md`/`AGENTS.md`: leave those markers and write your own text outside them.

## Size and hygiene

- Codex limits the combined project docs it reads (`project_doc_max_bytes`, 32 KiB by default): keep root + nested files small.
- Prefer many short module files over one long root file: agents load the closest file for the code they touch.
- Reference, don't paste: link to ADRs and docs instead of copying them.
- Commit them: they are part of the codebase and reviewed like code.
