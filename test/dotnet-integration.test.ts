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

describe.skipIf(!hasDotnet)("dotnet-* tools against a real SDK", () => {
  let dir: string;
  const skills = join(defaultContentRoot(), "skills");
  const node = (skill: string, file: string, ...args: string[]) =>
    spawnSync(process.execPath, [join(skills, skill, "scripts", file), ...args], {
      cwd: dir,
      encoding: "utf8",
    });
  const gitc = (...a: string[]) =>
    execFileSync("git", ["-c", "user.email=t@t.t", "-c", "user.name=t", ...a], { cwd: dir });

  beforeAll(async () => {
    dir = await tempDir();
    execFileSync("git", ["init", "-q"], { cwd: dir });
    await write(dir, { ".gitignore": "bin/\nobj/\n" });
    dotnet(["new", "sln", "--format", "slnx", "-n", "Shop"], dir);
    for (const m of ["Orders", "Billing"])
      expect(node("dotnet-module", "new-module.mjs", m, "--apply").status).toBe(0);
    // One command with explicit projects: `sln add` otherwise adds referenced projects itself and reports them as duplicates (differs per SDK version).
    dotnet(
      [
        "sln",
        "add",
        "src/Modules/Orders/Orders/Orders.csproj",
        "src/Modules/Orders/Orders.Contracts/Orders.Contracts.csproj",
        "tests/Orders.Tests/Orders.Tests.csproj",
        "src/Modules/Billing/Billing/Billing.csproj",
        "src/Modules/Billing/Billing.Contracts/Billing.Contracts.csproj",
        "tests/Billing.Tests/Billing.Tests.csproj",
        "--include-references",
        "false",
      ],
      dir,
    );
    gitc("add", "-A");
    gitc("commit", "-qm", "base");
  }, 300_000);

  test("modules created by new-module build, pass their starter tests, and have clean boundaries", async () => {
    dotnet(["build", "Shop.slnx", "--nologo", "-v", "q"], dir);
    const out = dotnet(["test", "Shop.slnx", "--nologo"], dir).toString();
    expect(out.match(/Passed!/g)).toHaveLength(2);
    const check = node(
      "dotnet-module-boundary-check",
      "check-boundaries.mjs",
      ".",
      "--json",
      "--strict",
    );
    expect(check.status).toBe(0);
    expect(JSON.parse(check.stdout)).toMatchObject({
      modules: ["Billing", "Orders"],
      findings: [],
    });
    const ctx = JSON.parse(
      node("dotnet-module-context", "module-context.mjs", "Orders", "--json").stdout,
    );
    expect(ctx.contractTypes["Orders.Contracts"]).toEqual(["interface IOrdersApi"]);
  }, 300_000);

  test("affected --run builds and tests only the changed module", async () => {
    await write(dir, {
      "src/Modules/Orders/Orders/Extra.cs":
        "namespace Orders;\n\ninternal static class Extra\n{\n}\n",
    });
    const r = node("dotnet-verify", "affected.mjs", "--run", "--json");
    expect(r.status, r.stdout + r.stderr).toBe(0);
    const out = JSON.parse(r.stdout);
    expect(out.plan.modules).toEqual(["Orders"]);
    expect(out.plan.test).toEqual(["tests/Orders.Tests/Orders.Tests.csproj"]);
    expect(out.results.every((x: { ok: boolean }) => x.ok)).toBe(true);

    // Badly formatted code fails the format step (and only that step).
    await write(dir, {
      "src/Modules/Orders/Orders/Extra.cs":
        "namespace Orders;\ninternal static class Extra {   }\n",
    });
    const bad = JSON.parse(node("dotnet-verify", "affected.mjs", "--run", "--json").stdout);
    expect(
      bad.results.filter((x: { ok: boolean }) => !x.ok).map((x: { step: string }) => x.step),
    ).toEqual([expect.stringContaining("dotnet format")]);
    await write(dir, {
      "src/Modules/Orders/Orders/Extra.cs":
        "namespace Orders;\n\ninternal static class Extra\n{\n}\n",
    });
  }, 300_000);

  test("a boundary violation introduced by hand is caught, and a contract change is classified", async () => {
    const billing = "src/Modules/Billing/Billing/Billing.csproj";
    const text = await readFile(join(dir, billing), "utf8");
    await write(dir, {
      [billing]: text.replace(
        "</Project>",
        '  <ItemGroup>\n    <ProjectReference Include="..\\..\\Orders\\Orders\\Orders.csproj" />\n  </ItemGroup>\n</Project>',
      ),
    });
    const check = node(
      "dotnet-module-boundary-check",
      "check-boundaries.mjs",
      ".",
      "--json",
      "--strict",
    );
    expect(check.status).toBe(1);
    expect(JSON.parse(check.stdout).findings.map((f: { id: string }) => f.id)).toContain("BND001");

    await write(dir, {
      "src/Modules/Orders/Orders.Contracts/IOrdersApi.cs":
        "namespace Orders.Contracts;\n\npublic interface IOrdersApi\n{\n    Task<string> GetAsync(Guid id);\n}\n",
    });
    const diff = JSON.parse(
      node("dotnet-module-contract", "contract-diff.mjs", "Orders", "--json").stdout,
    );
    expect(diff.breaking).toEqual([]);
    expect(diff.additive.join()).toMatch(/GetAsync/);
  }, 300_000);
});
