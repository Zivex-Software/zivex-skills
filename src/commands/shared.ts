import * as p from "@clack/prompts";
import { shorten, runInstall } from "../install.js";
import type { InstallResult, RunOpts, Selection } from "../install.js";
import type { Env } from "../env.js";
import { msg } from "../messages.js";
import { agentIdSchema } from "../schema.js";
import type { AgentId, Scope } from "../schema.js";
import { resolveScope } from "../scopes.js";

export interface CommonOpts extends RunOpts {
  global?: boolean;
  project?: boolean;
  scope?: Scope;
  yes?: boolean;
  agents?: string;
  packs?: string;
  hooks?: boolean;
  json?: boolean;
  all?: boolean;
}

/** A failure the user can act on: printed as "error: message" with exit code 1, no stack trace. */
export class CliError extends Error {}

export const interactive = (o: CommonOpts) =>
  !!process.stdin.isTTY && !!process.stdout.isTTY && !o.yes && !process.env.CI;
export const csv = (s?: string) =>
  s
    ? s
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
    : [];

export function parseAgents(s: string | undefined): AgentId[] {
  return csv(s).map((a) => {
    const r = agentIdSchema.safeParse(a);
    if (!r.success) throw new CliError(msg.unknownAgent(a));
    return r.data;
  });
}

export function scopeOf(env: Env, o: CommonOpts): Scope {
  try {
    return resolveScope(o, env.inRepo);
  } catch (e) {
    throw new CliError((e as Error).message);
  }
}

export function printResult(env: Env, r: InstallResult, dryRun?: boolean) {
  const written = r.applied.filter((a) => a.status === "written");
  for (const a of written)
    p.log.message(`${dryRun ? "would write" : "wrote"} ${shorten(a.key, env)}`);
  for (const s of r.skipped) p.log.warn(msg.skippedGlobal(s));
  for (const n of r.notices) p.log.info(n);
  for (const c of r.conflicts) p.log.warn(msg.keptConflict(shorten(c, env)));
  for (const f of r.removedStale)
    p.log.message(`${dryRun ? "would remove" : "removed"} ${shorten(f, env)}`);
  if (!written.length && !r.removedStale.length && !r.conflicts.length)
    p.log.success(msg.nothingToDo);
  if (dryRun) p.log.info(msg.dryRunDone);
}

/** Install; on conflicts, ask (interactive) or tell the user to pass --force (non-interactive, exit code 1). */
export async function installAndReport(
  env: Env,
  sel: Selection,
  o: CommonOpts,
): Promise<InstallResult> {
  const opts: RunOpts = { dryRun: o.dryRun, force: o.force, pin: o.pin };
  let r = await runInstall(env, sel, opts);
  if (r.conflicts.length && !o.dryRun && !o.force && interactive(o)) {
    const go = await p.confirm({ message: msg.askOverwrite(r.conflicts.length) });
    if (go === true) r = await runInstall(env, sel, { ...opts, force: true });
  }
  printResult(env, r, o.dryRun);
  if (r.conflicts.length && !o.dryRun) process.exitCode = 1;
  return r;
}

/** Selection stored in the lock for this scope (what `add`, `update` and `sync` build on). */
export function lockSelection(lock: import("../schema.js").Lock, scope: Scope): Selection {
  return {
    packs: lock.packs,
    skills: lock.skills,
    agents: lock.agents,
    hooks: lock.hooks,
    noRules: lock.noRules,
    scope: lock.scope ?? scope,
  };
}
