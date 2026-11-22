import * as p from "@clack/prompts";
import { createEnv } from "../env.js";
import { homeLockPath, runRemove, shorten } from "../install.js";
import { readLock } from "../lockfile.js";
import { msg } from "../messages.js";
import { CliError, scopeOf } from "./shared.js";
import type { CommonOpts } from "./shared.js";

export async function run(name: string | undefined, o: CommonOpts) {
  const env = await createEnv();
  const scope = scopeOf(env, o);
  // Hybrid keeps its shared global rules unless you ask for --global explicitly.
  const lock = await readLock(homeLockPath(env, scope));
  const what = { packs: [] as string[], skills: [] as string[], all: o.all };
  if (!o.all) {
    if (!name) throw new CliError(msg.notInstalled("(nothing given)"));
    if (name === "foundation") throw new CliError(msg.foundationRequired);
    if (lock.packs.includes(name)) what.packs.push(name);
    else if (lock.skills.includes(name)) what.skills.push(name);
    else throw new CliError(msg.notInstalled(name));
  }
  const r = await runRemove(env, scope, what, { dryRun: o.dryRun, force: o.force });
  for (const f of r.removed)
    p.log.message(`${o.dryRun ? "would remove" : "removed"} ${shorten(f, env)}`);
  for (const c of r.conflicts) p.log.warn(msg.keptConflict(shorten(c, env)));
  p.log.success(msg.removed(r.removed.length));
  if (r.conflicts.length) process.exitCode = 1;
  if (o.all && scope === "hybrid") p.log.info(msg.hybridKeptGlobal);
  if (o.dryRun) p.log.info(msg.dryRunDone);
}
