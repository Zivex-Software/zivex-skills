import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { defaultContentRoot } from "../src/content.js";
import { tempDir, write } from "./helpers.js";

const scripts = {
  security: "aspnet-security/scripts/check-security.mjs",
  performance: "aspnet-performance/scripts/check-performance.mjs",
  data: "aspnet-data-efcore/scripts/check-efcore.mjs",
  api: "aspnet-api-design/scripts/check-api.mjs",
  resilience: "aspnet-resilience/scripts/check-resilience.mjs",
  observability: "aspnet-observability/scripts/check-observability.mjs",
} as const;

function scan(name: keyof typeof scripts, dir: string, extra: string[] = []) {
  const r = spawnSync(
    process.execPath,
    [join(defaultContentRoot(), "skills", scripts[name]), dir, "--json", ...extra],
    { encoding: "utf8" },
  );
  return {
    status: r.status,
    found: JSON.parse(r.stdout || "[]") as {
      id: string;
      level: string;
      file: string;
      line: number;
    }[],
  };
}
const ids = (r: ReturnType<typeof scan>) => [...new Set(r.found.map((f) => f.id))].sort();

const BAD = {
  "Program.cs": `var builder = WebApplication.CreateBuilder(args);
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.AllowAnyOrigin().AllowCredentials()));
builder.Services.AddHttpClient("x");
builder.Services.AddSingleton<AppDbContext>();
var app = builder.Build();
app.UseDeveloperExceptionPage();
app.MapGet("/orders", async (AppDbContext db) => Results.Ok(await db.Orders.ToListAsync()));
await db.Database.MigrateAsync();
app.Run();
`,
  "Svc.cs": `public class Svc : BackgroundService {
  private HttpContext _ctx;
  protected override async Task ExecuteAsync(CancellationToken stoppingToken) {
    while (true) { await Task.Delay(1000); }
  }
  public void Run(AppDbContext db, IEnumerable<int> ids, string returnUrl, Exception ex, ILogger log, IFormFile file) {
    var x = Do().Result;
    var c = new HttpClient();
    var list = db.Orders.ToList().Where(o => o.Id > 1);
    foreach (var id in ids) {
      var o = await db.Orders.FirstOrDefaultAsync(o => o.Id == id);
    }
    db.Database.ExecuteSqlRaw($"select * from t where a = {x}");
    db.SaveChanges();
    Redirect(returnUrl);
    log.LogInformation($"paid {x}");
    log.LogError("failed " + ex.Message, ex.Message);
    log.LogInformation("token {Token}", password);
    var p = Path.Combine("/up", file.FileName);
    try { Foo(); } catch { }
    var h = MD5.Create();
    Console.WriteLine("hi");
    _ = Task.Run(() => Work());
    Thread.Sleep(10);
    return Results.Problem(ex.Message);
  }
}
`,
  "Worker.cs": `public class Worker : BackgroundService {
  protected override async Task ExecuteAsync(CancellationToken stoppingToken) { await Task.Yield(); }
}
`,
  "Svc2.cs": `public class Opts { void F() { var o = new TokenValidationParameters { ValidateIssuer = false, ValidateAudience = false }; opts.EnableSensitiveDataLogging(); } }`,
  "appsettings.json": `{ "ConnectionStrings": { "Default": "Server=db;User=sa;Password=SuperSecret123;" }, "Jwt": { "Secret": "abcdef123456789" }, "AllowedHosts": "*" }`,
};

const GOOD = {
  "Program.cs": `var builder = WebApplication.CreateBuilder(args);
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<GlobalHandler>();
builder.Services.AddHybridCache();
builder.Services.AddHealthChecks();
builder.Services.AddOpenTelemetry().UseOtlpExporter();
builder.Services.AddAuthorizationBuilder().SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build());
builder.Services.AddHttpClient<Api>().AddStandardResilienceHandler(o => o.Retry.DisableForUnsafeHttpMethods());
var app = builder.Build();
app.UseExceptionHandler();
app.MapHealthChecks("/health/live", new() { Predicate = _ => false });
app.MapGet("/orders", async (AppDbContext db, CancellationToken ct) => Results.Ok(await db.Orders.Select(o => new OrderDto(o.Id)).ToListAsync(ct)));
app.Run();
`,
  "Good.cs": `public class Good(ILogger<Good> log, IDbContextFactory<AppDbContext> factory) : BackgroundService {
  protected override async Task ExecuteAsync(CancellationToken stoppingToken) {
    while (!stoppingToken.IsCancellationRequested) {
      try { await using var db = await factory.CreateDbContextAsync(stoppingToken); await db.SaveChangesAsync(stoppingToken); }
      catch (Exception ex) when (ex is not OperationCanceledException) { log.LogError(ex, "Cycle failed for {Id}", 1); }
      await Task.Delay(1000, stoppingToken);
    }
  }
}
`,
  "appsettings.json": `{ "ConnectionStrings": { "Default": "" }, "AllowedHosts": "api.example.com" }`,
};

describe("check scripts", () => {
  test("bad code is flagged by each script", async () => {
    const dir = await tempDir();
    await write(dir, BAD);
    expect(ids(scan("security", dir))).toEqual(
      expect.arrayContaining([
        "SEC001",
        "SEC003",
        "SEC004",
        "SEC006",
        "SEC007",
        "SEC008",
        "SEC010",
        "SEC011",
        "SEC015",
        "SEC016",
        "SEC017",
        "SEC019",
        "SEC020",
      ]),
    );
    expect(ids(scan("performance", dir))).toEqual(
      expect.arrayContaining(["PERF001", "PERF003", "PERF004", "PERF005", "PERF008", "PERF014"]),
    );
    expect(ids(scan("data", dir))).toEqual(
      expect.arrayContaining(["EF001", "EF002", "EF003", "EF004", "EF005", "EF007"]),
    );
    expect(ids(scan("api", dir))).toEqual(
      expect.arrayContaining(["API001", "API002", "API003", "API007"]),
    );
    expect(ids(scan("resilience", dir))).toEqual(
      expect.arrayContaining([
        "RES001",
        "RES002",
        "RES005",
        "RES006",
        "RES007",
        "RES008",
        "RES010",
      ]),
    );
    expect(ids(scan("observability", dir))).toEqual(
      expect.arrayContaining(["OBS001", "OBS002", "OBS003", "OBS004", "OBS005", "OBS006"]),
    );
  });

  test("clean code produces no findings", async () => {
    const dir = await tempDir();
    await write(dir, GOOD);
    for (const name of Object.keys(scripts) as (keyof typeof scripts)[]) {
      expect(scan(name, dir).found, name).toEqual([]);
    }
  });

  test("--strict exits 1 on high findings only; test projects and bin/obj are ignored", async () => {
    const dir = await tempDir();
    await write(dir, {
      "A.cs": "var x = Do().Result;",
      "A.Tests/T.cs": "var y = Do().Result;",
      "obj/G.cs": "var z = Do().Result;",
    });
    const r = scan("performance", dir, ["--strict"]);
    expect(r.status).toBe(1);
    expect(r.found.map((f) => f.file)).toEqual(["A.cs"]);
    const ok = await tempDir();
    await write(ok, { "A.cs": "Thread.Sleep(1);" });
    expect(scan("performance", ok, ["--strict"]).status).toBe(0);
  });

  test("comments are ignored and loop detection stays inside loops", async () => {
    const dir = await tempDir();
    await write(dir, {
      "A.cs": `// var x = Do().Result;\nvar a = await db.Orders.FirstOrDefaultAsync();\nforeach (var i in ids)\n{\n  Log(i);\n}\nvar b = await db.Orders.FirstOrDefaultAsync();\n`,
    });
    expect(scan("performance", dir).found).toEqual([]);
    expect(scan("data", dir).found.filter((f) => f.id === "EF001")).toEqual([]);
  });
});

describe("security audit script", () => {
  const run = (dir: string) => {
    const r = spawnSync(
      process.execPath,
      [
        join(defaultContentRoot(), "skills/aspnet-security-audit/scripts/audit.mjs"),
        dir,
        "--json",
        "--no-packages",
      ],
      { encoding: "utf8" },
    );
    return JSON.parse(r.stdout);
  };

  test("flags middleware order mistakes and unauthenticated endpoints", async () => {
    const dir = await tempDir();
    await write(dir, {
      "Program.cs": `var app = WebApplication.CreateBuilder(args).Build();
app.UseAuthorization();
app.UseAuthentication();
app.UseCors();
app.UseRouting();
app.MapGet("/open", () => "x");
app.MapGet("/secret", () => "y").RequireAuthorization();
app.MapGet("/public", () => "z").AllowAnonymous();
`,
      "OrdersController.cs": `[Authorize]
public class OrdersController {
  [HttpGet] public IActionResult List() => null;
  [AllowAnonymous]
  [HttpGet] public IActionResult Health() => null;
}
`,
    });
    const r = run(dir);
    const msgs = r.pipeline.map((p: { msg: string }) => p.msg).join("\n");
    expect(msgs).toMatch(/UseAuthentication must come before UseAuthorization/);
    expect(msgs).toMatch(
      /UseRouting must come before UseCors|UseCors must come before UseAuthorization/,
    );
    const byRoute = Object.fromEntries(
      r.endpoints.map((e: { route: string; auth: string }) => [e.route, e.auth]),
    );
    expect(byRoute["GET /open"]).toBe("NONE");
    expect(byRoute["GET /secret"]).toBe("authorized");
    expect(byRoute["GET /public"]).toBe("anonymous (explicit)");
    expect(byRoute["GET List"]).toBe("authorized");
    expect(byRoute["GET Health"]).toBe("anonymous (explicit)");
  });

  test("a fallback policy covers endpoints without attributes", async () => {
    const dir = await tempDir();
    await write(dir, {
      "Program.cs": `var b = WebApplication.CreateBuilder(args);\nb.Services.AddAuthorizationBuilder().SetFallbackPolicy(p);\nvar app = b.Build();\napp.UseAuthentication();\napp.UseAuthorization();\napp.MapGet("/x", () => 1);\n`,
    });
    expect(run(dir).endpoints[0].auth).toBe("fallback policy");
  });
});
