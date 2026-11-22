import { createEnv } from "../env.js";
import { homeLockPath } from "../install.js";
import { readLock } from "../lockfile.js";
import { msg } from "../messages.js";
import { CliError, installAndReport, lockSelection, parseAgents, scopeOf } from "./shared.js";
import type { CommonOpts } from "./shared.js";

export async function run(name: string, o: CommonOpts) {
  const env = await createEnv();
  const scope = scopeOf(env, o);
  const lock = await readLock(homeLockPath(env, scope));
  const sel = lockSelection(lock, scope);
  sel.scope = lock.scope ?? scope;
  const agents = parseAgents(o.agents);
  if (agents.length) sel.agents = [...new Set([...sel.agents, ...agents])];
  if (!sel.agents.length) throw new CliError(msg.noAgentsDetected);
  if (o.hooks !== undefined) sel.hooks = o.hooks;

  if (env.content.packs.has(name)) sel.packs = [...new Set([...sel.packs, name])];
  else if (env.content.skills.has(name)) sel.skills = [...new Set([...sel.skills, name])];
  else throw new CliError(msg.unknownName(name));
  await installAndReport(env, sel, o);
}
