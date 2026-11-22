import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { lockSchema } from "./schema.js";
import type { InstalledItem, Lock } from "./schema.js";
import { globalConfigDir } from "./scopes.js";

export const emptyLock = (): Lock => ({
  version: 1,
  packs: [],
  skills: [],
  hooks: true,
  agents: [],
  noRules: [],
  items: [],
});

export const projectLockPath = (projectRoot: string) => join(projectRoot, "zivex.json");
export const globalLockPath = () => join(globalConfigDir(), "zivex.json");

/** Missing file => empty lock. A corrupt file throws with a fix hint rather than being overwritten. */
export async function readLock(path: string): Promise<Lock> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return emptyLock();
    throw e;
  }
  const r = lockSchema.safeParse(JSON.parse(text));
  if (!r.success)
    throw new Error(
      `${path} is invalid (${r.error.message}). Fix or delete it, then run "zivex-skills sync".`,
    );
  return r.data;
}

/** Stable, diff-friendly output; atomic via temp file + rename. */
export async function writeLock(path: string, lock: Lock): Promise<void> {
  const sorted: Lock = {
    ...lock,
    packs: [...lock.packs].sort(),
    skills: [...lock.skills].sort(),
    agents: [...lock.agents].sort(),
    items: [...lock.items].sort((a, b) =>
      `${a.kind}:${a.name}:${a.agent}`.localeCompare(`${b.kind}:${b.name}:${b.agent}`),
    ),
  };
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  await writeFile(tmp, `${JSON.stringify(sorted, null, 2)}\n`);
  await rename(tmp, path);
}

/** Replace items with the same kind/name/agent/scope, add the rest. */
export function upsertItems(lock: Lock, items: InstalledItem[]): Lock {
  const id = (i: InstalledItem) => `${i.kind}:${i.name}:${i.agent}:${i.scope}`;
  const fresh = new Set(items.map(id));
  return { ...lock, items: [...lock.items.filter((i) => !fresh.has(id(i))), ...items] };
}
