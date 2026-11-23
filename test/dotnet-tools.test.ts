import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { defaultContentRoot } from "../src/content.js";
import { tempDir, write } from "./helpers.js";

const script = (skill: string, file: string) =>
  join(defaultContentRoot(), "skills", skill, "scripts", file);
const run = (skill: string, file: string, cwd: string, ...args: string[]) =>
  spawnSync(process.execPath, [script(skill, file), ...args], { cwd, encoding: "utf8" });
const json = (r: { stdout: string }) => JSON.parse(r.stdout);
const proj = (refs: string[] = [], extra = "") =>
  `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net10.0</TargetFramework></PropertyGroup>${refs.map((r) => `<ItemGroup><ProjectReference Include="${r}" /></ItemGroup>`).join("")}${extra}</Project>`;

// Two modules with deliberate mistakes: Billing reaches into Orders' implementation, both depend on each other (cycle),
// Billing grants Orders InternalsVisibleTo, Contracts pull in EF, and Billing has no AGENTS.md.
const MODULAR = {
  "src/Modules/Orders/AGENTS.md": "# Orders\nOwns orders.\n",
  "src/Modules/Orders/Orders/Orders.csproj": proj([
    "../Orders.Contracts/Orders.Contracts.csproj",
    "../../Billing/Billing.Contracts/Billing.Contracts.csproj",
  ]),
  "src/Modules/Orders/Orders/Service.cs":
    "namespace Orders;\nusing Billing.Contracts;\nclass Service {}\n",
  "src/Modules/Orders/Orders.Contracts/Orders.Contracts.csproj": proj(
    [],
    `<ItemGroup><PackageReference Include="Microsoft.EntityFrameworkCore" Version="10.0.0" /></ItemGroup>`,
  ),
  "src/Modules/Orders/Orders.Contracts/IOrdersApi.cs":
    "namespace Orders.Contracts;\npublic interface IOrdersApi { Task<OrderDto?> GetAsync(Guid id); }\npublic record OrderDto(Guid Id, string Number);\n",
  "src/Modules/Billing/Billing/Billing.csproj": proj([
    "../Billing.Contracts/Billing.Contracts.csproj",
    "../../Orders/Orders.Contracts/Orders.Contracts.csproj",
    "../../Orders/Orders/Orders.csproj",
  ]),
  "src/Modules/Billing/Billing/Invoice.cs":
    'using Orders.Domain;\nusing Orders.Contracts;\n[assembly: System.Runtime.CompilerServices.InternalsVisibleTo("Orders")]\nclass Invoice {}\n',
  "src/Modules/Billing/Billing.Contracts/Billing.Contracts.csproj": proj(),
  "tests/Orders.Tests/Orders.Tests.csproj": proj(
    [
      "../../src/Modules/Orders/Orders/Orders.csproj",
      "../../src/Modules/Billing/Billing/Billing.csproj",
    ],
    `<ItemGroup><PackageReference Include="xunit" Version="2.9.0" /></ItemGroup>`,
  ),
};

describe("check-boundaries", () => {
  test("finds cross-module reference, cycle, InternalsVisibleTo, using, contract hygiene and missing AGENTS.md", async () => {
    const dir = await tempDir();
    await write(dir, MODULAR);
    const r = run("dotnet-module-boundary-check", "check-boundaries.mjs", dir, dir, "--json");
    const f = json(r).findings as { id: string; level: string; msg: string }[];
    const ids = new Set(f.map((x) => x.id));
    for (const id of ["BND001", "BND002", "BND003", "BND004", "BND005", "BND006", "BND008"])
      expect(ids.has(id), id).toBe(true);
    expect(f.find((x) => x.id === "BND001")!.msg).toMatch(
      /Billing.*references Orders.*implementation of module Orders/,
    );
    expect(
      f
        .filter((x) => x.id === "BND008")
        .map((x) => x.msg)
        .join(),
    ).toMatch(/Billing/);
    expect(f.some((x) => x.id === "BND008" && /Orders has/.test(x.msg))).toBe(false);
    expect(
      run("dotnet-module-boundary-check", "check-boundaries.mjs", dir, dir, "--strict").status,
    ).toBe(1);
  });

  test("a clean modular repo reports nothing; referencing contracts is fine", async () => {
    const dir = await tempDir();
    await write(dir, {
      "src/Modules/Orders/AGENTS.md": "x",
      "src/Modules/Billing/AGENTS.md": "x",
      "src/Modules/Orders/Orders/Orders.csproj": proj([
        "../Orders.Contracts/Orders.Contracts.csproj",
      ]),
      "src/Modules/Orders/Orders.Contracts/Orders.Contracts.csproj": proj(),
      "src/Modules/Billing/Billing/Billing.csproj": proj([
        "../Billing.Contracts/Billing.Contracts.csproj",
        "../../Orders/Orders.Contracts/Orders.Contracts.csproj",
      ]),
      "src/Modules/Billing/Billing.Contracts/Billing.Contracts.csproj": proj(),
      "src/Modules/Billing/Billing/Pay.cs": "using Orders.Contracts;\nclass Pay {}\n",
    });
    const r = run(
      "dotnet-module-boundary-check",
      "check-boundaries.mjs",
      dir,
      dir,
      "--json",
      "--strict",
    );
    expect(r.status).toBe(0);
    expect(json(r).findings).toEqual([]);
  });

  test("conventions without a Modules folder: company prefix and role suffix are stripped; modules.json overrides", async () => {
    const dir = await tempDir();
    await write(dir, {
      "src/Acme.Orders/Acme.Orders.csproj": proj(["../Acme.Billing/Acme.Billing.csproj"]),
      "src/Acme.Orders.Contracts/Acme.Orders.Contracts.csproj": proj(),
      "src/Acme.Billing/Acme.Billing.csproj": proj(),
      "src/Acme.Billing.Contracts/Acme.Billing.Contracts.csproj": proj(),
    });
    const r = run("dotnet-module-boundary-check", "check-boundaries.mjs", dir, dir, "--json");
    expect(json(r).modules).toEqual(["Billing", "Orders"]);
    expect(json(r).findings.map((x: { id: string }) => x.id)).toContain("BND001");
    // Declaring everything as one module via modules.json removes the cross-module finding.
    await write(dir, { "modules.json": JSON.stringify({ modules: { Core: ["src/"] } }) });
    expect(run("dotnet-module-boundary-check", "check-boundaries.mjs", dir, dir).stdout).toMatch(
      /1 module/,
    );
  });

  test("a single-module repo is not an error", async () => {
    const dir = await tempDir();
    await write(dir, { "src/App/App.csproj": proj() });
    const r = run("dotnet-module-boundary-check", "check-boundaries.mjs", dir, dir);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/nothing to check/);
  });
});

describe("module-context", () => {
  test("describes a module by name or by file path", async () => {
    const dir = await tempDir();
    await write(dir, MODULAR);
    for (const target of ["orders", join(dir, "src/Modules/Orders/Orders/Service.cs")]) {
      const r = json(
        run("dotnet-module-context", "module-context.mjs", dir, target, "--root", dir, "--json"),
      );
      expect(r.module).toBe("Orders");
      expect(r.agentsFile).toBe("src/Modules/Orders/AGENTS.md");
      expect(r.contractTypes["Orders.Contracts"]).toEqual([
        "interface IOrdersApi",
        "record OrderDto",
      ]);
      expect(r.consumesContracts).toEqual(["Billing.Contracts"]);
      expect(r.consumedBy).toEqual(["Billing"]);
      expect(r.testCommands).toEqual(["dotnet test tests/Orders.Tests/Orders.Tests.csproj"]);
    }
  });

  test("unknown targets list the modules instead of guessing", async () => {
    const dir = await tempDir();
    await write(dir, MODULAR);
    const r = run("dotnet-module-context", "module-context.mjs", dir, "--root", dir);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/Modules found: Billing, Orders/);
  });
});

describe("inspect-repo", () => {
  test("maps stack, settings, tests, CI and agent docs from evidence", async () => {
    const dir = await tempDir();
    await write(dir, {
      "global.json": JSON.stringify({ sdk: { version: "10.0.100" } }),
      "Directory.Build.props":
        "<Project><PropertyGroup><Nullable>enable</Nullable><TreatWarningsAsErrors>true</TreatWarningsAsErrors></PropertyGroup></Project>",
      "Directory.Packages.props":
        "<Project><PropertyGroup><ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally></PropertyGroup></Project>",
      ".editorconfig": "root = true\n",
      "Sample.slnx": "<Solution />",
      "src/Api/Api.csproj": proj(
        [],
        `<ItemGroup><PackageReference Include="Microsoft.EntityFrameworkCore.SqlServer" /><PackageReference Include="MassTransit" /></ItemGroup>`,
      ),
      "src/Api/Features/Orders/Create.cs": 'app.MapPost("/x", () => 1);\n',
      "tests/Api.Tests/Api.Tests.csproj": proj(
        [],
        `<ItemGroup><PackageReference Include="xunit" /><PackageReference Include="Testcontainers.MsSql" /><PackageReference Include="Microsoft.NET.Test.Sdk" /></ItemGroup>`,
      ),
      ".github/workflows/ci.yml": "name: ci\n",
      "AGENTS.md": "# repo\n",
    });
    const r = json(run("dotnet-conventions-bootstrap", "inspect-repo.mjs", dir, dir, "--json"));
    expect(r).toMatchObject({
      solutions: ["Sample.slnx"],
      targetFrameworks: ["net10.0"],
      sdkPinned: "10.0.100",
      centralPackageManagement: true,
      editorconfig: true,
      agentDocs: ["AGENTS.md"],
      ci: [".github/workflows/ci.yml"],
    });
    expect(r.settings).toMatchObject({ nullable: "enable", treatWarningsAsErrors: "true" });
    expect(r.tests.frameworks).toEqual(["xunit"]);
    expect(r.tests.libraries).toEqual(["Testcontainers.MsSql"]);
    expect(r.stack.data).toEqual(["Microsoft.EntityFrameworkCore.SqlServer"]);
    expect(r.stack.messaging).toEqual(["MassTransit"]);
    expect(r.layout.featureSlices).toEqual(["Features"]);
    expect(r.endpoints.minimalApi).toBe(1);
    expect(r.suggestedCommands.build).toBe("dotnet build Sample.slnx");
  });
});

describe("contract-diff", () => {
  const git = (cwd: string, ...a: string[]) =>
    execFileSync("git", ["-c", "user.email=t@t.t", "-c", "user.name=t", ...a], {
      cwd,
      stdio: "pipe",
    });
  const contract = (body: string) => `namespace Orders.Contracts;\n${body}\n`;
  const csproj = "src/Modules/Orders/Orders.Contracts/Orders.Contracts.csproj";
  const cs = "src/Modules/Orders/Orders.Contracts/Api.cs";

  test("classifies removed/changed members as breaking and new ones as additive", async () => {
    const dir = await tempDir();
    git(dir, "init", "-q");
    await write(dir, {
      [csproj]: proj(),
      [cs]: contract(
        `public interface IOrdersApi\n{\n    Task<OrderDto?> GetAsync(Guid id);\n    Task CancelAsync(Guid id);\n}\npublic record OrderDto(Guid Id, string Number);\npublic enum Status { Open = 1, Closed = 2 }\n`,
      ),
    });
    git(dir, "add", "-A");
    git(dir, "commit", "-qm", "base");
    await write(dir, {
      [cs]: contract(
        `public interface IOrdersApi\n{\n    Task<OrderDto?> GetAsync(Guid id, CancellationToken ct);\n    Task ReopenAsync(Guid id);\n}\npublic record OrderDto(Guid Id, string Number, decimal Total);\npublic enum Status { Open = 1, Closed = 2, Archived = 3 }\n`,
      ),
    });
    const r = json(run("dotnet-module-contract", "contract-diff.mjs", dir, "Orders", "--json"));
    expect(r.breaking.join("\n")).toMatch(/IOrdersApi: Task<OrderDto\?> GetAsync\(Guid id\);/);
    expect(r.breaking.join("\n")).toMatch(/CancelAsync/);
    expect(r.breaking.join("\n")).toMatch(/record OrderDto\(Guid Id, string Number\)/);
    expect(r.additive.join("\n")).toMatch(/ReopenAsync/);
    expect(r.additive.join("\n")).toMatch(/GetAsync\(Guid id, CancellationToken ct\)/);
    expect(r.additive.join("\n")).toMatch(/value Archived 3/);
    expect(
      run("dotnet-module-contract", "contract-diff.mjs", dir, "Orders", "--strict").status,
    ).toBe(1);
  });

  test("purely additive changes and non-public members do not break; --strict stays 0", async () => {
    const dir = await tempDir();
    git(dir, "init", "-q");
    await write(dir, {
      [csproj]: proj(),
      [cs]: contract(
        `public interface IOrdersApi\n{\n    Task GetAsync(Guid id);\n}\ninternal class Hidden { public int X; }\n`,
      ),
    });
    git(dir, "add", "-A");
    git(dir, "commit", "-qm", "base");
    await write(dir, {
      [cs]: contract(
        `public interface IOrdersApi\n{\n    Task GetAsync(Guid id);\n    Task NewAsync();\n}\ninternal class Hidden { public int Y; }\n`,
      ),
    });
    const r = run(
      "dotnet-module-contract",
      "contract-diff.mjs",
      dir,
      "Orders",
      "--strict",
      "--json",
    );
    expect(r.status).toBe(0);
    expect(json(r).breaking).toEqual([]);
    expect(json(r).additive).toHaveLength(1);
  });
});

describe("affected", () => {
  test("plans build, tests (name and project reference) and format for the changed project", async () => {
    const dir = await tempDir();
    execFileSync("git", ["init", "-q"], { cwd: dir });
    await write(dir, {
      "src/Orders/Orders.csproj": proj(),
      "src/Orders/Handler.cs": "class H {}",
      "tests/Orders.Tests/Orders.Tests.csproj": proj(
        ["../../src/Orders/Orders.csproj"],
        `<ItemGroup><PackageReference Include="xunit" Version="2" /></ItemGroup>`,
      ),
      "tests/Integration.Tests/Integration.Tests.csproj": proj(
        ["../../src/Orders/Orders.csproj"],
        `<ItemGroup><PackageReference Include="xunit" Version="2" /></ItemGroup>`,
      ),
      "tests/Other.Tests/Other.Tests.csproj": proj(
        [],
        `<ItemGroup><PackageReference Include="xunit" Version="2" /></ItemGroup>`,
      ),
    });
    // Only Handler.cs changes: everything else is committed, so only the real change counts.
    execFileSync("git", ["-c", "user.email=t@t.t", "-c", "user.name=t", "add", "-A"], { cwd: dir });
    execFileSync("git", ["-c", "user.email=t@t.t", "-c", "user.name=t", "commit", "-qm", "base"], {
      cwd: dir,
    });
    await write(dir, { "src/Orders/Handler.cs": "class H { int changed; }" });
    const r = json(run("dotnet-verify", "affected.mjs", dir, "--json"));
    expect(r.changedFiles).toEqual(["src/Orders/Handler.cs"]);
    expect(r.build).toContain("src/Orders/Orders.csproj");
    expect(r.test).toEqual([
      "tests/Integration.Tests/Integration.Tests.csproj",
      "tests/Orders.Tests/Orders.Tests.csproj",
    ]);
    expect(r.test).not.toContain("tests/Other.Tests/Other.Tests.csproj");
    expect(r.format).toContain("src/Orders/Orders.csproj");
  });
});

describe("new-module", () => {
  test("plans without writing; --apply creates sibling projects, contract, tests and AGENTS.md; refuses existing modules", async () => {
    const dir = await tempDir();
    await write(dir, { "src/Modules/Billing/Billing/Billing.csproj": proj() });
    const plan = run("dotnet-module", "new-module.mjs", dir, "Orders");
    expect(plan.status).toBe(0);
    expect(plan.stdout).toMatch(/Plan \(nothing written/);
    expect(existsSync(join(dir, "src/Modules/Orders"))).toBe(false);

    const done = run("dotnet-module", "new-module.mjs", dir, "Orders", "--apply");
    expect(done.status).toBe(0);
    for (const f of [
      "src/Modules/Orders/Orders/Orders.csproj",
      "src/Modules/Orders/Orders/OrdersModule.cs",
      "src/Modules/Orders/Orders.Contracts/Orders.Contracts.csproj",
      "src/Modules/Orders/Orders.Contracts/IOrdersApi.cs",
      "src/Modules/Orders/AGENTS.md",
      "tests/Orders.Tests/Orders.Tests.csproj",
    ])
      expect(existsSync(join(dir, f)), f).toBe(true);
    expect(await readFile(join(dir, "src/Modules/Orders/Orders/Orders.csproj"), "utf8")).toContain(
      "..\\Orders.Contracts\\Orders.Contracts.csproj",
    );
    expect(await readFile(join(dir, "tests/Orders.Tests/Orders.Tests.csproj"), "utf8")).toContain(
      "..\\..\\src\\Modules\\Orders\\Orders\\Orders.csproj",
    );
    expect(done.stdout).toMatch(
      /dotnet sln add src\/Modules\/Orders\/Orders\/Orders\.csproj .*tests\/Orders\.Tests\/Orders\.Tests\.csproj --include-references false/,
    );

    // The new module is detected as a module, with no boundary problems of its own.
    const check = run("dotnet-module-boundary-check", "check-boundaries.mjs", dir, dir, "--json");
    expect(json(check).modules).toEqual(["Billing", "Orders"]);
    expect(
      json(check).findings.filter((x: { id: string }) =>
        ["BND001", "BND003", "BND005"].includes(x.id),
      ),
    ).toEqual([]);
    expect(run("dotnet-module", "new-module.mjs", dir, "Orders", "--apply").status).toBe(1);
  });

  test("--template copies an existing module and renames it everywhere", async () => {
    const dir = await tempDir();
    await write(dir, {
      "src/Modules/Billing/AGENTS.md": "# Billing module\n",
      "src/Modules/Billing/Billing/Billing.csproj": proj([
        "../Billing.Contracts/Billing.Contracts.csproj",
      ]),
      "src/Modules/Billing/Billing/BillingModule.cs":
        "namespace Billing;\npublic static class BillingModule {}\n",
      "src/Modules/Billing/Billing.Contracts/Billing.Contracts.csproj": proj(),
    });
    const r = run(
      "dotnet-module",
      "new-module.mjs",
      dir,
      "Shipping",
      "--template",
      "Billing",
      "--apply",
    );
    expect(r.status).toBe(0);
    expect(
      await readFile(join(dir, "src/Modules/Shipping/Shipping/ShippingModule.cs"), "utf8"),
    ).toContain("class ShippingModule");
    expect(
      await readFile(join(dir, "src/Modules/Shipping/Shipping/Shipping.csproj"), "utf8"),
    ).toContain("Shipping.Contracts");
    expect(await readFile(join(dir, "src/Modules/Shipping/AGENTS.md"), "utf8")).toContain(
      "# Shipping module",
    );
    expect(existsSync(join(dir, "src/Modules/Billing/Billing/BillingModule.cs"))).toBe(true);
  });
});

describe("check-tests", () => {
  test("flags weak tests in test projects only", async () => {
    const dir = await tempDir();
    await write(dir, {
      "tests/App.Tests/AppTests.cs": `public class T {
  [Fact] public void Empty() { var x = 1; }
  [Fact] public void Sleeps() { Thread.Sleep(10); Assert.True(true); }
  [Fact(Skip = "later")] public void Skipped() { Assert.Equal(1, 1); }
  [Fact] public async Task Good() { var r = await Run(); Assert.Equal(3, r); }
  [Fact] public void Clock() { var n = DateTime.UtcNow; Assert.NotNull(n); }
  [Fact] public void Blocks() { var r = Run().Result; Assert.Equal(1, r); }
}
`,
      "src/App/Prod.cs": "class P { void F() { Thread.Sleep(1); } }\n",
    });
    const f = json(run("dotnet-testing", "check-tests.mjs", dir, dir, "--json")) as {
      id: string;
      line: number;
      file: string;
    }[];
    const ids = f.map((x) => x.id);
    for (const id of ["TST001", "TST002", "TST003", "TST004", "TST008", "TST009", "TST010"])
      expect(ids, id).toContain(id);
    expect(f.every((x) => x.file.startsWith("tests/"))).toBe(true);
    expect(f.filter((x) => x.id === "TST009").map((x) => x.line)).toEqual([2]);
  });
});

describe("module-context --find", () => {
  test("groups hits by module, names the module that defines the type, and handles routes and unknown terms", async () => {
    const dir = await tempDir();
    await write(dir, {
      "src/Modules/Orders/Orders/Order.cs":
        "namespace Orders;\npublic record OrderCancelled(Guid Id);\nclass Handler { void F() { var e = new OrderCancelled(id); } }\n",
      "src/Modules/Orders/Orders/Orders.csproj": proj(),
      "src/Modules/Billing/Billing/Billing.csproj": proj(),
      "src/Modules/Billing/Billing/Consumer.cs":
        "namespace Billing;\nclass C { void On(OrderCancelled e) { } }\n// OrderCancelled in a comment is ignored\n",
      "src/Modules/Orders/Orders/Routes.cs":
        'class R { void M(IEndpointRouteBuilder app) { app.MapGet("/orders/{id}", () => 1); } }\n',
    });
    const r = json(
      run(
        "dotnet-module-context",
        "module-context.mjs",
        dir,
        "--find",
        "OrderCancelled",
        "--root",
        dir,
        "--json",
      ),
    );
    expect(r.modules.map((m: { module: string }) => m.module).sort()).toEqual([
      "Billing",
      "Orders",
    ]);
    const orders = r.modules.find((m: { module: string }) => m.module === "Orders");
    expect(orders.hits).toBe(2);
    expect(orders.definitions).toEqual(["src/Modules/Orders/Orders/Order.cs:2"]);
    expect(r.modules.find((m: { module: string }) => m.module === "Billing").hits).toBe(1);
    const text = run(
      "dotnet-module-context",
      "module-context.mjs",
      dir,
      "--find",
      "OrderCancelled",
      "--root",
      dir,
    ).stdout;
    expect(text).toMatch(/Owner: Orders \(it defines "OrderCancelled"\)/);
    const route = json(
      run(
        "dotnet-module-context",
        "module-context.mjs",
        dir,
        "--find",
        "/orders/{id}",
        "--root",
        dir,
        "--json",
      ),
    );
    expect(route.modules.map((m: { module: string }) => m.module)).toEqual(["Orders"]);
    expect(
      run(
        "dotnet-module-context",
        "module-context.mjs",
        dir,
        "--find",
        "NoSuchThing",
        "--root",
        dir,
      ).stdout,
    ).toMatch(/does not appear/);
    expect(run("dotnet-module-context", "module-context.mjs", dir, "--find").status).toBe(2);
  });
});

describe("slice-inventory", () => {
  const slice = (name: string, extra = "") =>
    `namespace Orders.Features.${name};\npublic sealed record ${name}Request(string Reason);\npublic sealed class ${name} { public static void Map(IEndpointRouteBuilder app) => app.MapPost("/x", HandleAsync)${extra};\n  private static async Task<IResult> HandleAsync(${name}Request r, CancellationToken ct) => Results.Ok(); }\n`;

  test("reports which parts each slice has and what is missing", async () => {
    const dir = await tempDir();
    await write(dir, {
      "src/Modules/Orders/Orders/Orders.csproj": proj(),
      "src/Modules/Orders/Orders/Features/CancelOrder/CancelOrder.cs": `${slice("CancelOrder", ".RequireAuthorization()")}class CancelOrderValidator {}\n`,
      "src/Modules/Orders/Orders/Features/PayOrder/PayOrder.cs":
        'namespace Orders.Features.PayOrder;\npublic sealed record PayOrderRequest(decimal Amount);\npublic sealed class PayOrder { public static void Map(IEndpointRouteBuilder app) => app.MapPost("/pay", (PayOrderRequest r) => Results.Ok()); }\n',
      "tests/Orders.Tests/Orders.Tests.csproj": proj(
        ["../../src/Modules/Orders/Orders/Orders.csproj"],
        '<ItemGroup><PackageReference Include="xunit" Version="2" /></ItemGroup>',
      ),
      "tests/Orders.Tests/CancelOrderTests.cs":
        "public class CancelOrderTests { [Fact] public void Cancels() { } }\n",
    });
    const r = json(run("dotnet-feature-slice", "slice-inventory.mjs", dir, dir, "--json"));
    const by = Object.fromEntries(r.slices.map((s: { slice: string }) => [s.slice, s]));
    expect(by.CancelOrder).toMatchObject({
      endpoint: true,
      handler: true,
      validation: true,
      authorization: true,
      cancellation: true,
      tests: 1,
      missing: [],
    });
    expect(by.PayOrder.missing).toEqual([
      "authorization",
      "validation",
      "cancellation token",
      "tests",
    ]);
    expect(run("dotnet-feature-slice", "slice-inventory.mjs", dir, dir, "--strict").status).toBe(1);
    expect(
      run("dotnet-feature-slice", "slice-inventory.mjs", dir, dir, "--module", "Orders").stdout,
    ).toMatch(/2 slice\(s\), 1 with gaps/);
  });

  test("Features/<Module>/<Action>.cs layouts make every mapped file its own slice; no slice folders is not an error", async () => {
    const dir = await tempDir();
    await write(dir, {
      "src/Api/Api.csproj": proj(),
      "src/Api/Features/Catalog/CreateProduct.cs": slice(
        "CreateProduct",
        ".RequireAuthorization()",
      ),
      "src/Api/Features/Catalog/ListProducts.cs": slice("ListProducts", ".RequireAuthorization()"),
    });
    const r = json(run("dotnet-feature-slice", "slice-inventory.mjs", dir, dir, "--json"));
    expect(
      r.slices.map((s: { slice: string; group: string }) => `${s.group}/${s.slice}`).sort(),
    ).toEqual(["Catalog/CreateProduct", "Catalog/ListProducts"]);
    const none = await tempDir();
    await write(none, { "src/App/App.csproj": proj(), "src/App/Program.cs": "class P {}" });
    const q = run("dotnet-feature-slice", "slice-inventory.mjs", none, none, "--strict");
    expect(q.status).toBe(0);
    expect(q.stdout).toMatch(/may not use vertical slices/);
  });
});

describe("security audit: ownership-check candidates", () => {
  test("flags a load by id without any tenant, owner, user or authorization hint, and not a guarded one", async () => {
    const dir = await tempDir();
    await write(dir, {
      "Open.cs":
        "class Open {\n  async Task<Order?> Get(Guid id, Db db) {\n    return await db.Orders.FirstOrDefaultAsync(o => o.Id == id);\n  }\n}\n",
      "Guarded.cs":
        "class Guarded {\n  async Task<Order?> Get(Guid id, Db db, ITenant tenant) {\n    return await db.Orders.FirstOrDefaultAsync(o => o.Id == id && o.TenantId == tenant.Id);\n  }\n}\n",
      "Authorized.cs":
        'class Authorized {\n  async Task Get(Guid orderId, Db db, IAuthorizationService authz) {\n    var o = await db.Orders.FindAsync(orderId);\n    await authz.AuthorizeAsync(User, o, "OrderOwner");\n  }\n}\n',
    });
    const r = JSON.parse(
      spawnSync(
        process.execPath,
        [script("aspnet-security-audit", "audit.mjs"), dir, "--json", "--no-packages"],
        { encoding: "utf8" },
      ).stdout,
    );
    expect(r.ownership.map((o: { file: string }) => o.file)).toEqual(["Open.cs"]);
    expect(r.ownership[0].line).toBe(3);
  });
});
