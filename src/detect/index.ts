import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type { AgentId } from "../schema.js";

const SKIP = new Set(["node_modules", "bin", "obj", ".git", ".vs", "dist"]);
const exists = (p: string) =>
  stat(p).then(
    () => true,
    () => false,
  );

/** Nearest ancestor containing .git, or undefined. */
export async function findGitRoot(from: string): Promise<string | undefined> {
  for (let d = from; ; d = join(d, "..")) {
    if (await exists(join(d, ".git"))) return d;
    if (join(d, "..") === d) return undefined;
  }
}

/** .NET = a .sln/.slnx/.csproj within 3 levels. node = a package.json at the root. */
export async function detectStack(root: string): Promise<{ dotnet: boolean; node: boolean }> {
  const walk = async (dir: string, depth: number): Promise<boolean> => {
    for (const e of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
      if (e.isFile() && /\.(sln|slnx|csproj)$/i.test(e.name)) return true;
      if (
        e.isDirectory() &&
        depth < 3 &&
        !SKIP.has(e.name) &&
        (await walk(join(dir, e.name), depth + 1))
      )
        return true;
    }
    return false;
  };
  return { dotnet: await walk(root, 0), node: await exists(join(root, "package.json")) };
}

export async function detectAgents(projectRoot: string, home: string): Promise<AgentId[]> {
  const found: AgentId[] = [];
  const any = async (...p: string[]) => (await Promise.all(p.map(exists))).some(Boolean);
  if (
    await any(join(home, ".claude"), join(projectRoot, ".claude"), join(projectRoot, "CLAUDE.md"))
  )
    found.push("claude-code");
  if (await any(join(home, ".cursor"), join(projectRoot, ".cursor"))) found.push("cursor");
  if (await any(join(home, ".codex"), join(projectRoot, ".codex"))) found.push("codex");
  return found;
}
