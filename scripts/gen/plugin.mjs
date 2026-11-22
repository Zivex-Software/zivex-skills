// Generates plugin/hooks.json (Claude Code plugin hooks) from content/hooks/*.yaml, so the CLI installer and the
// plugin share one source. Usage: node scripts/gen/plugin.mjs   (run via `npm run gen`; CI fails if it is stale)
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
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
manifest.version = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

writeFileSync(join(root, "plugin", "hooks.json"), `${JSON.stringify({ hooks }, null, 2)}\n`);
console.log("wrote plugin/hooks.json and synced the plugin version");
