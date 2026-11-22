// SessionStart hook for the Claude Code plugin: injects the always-on foundation rules as session context.
// (A plugin cannot ship a CLAUDE.md, so this is how the six foundation rules stay always-on.)
// The CLI installer writes the same rules into CLAUDE.md instead; do not use both.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "content", "foundation");
const rules = readdirSync(dir)
  .filter((f) => f.endsWith(".md"))
  .sort()
  .map((f) => readFileSync(join(dir, f), "utf8").trim());

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: `# Zivex foundation rules (always on)\n\n${rules.join("\n\n")}`,
    },
  }),
);
