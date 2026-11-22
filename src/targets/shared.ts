import { readFile, readdir } from "node:fs/promises";
import { join, posix } from "node:path";
import type { Skill } from "../content.js";
import type { AgentId } from "../schema.js";
import type { Ctx, Op } from "./types.js";

export const rootFor = (ctx: Ctx, place: "project" | "global") =>
  place === "project" ? ctx.projectRoot : ctx.home;

async function walk(dir: string, prefix = ""): Promise<string[]> {
  const out: string[] = [];
  for (const e of (await readdir(dir, { withFileTypes: true })).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const rel = posix.join(prefix, e.name);
    if (e.isDirectory()) out.push(...(await walk(join(dir, e.name), rel)));
    else out.push(rel);
  }
  return out;
}

/** One file op per file of each skill directory, written to <base>/<skill>/... (Agent Skills layout). */
export async function skillOps(
  skills: Skill[],
  agent: AgentId,
  place: "project" | "global",
  base: string,
): Promise<Op[]> {
  const ops: Op[] = [];
  for (const s of skills) {
    for (const rel of await walk(s.path)) {
      ops.push({
        type: "file",
        item: { kind: "skill", name: s.name },
        agent,
        place,
        path: join(base, s.name, ...rel.split("/")),
        content: await readFile(join(s.path, ...rel.split("/"))),
      });
    }
  }
  return ops;
}

export const readText = (path: string) => readFile(path, "utf8");
