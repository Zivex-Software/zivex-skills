# Changelog

## 0.1.0

First release (Phase 1).

- CLI: `init`, `add`, `remove`, `list`, `update`, `sync`, `doctor`; scopes `hybrid`, `project`, `global`; `--dry-run`, `--yes`, `--force`, `--pin`; non-interactive mode for CI and agents.
- Targets: Claude Code (skills, subagents, hooks, rules), Cursor (rules, skills), Codex (AGENTS.md rules, skills, subagents), generic `.agents/skills`.
- Content: 6 foundation rules, 3 Claude Code hooks (format-on-edit, verify-before-stop, guard-destructive), the `dotnet-reviewer` subagent, 8 module-first skills, 6 packs.
- Safety: backups before merging into user files, content hashes to detect local edits, idempotent installs, complete removal.
