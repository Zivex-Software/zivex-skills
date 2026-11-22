import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export const tempDir = () => mkdtemp(join(tmpdir(), "zivex-test-"));

export async function write(root: string, files: Record<string, string>) {
  for (const [p, text] of Object.entries(files)) {
    await mkdir(dirname(join(root, p)), { recursive: true });
    await writeFile(join(root, p), text);
  }
}

export const skillMd = (name: string) =>
  `---\nname: ${name}\ndescription: Does ${name}.\n---\n# ${name}\n`;

import { readFile, readdir } from "node:fs/promises";
import { loadContent } from "../src/content.js";
import { resolvePacks } from "../src/resolve/index.js";
import type { Ctx } from "../src/targets/types.js";
import type { Scope } from "../src/schema.js";

export const fixtureFiles = {
  "skills/a-skill/SKILL.md": skillMd("a-skill"),
  "skills/a-skill/references/notes.md": "notes\n",
  "foundation/safety.md": "# Safety first\n\nNever drop prod.\n",
  "agents/rev.md":
    '---\nname: rev\ndescription: "Reviews a diff."\n---\nReview the diff.\nSay "ok".\n',
  "hooks/fmt.mjs": "// fmt hook\n",
  "hooks/fmt.yaml": "event: PostToolUse\nmatcher: Edit|Write\ntimeout: 60\n",
  "packs/all.yaml":
    "id: all\ntitle: All\nrules: [safety]\nskills: [a-skill]\nagents: [rev]\nhooks: [fmt]\n",
};

/** Builds a fixture content tree + project/home dirs; returns everything a target test needs. */
export async function setup(scope: Scope = "project") {
  const root = await tempDir();
  await write(
    root,
    Object.fromEntries(Object.entries(fixtureFiles).map(([k, v]) => [`content/${k}`, v])),
  );
  const content = await loadContent(join(root, "content"));
  const ctx: Ctx = {
    content,
    projectRoot: join(root, "project"),
    home: join(root, "home"),
    codexHome: join(root, "home", ".codex"),
    scope,
  };
  await mkdir(ctx.projectRoot, { recursive: true });
  await mkdir(ctx.home, { recursive: true });
  return {
    root,
    ctx,
    res: resolvePacks(content, ["all"]),
    roots: { project: ctx.projectRoot, home: ctx.home },
  };
}

/** posix-relative path -> text, for golden comparisons. Backup files are excluded. */
export async function tree(dir: string, prefix = ""): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const e of (await readdir(dir, { withFileTypes: true }).catch(() => [])).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const p = `${prefix}${e.name}`;
    if (e.isDirectory()) Object.assign(out, await tree(join(dir, e.name), `${p}/`));
    else if (!e.name.includes(".zivex-bak-")) out[p] = await readFile(join(dir, e.name), "utf8");
  }
  return out;
}
