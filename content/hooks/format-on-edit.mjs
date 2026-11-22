// Runs `dotnet format` on a .cs file the agent just edited. Never blocks: always exits 0.
// No-ops outside .NET repositories so it is safe as a global hook.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, parse, relative } from "node:path";

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
  // `dotnet format` silently ignores an absolute --include: run it from the workspace folder with a relative path.
  const dir = dirname(workspace);
  execFileSync(
    "dotnet",
    ["format", basename(workspace), "--include", relative(dir, file), "--no-restore"],
    {
      cwd: dir,
      stdio: "ignore",
      timeout: 100_000,
    },
  );
} catch {
  // Formatting is best effort: a missing SDK or a format error must not interrupt the agent.
}
process.exit(0);
