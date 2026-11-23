// Packs the project and runs the tarball through a package manager against a fixture .NET repo.
// Usage: node scripts/smoke.mjs <npm|pnpm|bun|yarn>
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import assert from "node:assert/strict";

const pm = process.argv[2] ?? "npm";
const root = resolve(import.meta.dirname, "..");
const win = process.platform === "win32";
const sh = (cmd, args, opts = {}) =>
  spawnSync(cmd, args, { encoding: "utf8", shell: win, ...opts });

const work = mkdtempSync(join(tmpdir(), `zivex-smoke-${pm}-`));
const packed = JSON.parse(
  execFileSync("npm", ["pack", "--json", "--pack-destination", work], {
    cwd: root,
    encoding: "utf8",
    shell: win,
  }),
);
const tgz = join(work, packed[0].filename);

// How each package manager runs a bin from a tarball without installing it globally.
const runners = {
  npm: (a) => ["npm", ["exec", "--yes", `--package=${tgz}`, "--", "zivex-skills", ...a]],
  pnpm: (a) => ["pnpm", ["--package", tgz, "dlx", "zivex-skills", ...a]],
  // Yarn Berry reads a bare Windows path as a registry name, so give it an explicit file: URL.
  yarn: (a) => [
    "yarn",
    ["dlx", "-p", `zivex-skills@file:${tgz.replaceAll("\\", "/")}`, "zivex-skills", ...a],
  ],
  bun: (a) => ["bunx", ["--package", tgz, "zivex-skills", ...a]],
};
const repo = join(work, "repo");
cpSync(join(root, "test", "fixtures", "dotnet-sample"), repo, { recursive: true });
execFileSync("git", ["init", "-q"], { cwd: repo });
const home = join(work, "home");
const env = {
  ...process.env,
  HOME: home,
  USERPROFILE: home,
  XDG_CONFIG_HOME: join(home, "cfg"),
  APPDATA: join(home, "cfg"),
  CI: "1",
  NO_COLOR: "1",
};
const zs = (...a) => {
  let [cmd, args] = runners[pm](a);
  let r = sh(cmd, args, { cwd: repo, env });
  // pnpm/yarn may only exist through corepack (CI runs `corepack enable` instead).
  if (r.error?.code === "ENOENT" && ["pnpm", "yarn"].includes(cmd))
    r = sh("corepack", [cmd, ...args], { cwd: repo, env });
  assert.equal(
    r.status,
    0,
    `${pm} zivex-skills ${a.join(" ")} failed:\n${r.stdout}\n${r.stderr}\n${r.error ?? ""}`,
  );
  return r.stdout + r.stderr;
};
const files = (d) =>
  readdirSync(d, { recursive: true })
    .map(String)
    .filter((f) => !f.startsWith(".git"));

try {
  assert.match(zs("--help"), /Usage: zivex-skills/);
  zs(
    "init",
    "--yes",
    "--agents",
    "claude-code,cursor,codex",
    "--packs",
    "workflow-features",
    "--scope",
    "project",
  );
  for (const f of [
    ".claude/skills/dotnet-verify/SKILL.md",
    ".claude/agents/dotnet-reviewer.md",
    ".claude/settings.json",
    ".agents/skills/dotnet-verify/SKILL.md",
    ".cursor/rules/zivex-structure.mdc",
    "CLAUDE.md",
    "AGENTS.md",
    "zivex.json",
  ]) {
    assert.ok(existsSync(join(repo, f)), `missing ${f}`);
  }
  const hooks = JSON.parse(readFileSync(join(repo, ".claude/settings.json"), "utf8")).hooks;
  assert.deepEqual(Object.keys(hooks).sort(), ["PostToolUse", "PreToolUse", "Stop"]);
  // Warnings are fine (installing for Claude Code and Cursor triggers the duplicate-skill warning); errors are not.
  const doctor = zs("doctor");
  assert.match(doctor, /No problems found|0 error\(s\)/, doctor);
  assert.match(zs("sync"), /Nothing to do/);
  zs("remove", "--all", "--project");
  assert.deepEqual(
    files(repo).filter((f) => !f.startsWith("src") && f !== "Sample.slnx"),
    [],
  );

  // Opt-in packs: `init --yes` without --packs installs the defaults only; the Zivex pack needs an explicit `add`.
  zs("init", "--yes", "--agents", "generic", "--scope", "project");
  assert.ok(
    existsSync(join(repo, ".agents/skills/aspnet-security/SKILL.md")),
    "default packs are installed",
  );
  assert.ok(
    !existsSync(join(repo, ".agents/skills/zivex-engineering-standards")),
    "opt-in pack must not be a default",
  );
  zs("add", "zivex-conventions");
  assert.ok(
    existsSync(join(repo, ".agents/skills/zivex-engineering-standards/SKILL.md")),
    "opt-in pack installs when asked for",
  );
  assert.ok(
    existsSync(join(repo, ".agents/skills/zivex-vertical-slice/references/slice-anatomy.md")),
  );
  zs("remove", "zivex-conventions");
  assert.ok(
    !existsSync(join(repo, ".agents/skills/zivex-engineering-standards")),
    "opt-in pack removes cleanly",
  );
  assert.ok(
    existsSync(join(repo, ".agents/skills/aspnet-security/SKILL.md")),
    "removing the opt-in pack keeps the rest",
  );
  zs("remove", "--all", "--project");
  assert.deepEqual(
    files(repo).filter((f) => !f.startsWith("src") && f !== "Sample.slnx"),
    [],
  );
  console.log(`smoke ok: ${pm}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
