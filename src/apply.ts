import { copyFile, mkdir, readFile, rmdir, unlink, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import {
  readSection,
  removeHook,
  removeSection,
  sha256,
  upsertHook,
  upsertSection,
} from "./merge.js";
import type { Settings } from "./merge.js";
import type { InstalledItem } from "./schema.js";
import type { Op } from "./targets/types.js";

export interface Roots {
  project: string;
  home: string;
}
export interface ApplyOptions {
  /** Hash of what we wrote last time, by opKey(). Comes from the lockfile (see previousHashes). */
  previous?: Map<string, string>;
  /** Overwrite user-modified files/sections (after backing them up). */
  force?: boolean;
  /** Compute the report without writing anything. */
  dryRun?: boolean;
}
export interface Applied {
  op: Op;
  key: string;
  status: "written" | "unchanged" | "conflict";
  hash: string;
}
export interface Report {
  applied: Applied[];
  backups: string[];
}

/** Absolute key for an op; `#tag` marks merged (non-whole-file) content. */
export function opKey(op: Op): string {
  if (op.type === "section") return `${op.path}#${op.id}`;
  if (op.type === "hooks") return `${op.path}#hook:${op.entry.name}`;
  return op.path;
}

const stamp = () => new Date().toISOString().replace(/\D/g, "").slice(0, 14);
const readOrUndefined = (p: string) =>
  readFile(p).then(
    (b) => b,
    (e: NodeJS.ErrnoException) => {
      if (e.code === "ENOENT") return undefined;
      throw e;
    },
  );

async function backup(path: string, report: Report, at: string, dryRun?: boolean) {
  const to = `${path}.zivex-bak-${at}`;
  if (!dryRun) await copyFile(path, to);
  report.backups.push(to);
}

async function put(path: string, data: string | Uint8Array, dryRun?: boolean) {
  if (dryRun) return;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, data);
}

function parseSettings(path: string, text: string): Settings {
  try {
    return text.trim() ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      `Cannot parse ${path} as JSON. Fix the file (nothing was changed), then run the command again.`,
    );
  }
}

/** Apply ops in order. Idempotent: an op whose result is already on disk is reported "unchanged". */
export async function applyOps(ops: Op[], opts: ApplyOptions = {}): Promise<Report> {
  const report: Report = { applied: [], backups: [] };
  const at = stamp();
  const prev = opts.previous ?? new Map<string, string>();

  for (const op of ops) {
    const key = opKey(op);
    const done = (status: Applied["status"], hash: string) =>
      report.applied.push({ op, key, status, hash });
    const old = prev.get(key);

    if (op.type === "file") {
      const hash = sha256(op.content);
      const cur = await readOrUndefined(op.path);
      if (cur && sha256(cur) === hash) done("unchanged", hash);
      else if (cur && !opts.force && sha256(cur) !== old) done("conflict", hash);
      else {
        if (cur) await backup(op.path, report, at, opts.dryRun);
        await put(op.path, op.content, opts.dryRun);
        done("written", hash);
      }
    } else if (op.type === "section") {
      const body = op.body.trim();
      const hash = sha256(body);
      const buf = await readOrUndefined(op.path);
      const text = buf?.toString("utf8");
      const cur = text === undefined ? undefined : readSection(text, op.id);
      if (cur !== undefined && sha256(cur) === hash) done("unchanged", hash);
      else if (cur !== undefined && !opts.force && sha256(cur) !== old) done("conflict", hash);
      else {
        if (text !== undefined) await backup(op.path, report, at, opts.dryRun);
        const base = text ?? op.preambleIfNew ?? "";
        await put(op.path, upsertSection(base, op.id, body), opts.dryRun);
        done("written", hash);
      }
    } else {
      const hash = sha256(JSON.stringify(op.entry));
      const text = (await readOrUndefined(op.path))?.toString("utf8");
      const before = parseSettings(op.path, text ?? "");
      const after = upsertHook(before, op.entry);
      if (JSON.stringify(before) === JSON.stringify(after)) done("unchanged", hash);
      else {
        if (text !== undefined) await backup(op.path, report, at, opts.dryRun);
        await put(op.path, `${JSON.stringify(after, null, 2)}\n`, opts.dryRun);
        done("written", hash);
      }
    }
  }
  return report;
}

// ---- Lock bookkeeping ----
const rootOf = (roots: Roots, scope: "project" | "global") =>
  scope === "project" ? roots.project : roots.home;
const toRel = (roots: Roots, scope: "project" | "global", abs: string) => {
  const [path, tag] = abs.split("#");
  return relative(rootOf(roots, scope), path!).split("\\").join("/") + (tag ? `#${tag}` : "");
};
const toAbs = (roots: Roots, scope: "project" | "global", rel: string) => {
  const [path, tag] = rel.split("#");
  return resolve(rootOf(roots, scope), path!) + (tag ? `#${tag}` : "");
};

/** Hash of everything the lock says we last wrote, by absolute opKey. */
export function previousHashes(items: InstalledItem[], roots: Roots): Map<string, string> {
  const m = new Map<string, string>();
  for (const it of items)
    for (const [k, h] of Object.entries(it.files)) m.set(toAbs(roots, it.scope, k), h);
  return m;
}

/** Group applied (non-conflicting) ops into lock items: one per kind/name/agent/scope. */
export function toLockItems(applied: Applied[], version: string, roots: Roots): InstalledItem[] {
  const items = new Map<string, InstalledItem>();
  for (const a of applied) {
    if (a.status === "conflict") continue;
    const { item, agent, place } = a.op;
    const id = `${item.kind}:${item.name}:${agent}:${place}`;
    const it = items.get(id) ?? {
      kind: item.kind,
      name: item.name,
      agent,
      scope: place,
      version,
      files: {},
    };
    it.files[toRel(roots, place, a.key)] = a.hash;
    items.set(id, it);
  }
  return [...items.values()];
}

// ---- Removal ----
export interface RemoveReport {
  removed: string[];
  conflicts: string[];
  backups: string[];
}

async function pruneEmptyDirs(dir: string, stop: string) {
  for (let d = dir; d.startsWith(stop) && d !== stop; d = dirname(d)) {
    try {
      await rmdir(d);
    } catch {
      return;
    }
  }
}

/**
 * Remove everything the given lock items wrote. Files/sections the user edited are kept and reported
 * as conflicts unless `force`. Paths still referenced by `keep` (another agent shares them) are left alone.
 */
export async function removeItems(
  items: InstalledItem[],
  keep: InstalledItem[],
  roots: Roots,
  opts: { force?: boolean; dryRun?: boolean } = {},
): Promise<RemoveReport> {
  const rep: RemoveReport = { removed: [], conflicts: [], backups: [] };
  const at = stamp();
  const shared = new Set(
    keep.flatMap((k) => Object.keys(k.files).map((f) => toAbs(roots, k.scope, f))),
  );

  for (const it of items) {
    for (const [rel, hash] of Object.entries(it.files)) {
      const key = toAbs(roots, it.scope, rel);
      if (shared.has(key)) continue;
      const [path, tag] = key.split("#") as [string, string | undefined];
      const buf = await readOrUndefined(path);
      if (!buf) continue;

      if (!tag) {
        if (!opts.force && sha256(buf) !== hash) rep.conflicts.push(path);
        else {
          if (!opts.dryRun) {
            await unlink(path);
            await pruneEmptyDirs(dirname(path), rootOf(roots, it.scope));
          }
          rep.removed.push(path);
        }
        continue;
      }

      const text = buf.toString("utf8");
      let next: string;
      if (tag.startsWith("hook:")) {
        const before = parseSettings(path, text);
        const after = removeHook(before, tag.slice(5));
        next = Object.keys(after).length ? `${JSON.stringify(after, null, 2)}\n` : "";
        if (JSON.stringify(before) === JSON.stringify(after)) continue;
      } else {
        const cur = readSection(text, tag);
        if (cur === undefined) continue;
        if (!opts.force && sha256(cur) !== hash) {
          rep.conflicts.push(`${path}#${tag}`);
          continue;
        }
        next = removeSection(text, tag);
      }
      const r = { applied: [], backups: rep.backups };
      if (next) {
        await backup(path, r, at, opts.dryRun);
        await put(path, next, opts.dryRun);
      } else if (!opts.dryRun) await unlink(path);
      rep.removed.push(key);
    }
  }
  return rep;
}
