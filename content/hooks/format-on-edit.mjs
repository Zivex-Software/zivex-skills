// Runs `dotnet format` on a .cs file the agent just edited. Never blocks: always exits 0.
// No-ops outside .NET repositories so it is safe as a global hook.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, parse } from "node:path";

const isProject = (n) => /\.(sln|slnx|csproj)$/i.test(n);
function findUp(start, test) {
  for (let d = start; ; d = dirname(d)) {
    const hit = readdirSync(d).find(test);
    if (hit) return join(d, hit);
    if (d === parse(d).root) return undefined;
  }
}

try {
  const input = JSON.parse(readFileSync(0, "utf8"));
  const file = input?.tool_input?.file_path;
  if (typeof file !== "string" || !file.endsWith(".cs") || !existsSync(file)) process.exit(0);
  const workspace = findUp(dirname(file), isProject);
  if (!workspace) process.exit(0);
  execFileSync("dotnet", ["format", workspace, "--include", file, "--no-restore"], {
    stdio: "ignore",
    timeout: 100_000,
  });
} catch {
  // Formatting is best effort: a missing SDK or a format error must not interrupt the agent.
}
process.exit(0);
