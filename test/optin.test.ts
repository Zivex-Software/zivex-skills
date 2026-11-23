import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, test } from "vitest";
import { loadContent } from "../src/content.js";
import { packSchema } from "../src/schema.js";
import { resolveSelection } from "../src/resolve/index.js";

const root = join(import.meta.dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
function files(dir: string): string[] {
  return readdirSync(join(root, dir)).flatMap((n) => {
    const p = join(dir, n);
    return statSync(join(root, p)).isDirectory() ? files(p) : [p];
  });
}

describe("opt-in packs", () => {
  test("optIn defaults to false and the Zivex pack is opt-in", async () => {
    expect(packSchema.parse({ id: "x", title: "X" }).optIn).toBe(false);
    const c = await loadContent();
    expect(c.packs.get("zivex-conventions")?.optIn).toBe(true);
    expect([...c.packs.values()].filter((p) => p.optIn).map((p) => p.id)).toEqual([
      "zivex-conventions",
    ]);
  });

  test("no pack requires an opt-in pack, so no default or workflow selection can pull it in", async () => {
    const c = await loadContent();
    const optIn = new Set([...c.packs.values()].filter((p) => p.optIn).map((p) => p.id));
    for (const p of c.packs.values())
      for (const r of p.requires)
        expect(optIn.has(r), `${p.id} requires opt-in pack ${r}`).toBe(false);
    const everything = resolveSelection(c, {
      packs: [...c.packs.values()].filter((p) => !p.optIn).map((p) => p.id),
      skills: [],
    });
    expect(everything.skills.map((s) => s.name).filter((n) => n.startsWith("zivex-"))).toEqual([]);
  });

  test("selecting the opt-in pack adds exactly its six skills plus the core it builds on", async () => {
    const c = await loadContent();
    const r = resolveSelection(c, { packs: ["zivex-conventions"], skills: [] });
    expect(
      r.skills
        .map((s) => s.name)
        .filter((n) => n.startsWith("zivex-"))
        .sort(),
    ).toEqual([
      "zivex-architecture-workflow",
      "zivex-build-workflow",
      "zivex-compliance-by-construction",
      "zivex-dotnet-code-style",
      "zivex-engineering-standards",
      "zivex-vertical-slice",
    ]);
    expect(r.packs).toEqual(["foundation", "dotnet-core", "zivex-conventions"]);
  });
});

describe("public content hygiene", () => {
  // The Zivex pack is published in a public MIT repository: it must not carry internal names, paths or personal data.
  const DENY =
    /\bDaan\b|Gearlane|Hermes|\.hermes|\bBorne\b|Zivex (Identity|Suite|Connect|Intelligence|Operations|Studio)|Moneybird|Mollie|OpenBao|Hetzner|Coolify|Scaleway|\/Users\/|~\/Development|aspnet-starter|zivex-retro|zivex-decisions|Identity ADR|Operations ADR|Foundation ADR/;

  test("the Zivex skills and their plugin copy are free of internal references", () => {
    const targets = [
      ...readdirSync(join(root, "content", "skills"))
        .filter((n) => n.startsWith("zivex-"))
        .flatMap((n) => files(join("content", "skills", n))),
      ...files("plugins"),
    ];
    expect(targets.length).toBeGreaterThan(20);
    for (const f of targets) expect(read(f), f).not.toMatch(DENY);
  });
});

describe("opt-in plugin", () => {
  const manifest = JSON.parse(read(".claude-plugin/plugin.json"));
  const market = JSON.parse(read(".claude-plugin/marketplace.json"));

  test("the main plugin does not list the opt-in skills; the marketplace offers both plugins", () => {
    expect(manifest.skills.every((s: string) => !s.includes("/zivex-"))).toBe(true);
    expect(market.plugins.map((p: { name: string }) => p.name)).toEqual([
      "zivex-skills",
      "zivex-conventions",
    ]);
    expect(market.plugins[1].source).toBe("./plugins/zivex-conventions");
  });

  test("the opt-in plugin is a byte-for-byte copy of the source skills with a matching version", () => {
    const pm = JSON.parse(read("plugins/zivex-conventions/.claude-plugin/plugin.json"));
    expect(pm.name).toBe("zivex-conventions");
    expect(pm.version).toBe(JSON.parse(read("package.json")).version);
    for (const name of readdirSync(join(root, "plugins/zivex-conventions/skills"))) {
      const src = files(join("content", "skills", name))
        .map((f) => relative(join("content", "skills", name), f))
        .sort();
      const copy = files(join("plugins/zivex-conventions/skills", name))
        .map((f) => relative(join("plugins/zivex-conventions/skills", name), f))
        .sort();
      expect(copy, name).toEqual(src);
      for (const f of src)
        expect(read(join("plugins/zivex-conventions/skills", name, f)), `${name}/${f}`).toBe(
          read(join("content", "skills", name, f)),
        );
    }
  });
});
