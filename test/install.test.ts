import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { beforeEach, expect, test } from "vitest";
import { run as init } from "../src/commands/init.js";
import { loadContent } from "../src/content.js";
import type { Env } from "../src/env.js";
import { runInstall, runRemove } from "../src/install.js";
import type { Selection } from "../src/install.js";
import { globalLockPath, projectLockPath, readLock } from "../src/lockfile.js";
import { setup, tree, write } from "./helpers.js";

async function envFor(scope: Selection["scope"] = "hybrid") {
  const s = await setup(scope);
  // Keep the real user config dir out of the tests.
  process.env.XDG_CONFIG_HOME = join(s.root, "xdg");
  process.env.APPDATA = join(s.root, "xdg");
  const env: Env = {
    cwd: s.ctx.projectRoot,
    projectRoot: s.ctx.projectRoot,
    inRepo: true,
    home: s.ctx.home,
    codexHome: s.ctx.codexHome,
    version: "1.0.0",
    content: s.ctx.content,
  };
  const sel: Selection = {
    packs: ["all"],
    skills: [],
    agents: ["claude-code"],
    hooks: true,
    scope,
  };
  return { env, sel, root: s.root };
}

beforeEach(() => {
  delete process.env.CI;
});

test("hybrid install: rules global, rest in the project, selection stored, rerun is a no-op", async () => {
  const { env, sel } = await envFor("hybrid");
  const r1 = await runInstall(env, sel);
  expect(r1.conflicts).toEqual([]);
  expect(Object.keys(await tree(env.home))).toContain(".claude/CLAUDE.md");
  expect(Object.keys(await tree(env.projectRoot))).toContain(".claude/skills/a-skill/SKILL.md");
  const lock = await readLock(projectLockPath(env.projectRoot));
  expect(lock).toMatchObject({ scope: "hybrid", packs: ["all"], agents: ["claude-code"] });
  expect((await readLock(globalLockPath())).items.map((i) => i.kind)).toEqual(["rule"]);

  const r2 = await runInstall(env, sel);
  expect(r2.applied.every((a) => a.status === "unchanged")).toBe(true);
  expect(r2.backups).toEqual([]);
});

test("skips project items already global at the same version, unless --pin", async () => {
  const { env, sel } = await envFor("global");
  await runInstall(env, { ...sel, agents: ["generic"], scope: "global" });
  const r = await runInstall(env, { ...sel, agents: ["generic"], scope: "project" });
  expect(r.skipped).toContain("skill a-skill");
  // Only the lockfile (the selection teammates sync from) is written.
  expect(Object.keys(await tree(env.projectRoot))).toEqual(["zivex.json"]);
  const pinned = await runInstall(
    env,
    { ...sel, agents: ["generic"], scope: "project" },
    { pin: true },
  );
  expect(pinned.skipped).toEqual([]);
  expect(Object.keys(await tree(env.projectRoot))).toContain(".agents/skills/a-skill/SKILL.md");
});

test("dry run writes neither files nor lockfiles", async () => {
  const { env, sel } = await envFor("project");
  await runInstall(env, sel, { dryRun: true });
  expect(await tree(env.projectRoot)).toEqual({});
});

test("update removes items the new content no longer ships", async () => {
  const { env, sel, root } = await envFor("project");
  await runInstall(env, sel);
  await write(root, {
    "content/packs/all.yaml":
      "id: all\ntitle: All\nrules: [safety]\nskills: [a-skill]\nagents: [rev]\n",
  });
  const next = { ...env, content: await loadContent(join(root, "content")) };
  const r = await runInstall(next, sel);
  expect(r.removedStale.some((p) => p.includes("fmt.mjs"))).toBe(true);
  const left = await tree(env.projectRoot);
  expect(left[".claude/hooks/zivex/fmt.mjs"]).toBeUndefined();
  expect(left[".claude/settings.json"] ?? "{}").not.toContain("fmt.mjs");
});

test("edited files are kept and reported; --force overwrites", async () => {
  const { env, sel } = await envFor("project");
  await runInstall(env, sel);
  const f = join(env.projectRoot, ".claude", "skills", "a-skill", "SKILL.md");
  await writeFile(f, "mine");
  const r = await runInstall(env, sel);
  expect(r.conflicts).toHaveLength(1);
  expect(await readFile(f, "utf8")).toBe("mine");
  // The lock still remembers the original hash, so it stays a conflict.
  expect((await runInstall(env, sel)).conflicts).toHaveLength(1);
  expect((await runInstall(env, sel, { force: true })).conflicts).toEqual([]);
  expect(await readFile(f, "utf8")).toContain("a-skill");
});

test("remove --all cleans up completely, including zivex.json", async () => {
  const { env, sel } = await envFor("project");
  await runInstall(env, sel);
  await runRemove(env, "project", { packs: [], skills: [], all: true });
  expect(await tree(env.projectRoot)).toEqual({});
});

test("remove one skill keeps the rest", async () => {
  const { env, sel } = await envFor("project");
  await runInstall(env, { ...sel, packs: [], skills: ["a-skill"] });
  await runRemove(env, "project", { packs: [], skills: ["a-skill"] });
  expect(await tree(env.projectRoot)).toEqual({});
});

test("init without a terminal and without flags fails with a fix", async () => {
  await expect(init({})).rejects.toThrow(/Missing --agents and --packs.*--yes/);
});

test("init --packs with an unknown pack lists what exists", async () => {
  await expect(init({ yes: true, agents: "claude-code", packs: "nope" })).rejects.toThrow(
    /Unknown pack "nope"/,
  );
});
