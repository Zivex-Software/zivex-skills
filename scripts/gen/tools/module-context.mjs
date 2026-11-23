// Prints the context an agent needs before touching a module: its AGENTS.md, projects, public contract types,
// the contracts it consumes, who consumes its contract, and how to test it.
// Usage: node module-context.mjs <module name | path to a file or folder> [--json] [--root <repo>]
//@@MODULES@@
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const ri = args.indexOf("--root");
const root = resolve(ri >= 0 ? args[ri + 1] : process.cwd());
const target = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--root");
const projects = readProjects(root);
const byPath = byFile(projects);
const modules = moduleNames(projects);
if (!target) {
  console.error(
    "Usage: module-context.mjs <module name | file or folder path>\nModules found: " +
      (modules.join(", ") || "none"),
  );
  process.exit(2);
}

let moduleName = modules.find((m) => m.toLowerCase() === target.toLowerCase());
if (!moduleName) {
  const abs = resolve(root, target);
  const p = existsSync(abs)
    ? (projectOf(projects, abs) ?? projects.find((x) => abs === x.dir))
    : undefined;
  moduleName = p?.module ?? undefined;
}
const mine = moduleName ? projects.filter((p) => p.module === moduleName) : projects;
const rel = (p) => posix(relative(root, p));

const typesIn = (project) => {
  const out = [];
  for (const file of walkFiles(project.dir)) {
    if (!file.endsWith(".cs")) continue;
    for (const line of (tryRead(file) ?? "").split("\n")) {
      const m =
        /^\s*public\s+(?:(?:sealed|static|abstract|partial|readonly)\s+)*(interface|class|record(?:\s+struct|\s+class)?|struct|enum)\s+(\w+)/.exec(
          line,
        );
      if (m) out.push(`${m[1].replace(/\s+/g, " ")} ${m[2]}`);
    }
  }
  return out.sort();
};

const contracts = mine.filter((p) => p.role === "contracts");
const consumed = [
  ...new Set(
    mine
      .filter((p) => p.role !== "contracts")
      .flatMap((p) =>
        p.refs
          .map((r) => byPath.get(r))
          .filter((t) => t && t.module && t.module !== moduleName && t.role === "contracts")
          .map((t) => t.name),
      ),
  ),
].sort();
const consumers = moduleName
  ? [
      ...new Set(
        projects
          .filter(
            (p) =>
              p.module &&
              p.module !== moduleName &&
              p.refs.some(
                (r) => byPath.get(r)?.module === moduleName && byPath.get(r)?.role === "contracts",
              ),
          )
          .map((p) => p.module),
      ),
    ].sort()
  : [];
const agentsFile = [
  ...new Set(mine.filter((p) => p.role === "impl").flatMap((p) => [p.dir, dirname(p.dir)])),
]
  .map((d) => join(d, "AGENTS.md"))
  .find((f) => existsSync(f));
const agents = agentsFile
  ? (tryRead(agentsFile) ?? "").split("\n").slice(0, 60).join("\n")
  : undefined;
const tests = mine.filter((p) => p.role === "test");

const result = {
  module: moduleName ?? "(none: whole repository treated as one module)",
  agentsFile: agentsFile ? rel(agentsFile) : null,
  projects: mine.map((p) => ({ name: p.name, role: p.role, path: p.rel, tfms: p.tfms })),
  contractTypes: Object.fromEntries(contracts.map((c) => [c.name, typesIn(c)])),
  consumesContracts: consumed,
  consumedBy: consumers,
  testCommands: tests.map((t) => `dotnet test ${t.rel}`),
};
if (flag("--json")) console.log(JSON.stringify({ ...result, agents }, null, 2));
else {
  console.log(`# Module: ${result.module}`);
  console.log(`AGENTS.md: ${result.agentsFile ?? "none (run dotnet-conventions-bootstrap)"}`);
  if (agents) console.log(`\n--- AGENTS.md (first 60 lines) ---\n${agents}\n---`);
  console.log("\n## Projects");
  for (const p of result.projects)
    console.log(
      `- ${p.role.padEnd(9)} ${p.name}  (${p.path}${p.tfms.length ? `, ${p.tfms.join(";")}` : ""})`,
    );
  console.log("\n## Public contract");
  if (!contracts.length) console.log("- no .Contracts project found");
  for (const [name, types] of Object.entries(result.contractTypes))
    console.log(`- ${name}: ${types.length ? types.join(", ") : "(no public types)"}`);
  console.log(`\n## Consumes contracts of: ${consumed.length ? consumed.join(", ") : "none"}`);
  console.log(
    `## Contract consumed by modules: ${consumers.length ? consumers.join(", ") : "none"}`,
  );
  console.log("\n## How to test");
  console.log(
    result.testCommands.length
      ? result.testCommands.map((c) => `- ${c}`).join("\n")
      : "- no test project found for this module",
  );
}
