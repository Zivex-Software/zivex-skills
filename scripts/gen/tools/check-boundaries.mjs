// Checks module boundaries in a .NET modular monolith: modules may depend on each other only through ".Contracts" projects.
// Heuristic (project files and using directives). Reports candidates; confirm each in context.
// Usage: node check-boundaries.mjs [path] [--json] [--strict]    (--strict: exit 1 when any HIGH finding exists)
//@@MODULES@@
const args = process.argv.slice(2);
const root = resolve(args.find((a) => !a.startsWith("--")) ?? process.cwd());
const json = args.includes("--json");
const projects = readProjects(root);
const byPath = byFile(projects);
const modules = moduleNames(projects);
const findings = [];
const add = (id, level, file, line, msg, fix) => findings.push({ id, level, file, line, msg, fix });
const rel = (p) => posix(relative(root, p));
const SHARED_OK = (p) => p.role === "shared";

if (modules.length < 2) {
  if (json) console.log(JSON.stringify({ modules, findings: [] }, null, 2));
  else
    console.log(
      `${modules.length} module(s) detected (${modules.join(", ") || "none"}): nothing to check across modules. Add modules.json to describe modules explicitly.`,
    );
  process.exit(0);
}

// BND001/BND002: project references across modules must target the other module's Contracts project.
const edges = new Map();
for (const p of projects) {
  for (const target of p.refs) {
    const t = byPath.get(target);
    if (!t || SHARED_OK(t) || SHARED_OK(p) || !p.module || !t.module || p.module === t.module)
      continue;
    if (p.role !== "test")
      (edges.get(p.module) ?? edges.set(p.module, new Set()).get(p.module)).add(t.module);
    if (t.role === "contracts") continue;
    if (p.role === "test")
      add(
        "BND002",
        "medium",
        p.rel,
        1,
        `Test project of ${p.module} references ${t.name} (implementation of ${t.module})`,
        `Test against ${t.module}.Contracts or a fake; tests of one module should not depend on another module's internals.`,
      );
    else
      add(
        "BND001",
        "high",
        p.rel,
        1,
        `${p.name} (${p.module}) references ${t.name}, the implementation of module ${t.module}`,
        `Reference ${t.module}.Contracts only; if the needed type is missing, add it to the contract (see dotnet-module-contract).`,
      );
  }
}

// BND003: cycles between modules (even through contracts they make modules inseparable).
// Tarjan's strongly connected components: linear time, one finding per group of modules that depend on each other.
{
  let counter = 0;
  const index = new Map();
  const low = new Map();
  const onStack = new Set();
  const stack = [];
  const strong = (v) => {
    index.set(v, counter);
    low.set(v, counter++);
    stack.push(v);
    onStack.add(v);
    for (const w of edges.get(v) ?? []) {
      if (!index.has(w)) {
        strong(w);
        low.set(v, Math.min(low.get(v), low.get(w)));
      } else if (onStack.has(w)) low.set(v, Math.min(low.get(v), index.get(w)));
    }
    if (low.get(v) === index.get(v)) {
      const group = [];
      let w;
      do {
        w = stack.pop();
        onStack.delete(w);
        group.push(w);
      } while (w !== v);
      if (group.length > 1)
        add(
          "BND003",
          "medium",
          ".",
          1,
          `Modules depend on each other in a cycle: ${group.sort().join(" <-> ")}`,
          "Break the cycle: invert one dependency with an integration event, or move the shared concept into a contract both can use.",
        );
    }
  };
  for (const v of [...edges.keys()].sort()) if (!index.has(v)) strong(v);
}

// BND005: contracts must stay free of implementation and framework-heavy dependencies.
for (const p of projects.filter((x) => x.role === "contracts")) {
  for (const target of p.refs) {
    const t = byPath.get(target);
    if (t && t.module === p.module && t.role === "impl")
      add(
        "BND005",
        "medium",
        p.rel,
        1,
        `${p.name} references its own implementation ${t.name}`,
        "Contracts must not depend on the implementation (it creates a cycle and leaks internals).",
      );
  }
  const heavy = p.packages
    .filter((n) =>
      /^Microsoft\.EntityFrameworkCore|^Microsoft\.AspNetCore|^MassTransit|^MediatR$/i.test(n),
    )
    .concat(p.frameworks.filter((n) => /AspNetCore/i.test(n)));
  if (heavy.length)
    add(
      "BND005",
      "medium",
      p.rel,
      1,
      `${p.name} depends on ${heavy.join(", ")}`,
      "Keep contracts to plain interfaces, records and events; no ORM or web types.",
    );
}

// Source scan: InternalsVisibleTo to another module, and using directives into another module's namespaces.
const ivtFinding = (p, name, file, line) => {
  const t = projects.find((x) => x.name === name);
  if (t && t.module && p.module && t.module !== p.module && t.role !== "test")
    add(
      "BND004",
      "high",
      file,
      line,
      `InternalsVisibleTo grants ${t.name} (module ${t.module}) access to ${p.module} internals`,
      "Remove it; expose what the other module needs through the contract.",
    );
};
for (const file of walkFiles(root)) {
  if (!file.endsWith(".cs")) continue;
  const p = projectOf(projects, file);
  if (!p || p.role === "test" || p.role === "shared" || !p.module) continue;
  const text = stripBlockComments(tryRead(file) ?? "");
  text.split("\n").forEach((line, i) => {
    if (line.trimStart().startsWith("//")) return;
    // [assembly: InternalsVisibleTo("Billing")], with a public key ("Billing, PublicKey=...") or a named argument (assemblyName: "Billing")
    const ivt = /InternalsVisibleTo\(\s*(?:assemblyName\s*:\s*)?"([^",]+)/.exec(line);
    if (ivt) ivtFinding(p, ivt[1].trim(), rel(file), i + 1);
    // using X.Y; / global using X.Y; / using static X.Y; / using Alias = X.Y.Z;
    const use = /^\s*(?:global\s+)?using\s+(?:static\s+)?(?:\w+\s*=\s*)?([\w.]+)\s*;/.exec(line);
    if (use && p.role !== "contracts") {
      const seg = use[1].split(".");
      if (VENDOR_ROOTS.has(seg[0])) return;
      const other = modules.find((m) => m !== p.module && seg.slice(0, 3).includes(m));
      if (other && !seg.includes("Contracts"))
        add(
          "BND006",
          "medium",
          rel(file),
          i + 1,
          `using ${use[1]} reaches into module ${other} outside its Contracts namespace`,
          `Use ${other}.Contracts types only.`,
        );
    }
  });
}
for (const p of projects) for (const name of p.ivt) ivtFinding(p, name, p.rel, 1);

// BND008: each module should explain itself to agents and humans.
for (const m of modules) {
  const dirs = projects.filter((p) => p.module === m && p.role === "impl").map((p) => p.dir);
  const candidates = dirs.flatMap((d) => [d, dirname(d)]);
  if (dirs.length && !candidates.some((d) => existsSync(join(d, "AGENTS.md"))))
    add(
      "BND008",
      "low",
      rel(dirs[0]),
      1,
      `Module ${m} has no AGENTS.md`,
      "Add one (purpose, contract, layout, rules, test command); dotnet-conventions-bootstrap can draft it.",
    );
}

const unique = [
  ...new Map(findings.map((f) => [`${f.id}|${f.file}|${f.line}|${f.msg}`, f])).values(),
];
const order = { high: 0, medium: 1, low: 2 };
unique.sort(
  (a, b) => order[a.level] - order[b.level] || a.file.localeCompare(b.file) || a.line - b.line,
);
if (json) console.log(JSON.stringify({ modules, findings: unique }, null, 2));
else {
  for (const f of unique)
    console.log(
      `${f.file}:${f.line}  ${f.level.toUpperCase()}  ${f.id}  ${f.msg}\n    fix: ${f.fix}`,
    );
  const n = (l) => unique.filter((f) => f.level === l).length;
  console.log(
    `\nModules: ${modules.join(", ")}. ${projects.length} projects scanned: ${n("high")} high, ${n("medium")} medium, ${n("low")} low.`,
  );
}
if (args.includes("--strict") && unique.some((f) => f.level === "high")) process.exit(1);
