import { createEnv } from "../env.js";
import { globalLockPath, projectLockPath, readLock } from "../lockfile.js";
import { msg } from "../messages.js";
import { CliError, installAndReport, lockSelection, scopeOf } from "./shared.js";
import type { CommonOpts } from "./shared.js";

/** Replay the lockfile selection with the current package content. `update` and `sync` share this. */
async function replay(paths: string[], o: CommonOpts, strict: boolean) {
  const env = await createEnv();
  let ran = 0;
  for (const path of paths) {
    const lock = await readLock(path);
    if (!lock.agents.length) continue;
    await installAndReport(env, lockSelection(lock, scopeOf(env, o)), o);
    ran++;
  }
  if (!ran && strict) throw new CliError(msg.noLock);
  if (!ran && !strict) throw new CliError(msg.emptyList);
}

export async function update(o: CommonOpts) {
  const env = await createEnv();
  const scope = scopeOf(env, o);
  const project = projectLockPath(env.projectRoot);
  const paths = o.all
    ? [project, globalLockPath()]
    : [scope === "global" ? globalLockPath() : project];
  await replay(paths, o, false);
}

export async function sync(o: CommonOpts) {
  const env = await createEnv();
  await replay([projectLockPath(env.projectRoot)], o, true);
}
