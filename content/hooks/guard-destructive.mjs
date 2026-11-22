// Asks (or denies) before destructive shell commands. No-ops outside .NET repositories.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, parse } from "node:path";

const input = (() => {
  try {
    return JSON.parse(readFileSync(0, "utf8"));
  } catch {
    return {};
  }
})();
const command = input?.tool_input?.command;
if (typeof command !== "string") process.exit(0);

const isDotnetRepo = (start) => {
  for (let d = start; ; d = dirname(d)) {
    try {
      if (readdirSync(d).some((n) => /\.(sln|slnx|csproj)$/i.test(n))) return true;
    } catch {}
    if (d === parse(d).root) return false;
  }
};
if (!isDotnetRepo(input.cwd || process.cwd())) process.exit(0);

// deny = never without the user doing it themselves; ask = the user confirms each time.
const rules = [
  ["deny", /\bdotnet\s+ef\s+database\s+drop\b/i, "dotnet ef database drop deletes a database"],
  ["deny", /\bdrop\s+(database|schema)\b/i, "DROP DATABASE/SCHEMA deletes data"],
  ["ask", /\bdrop\s+table\b|\btruncate\s+table\b/i, "DROP/TRUNCATE TABLE deletes data"],
  [
    "ask",
    /\bgit\s+push\b[^;&|]*(--force\b|--force-with-lease\b|\s-f\b|\s\+\S)/i,
    "force push rewrites remote history",
  ],
  ["ask", /\bgit\s+(reset\s+--hard|clean\s+-[a-z]*f)/i, "this discards uncommitted work"],
  [
    "ask",
    /\brm\s+(-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r|--recursive\b[^;&|]*--force|--force\b[^;&|]*--recursive)/i,
    "recursive forced delete",
  ],
  ["ask", /\b(remove-item|rd|rmdir)\b[^;&|]*(-recurse|\/s)\b/i, "recursive delete"],
];
for (const [decision, pattern, why] of rules) {
  if (pattern.test(command)) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: decision,
          permissionDecisionReason: `guard-destructive: ${why}. ${decision === "deny" ? "Ask the user to run it themselves if it is really intended." : "Confirm with the user."}`,
        },
      }),
    );
    process.exit(0);
  }
}
process.exit(0);
