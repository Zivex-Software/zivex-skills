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
  expect([...c.skills.keys()].sort()).toHaveLength(21);
  expect(c.rules.size).toBe(6);
  expect(c.hooks.size).toBe(3);
  expect([...c.packs.keys()].sort()).toEqual([
    "aspnet-api",
    "aspnet-data",
    "aspnet-performance",
    "aspnet-security",
    "dotnet-core",
    "dotnet-modules",
    "foundation",
    "workflow-features",
    "workflow-greenfield",
    "workflow-review-qa",
    "zivex-conventions",
  ]);
});

import { execFileSync } from "node:child_process";
import { findCursorDuplicates } from "../src/commands/doctor.js";

test("verify-before-stop plans builds for changed projects and tests by name or by project reference", async () => {
  const dir = await tempDir();
  const csproj = (refs: string[] = []) =>
    `<Project Sdk="Microsoft.NET.Sdk">${refs.map((r) => `<ItemGroup><ProjectReference Include="${r}" /></ItemGroup>`).join("")}</Project>`;
  await write(dir, {
    "src/Orders/Orders.csproj": csproj(),
    "src/Orders/Handler.cs": "class H {}",
    "src/Billing/Billing.csproj": csproj(),
    "tests/Orders.Tests/Orders.Tests.csproj": csproj(["..\\..\\src\\Orders\\Orders.csproj"]),
    "tests/Integration.Tests/Integration.Tests.csproj": csproj(["../../src/Orders/Orders.csproj"]),
    "tests/Billing.Tests/Billing.Tests.csproj": csproj(["../../src/Billing/Billing.csproj"]),
    "tests/Other.Tests/Other.Tests.csproj": csproj(),
  });
  execFileSync("git", ["init", "-q"], { cwd: dir });
  const r = spawnSync(
    process.execPath,
    [join(defaultContentRoot(), "hooks", "verify-before-stop.mjs")],
    {
      input: JSON.stringify({ cwd: dir }),
      encoding: "utf8",
      env: { ...process.env, ZIVEX_VERIFY_PLAN: "1" },
    },
  );
  expect(r.status).toBe(0);
  expect(JSON.parse(r.stdout)).toEqual({
    build: ["src/Orders/Orders.csproj"],
    test: [
      "tests/Integration.Tests/Integration.Tests.csproj",
      "tests/Orders.Tests/Orders.Tests.csproj",
    ],
  });
});

test("doctor flags skills installed for both Claude Code and Cursor in the same scope only", () => {
  const item = (agent: "claude-code" | "cursor", scope: "project" | "global", name = "s") =>
    ({ kind: "skill", name, agent, scope, version: "1", files: {} }) as const;
  expect(findCursorDuplicates([item("claude-code", "project"), item("cursor", "project")])).toEqual(
    [{ name: "s", scope: "project" }],
  );
  expect(findCursorDuplicates([item("claude-code", "project"), item("cursor", "global")])).toEqual(
    [],
  );
  expect(findCursorDuplicates([item("cursor", "project")])).toEqual([]);
});
