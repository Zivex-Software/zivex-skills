import { readFile, readdir, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { expect, test } from "vitest";
import { applyOps, previousHashes, pruneBackups, removeItems, toLockItems } from "../src/apply.js";
import { targets } from "../src/targets/index.js";
import type { AgentId } from "../src/schema.js";
import { setup, tree, write } from "./helpers.js";

const agents: AgentId[] = ["claude-code", "cursor", "codex", "generic"];

for (const id of agents) {
  test(`golden: ${id} (project scope)`, async () => {
    const { ctx, res } = await setup("project");
    const plan = await targets[id].plan(res, ctx);
    await applyOps(plan.ops);
    await expect(
      JSON.stringify({ files: await tree(ctx.projectRoot), notices: plan.notices }, null, 2),
    ).toMatchFileSnapshot(`golden/${id}.json`);
  });
}

test("applying twice changes nothing and creates no backups", async () => {
  const { ctx, res, roots } = await setup("project");
  for (const id of agents) {
    const { ops } = await targets[id].plan(res, ctx);
    const first = await applyOps(ops);
    const lock = toLockItems(first.applied, "1.0.0", roots);
    const second = await applyOps(ops, { previous: previousHashes(lock, roots) });
    expect(second.applied.every((a) => a.status === "unchanged")).toBe(true);
    expect(second.backups).toEqual([]);
  }
});

test("hybrid: rules go to the user dir (claude/codex) or project (cursor, with a notice); the rest to the project", async () => {
  const { ctx, res } = await setup("hybrid");
  await applyOps((await targets["claude-code"].plan(res, ctx)).ops);
  await applyOps((await targets.codex.plan(res, ctx)).ops);
  const cursor = await targets.cursor.plan(res, ctx);
  await applyOps(cursor.ops);
  expect(Object.keys(await tree(ctx.home))).toEqual([".claude/CLAUDE.md", ".codex/AGENTS.md"]);
  expect(Object.keys(await tree(ctx.projectRoot))).toContain(".cursor/rules/zivex-safety.mdc");
  expect(cursor.notices.join()).toMatch(/no global rules/);
});

test("global hooks use an absolute script path; project hooks use CLAUDE_PROJECT_DIR", async () => {
  const g = await setup("global");
  await applyOps((await targets["claude-code"].plan(g.res, g.ctx)).ops);
  const gs = JSON.parse(await readFile(join(g.ctx.home, ".claude", "settings.json"), "utf8"));
  const arg: string = gs.hooks.PostToolUse[0].hooks[0].args[0];
  expect(isAbsolute(arg)).toBe(true);
  expect(arg.replaceAll("\\", "/")).toMatch(/\.claude\/hooks\/zivex\/fmt\.mjs$/);
});

test("settings.json merge keeps user hooks, never touches settings.local.json, backs up before changing", async () => {
  const { ctx, res, roots } = await setup("project");
  const user = {
    permissions: { allow: ["Bash(ls)"] },
    hooks: {
      PostToolUse: [{ matcher: "Edit|Write", hooks: [{ type: "command", command: "mine" }] }],
    },
  };
  await write(ctx.projectRoot, {
    ".claude/settings.json": JSON.stringify(user, null, 4),
    ".claude/settings.local.json": '{"local":true}',
  });
  const { ops } = await targets["claude-code"].plan(res, ctx);
  const rep = await applyOps(ops);
  const s = JSON.parse(await readFile(join(ctx.projectRoot, ".claude", "settings.json"), "utf8"));
  expect(s.permissions).toEqual(user.permissions);
  expect(s.hooks.PostToolUse[0].hooks).toHaveLength(2);
  expect(s.hooks.PostToolUse[0].hooks[0].command).toBe("mine");
  expect(await readFile(join(ctx.projectRoot, ".claude", "settings.local.json"), "utf8")).toBe(
    '{"local":true}',
  );
  expect(rep.backups).toHaveLength(1);

  const lock = toLockItems(rep.applied, "1", roots);
  await removeItems(lock, [], roots);
  expect(
    JSON.parse(await readFile(join(ctx.projectRoot, ".claude", "settings.json"), "utf8")),
  ).toEqual(user);
});

test("invalid settings.json is reported and left untouched", async () => {
  const { ctx, res } = await setup("project");
  await write(ctx.projectRoot, { ".claude/settings.json": "{ nope" });
  const { ops } = await targets["claude-code"].plan(res, ctx);
  await expect(applyOps(ops)).rejects.toThrow(/Cannot parse .*settings\.json/);
  expect(await readFile(join(ctx.projectRoot, ".claude", "settings.json"), "utf8")).toBe("{ nope");
});

test("user edits are conflicts (kept) unless forced, and forcing backs up first", async () => {
  const { ctx, res, roots } = await setup("project");
  const { ops } = await targets["claude-code"].plan(res, ctx);
  const lock = toLockItems((await applyOps(ops)).applied, "1", roots);
  const skill = join(ctx.projectRoot, ".claude", "skills", "a-skill", "SKILL.md");
  await writeFile(skill, "my edit");
  await write(ctx.projectRoot, {
    "CLAUDE.md": (await readFile(join(ctx.projectRoot, "CLAUDE.md"), "utf8")).replace(
      "Never drop prod.",
      "Edited.",
    ),
  });

  const previous = previousHashes(lock, roots);
  const rep = await applyOps(ops, { previous });
  expect(
    rep.applied
      .filter((a) => a.status === "conflict")
      .map((a) => a.op.type)
      .sort(),
  ).toEqual(["file", "section"]);
  expect(await readFile(skill, "utf8")).toBe("my edit");

  const rm = await removeItems(lock, [], roots);
  expect(rm.conflicts).toHaveLength(2);

  const forced = await applyOps(ops, { previous, force: true });
  expect(forced.backups).toHaveLength(2);
  expect(await readFile(skill, "utf8")).toContain("a-skill");
});

test("remove cleans up completely, but keeps files another agent still uses", async () => {
  const { ctx, res, roots } = await setup("project");
  const all: ReturnType<typeof toLockItems> = [];
  for (const id of ["cursor", "codex", "generic"] as const) {
    all.push(
      ...toLockItems((await applyOps((await targets[id].plan(res, ctx)).ops)).applied, "1", roots),
    );
  }
  const cursorItems = all.filter((i) => i.agent === "cursor");
  await removeItems(
    cursorItems,
    all.filter((i) => i.agent !== "cursor"),
    roots,
  );
  const left = await tree(ctx.projectRoot);
  expect(left[".agents/skills/a-skill/SKILL.md"]).toBeDefined();
  expect(left[".cursor/rules/zivex-safety.mdc"]).toBeUndefined();

  await removeItems(
    all.filter((i) => i.agent !== "cursor"),
    [],
    roots,
  );
  expect(await tree(ctx.projectRoot)).toEqual({});
});

test("a new CLAUDE.md imports an existing AGENTS.md so it is not shadowed", async () => {
  const { ctx, res } = await setup("project");
  await write(ctx.projectRoot, { "AGENTS.md": "# Team rules\n" });
  await applyOps((await targets["claude-code"].plan(res, ctx)).ops);
  expect(await readFile(join(ctx.projectRoot, "CLAUDE.md"), "utf8")).toMatch(/^@AGENTS\.md\n/);
});

test("dry run writes nothing", async () => {
  const { ctx, res } = await setup("project");
  const rep = await applyOps((await targets["claude-code"].plan(res, ctx)).ops, { dryRun: true });
  expect(rep.applied.every((a) => a.status === "written")).toBe(true);
  expect(await tree(ctx.projectRoot)).toEqual({});
});

test("merging many rules into one existing file makes exactly one backup; a new file makes none", async () => {
  const { ctx, res } = await setup("project");
  const fresh = await applyOps((await targets["claude-code"].plan(res, ctx)).ops);
  expect(fresh.backups).toEqual([]);
  const { ctx: c2, res: r2 } = await setup("project");
  await write(c2.projectRoot, { "CLAUDE.md": "# Mine\n", ".claude/settings.json": "{}" });
  const rep = await applyOps((await targets["claude-code"].plan(r2, c2)).ops);
  expect(rep.backups).toHaveLength(2);
});

test("remove leaves no backups behind when we owned the whole file, and keeps user content in shared files", async () => {
  const { ctx, res, roots } = await setup("project");
  await write(ctx.projectRoot, { "CLAUDE.md": "# Mine\n" });
  const lock = toLockItems(
    (await applyOps((await targets["claude-code"].plan(res, ctx)).ops)).applied,
    "1",
    roots,
  );
  const rm = await removeItems(lock, [], roots);
  expect(await readFile(join(ctx.projectRoot, "CLAUDE.md"), "utf8")).toBe("# Mine\n");
  // CLAUDE.md survived (user content), so its backup stays; fully-owned files lose theirs.
  expect((await pruneBackups(rm.backups)).every((b) => b.includes("CLAUDE.md"))).toBe(true);
  const owned = await setup("project");
  const l2 = toLockItems(
    (await applyOps((await targets["claude-code"].plan(owned.res, owned.ctx)).ops)).applied,
    "1",
    owned.roots,
  );
  expect(await pruneBackups((await removeItems(l2, [], owned.roots)).backups)).toEqual([]);
});

test("remove prunes directories that become empty, including after deleting merged files", async () => {
  const { ctx, res, roots } = await setup("project");
  const lock = toLockItems(
    (await applyOps((await targets["claude-code"].plan(res, ctx)).ops)).applied,
    "1",
    roots,
  );
  await removeItems(lock, [], roots);
  expect(await readdir(ctx.projectRoot)).toEqual([]);
});
