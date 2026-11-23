// Prints the context an agent needs before touching a module: its AGENTS.md, projects, public contract types,
// the contracts it consumes, who consumes its contract, and how to test it.
// Usage: node module-context.mjs <module name | path to a file or folder> [--json] [--root <repo>]
//        node module-context.mjs --find <type, route, table or message name> [--json] [--root <repo>]   (which module owns it, who uses it)
//@@MODULES@@
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const ri = args.indexOf("--root");
const root = resolve(ri >= 0 ? args[ri + 1] : process.cwd());
const target = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--root");
const projects = readProjects(root);
const byPath = byFile(projects);
const modules = moduleNames(projects);
const fi = args.indexOf("--find");
if (fi >= 0) {
  // Which module does this belong to? Search the C# sources for a whole word (or a literal like "/orders") and group by module.
  const needle = args[fi + 1];
  if (!needle || needle.startsWith("--")) {
    console.error(
      "Usage: module-context.mjs --find <type, route, table or message name> [--root <repo>] [--json]",
    );
    process.exit(2);
  }
  const esc = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(/^\w+$/.test(needle) ? `\\b${esc}\\b` : esc);
  const def = new RegExp(`\\b(class|record|struct|interface|enum)\\s+${esc}\\b`);
  const groups = new Map();
  for (const file of walkFiles(root)) {
    if (!file.endsWith(".cs")) continue;
    const owner = projectOf(projects, file);
    const key = owner?.module ?? "(shared or none)";
    (tryRead(file) ?? "").split("\n").forEach((line, i) => {
      if (line.trimStart().startsWith("//") || !re.test(line)) return;
      const g = groups.get(key) ?? {
        module: key,
        hits: 0,
        files: new Set(),
        roles: {},
        definitions: [],
        samples: [],
      };
      const where = `${posix(relative(root, file))}:${i + 1}`;
      g.hits++;
      g.files.add(posix(relative(root, file)));
      g.roles[owner?.role ?? "none"] = (g.roles[owner?.role ?? "none"] ?? 0) + 1;
      if (def.test(line)) g.definitions.push(where);
      if (g.samples.length < 3) g.samples.push(`${where}  ${line.trim().slice(0, 110)}`);
      groups.set(key, g);
    });
  }
  const found = [...groups.values()]
    .map((g) => ({ ...g, files: g.files.size }))
    .sort((a, b) => b.hits - a.hits);
  if (flag("--json")) console.log(JSON.stringify({ needle, modules: found }, null, 2));
  else if (!found.length) console.log(`"${needle}" does not appear in any C# file under ${root}.`);
  else {
    console.log(`# "${needle}" appears in ${found.length} module(s)`);
    for (const g of found) {
      const roles = Object.entries(g.roles)
        .map(([r, n]) => `${r} ${n}`)
        .join(", ");
      console.log(
        `\n## ${g.module}: ${g.hits} hit(s) in ${g.files} file(s) (${roles})${g.definitions.length ? `\n   defined at: ${g.definitions.join(", ")}` : ""}`,
      );
      for (const s of g.samples) console.log(`   ${s}`);
    }
    const definedIn = found.filter((g) => g.definitions.length).map((g) => g.module);
    console.log(
      definedIn.length === 1
        ? `\nOwner: ${definedIn[0]} (it defines "${needle}"); the other modules use it.`
        : `\nOwner: ${definedIn.length ? `defined in several modules (${definedIn.join(", ")})` : "no definition found: it may be a route, table or string; the module with most hits is the likely owner"}.`,
    );
  }
  process.exit(0);
}
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
