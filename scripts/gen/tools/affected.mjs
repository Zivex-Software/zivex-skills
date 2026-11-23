// Works out what a change affects and (with --run) verifies it: build the changed projects, run the tests that cover them
// (by naming convention or <ProjectReference>), and check formatting. Plan first, so you can see what will run.
// Usage: node affected.mjs [--base <ref>] [--run] [--no-format] [--json]
//   --base <ref>  also include files changed since <ref> (default: only uncommitted changes)
import { execFileSync, spawnSync } from "node:child_process";
//@@MODULES@@
const args = process.argv.slice(2);
const bi = args.indexOf("--base");
const base = bi >= 0 ? args[bi + 1] : undefined;
const git = (a, cwd = process.cwd()) =>
  execFileSync("git", a, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
let top;
try {
  top = resolve(git(["rev-parse", "--show-toplevel"]).trim());
} catch {
  console.error("Not inside a git repository.");
  process.exit(2);
}
const changed = new Set();
for (const l of git(["status", "--porcelain", "-uall"], top).split("\n")) {
  const f = l.slice(3).trim().replace(/^"|"$/g, "").split(" -> ").pop();
  if (f && /\.(cs|csproj|props|targets)$/.test(f)) changed.add(resolve(top, f));
}
if (base)
  for (const f of git(["diff", "--name-only", `${base}...HEAD`], top).split("\n"))
    if (/\.(cs|csproj|props|targets)$/.test(f)) changed.add(resolve(top, f));

const projects = readProjects(top);
const touched = new Map();
for (const f of changed) {
  const p = f.endsWith(".csproj") ? projects.find((x) => x.file === f) : projectOf(projects, f);
  if (p) touched.set(p.file, p);
}
const global = [...changed].some((f) => /Directory\.(Build|Packages)\.(props|targets)$/.test(f));
const buildSet = global ? projects.filter((p) => p.role !== "test") : [...touched.values()];
const stem = (p) => p.name;
const refs = (t) => new Set(t.refs);
const tests = projects.filter(
  (t) =>
    t.role === "test" &&
    (touched.has(t.file) ||
      global ||
      buildSet.some(
        (p) => p.role !== "test" && (t.name.startsWith(`${stem(p)}.`) || refs(t).has(p.file)),
      )),
);
const modules = [...new Set([...touched.values()].map((p) => p.module).filter(Boolean))].sort();
const rel = (p) => posix(relative(top, p.file));
const plan = {
  changedFiles: [...changed].map((f) => posix(relative(top, f))).sort(),
  modules,
  build: [...new Set([...buildSet, ...tests].map(rel))].sort(),
  test: tests.map(rel).sort(),
  format: args.includes("--no-format") ? [] : [...touched.values()].map(rel).sort(),
};
const cmds = [
  ...plan.build.map((p) => ["dotnet", ["build", p, "--nologo", "-v", "q"]]),
  ...plan.test.map((p) => ["dotnet", ["test", p, "--nologo", "-v", "q"]]),
  ...plan.format.map((p) => ["dotnet", ["format", p, "--verify-no-changes", "--no-restore"]]),
];

if (!args.includes("--run")) {
  if (args.includes("--json")) console.log(JSON.stringify(plan, null, 2));
  else {
    console.log(
      `# Affected by ${plan.changedFiles.length} changed file(s); modules: ${modules.join(", ") || "none detected"}`,
    );
    for (const [title, list] of [
      ["Build", plan.build],
      ["Test", plan.test],
      ["Format check", plan.format],
    ])
      console.log(`\n${title}:\n${list.map((x) => `  ${x}`).join("\n") || "  -"}`);
    console.log(
      "\nRun it: node affected.mjs --run   (commands: " +
        cmds.map(([c, a]) => `${c} ${a.join(" ")}`).join(" ; ") +
        ")",
    );
  }
  process.exit(0);
}

let failed = 0;
const rows = [];
for (const [cmd, a] of cmds) {
  const r = spawnSync(cmd, a, { cwd: top, encoding: "utf8", shell: process.platform === "win32" });
  const ok = r.status === 0;
  if (!ok) failed++;
  rows.push({
    step: `${cmd} ${a.slice(0, 2).join(" ")}`,
    ok,
    tail: ok ? "" : `${r.stdout ?? ""}${r.stderr ?? ""}`.trim().split("\n").slice(-15).join("\n"),
  });
}
if (args.includes("--json")) console.log(JSON.stringify({ plan, results: rows }, null, 2));
else {
  for (const r of rows)
    console.log(
      `${r.ok ? "PASS" : "FAIL"}  ${r.step}${r.ok ? "" : `\n${r.tail.replace(/^/gm, "      ")}`}`,
    );
  console.log(
    `\n${rows.length - failed}/${rows.length} steps passed. Not run: integration tests outside the affected projects, other modules that consume a changed contract.`,
  );
}
process.exit(failed ? 1 : 0);
