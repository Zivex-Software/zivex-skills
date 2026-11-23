// Maps a .NET repository so conventions can be written down from evidence instead of guessed:
// solutions, projects and modules, target frameworks, build settings, test and library stack, CI, layout style, existing agent docs.
// Usage: node inspect-repo.mjs [path] [--json]
//@@MODULES@@
const args = process.argv.slice(2);
const root = resolve(args.find((a) => !a.startsWith("--")) ?? process.cwd());
const projects = readProjects(root);
const rel = (p) => posix(relative(root, p));
const all = [...walkFiles(root)];
const named = (re) =>
  all
    .filter((f) => re.test(basename(f)))
    .map(rel)
    .sort();
const text = (f) => tryRead(join(root, f)) ?? "";

const props = [
  "Directory.Build.props",
  "Directory.Build.targets",
  "Directory.Packages.props",
  "global.json",
  ".editorconfig",
  "nuget.config",
  "NuGet.Config",
].filter((f) => existsSync(join(root, f)));
const prop = (name) => {
  for (const f of ["Directory.Build.props", ...projects.slice(0, 1).map((p) => p.rel)]) {
    const m = new RegExp(`<${name}>([^<]+)</${name}>`, "i").exec(text(f));
    if (m) return m[1].trim();
  }
  return undefined;
};
const packages = [...new Set(projects.flatMap((p) => p.packages))].sort();
const has = (re) => packages.filter((n) => re.test(n));
const sdk = (() => {
  try {
    return JSON.parse(text("global.json")).sdk?.version;
  } catch {
    return undefined;
  }
})();

const dirNames = new Set(all.flatMap((f) => posix(relative(root, dirname(f))).split("/")));
const layout = {
  featureSlices: ["Features", "UseCases", "Slices"].filter((d) => dirNames.has(d)),
  layered: ["Controllers", "Services", "Repositories", "Handlers"].filter((d) => dirNames.has(d)),
};
const cs = all.filter((f) => f.endsWith(".cs") && !/[\\/](bin|obj)[\\/]/.test(f));
const sample = cs
  .slice(0, 400)
  .map((f) => tryRead(f) ?? "")
  .join("\n");
const count = (re) => (sample.match(re) ?? []).length;
const endpoints = {
  minimalApi: count(/\.Map(Get|Post|Put|Delete|Patch)\s*\(/g),
  controllers: count(/\[ApiController\]/g),
};

const modules = moduleNames(projects).map((m) => ({
  module: m,
  projects: projects.filter((p) => p.module === m).map((p) => `${p.role}:${p.name}`),
}));
const slnFiles = named(/\.(sln|slnx)$/i);
const test = {
  projects: projects.filter((p) => p.isTest).map((p) => p.rel),
  frameworks: has(/^(xunit|xunit\.v3|NUnit|MSTest\.TestFramework|MSTest)$/i),
  libraries: has(
    /^(FluentAssertions|Shouldly|NSubstitute|Moq|FakeItEasy|Bogus|AutoFixture|Verify\.|Testcontainers|Respawn|Microsoft\.AspNetCore\.Mvc\.Testing|Microsoft\.EntityFrameworkCore\.InMemory|coverlet)/i,
  ),
};
const report = {
  root,
  solutions: slnFiles,
  projectCount: projects.length,
  targetFrameworks: [...new Set(projects.flatMap((p) => p.tfms))].sort(),
  sdkPinned: sdk ?? null,
  buildFiles: props,
  centralPackageManagement: /ManagePackageVersionsCentrally>\s*true/i.test(
    text("Directory.Packages.props"),
  ),
  settings: {
    nullable: prop("Nullable") ?? null,
    implicitUsings: prop("ImplicitUsings") ?? null,
    treatWarningsAsErrors: prop("TreatWarningsAsErrors") ?? null,
    langVersion: prop("LangVersion") ?? null,
    analysisLevel: prop("AnalysisLevel") ?? null,
  },
  editorconfig: existsSync(join(root, ".editorconfig")),
  modules,
  moduleDetection: existsSync(join(root, "modules.json")) ? "modules.json" : "conventions",
  tests: test,
  stack: {
    data: has(/^Microsoft\.EntityFrameworkCore|^Dapper$|^Npgsql|^Microsoft\.Data\.SqlClient/),
    messaging: has(
      /^MassTransit|^MediatR$|^Wolverine|^Rebus|^NServiceBus|^Azure\.Messaging|^RabbitMQ/,
    ),
    validation: has(/^FluentValidation|^MiniValidation/),
    observability: has(/^Serilog|^OpenTelemetry|^Microsoft\.ApplicationInsights/),
    resilience: has(/^Polly|^Microsoft\.Extensions\.(Http\.)?Resilience/),
    auth: has(/^Microsoft\.AspNetCore\.(Authentication|Identity)|^Duende|^OpenIddict/),
  },
  layout,
  endpoints,
  ci: [
    ...named(/\.ya?ml$/).filter((f) => f.startsWith(".github/workflows/")),
    ...named(/^(azure-pipelines\.ya?ml|\.gitlab-ci\.yml|Jenkinsfile|bitbucket-pipelines\.yml)$/),
  ],
  containers: named(/^(Dockerfile.*|docker-compose.*\.ya?ml|compose\.ya?ml)$/i),
  agentDocs: named(/^(AGENTS|CLAUDE)\.md$/i).concat(
    existsSync(join(root, ".cursor", "rules")) ? [".cursor/rules/"] : [],
  ),
  suggestedCommands: {
    build: slnFiles[0] ? `dotnet build ${slnFiles[0]}` : "dotnet build",
    test: slnFiles[0] ? `dotnet test ${slnFiles[0]}` : "dotnet test",
    format: "dotnet format --verify-no-changes",
  },
};
if (args.includes("--json")) console.log(JSON.stringify(report, null, 2));
else {
  const line = (k, v) =>
    console.log(
      `${k.padEnd(26)} ${Array.isArray(v) ? v.join(", ") || "-" : typeof v === "object" && v ? JSON.stringify(v) : (v ?? "-")}`,
    );
  console.log(`# Repository map: ${root}`);
  for (const [k, v] of Object.entries(report)) if (k !== "root" && k !== "modules") line(k, v);
  console.log("\n## Modules");
  for (const m of modules) console.log(`- ${m.module}: ${m.projects.join(", ")}`);
  if (!modules.length) console.log("- none detected: treat the repository as one module");
}
