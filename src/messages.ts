/** Every user-facing CLI string. Say "pack", never "bundle". Errors say what happened and how to fix it. */
import type { AgentId } from "./schema.js";

export const agentLabel: Record<AgentId, string> = {
  "claude-code": "Claude Code",
  cursor: "Cursor",
  codex: "Codex",
  generic: "Other agents (.agents/skills)",
};

export const msg = {
  cli: {
    description: "Install AI-agent skills, rules, hooks and subagents for .NET modular monoliths.",
    examples:
      "Examples:\n  npx zivex-skills init\n  npx zivex-skills add dotnet-verify\n  npx zivex-skills sync",
  },
  flags: {
    global: "use the user directory (all projects)",
    project: "use this repository (committed, shared with the team)",
    scope: "hybrid | project | global",
    dryRun: "print the plan and write nothing",
    yes: "accept defaults, never prompt",
    force: "overwrite files you edited (a backup is made first)",
    pin: "install in the project even if the same version is already global",
    agents: "comma-separated: claude-code, cursor, codex, generic",
    packs: "comma-separated pack ids (see `list --available`)",
    hooks: "install hooks (Claude Code)",
    noHooks: "do not install hooks",
    json: "machine-readable output",
    all: "everything",
  },
  intro: "zivex-skills",
  scanning: "Scanning the project",
  scanned: (dotnet: boolean, agents: string[]) =>
    `${dotnet ? ".NET project found" : "No .NET project found"}; agents detected: ${agents.length ? agents.join(", ") : "none"}`,
  noDotnet:
    "No .NET solution or project found here. That is fine: hooks stay quiet outside .NET repositories.",
  foundationNote: "The foundation pack (always-on rules) is always included.",
  askScope: "Where should everything be installed?",
  scopeOptions: {
    hybrid: {
      label: "Hybrid (recommended)",
      hint: "foundation rules for you, everything else in this repository",
    },
    project: { label: "Project", hint: "everything in this repository, committed and shared" },
    global: { label: "Global", hint: "everything in your user directory" },
  },
  askAgents: "Which agents do you use?",
  askPacks: "Which packs do you want?",
  groupWorkflows: "Workflows",
  groupStack: "Stack",
  askCursorRules:
    "Cursor cannot read global rules (user rules only live in Cursor's settings). Write the always-on rules into this repository for Cursor?",
  askHooks: "Install hooks (format on edit, verify before stop, guard destructive commands)?",
  summaryTitle: "This will be written",
  confirmGo: "Write these files?",
  askOverwrite: (n: number) =>
    `${n} file(s) were edited by you. Overwrite them? (a backup is made first)`,
  working: "Installing",
  done: "Done",
  nothingToDo: "Nothing to do: everything is already up to date.",
  dryRunDone: "Dry run: nothing was written.",
  cancelled: "Cancelled. Nothing was written.",
  skippedGlobal: (what: string) =>
    `Skipped ${what}: the same version is already installed globally (use --pin to install it in the project).`,
  keptConflict: (p: string) =>
    `Kept ${p} because you edited it. Use --force to overwrite (a backup is made first).`,
  outro: (bootstrap: boolean) =>
    [
      bootstrap && 'Next: ask your agent to run "dotnet-conventions-bootstrap".',
      "Commit zivex.json and the agent folders. Teammates run: npx zivex-skills sync",
    ]
      .filter(Boolean)
      .join("\n"),
  noLock: 'No zivex.json found here. Run "npx zivex-skills init" first.',
  notInstalled: (n: string) => `"${n}" is not installed. Run "zivex-skills list" to see what is.`,
  foundationRequired:
    'The foundation pack is always included. To remove everything use "zivex-skills remove --all".',
  hybridKeptGlobal:
    'Global foundation rules were kept (other projects share them). Remove them with "zivex-skills remove --all --global".',
  removed: (n: number) => `Removed ${n} file(s).`,
  unknownName: (n: string) =>
    `"${n}" is neither a pack nor a skill. Run "zivex-skills list --available".`,
  unknownPack: (n: string, all: string[]) => `Unknown pack "${n}". Available: ${all.join(", ")}.`,
  unknownAgent: (n: string) => `Unknown agent "${n}". Use: claude-code, cursor, codex, generic.`,
  missingFlags: (flags: string[]) =>
    `Missing ${flags.join(" and ")} (not running interactively). Pass them, or add --yes to accept the defaults.`,
  noAgentsDetected: "No agents detected. Pass --agents (for example --agents claude-code).",
  emptyList: "Nothing installed yet. Run: npx zivex-skills init",
  permission: (p: string) => `Cannot write ${p}. Check the permissions, or use --scope project.`,
  invalidContent: "The installed zivex-skills content is invalid. Reinstall the package.",
  doctor: {
    ok: "No problems found.",
    summary: (e: number, w: number) => `${e} error(s), ${w} warning(s).`,
    missingFile: (p: string) => `Missing ${p}. Fix: zivex-skills sync`,
    modified: (p: string) =>
      `Edited since install: ${p}. Fine if intended; update will ask before overwriting.`,
    cursorDuplicate: (count: number, scope: string, example: string) =>
      `${count} skill(s) in ${scope} scope (for example ${example}) are installed for both Claude Code and Cursor. Cursor reads .claude/skills and .agents/skills, so it may list them twice. Harmless; to avoid it choose Claude Code only (Cursor reads those too) or Cursor only.`,
    duplicate: (k: string) =>
      `${k} is installed both globally and in the project. The project copy wins. Remove one to avoid confusion.`,
    drift: (k: string, a: string, b: string) =>
      `${k}: project is ${a}, global is ${b}. Fix: zivex-skills update --all`,
    badJson: (p: string) => `${p} is not valid JSON. Fix the file, then run: zivex-skills sync`,
    nodeOld: (v: string) => `Node ${v} is too old for the hooks (needs 22+). Upgrade Node.`,
    notWritable: (p: string) => `Cannot write to ${p}. Check the permissions.`,
  },
};
