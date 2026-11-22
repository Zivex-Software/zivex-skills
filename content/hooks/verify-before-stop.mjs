// Before the agent finishes: if .cs files changed, build and run the tests of the affected projects.
// On failure it exits 2 with the tail of the output so the agent keeps working.
// No-ops outside .NET repositories, when nothing changed, and on the second stop attempt (stop_hook_active).
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, parse, relative, resolve } from "node:path";

const input = (() => {
  try {
    return JSON.parse(readFileSync(0, "utf8"));
  } catch {
    return {};
  }
})();
if (input.stop_hook_active) process.exit(0);

const cwd = input.cwd || process.cwd();
const run = (cmd, args) => {
  try {
    return {
      ok: true,
      out: execFileSync(cmd, args, {
        cwd,
        encoding: "utf8",
        stdio: "pipe",
        timeout: 540_000,
        maxBuffer: 64 << 20,
      }),
    };
  } catch (e) {
    return { ok: false, out: `${e.stdout ?? ""}${e.stderr ?? ""}` || String(e.message) };
  }
};
const tail = (s) => s.trim().split("\n").slice(-40).join("\n");

const top = run("git", ["rev-parse", "--show-toplevel"]);
if (!top.ok) process.exit(0);
const root = top.out.trim();
const status = run("git", ["status", "--porcelain", "-uall"]);
const changed = status.ok
  ? status.out
      .split("\n")
      .map((l) => l.slice(3).trim().replace(/^"|"$/g, ""))
      .filter((f) => f.endsWith(".cs"))
      .map((f) => resolve(root, f))
  : [];
if (changed.length === 0) process.exit(0);

const nearestProject = (file) => {
  for (let d = dirname(file); d.startsWith(root); d = dirname(d)) {
    try {
      const hit = readdirSync(d).find((n) => n.endsWith(".csproj"));
      if (hit) return join(d, hit);
    } catch {}
    if (d === parse(d).root) break;
  }
};
const projects = [...new Set(changed.map(nearestProject).filter(Boolean))];
if (projects.length === 0) process.exit(0);

// Which projects are affected: the changed projects, plus test projects that either follow the naming
// convention ("Foo.Orders" -> "Foo.Orders.Tests*") or reference a changed project (<ProjectReference>).
const all = [];
const walk = (d, depth) => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    if (e.isFile() && e.name.endsWith(".csproj")) all.push(join(d, e.name));
    else if (
      e.isDirectory() &&
      depth < 6 &&
      !["node_modules", "bin", "obj", ".git"].includes(e.name)
    )
      walk(join(d, e.name), depth + 1);
  }
};
walk(root, 0);
const stem = (p) => parse(p).name;
const isTest = (p) => /tests?($|\.)/i.test(stem(p));
const refsOf = (csproj) => {
  try {
    return [
      ...readFileSync(csproj, "utf8").matchAll(
        /<ProjectReference\s[^>]*?Include\s*=\s*"([^"]+)"/gi,
      ),
    ].map((m) => resolve(dirname(csproj), m[1].replaceAll("\\", "/")));
  } catch {
    return [];
  }
};
const changedSet = new Set(projects.map((p) => resolve(p)));
const tests = new Set(projects.filter(isTest));
for (const t of all.filter(isTest)) {
  const byName = projects.some((p) => !isTest(p) && stem(t).startsWith(`${stem(p)}.`));
  const byRef = refsOf(t).some((r) => changedSet.has(r));
  if (byName || byRef) tests.add(t);
}

// ZIVEX_VERIFY_PLAN=1 prints the plan instead of running it (used by the tests; handy for debugging).
if (process.env.ZIVEX_VERIFY_PLAN === "1") {
  const rel = (p) => relative(root, p).split("\\").join("/");
  process.stdout.write(
    JSON.stringify({ build: projects.map(rel).sort(), test: [...tests].map(rel).sort() }),
  );
  process.exit(0);
}

// Build only the affected projects (their dependents are built when their tests build).
for (const p of projects) {
  const r = run("dotnet", ["build", p, "--nologo", "-v", "q"]);
  if (!r.ok) fail(`dotnet build failed for ${p}:\n${tail(r.out)}`);
}
for (const t of tests) {
  const r = run("dotnet", ["test", t, "--nologo", "-v", "q"]);
  if (!r.ok) fail(`dotnet test failed for ${t}:\n${tail(r.out)}`);
}
process.exit(0);

function fail(message) {
  process.stderr.write(`${message}\n\nFix the failure, then finish. (verify-before-stop)\n`);
  process.exit(2);
}
