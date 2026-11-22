import { readdir, readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import {
  agentFrontmatterSchema,
  hookMetaSchema,
  packSchema,
  skillFrontmatterSchema,
} from "./schema.js";
import type { HookMeta, Pack, SkillFrontmatter } from "./schema.js";

export interface Entry {
  name: string;
  /** Absolute path: a directory for skills, a file for everything else. */
  path: string;
}
export interface Skill extends Entry {
  frontmatter: SkillFrontmatter;
}
export interface Hook extends Entry {
  meta: HookMeta;
}
export interface Content {
  root: string;
  packs: Map<string, Pack>;
  rules: Map<string, Entry>;
  skills: Map<string, Skill>;
  agents: Map<string, Entry>;
  hooks: Map<string, Hook>;
}

export class ContentError extends Error {
  constructor(readonly issues: string[]) {
    super(`Invalid content:\n${issues.map((i) => `  - ${i}`).join("\n")}`);
  }
}

/** content/ sits one level above both src/ and dist/. */
export const defaultContentRoot = () => fileURLToPath(new URL("../content", import.meta.url));

const exists = (p: string) =>
  stat(p).then(
    () => true,
    () => false,
  );
const list = (dir: string) => readdir(dir, { withFileTypes: true }).catch(() => []);

export function frontmatter(text: string): { data: unknown; body: string } | undefined {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!m) return undefined;
  return { data: parseYaml(m[1] ?? ""), body: m[2] ?? "" };
}

const fmt = (e: { issues: { path: PropertyKey[]; message: string }[] }) =>
  e.issues.map((i) => `${i.path.map(String).join(".") || "(root)"}: ${i.message}`).join("; ");

export async function loadContent(root = defaultContentRoot()): Promise<Content> {
  const issues: string[] = [];
  const rel = (p: string) => p.slice(root.length + 1);
  const c: Content = {
    root,
    packs: new Map(),
    rules: new Map(),
    skills: new Map(),
    agents: new Map(),
    hooks: new Map(),
  };

  for (const f of await list(join(root, "packs"))) {
    if (!f.isFile() || !f.name.endsWith(".yaml")) continue;
    const path = join(root, "packs", f.name);
    try {
      const r = packSchema.safeParse(parseYaml(await readFile(path, "utf8")));
      if (!r.success) issues.push(`${rel(path)}: ${fmt(r.error)}`);
      else if (r.data.id !== f.name.slice(0, -5))
        issues.push(`${rel(path)}: id "${r.data.id}" must match the file name`);
      else c.packs.set(r.data.id, r.data);
    } catch (e) {
      issues.push(`${rel(path)}: ${(e as Error).message}`);
    }
  }

  for (const d of await list(join(root, "skills"))) {
    if (!d.isDirectory()) continue;
    const path = join(root, "skills", d.name);
    const file = join(path, "SKILL.md");
    if (!(await exists(file))) {
      issues.push(`${rel(path)}: missing SKILL.md`);
      continue;
    }
    try {
      const fm = frontmatter(await readFile(file, "utf8"));
      if (!fm) {
        issues.push(`${rel(file)}: missing YAML frontmatter`);
        continue;
      }
      const r = skillFrontmatterSchema.safeParse(fm.data);
      if (!r.success) issues.push(`${rel(file)}: ${fmt(r.error)}`);
      else if (r.data.name !== d.name)
        issues.push(`${rel(file)}: name "${r.data.name}" must match directory "${d.name}"`);
      else c.skills.set(d.name, { name: d.name, path, frontmatter: r.data });
    } catch (e) {
      issues.push(`${rel(file)}: ${(e as Error).message}`);
    }
  }

  for (const f of await list(join(root, "agents"))) {
    if (!f.isFile() || !f.name.endsWith(".md")) continue;
    const path = join(root, "agents", f.name);
    const name = f.name.slice(0, -3);
    const fm = frontmatter(await readFile(path, "utf8"));
    const r = fm && agentFrontmatterSchema.safeParse(fm.data);
    if (!r) issues.push(`${rel(path)}: missing YAML frontmatter`);
    else if (!r.success) issues.push(`${rel(path)}: ${fmt(r.error)}`);
    else if (r.data.name !== name)
      issues.push(`${rel(path)}: name "${r.data.name}" must match the file name`);
    else c.agents.set(name, { name, path });
  }

  for (const f of await list(join(root, "foundation"))) {
    if (f.isFile() && f.name.endsWith(".md")) {
      const name = f.name.slice(0, -3);
      c.rules.set(name, { name, path: join(root, "foundation", f.name) });
    }
  }

  const hookFiles = (await list(join(root, "hooks"))).filter((f) => f.isFile());
  const hookNames = new Set(hookFiles.map((f) => f.name.replace(/\.(mjs|yaml)$/, "")));
  for (const name of hookNames) {
    const script = join(root, "hooks", `${name}.mjs`);
    const meta = join(root, "hooks", `${name}.yaml`);
    if (!(await exists(script)) || !(await exists(meta))) {
      issues.push(`hooks/${name}: needs both ${name}.mjs and ${name}.yaml`);
      continue;
    }
    try {
      const r = hookMetaSchema.safeParse(parseYaml(await readFile(meta, "utf8")));
      if (!r.success) issues.push(`${rel(meta)}: ${fmt(r.error)}`);
      else c.hooks.set(name, { name, path: script, meta: r.data });
    } catch (e) {
      issues.push(`${rel(meta)}: ${(e as Error).message}`);
    }
  }

  for (const p of c.packs.values()) {
    for (const [field, map] of [
      ["requires", c.packs],
      ["rules", c.rules],
      ["skills", c.skills],
      ["agents", c.agents],
      ["hooks", c.hooks],
    ] as const) {
      for (const n of p[field])
        if (!map.has(n)) issues.push(`packs/${p.id}.yaml: ${field} references unknown "${n}"`);
    }
  }

  if (issues.length) throw new ContentError(issues);
  return c;
}
