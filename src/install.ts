import { unlink } from "node:fs/promises";
import { relative } from "node:path";
import {
  applyOps,
  previousHashes,
  pruneBackups,
  removeItems,
  stamp,
  toLockItems,
} from "./apply.js";
import type { Applied, Roots } from "./apply.js";
import { globalLockPath, projectLockPath, readLock, upsertItems, writeLock } from "./lockfile.js";
import { resolveSelection } from "./resolve/index.js";
import type { AgentId, InstalledItem, Lock, Scope } from "./schema.js";
import type { Env } from "./env.js";
import { targets } from "./targets/index.js";
import type { Op } from "./targets/types.js";

export interface Selection {
  packs: string[];
  skills: string[];
  agents: AgentId[];
  hooks: boolean;
  scope: Scope;
  /** Agents that skip always-on rules. */
  noRules?: AgentId[];
}
export interface RunOpts {
  dryRun?: boolean;
  force?: boolean;
  pin?: boolean;
}
export interface InstallResult {
  applied: Applied[];
  backups: string[];
  notices: string[];
  /** Items not installed in the project because the same version is already global. */
  skipped: string[];
  removedStale: string[];
  conflicts: string[];
}

export const roots = (env: Env): Roots => ({ project: env.projectRoot, home: env.home });
/** The lock that stores the selection: the project's zivex.json, or the global one for global scope. */
export const homeLockPath = (env: Env, scope: Scope) =>
  scope === "global" ? globalLockPath() : projectLockPath(env.projectRoot);

const itemId = (i: { kind: string; name: string; agent: string }) =>
  `${i.kind}:${i.name}:${i.agent}`;

/** Plan + apply (or dry-run) a full selection, update the lockfiles, and remove items the selection no longer produces. */
export async function runInstall(
  env: Env,
  sel: Selection,
  opts: RunOpts = {},
): Promise<InstallResult> {
  const res = resolveSelection(env.content, sel);
  const ctx = {
    content: env.content,
    projectRoot: env.projectRoot,
    home: env.home,
    codexHome: env.codexHome,
    scope: sel.scope,
    noRules: sel.noRules ?? [],
  };
  let ops: Op[] = [];
  const notices = new Set<string>();
  for (const a of sel.agents) {
    const plan = await targets[a].plan(res, ctx);
    ops.push(...plan.ops);
    plan.notices.forEach((n) => notices.add(n));
  }

  const projectLock = await readLock(projectLockPath(env.projectRoot));
  const globalLock = await readLock(globalLockPath());
  const skipped = new Set<string>();
  if (!opts.pin) {
    const inGlobal = (op: Op) =>
      globalLock.items.some(
        (i) => itemId(i) === itemId({ ...op.item, agent: op.agent }) && i.version === env.version,
      );
    ops = ops.filter((op) => {
      if (op.place !== "project" || !inGlobal(op)) return true;
      skipped.add(`${op.item.kind} ${op.item.name}`);
      return false;
    });
  }

  const r = roots(env);
  const previous = previousHashes([...projectLock.items, ...globalLock.items], r);
  const report = await applyOps(ops, { previous, force: opts.force, dryRun: opts.dryRun });
  const conflicts = report.applied.filter((a) => a.status === "conflict").map((a) => a.key);
  const result: InstallResult = {
    applied: report.applied,
    backups: report.backups,
    notices: [...notices],
    skipped: [...skipped],
    removedStale: [],
    conflicts,
  };
  if (opts.dryRun) return result;

  // A conflicting file keeps its old recorded hash, so the next run still sees it as ours-but-edited.
  const forLock = report.applied.map((a) =>
    a.status === "conflict" && previous.has(a.key)
      ? { ...a, status: "unchanged" as const, hash: previous.get(a.key)! }
      : a,
  );
  const fresh = toLockItems(forLock, env.version, r);
  const planned = new Set([...ops.map((o) => itemId({ ...o.item, agent: o.agent })), ...skipped]);

  for (const place of ["project", "global"] as const) {
    const isHome = place === (sel.scope === "global" ? "global" : "project");
    const path = place === "project" ? projectLockPath(env.projectRoot) : globalLockPath();
    let lock: Lock = place === "project" ? projectLock : globalLock;
    const mine = fresh.filter((i) => i.scope === place);
    if (!mine.length && !isHome) continue;
    lock = upsertItems(lock, mine);
    // Stale items are only cleaned in the lock that owns the selection (hybrid never prunes shared global rules).
    if (isHome) {
      const stale = lock.items.filter((i) => !planned.has(itemId(i)));
      const gone = await dropItems(stale, lock.items, r, opts);
      result.removedStale.push(...gone.removed);
      lock = { ...lock, items: lock.items.filter((i) => !gone.items.includes(i)) };
      lock = {
        ...lock,
        scope: sel.scope,
        packs: sel.packs,
        skills: sel.skills,
        hooks: sel.hooks,
        agents: sel.agents,
        noRules: sel.noRules ?? [],
      };
    }
    await writeLock(path, lock);
  }
  return result;
}

/** Remove whole items one at a time so a conflict keeps just that item in the lock. */
async function dropItems(items: InstalledItem[], all: InstalledItem[], r: Roots, opts: RunOpts) {
  const out = { removed: [] as string[], items: [] as InstalledItem[], conflicts: [] as string[] };
  let remaining = all;
  const at = stamp();
  const backups: string[] = [];
  for (const it of items) {
    remaining = remaining.filter((i) => i !== it);
    const rep = await removeItems([it], remaining, r, {
      force: opts.force,
      dryRun: opts.dryRun,
      at,
    });
    backups.push(...rep.backups);
    out.removed.push(...rep.removed);
    out.conflicts.push(...rep.conflicts);
    if (!rep.conflicts.length) out.items.push(it);
  }
  if (!opts.dryRun) await pruneBackups(backups, r);
  return out;
}

export interface RemoveResult {
  removed: string[];
  conflicts: string[];
}

/** Remove packs/skills (or everything) from the lock that `scope` selects, then delete what they wrote. */
export async function runRemove(
  env: Env,
  scope: Scope,
  what: { packs: string[]; skills: string[]; all?: boolean },
  opts: RunOpts = {},
): Promise<RemoveResult> {
  const path = homeLockPath(env, scope);
  const lock = await readLock(path);
  const r = roots(env);
  let keepPacks = lock.packs;
  let keepSkills = lock.skills;
  let doomed: InstalledItem[];
  if (what.all) {
    doomed = lock.items;
    keepPacks = [];
    keepSkills = [];
  } else {
    keepPacks = lock.packs.filter((p) => !what.packs.includes(p));
    keepSkills = lock.skills.filter((s) => !what.skills.includes(s));
    const wanted = resolveSelection(env.content, {
      packs: keepPacks,
      skills: keepSkills,
      hooks: lock.hooks,
    });
    const keepIds = new Set([
      ...wanted.rules.map((x) => `rule:${x.name}`),
      ...wanted.skills.map((x) => `skill:${x.name}`),
      ...wanted.agents.map((x) => `agent:${x.name}`),
      ...wanted.hooks.map((x) => `hook:${x.name}`),
    ]);
    doomed = lock.items.filter((i) => !keepIds.has(`${i.kind}:${i.name}`));
  }
  const gone = await dropItems(doomed, lock.items, r, opts);
  if (opts.dryRun) return { removed: gone.removed, conflicts: gone.conflicts };

  const items = lock.items.filter((i) => !gone.items.includes(i));
  if (!items.length && !keepPacks.length && !keepSkills.length)
    await unlink(path).catch(() => undefined);
  else await writeLock(path, { ...lock, packs: keepPacks, skills: keepSkills, items });
  return { removed: gone.removed, conflicts: gone.conflicts };
}

/** Friendly path for output: project-relative, or ~/ for the user directory. */
export function shorten(abs: string, env: Env): string {
  const [p, tag] = abs.split("#");
  const rel = relative(env.projectRoot, p!);
  const out = !rel.startsWith("..")
    ? rel
    : relative(env.home, p!).startsWith("..")
      ? p!
      : `~/${relative(env.home, p!)}`;
  return (out + (tag ? ` (${tag.replace(/^hook:/, "hook ")})` : "")).split("\\").join("/");
}
