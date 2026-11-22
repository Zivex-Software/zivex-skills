import { access, constants, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import * as p from "@clack/prompts";
import { toAbs } from "../apply.js";
import { createEnv } from "../env.js";
import type { Env } from "../env.js";
import { globalLockPath, projectLockPath, readLock } from "../lockfile.js";
import { msg } from "../messages.js";
import { readSection, sha256 } from "../merge.js";
import { roots, shorten } from "../install.js";
import type { InstalledItem } from "../schema.js";
import type { CommonOpts } from "./shared.js";

type Finding = { level: "error" | "warn"; text: string };

/** Skills installed for both Claude Code and Cursor in one scope: Cursor reads .claude/skills AND .agents/skills. */
export function findCursorDuplicates(items: InstalledItem[]): { name: string; scope: string }[] {
  const key = (i: InstalledItem) => `${i.name}:${i.scope}`;
  const claude = new Set(
    items.filter((i) => i.kind === "skill" && i.agent === "claude-code").map(key),
  );
  return items
    .filter((i) => i.kind === "skill" && i.agent === "cursor" && claude.has(key(i)))
    .map((i) => ({ name: i.name, scope: i.scope }));
}

async function check(env: Env, label: "project" | "global", path: string, f: Finding[]) {
  const lock = await readLock(path).catch((e: Error) => {
    f.push({ level: "error", text: e.message });
    return undefined;
  });
  if (!lock) return undefined;
  for (const it of lock.items) {
    for (const [rel, hash] of Object.entries(lock.items.length ? it.files : {})) {
      const abs = toAbs(roots(env), it.scope, rel);
      const [file, tag] = abs.split("#") as [string, string | undefined];
      const buf = await readFile(file).catch(() => undefined);
      if (!buf) {
        f.push({ level: "error", text: msg.doctor.missingFile(shorten(file, env)) });
        continue;
      }
      if (tag?.startsWith("hook:")) {
        try {
          JSON.parse(buf.toString("utf8"));
        } catch {
          f.push({ level: "error", text: msg.doctor.badJson(shorten(file, env)) });
        }
        continue;
      }
      const cur = tag ? readSection(buf.toString("utf8"), tag) : sha256(buf);
      const now = tag && cur !== undefined ? sha256(cur) : cur;
      if (now === undefined)
        f.push({ level: "error", text: msg.doctor.missingFile(shorten(abs, env)) });
      else if (now !== hash)
        f.push({ level: "warn", text: msg.doctor.modified(shorten(abs, env)) });
    }
  }
  void label;
  return lock;
}

export async function run(o: CommonOpts) {
  const env = await createEnv();
  const f: Finding[] = [];
  const project = await check(env, "project", projectLockPath(env.projectRoot), f);
  const global = await check(env, "global", globalLockPath(), f);

  for (const a of project?.items ?? []) {
    const g = global?.items.find(
      (i) => i.kind === a.kind && i.name === a.name && i.agent === a.agent,
    );
    if (!g) continue;
    const k = `${a.kind} ${a.name} (${a.agent})`;
    f.push({
      level: "warn",
      text:
        g.version === a.version
          ? msg.doctor.duplicate(k)
          : msg.doctor.drift(k, a.version, g.version),
    });
  }

  for (const lock of [project, global]) {
    const dups = findCursorDuplicates(lock?.items ?? []);
    for (const scope of new Set(dups.map((d) => d.scope))) {
      const names = dups.filter((d) => d.scope === scope).map((d) => d.name);
      f.push({ level: "warn", text: msg.doctor.cursorDuplicate(names.length, scope, names[0]!) });
    }
  }

  const major = Number(process.versions.node.split(".")[0]);
  if (
    major < 22 &&
    [...(project?.items ?? []), ...(global?.items ?? [])].some((i) => i.kind === "hook")
  ) {
    f.push({ level: "error", text: msg.doctor.nodeOld(process.versions.node) });
  }

  // Writable: nearest existing ancestor of the global config dir.
  for (let d = dirname(globalLockPath()); ; d = dirname(d)) {
    if (
      await access(d, constants.F_OK).then(
        () => true,
        () => false,
      )
    ) {
      if (
        await access(d, constants.W_OK).then(
          () => false,
          () => true,
        )
      )
        f.push({ level: "error", text: msg.doctor.notWritable(d) });
      break;
    }
    if (dirname(d) === d) break;
  }

  const errors = f.filter((x) => x.level === "error").length;
  if (o.json) console.log(JSON.stringify(f, null, 2));
  else {
    for (const x of f) (x.level === "error" ? p.log.error : p.log.warn)(x.text);
    if (!f.length) p.log.success(msg.doctor.ok);
    else p.log.info(msg.doctor.summary(errors, f.length - errors));
  }
  if (errors) process.exitCode = 1;
}
