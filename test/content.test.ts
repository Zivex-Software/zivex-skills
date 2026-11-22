import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { ContentError, loadContent } from "../src/content.js";
import { resolvePacks } from "../src/resolve/index.js";
import { skillMd, tempDir, write } from "./helpers.js";

const base = {
  "skills/a-skill/SKILL.md": skillMd("a-skill"),
  "foundation/safety.md": "# Safety\n",
  "hooks/fmt.mjs": "// hook\n",
  "hooks/fmt.yaml": "event: PostToolUse\n",
  "agents/rev.md": "---\nname: rev\ndescription: Reviews.\n---\nBody\n",
  "packs/foundation.yaml": "id: foundation\ntitle: Foundation\nrules: [safety]\n",
  "packs/core.yaml":
    "id: core\ntitle: Core\nrequires: [foundation]\nskills: [a-skill]\nhooks: [fmt]\nagents: [rev]\n",
};

// Guards the shipped content: CI fails on an invalid pack or SKILL.md.
test("shipped content is valid", async () => {
  await expect(loadContent()).resolves.toBeDefined();
});

test("loads and resolves requires closure, deduped", async () => {
  const root = await tempDir();
  await write(root, {
    ...base,
    "packs/extra.yaml": "id: extra\ntitle: E\nrequires: [core, foundation]\nskills: [a-skill]\n",
  });
  const r = resolvePacks(await loadContent(root), ["extra", "core"]);
  expect(r.packs).toEqual(["foundation", "core", "extra"]);
  expect(r.skills.map((s) => s.name)).toEqual(["a-skill"]);
  expect(r.rules.map((s) => s.name)).toEqual(["safety"]);
});

test("reports every issue: bad skill, name mismatch, unknown reference", async () => {
  const root = await tempDir();
  await write(root, {
    ...base,
    "skills/bad/SKILL.md": "no frontmatter",
    "skills/other/SKILL.md": skillMd("mismatch"),
    "packs/broken.yaml": "id: broken\ntitle: B\nskills: [ghost]\n",
  });
  const err = await loadContent(root).catch((e) => e);
  expect(err).toBeInstanceOf(ContentError);
  expect(err.issues).toHaveLength(3);
});

test("rejects unknown pack ids and cycles", async () => {
  const root = await tempDir();
  await write(root, {
    "packs/a.yaml": "id: a\ntitle: A\nrequires: [b]\n",
    "packs/b.yaml": "id: b\ntitle: B\nrequires: [a]\n",
  });
  const c = await loadContent(root);
  expect(() => resolvePacks(c, ["a"])).toThrow(/cycle: a -> b -> a/);
  expect(() => resolvePacks(c, ["nope"])).toThrow(/Unknown pack/);
});

// Content quality gates for the shipped skills (Agent Skills guidance: keep SKILL.md short, one level of references).
describe("shipped skills", () => {
  const read = async () => {
    const c = await loadContent();
    return [...c.skills.values()];
  };

  test("SKILL.md stays under 500 lines", async () => {
    for (const s of await read()) {
      const lines = (await readFile(join(s.path, "SKILL.md"), "utf8")).split("\n").length;
      expect(lines, s.name).toBeLessThan(500);
    }
  });

  test("every referenced references/ and scripts/ file exists, and aspnet-* skill names resolve", async () => {
    const skills = await read();
    const names = new Set(skills.map((s) => s.name));
    for (const s of skills) {
      const dirText = [await readFile(join(s.path, "SKILL.md"), "utf8")];
      for (const sub of ["references"]) {
        for (const f of await readdir(join(s.path, sub)).catch(() => []))
          dirText.push(await readFile(join(s.path, sub, f), "utf8"));
      }
      const all = dirText.join("\n");
      for (const m of all.matchAll(/`((?:references|scripts)\/[\w.-]+\.(?:md|mjs))`/g)) {
        expect(existsSync(join(s.path, m[1]!)), `${s.name}: ${m[1]}`).toBe(true);
      }
      for (const m of all.matchAll(/`(aspnet-[a-z-]+)`/g)) {
        expect(names.has(m[1]!), `${s.name} mentions unknown skill ${m[1]}`).toBe(true);
      }
    }
  });

  test("every skill that ships scripts documents them in SKILL.md", async () => {
    for (const s of await read()) {
      for (const f of await readdir(join(s.path, "scripts")).catch(() => [])) {
        expect(
          await readFile(join(s.path, "SKILL.md"), "utf8"),
          `${s.name} does not mention scripts/${f}`,
        ).toContain(`scripts/${f}`);
      }
    }
  });
});
