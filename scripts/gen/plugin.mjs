// Generates plugin/hooks.json (Claude Code plugin hooks) from content/hooks/*.yaml, so the CLI installer and the
// plugin share one source. Usage: node scripts/gen/plugin.mjs   (run via `npm run gen`; CI fails if it is stale)
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

const root = join(import.meta.dirname, "..", "..");
const hooksDir = join(root, "content", "hooks");
const hooks = {};
const add = (event, matcher, handler) => {
  const groups = (hooks[event] ??= []);
  let group = groups.find((g) => g.matcher === matcher);
  if (!group) groups.push((group = { ...(matcher ? { matcher } : {}), hooks: [] }));
  group.hooks.push(handler);
};

// Always-on rules: one SessionStart context injection.
add("SessionStart", undefined, {
  type: "command",
  command: "node",
  args: ["${CLAUDE_PLUGIN_ROOT}/plugin/foundation-context.mjs"],
});

for (const f of readdirSync(hooksDir)
  .filter((n) => n.endsWith(".yaml"))
  .sort()) {
  const name = f.replace(/\.yaml$/, "");
  const meta = parse(readFileSync(join(hooksDir, f), "utf8"));
  add(meta.event, meta.matcher, {
    type: "command",
    command: "node",
    args: [`\${CLAUDE_PLUGIN_ROOT}/content/hooks/${name}.mjs`],
    ...(meta.timeout ? { timeout: meta.timeout } : {}),
  });
}

// plugin.json carries the package version (Claude Code only updates a plugin when its version changes).
const manifestPath = join(root, ".claude-plugin", "plugin.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
manifest.version = pkg.version;

// Opt-in packs (optIn: true) ship as their own plugin; the main plugin lists its skills explicitly so they are not pulled in.
const packsDir = join(root, "content", "packs");
const optInPacks = readdirSync(packsDir)
  .filter((f) => f.endsWith(".yaml"))
  .map((f) => parse(readFileSync(join(packsDir, f), "utf8")))
  .filter((p) => p.optIn === true);
const optInSkills = new Set(optInPacks.flatMap((p) => p.skills ?? []));
const allSkills = readdirSync(join(root, "content", "skills"), { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();
const coreSkills = allSkills.filter((n) => !optInSkills.has(n));
manifest.skills = coreSkills.map((n) => `./content/skills/${n}`);
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

writeFileSync(join(root, "plugin", "hooks.json"), `${JSON.stringify({ hooks }, null, 2)}\n`);
console.log("wrote plugin/hooks.json and synced the plugin version");

// One extra plugin per opt-in pack: plugins/<pack>/ with its own manifest and a copy of the skills (a plugin cannot reach outside its folder).
const marketplacePath = join(root, ".claude-plugin", "marketplace.json");
const marketplace = JSON.parse(readFileSync(marketplacePath, "utf8"));
marketplace.plugins = [
  {
    ...marketplace.plugins.find((p) => p.name === manifest.name),
    description: `${coreSkills.length} skills (ASP.NET security, performance, EF Core, API design, resilience, observability, module boundaries), a reviewer subagent, guard/format/verify hooks, always-on rules`,
  },
];
rmSync(join(root, "plugins"), { recursive: true, force: true });
for (const pack of optInPacks) {
  const dir = join(root, "plugins", pack.id);
  mkdirSync(join(dir, ".claude-plugin"), { recursive: true });
  const description = `${pack.title}: ${pack.hint}. Opt-in companion to zivex-skills; the skills work on their own.`;
  writeFileSync(
    join(dir, ".claude-plugin", "plugin.json"),
    `${JSON.stringify(
      {
        name: pack.id,
        version: pkg.version,
        description,
        author: manifest.author,
        homepage: manifest.homepage,
        repository: manifest.repository,
        license: manifest.license,
        keywords: ["dotnet", "conventions", "code-style", "architecture", "compliance", "zivex"],
      },
      null,
      2,
    )}\n`,
  );
  for (const name of pack.skills)
    cpSync(join(root, "content", "skills", name), join(dir, "skills", name), { recursive: true });
  writeFileSync(
    join(dir, "README.md"),
    `# ${pack.title}\n\n${description}\n\nGenerated from \`content/skills\` by \`npm run gen\` in https://github.com/Zivex-Software/zivex-skills (MIT). Do not edit here.\n`,
  );
  cpSync(join(root, "LICENSE"), join(dir, "LICENSE"));
  marketplace.plugins.push({
    name: pack.id,
    source: `./plugins/${pack.id}`,
    description,
    category: "development",
  });
}
writeFileSync(marketplacePath, `${JSON.stringify(marketplace, null, 2)}\n`);
console.log(`wrote ${optInPacks.length} opt-in plugin(s) and the marketplace`);
