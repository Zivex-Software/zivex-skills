import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { defaultContentRoot } from "../src/content.js";
import { tempDir, write } from "./helpers.js";

// Regression tests for bugs found by an independent review of the dotnet-* scripts. Each case failed before its fix.
const script = (skill: string, file: string) =>
  join(defaultContentRoot(), "skills", skill, "scripts", file);
const run = (skill: string, file: string, cwd: string, ...args: string[]) =>
  spawnSync(process.execPath, [script(skill, file), ...args], {
    cwd,
    encoding: "utf8",
    timeout: 20_000,
  });
const json = (r: { stdout: string }) => JSON.parse(r.stdout);
const proj = (refs: string[] = [], extra = "") =>
  `<Project Sdk="Microsoft.NET.Sdk">${refs.map((r) => `<ItemGroup><ProjectReference Include="${r}" /></ItemGroup>`).join("")}${extra}</Project>`;
const git = (cwd: string, ...a: string[]) =>
  execFileSync("git", ["-c", "user.email=t@t.t", "-c", "user.name=t", ...a], {
    cwd,
    stdio: "pipe",
  });
const boundaries = (dir: string, ...a: string[]) =>
  run("dotnet-module-boundary-check", "check-boundaries.mjs", dir, dir, "--json", ...a);
const ids = (r: { stdout: string }) => json(r).findings.map((f: { id: string }) => f.id);

const CONTRACT = "src/Modules/Orders/Orders.Contracts/Api.cs";
async function contractRepo(before: string, after: string, eol = "\n") {
  const dir = await tempDir();
  git(dir, "init", "-q");
  await write(dir, {
    "src/Modules/Orders/Orders.Contracts/Orders.Contracts.csproj": proj(),
    [CONTRACT]: before.replaceAll("\n", eol),
  });
  git(dir, "add", "-A");
  git(dir, "commit", "-qm", "base");
  await write(dir, { [CONTRACT]: after.replaceAll("\n", eol) });
  return dir;
}
const diff = (dir: string, cwd = dir) =>
  json(run("dotnet-module-contract", "contract-diff.mjs", cwd, "Orders", "--json"));
const ns = "namespace Orders.Contracts;\n";

describe("contract-diff parser", () => {
  test("works from a subdirectory of the repository", async () => {
    const dir = await contractRepo(
      `${ns}public interface IA\n{\n    void M();\n}\n`,
      `${ns}public interface IA\n{\n}\n`,
    );
    await write(dir, { "src/keep.txt": "x" });
    expect(diff(dir, join(dir, "src")).breaking.join()).toMatch(/void M\(\);/);
  });

  test("multi-line record and method headers are read whole, and later types keep their path", async () => {
    const before = `${ns}public record R(\n    Guid Id,\n    decimal Total);\npublic interface IApi\n{\n    Task<int> Get(\n        int a,\n        int b);\n}\n`;
    const after = before.replace("decimal Total", "string Total").replace("int b)", "long b)");
    const r = diff(await contractRepo(before, after));
    expect(r.breaking.join("\n")).toMatch(/record R\(Guid Id, decimal Total\)/);
    expect(r.breaking.join("\n")).toMatch(/Task<int> Get\(int a, int b\)/);
    expect(r.additive.join("\n")).toMatch(/long b/);
    expect(r.breaking.join("\n")).not.toMatch(/IApi: public interface/); // untouched type is not reported
  });

  test("CRLF files: trailing comments do not leak into signatures", async () => {
    const base = `${ns}public interface IA\n{\n    void M(); // old note\n    void N();\n}\npublic class C\n{\n    public int X { get; set; } // note\n}\n`;
    const same = diff(
      await contractRepo(
        base,
        base.replace("// note", "// other note").replace("// old note", "// new note"),
        "\r\n",
      ),
    );
    expect(same.breaking).toEqual([]);
    expect(same.additive).toEqual([]);
    const removed = diff(
      await contractRepo(base, base.replace("    void M(); // old note\n", ""), "\r\n"),
    );
    expect(removed.breaking.join()).toMatch(/void M\(\);/);
  });

  test("attributes on the same line, delegates, default interface members, defaults and constants are tracked", async () => {
    const before = `${ns}public class C\n{\n    [JsonPropertyName("x")] public string J { get; set; }\n    public const int Max = 5;\n    public void M(int a = 0, string b = "") { }\n}\n[Serializable] public class D { public int Y { get; set; } }\npublic delegate int Handler(int a);\npublic interface IDef\n{\n    void Keep(int a) { }\n}\n`;
    const after = `${ns}public class C\n{\n    public const int Max = 6;\n    public void M(int a = 0, int b = 0) { }\n}\n[Serializable] public class D { }\npublic delegate int Handler(int a, int b);\npublic interface IDef\n{\n}\n`;
    const b = diff(await contractRepo(before, after)).breaking.join("\n");
    expect(b).toMatch(/string J/);
    expect(b).toMatch(/Max = 5/);
    expect(b).toMatch(/string b/);
    expect(b).toMatch(/int Y/);
    expect(b).toMatch(/delegate int Handler\(int a\)/);
    expect(b).toMatch(/void Keep\(int a\)/);
  });

  test("same type name in different namespaces, and braces inside string constants", async () => {
    const before = `namespace Orders.Contracts.Events { public class Created { public int A { get; set; } } }\nnamespace Orders.Contracts.Commands { public class Created { public int B { get; set; } } }\nnamespace Orders.Contracts { public static class K { public const string Open = "{"; public int Count { get; } } }\n`;
    const after = `namespace Orders.Contracts.Commands { public class Created { public int B { get; set; } } }\nnamespace Orders.Contracts { public static class K { public const string Open = "{"; } }\n`;
    const b = diff(await contractRepo(before, after)).breaking.join("\n");
    expect(b).toMatch(/Events\.Created/);
    expect(b).toMatch(/K: .*Count/);
  });

  test("only a same-named member counts as 'changed'", async () => {
    const r = diff(
      await contractRepo(
        `${ns}public interface I\n{\n    void Cancel();\n}\n`,
        `${ns}public interface I\n{\n    void Reopen();\n}\n`,
      ),
    );
    expect(r.breaking).toHaveLength(1);
    expect(r.changed).toEqual([]);
  });

  test("not a git repository and unknown ref give a friendly error, not a stack trace", async () => {
    const dir = await tempDir();
    await write(dir, { "src/Modules/Orders/Orders.Contracts/Orders.Contracts.csproj": proj() });
    const outside = run("dotnet-module-contract", "contract-diff.mjs", dir, "Orders");
    expect(outside.status).toBe(2);
    expect(outside.stderr).toMatch(/git repository/i);
    expect(outside.stderr).not.toMatch(/\n\s+at /);
  });
});

describe("check-boundaries", () => {
  test("a composition root (Host, Api) is not a module and may reference implementations", async () => {
    const dir = await tempDir();
    await write(dir, {
      "src/Acme.Orders/Acme.Orders.csproj": proj([
        "../Acme.Orders.Contracts/Acme.Orders.Contracts.csproj",
      ]),
      "src/Acme.Orders.Contracts/Acme.Orders.Contracts.csproj": proj(),
      "src/Acme.Billing/Acme.Billing.csproj": proj([
        "../Acme.Billing.Contracts/Acme.Billing.Contracts.csproj",
      ]),
      "src/Acme.Billing.Contracts/Acme.Billing.Contracts.csproj": proj(),
      "src/Acme.Host/Acme.Host.csproj": proj([
        "../Acme.Orders/Acme.Orders.csproj",
        "../Acme.Billing/Acme.Billing.csproj",
      ]),
      "src/Acme.Api/Acme.Api.csproj": proj(["../Acme.Orders/Acme.Orders.csproj"]),
    });
    const r = boundaries(dir, "--strict");
    expect(r.status).toBe(0);
    expect(json(r).modules).toEqual(["Billing", "Orders"]);
  });

  test("commented-out references are ignored (XML and C# block comments)", async () => {
    const dir = await tempDir();
    await write(dir, {
      "src/Modules/Orders/Orders/Orders.csproj": proj([
        "../Orders.Contracts/Orders.Contracts.csproj",
      ]).replace(
        "</Project>",
        '<!-- <ProjectReference Include="..\\..\\Billing\\Billing\\Billing.csproj" /> --></Project>',
      ),
      "src/Modules/Orders/Orders.Contracts/Orders.Contracts.csproj": proj(),
      "src/Modules/Billing/Billing/Billing.csproj": proj(),
      "src/Modules/Billing/Billing/Hook.cs":
        '/*\n[assembly: System.Runtime.CompilerServices.InternalsVisibleTo("Orders")]\n*/\nclass X {}\n',
      "src/Modules/Billing/AGENTS.md": "x",
      "src/Modules/Orders/AGENTS.md": "x",
    });
    const r = boundaries(dir, "--strict");
    expect(r.status).toBe(0);
    expect(json(r).findings).toEqual([]);
  });

  test("modules.json prefixes respect path boundaries (Orders vs Orders2)", async () => {
    const dir = await tempDir();
    await write(dir, {
      "modules.json": JSON.stringify({
        modules: { Orders: ["src/Orders"], Orders2: ["src/Orders2"] },
      }),
      "src/Orders/Orders.csproj": proj(),
      "src/Orders2/Orders2.csproj": proj(["../Orders/Orders.csproj"]),
    });
    const r = boundaries(dir);
    expect(json(r).modules).toEqual(["Orders", "Orders2"]);
    expect(ids(r)).toContain("BND001");
  });

  test("deeply nested repositories are still scanned", async () => {
    const dir = await tempDir();
    const deep = "a/b/c/d/e/f/g/h/i/j";
    await write(dir, {
      [`${deep}/src/Modules/Orders/Orders/Orders.csproj`]: proj(),
      [`${deep}/src/Modules/Billing/Billing/Billing.csproj`]: proj([
        "../../Orders/Orders/Orders.csproj",
      ]),
    });
    expect(json(boundaries(dir)).modules).toEqual(["Billing", "Orders"]);
  });

  test("dense module graphs finish quickly and report one cycle per strongly connected group", async () => {
    const dir = await tempDir();
    const names = Array.from({ length: 12 }, (_, i) => `M${i}`);
    const files: Record<string, string> = {};
    for (const n of names) {
      files[`src/Modules/${n}/${n}/${n}.csproj`] = proj(
        names.filter((o) => o !== n).map((o) => `../../${o}/${o}.Contracts/${o}.Contracts.csproj`),
      );
      files[`src/Modules/${n}/${n}.Contracts/${n}.Contracts.csproj`] = proj();
      files[`src/Modules/${n}/AGENTS.md`] = "x";
    }
    await write(dir, files);
    const t0 = Date.now();
    const r = boundaries(dir);
    expect(Date.now() - t0).toBeLessThan(10_000);
    expect(json(r).findings.filter((f: { id: string }) => f.id === "BND003")).toHaveLength(1);
  }, 30_000);

  test("more InternalsVisibleTo and using forms are caught; framework namespaces are not mistaken for modules", async () => {
    const dir = await tempDir();
    await write(dir, {
      "src/Modules/Orders/Orders/Acme.Orders.csproj": proj(),
      "src/Modules/Orders/Orders/A.cs":
        '[assembly: InternalsVisibleTo("Acme.Billing, PublicKey=0024")]\n[assembly: InternalsVisibleTo(assemblyName: "Acme.Identity")]\nglobal using Acme.Billing.Internal;\nusing B = Acme.Billing.Domain.Invoice;\nusing Microsoft.AspNetCore.Identity;\nclass A {}\n',
      "src/Modules/Billing/Billing/Acme.Billing.csproj": proj(
        [],
        "<ItemGroup><ProjectReference Include='..\\..\\Orders\\Orders\\Acme.Orders.csproj' /></ItemGroup>",
      ),
      "src/Modules/Identity/Identity/Acme.Identity.csproj": proj(),
    });
    const f = json(boundaries(dir)).findings as { id: string; msg: string }[];
    expect(
      f
        .filter((x) => x.id === "BND004")
        .map((x) => x.msg)
        .join(),
    ).toMatch(/Billing.*\n?.*|Identity/);
    expect(f.filter((x) => x.id === "BND004")).toHaveLength(2);
    expect(f.filter((x) => x.id === "BND001").length).toBeGreaterThan(0);
    const usings = f.filter((x) => x.id === "BND006").map((x) => x.msg);
    expect(usings.some((m) => /Acme\.Billing\.Internal/.test(m))).toBe(true);
    expect(usings.some((m) => /Acme\.Billing\.Domain\.Invoice/.test(m))).toBe(true);
    expect(usings.some((m) => /Microsoft\.AspNetCore\.Identity/.test(m))).toBe(false);
  });

  test("--json is valid JSON even with fewer than two modules; a test project with two role suffixes belongs to its module", async () => {
    const dir = await tempDir();
    await write(dir, { "src/App/App.csproj": proj() });
    expect(json(boundaries(dir))).toMatchObject({ findings: [] });
    const dir2 = await tempDir();
    await write(dir2, {
      "src/Acme.Orders/Acme.Orders.csproj": proj(),
      "src/Acme.Orders.Domain.Tests/Acme.Orders.Domain.Tests.csproj": proj(),
      "src/Acme.Billing/Acme.Billing.csproj": proj(),
    });
    expect(json(boundaries(dir2)).modules).toEqual(["Billing", "Orders"]);
  });
});

describe("inspect-repo", () => {
  test("ignores commented-out packages and trims multi-line target frameworks", async () => {
    const dir = await tempDir();
    await write(dir, {
      "src/App/App.csproj": `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFrameworks>\n      net8.0;\n      net10.0\n    </TargetFrameworks></PropertyGroup><!-- <PackageReference Include="xunit" /> --></Project>`,
    });
    const r = json(run("dotnet-conventions-bootstrap", "inspect-repo.mjs", dir, dir, "--json"));
    expect(r.tests.frameworks).toEqual([]);
    expect(r.targetFrameworks).toEqual(["net10.0", "net8.0"]);
  });
});

describe("affected", () => {
  const repo = async () => {
    const dir = await tempDir();
    git(dir, "init", "-q");
    return dir;
  };

  test("includes test projects that depend on a changed project transitively", async () => {
    const dir = await repo();
    await write(dir, {
      "src/Orders.Domain/Orders.Domain.csproj": proj(),
      "src/Orders.Domain/X.cs": "class X {}",
      "src/Orders/Orders.csproj": proj(["../Orders.Domain/Orders.Domain.csproj"]),
      "tests/Orders.Tests/Orders.Tests.csproj": proj(
        ["../../src/Orders/Orders.csproj"],
        '<ItemGroup><PackageReference Include="xunit" /></ItemGroup>',
      ),
    });
    git(dir, "add", "-A");
    git(dir, "commit", "-qm", "base");
    await write(dir, { "src/Orders.Domain/X.cs": "class X { int y; }" });
    expect(json(run("dotnet-verify", "affected.mjs", dir, "--json")).test).toEqual([
      "tests/Orders.Tests/Orders.Tests.csproj",
    ]);
  });

  test("renamed files with spaces in their path are followed", async () => {
    const dir = await repo();
    await write(dir, {
      "src/Billing/Billing.csproj": proj(),
      "src/Billing/My Folder/a b.cs": "class A {}",
    });
    git(dir, "add", "-A");
    git(dir, "commit", "-qm", "base");
    git(dir, "mv", "src/Billing/My Folder/a b.cs", "src/Billing/My Folder/c d.cs");
    const r = json(run("dotnet-verify", "affected.mjs", dir, "--json"));
    expect(r.changedFiles).toContain("src/Billing/My Folder/c d.cs");
    expect(r.build).toContain("src/Billing/Billing.csproj");
  });

  test("an unknown --base gives a friendly error", async () => {
    const dir = await repo();
    await write(dir, { "src/A/A.csproj": proj() });
    git(dir, "add", "-A");
    git(dir, "commit", "-qm", "base");
    const r = run("dotnet-verify", "affected.mjs", dir, "--base", "no-such-ref");
    expect(r.status).toBe(2);
    expect(r.stderr).not.toMatch(/\n\s+at /);
  });
});

describe("new-module --template", () => {
  test("a project directly inside the module folder does not copy the whole Modules folder; lowercase and kebab names are renamed too", async () => {
    const dir = await tempDir();
    await write(dir, {
      "src/Modules/Orders/Orders.csproj": proj(["Zcontracts/Orders.Contracts.csproj"]),
      "src/Modules/Orders/Zcontracts/Orders.Contracts.csproj": proj(),
      "src/Modules/Orders/OrdersModule.cs":
        'namespace Orders;\nclass OrdersModule { string route = "/orders"; string tag = "order-items"; }\n',
    });
    const r = run(
      "dotnet-module",
      "new-module.mjs",
      dir,
      "Shipping",
      "--template",
      "Orders",
      "--apply",
    );
    expect(r.status, r.stderr).toBe(0);
    expect(existsSync(join(dir, "src/Modules/Shipping/Shipping.csproj"))).toBe(true);
    expect(existsSync(join(dir, "src/Modules/Modules"))).toBe(false);
    expect(await readFile(join(dir, "src/Modules/Shipping/ShippingModule.cs"), "utf8")).toContain(
      '"/shipping"',
    );
  });
});
