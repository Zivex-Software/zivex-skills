import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { beforeAll, describe, expect, test } from "vitest";
import { defaultContentRoot } from "../src/content.js";
import { tempDir, write } from "./helpers.js";

// Real-SDK tests: the hooks and the audit script run against an actual .NET solution.
// Skipped when no dotnet SDK is installed (GitHub-hosted runners have one).
const hasDotnet =
  spawnSync("dotnet", ["--version"], { encoding: "utf8", shell: process.platform === "win32" })
    .status === 0;
const hook = (name: string) => join(defaultContentRoot(), "hooks", `${name}.mjs`);
const dotnet = (args: string[], cwd: string) =>
  execFileSync("dotnet", args, { cwd, stdio: "pipe", shell: process.platform === "win32" });
const runHook = (name: string, cwd: string, input: object) =>
  spawnSync(process.execPath, [hook(name)], {
    input: JSON.stringify({ cwd, ...input }),
    encoding: "utf8",
    cwd,
  });

describe.skipIf(!hasDotnet)("hooks against a real .NET solution", () => {
  let dir: string;
  const calc = join("src", "Orders", "Calc.cs");
  const tests = join("tests", "Orders.Tests", "CalcTests.cs");
  const source = (ret: string) =>
    `namespace Orders;\npublic static class Calc { public static int Add(int a, int b) => ${ret}; }\n`;
  const testSource = (expected: number) =>
    `using Orders;\nusing Xunit;\npublic class CalcTests { [Fact] public void Adds() => Assert.Equal(${expected}, Calc.Add(1, 2)); }\n`;

  beforeAll(async () => {
    dir = await tempDir();
    execFileSync("git", ["init", "-q"], { cwd: dir });
    await write(dir, { ".gitignore": "bin/\nobj/\n" });
    dotnet(["new", "classlib", "-n", "Orders", "-o", "src/Orders"], dir);
    dotnet(["new", "xunit", "-n", "Orders.Tests", "-o", "tests/Orders.Tests"], dir);
    dotnet(["add", join("tests", "Orders.Tests"), "reference", join("src", "Orders")], dir);
    await write(dir, { [calc]: source("a + b"), [tests]: testSource(3) });
    execFileSync("git", ["-c", "user.email=t@t.t", "-c", "user.name=t", "add", "-A"], { cwd: dir });
    execFileSync("git", ["-c", "user.email=t@t.t", "-c", "user.name=t", "commit", "-qm", "init"], {
      cwd: dir,
    });
  }, 300_000);

  test("format-on-edit formats an edited .cs file (dotnet format needs a relative --include)", async () => {
    await write(dir, {
      [calc]:
        "namespace Orders;\npublic static class Calc {   public static int Add(int a,int b)   =>   a+b; }\n",
    });
    const r = runHook("format-on-edit", dir, { tool_input: { file_path: join(dir, calc) } });
    expect(r.status).toBe(0);
    expect(await readFile(join(dir, calc), "utf8")).toContain(
      "public static int Add(int a, int b) => a + b;",
    );
  }, 300_000);

  test("verify-before-stop: passes when build and tests pass", async () => {
    await write(dir, { [calc]: source("a + b"), [tests]: testSource(3) });
    expect(runHook("verify-before-stop", dir, {}).status).toBe(0);
  }, 300_000);

  test("verify-before-stop: exit 2 with the failing test output", async () => {
    await write(dir, { [tests]: testSource(9) });
    const r = runHook("verify-before-stop", dir, {});
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/dotnet test failed/);
    expect(r.stderr).toMatch(/Failed/);
    await write(dir, { [tests]: testSource(3) });
  }, 300_000);

  test("verify-before-stop: exit 2 on a compile error, and not on the second stop attempt", async () => {
    await write(dir, {
      [join("src", "Orders", "Broken.cs")]: 'public class Broken { int x = "no"; }\n',
    });
    const r = runHook("verify-before-stop", dir, {});
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/dotnet build failed/);
    expect(runHook("verify-before-stop", dir, { stop_hook_active: true }).status).toBe(0);
  }, 300_000);
});
