import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { expect, test } from "vitest";
import { defaultContentRoot, loadContent } from "../src/content.js";
import { resolvePacks } from "../src/resolve/index.js";
import { tempDir, write } from "./helpers.js";

const hook = (name: string, input: object) =>
  spawnSync(process.execPath, [join(defaultContentRoot(), "hooks", `${name}.mjs`)], {
    input: JSON.stringify(input),
    encoding: "utf8",
  });

async function repo(dotnet: boolean) {
  const dir = await tempDir();
  if (dotnet) await write(dir, { "App.csproj": "<Project />" });
  return dir;
}
const bash = (cwd: string, command: string) =>
  hook("guard-destructive", { cwd, tool_input: { command } });
const decision = (r: { stdout: string }) =>
  r.stdout ? JSON.parse(r.stdout).hookSpecificOutput.permissionDecision : "allow";

test("guard-destructive denies, asks, or allows in a .NET repo", async () => {
  const d = await repo(true);
  expect(decision(bash(d, "dotnet ef database drop --force"))).toBe("deny");
  expect(decision(bash(d, "git push --force origin main"))).toBe("ask");
  expect(decision(bash(d, "git push -f"))).toBe("ask");
  expect(decision(bash(d, "rm -rf bin"))).toBe("ask");
  expect(decision(bash(d, "git push origin main"))).toBe("allow");
  expect(decision(bash(d, "dotnet test"))).toBe("allow");
});

test("guard-destructive is silent outside .NET repos", async () => {
  const d = await repo(false);
  expect(decision(bash(d, "rm -rf /tmp/x; dotnet ef database drop"))).toBe("allow");
});

test("verify-before-stop and format-on-edit no-op outside .NET / without changes", async () => {
  const d = await repo(false);
  expect(hook("verify-before-stop", { cwd: d }).status).toBe(0);
  expect(hook("verify-before-stop", { cwd: d, stop_hook_active: true }).status).toBe(0);
  expect(
    hook("format-on-edit", { cwd: d, tool_input: { file_path: join(d, "a.cs") } }).status,
  ).toBe(0);
  expect(hook("format-on-edit", { tool_input: {} }).status).toBe(0);
});

test("every pack resolves and the shipped packs cover the Phase 1 content", async () => {
  const c = await loadContent();
  for (const id of c.packs.keys()) resolvePacks(c, [id]);
  expect([...c.skills.keys()].sort()).toHaveLength(8);
  expect(c.rules.size).toBe(6);
  expect(c.hooks.size).toBe(3);
  expect([...c.packs.keys()].sort()).toEqual([
    "dotnet-core",
    "dotnet-modules",
    "foundation",
    "workflow-features",
    "workflow-greenfield",
    "workflow-review-qa",
  ]);
});
