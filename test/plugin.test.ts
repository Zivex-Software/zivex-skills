import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { parse } from "yaml";
import { loadContent } from "../src/content.js";

const root = join(import.meta.dirname, "..");
const json = async (p: string) => JSON.parse(await readFile(join(root, p), "utf8"));

describe("Claude Code plugin", () => {
  test("manifest points at real files and its version equals the package version", async () => {
    const manifest = await json(".claude-plugin/plugin.json");
    const pkg = await json("package.json");
    expect(manifest.name).toBe("zivex-skills");
    expect(manifest.version).toBe(pkg.version);
    expect(manifest.license).toBe(pkg.license);
    for (const p of [manifest.hooks, ...manifest.skills, ...manifest.agents]) {
      expect(p.startsWith("./"), p).toBe(true);
      expect(existsSync(join(root, p)), p).toBe(true);
    }
    const market = await json(".claude-plugin/marketplace.json");
    expect(market.plugins.map((p: { name: string }) => p.name)).toEqual([
      manifest.name,
      "zivex-conventions",
    ]);
    expect(market.plugins[0].source).toBe("./");
  });

  test("hooks.json has one entry per content hook (event, matcher, script) plus the foundation SessionStart", async () => {
    const { hooks } = await json("plugin/hooks.json");
    const flat = Object.entries(hooks).flatMap(([event, groups]) =>
      (groups as { matcher?: string; hooks: { args: string[]; command: string }[] }[]).flatMap(
        (g) =>
          g.hooks.map((h) => ({
            event,
            matcher: g.matcher,
            script: h.args[0]!,
            command: h.command,
          })),
      ),
    );
    expect(
      flat.every((h) => h.command === "node" && h.script.startsWith("${CLAUDE_PLUGIN_ROOT}/")),
    ).toBe(true);
    for (const f of (await readdir(join(root, "content", "hooks"))).filter((n) =>
      n.endsWith(".yaml"),
    )) {
      const name = f.replace(".yaml", "");
      const meta = parse(await readFile(join(root, "content", "hooks", f), "utf8"));
      const hit = flat.find((h) => h.script.endsWith(`/content/hooks/${name}.mjs`));
      expect(hit, name).toMatchObject({ event: meta.event, matcher: meta.matcher });
    }
    expect(
      flat.some(
        (h) => h.event === "SessionStart" && h.script.endsWith("/plugin/foundation-context.mjs"),
      ),
    ).toBe(true);
  });

  test("foundation-context.mjs injects every foundation rule as SessionStart context", async () => {
    const r = spawnSync(process.execPath, [join(root, "plugin", "foundation-context.mjs")], {
      encoding: "utf8",
    });
    expect(r.status).toBe(0);
    const out = JSON.parse(r.stdout).hookSpecificOutput;
    expect(out.hookEventName).toBe("SessionStart");
    const content = await loadContent();
    for (const rule of content.rules.values()) {
      const heading = /^#\s+(.+)$/m.exec(await readFile(rule.path, "utf8"))![1]!;
      expect(out.additionalContext, rule.name).toContain(heading);
    }
  });

  const hasClaude =
    spawnSync("claude", ["--version"], { encoding: "utf8", shell: process.platform === "win32" })
      .status === 0;
  test.skipIf(!hasClaude)(
    "`claude plugin validate .` passes and lists all skills, the agent and the hooks",
    async () => {
      const r = spawnSync("claude", ["plugin", "validate", "."], {
        cwd: root,
        encoding: "utf8",
        shell: process.platform === "win32",
      });
      expect(r.status, r.stdout + r.stderr).toBe(0);
      const content = await loadContent();
      // The opt-in Zivex skills ship as their own plugin, not in this one.
      for (const name of content.skills.keys()) {
        if (name.startsWith("zivex-")) expect(r.stdout).not.toContain(`zivex-skills:${name}`);
        else expect(r.stdout).toContain(`zivex-skills:${name}`);
      }
      expect(r.stdout).toContain("agents: zivex-skills:dotnet-reviewer");
      expect(r.stdout).toMatch(/hooks: SessionStart/);
    },
    120_000,
  );
});
