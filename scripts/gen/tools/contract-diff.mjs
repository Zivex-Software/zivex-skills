// Compares the public surface of a module's .Contracts project with a git ref and classifies the change:
// removed or changed public members are BREAKING, new ones are ADDITIVE. Heuristic text parser (types, members, record parameters, enum values).
// Usage: node contract-diff.mjs <module name | path to the Contracts folder> [--base <ref, default HEAD>] [--json] [--strict]
import { execFileSync } from "node:child_process";
//@@MODULES@@
const args = process.argv.slice(2);
const bi = args.indexOf("--base");
const base = bi >= 0 ? args[bi + 1] : "HEAD";
const target = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--base");
const cwd = resolve(process.cwd());
const git = (a) =>
  execFileSync("git", a, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
if (!target) {
  console.error("Usage: contract-diff.mjs <module name | contracts folder> [--base <ref>]");
  process.exit(2);
}
const top = resolve(git(["rev-parse", "--show-toplevel"]).trim());

let dir = resolve(cwd, target);
if (!existsSync(dir)) {
  const projects = readProjects(top);
  const c = projects.find(
    (p) => p.role === "contracts" && p.module?.toLowerCase() === target.toLowerCase(),
  );
  if (!c) {
    console.error(`No Contracts project found for "${target}".`);
    process.exit(2);
  }
  dir = c.dir;
}
if (dir.endsWith(".csproj")) dir = dirname(dir);
const relDir = posix(relative(top, dir));

// Signature extraction: tracks type nesting with brace depth; only public types and their public (or interface) members count.
function signatures(source) {
  const clean = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, ""));
  const out = new Set();
  const stack = [];
  let depth = 0;
  const norm = (s) =>
    s
      .replace(/\s+/g, " ")
      .replace(/([(<[])\s+/g, "$1")
      .replace(/\s+([)>\],])/g, "$1")
      .trim();
  const TYPE =
    /^\s*(?:(public|internal|private|protected)\s+)?(?:(?:sealed|static|abstract|partial|readonly|unsafe|new)\s+)*(class|interface|struct|enum|record(?:\s+(?:class|struct))?)\s+(\w+)/;
  for (const line of clean) {
    if (/^\s*\[.*\]\s*$/.test(line) || !line.trim()) continue;
    const t = TYPE.exec(line);
    const top = stack[stack.length - 1];
    if (t) {
      const isPublic = t[1] === "public" || (top?.kind === "interface" && !t[1] && top.public);
      const path = [...stack.map((s) => s.name), t[3]].join(".");
      const parentPublic = !top || top.public;
      const entry = {
        name: t[3],
        kind: t[2].split(" ")[0],
        public: isPublic && parentPublic,
        depth: null,
      };
      if (entry.public) out.add(`${path}: ${norm(line.replace(/\{.*$/, ""))}`);
      // Small enums are often written on one line: `enum Status { Open = 1, Closed = 2 }`.
      if (entry.public && entry.kind === "enum" && line.includes("{") && line.includes("}")) {
        for (const part of line.slice(line.indexOf("{") + 1, line.lastIndexOf("}")).split(",")) {
          const m = /^\s*(\w+)(?:\s*=\s*(.+?))?\s*$/.exec(part);
          if (m) out.add(`${path}: value ${m[1]}${m[2] ? ` ${m[2].trim()}` : ""}`);
        }
      }
      stack.push(entry);
    } else if (top?.public && top.depth !== null && depth === top.depth) {
      const text = line.trim();
      if (top.kind === "enum") {
        const v = /^(\w+)/.exec(text);
        if (v)
          out.add(
            `${stack.map((s) => s.name).join(".")}: value ${v[1]}${/=\s*[^,]+/.exec(text) ? ` ${/=\s*([^,]+)/.exec(text)[1].trim()}` : ""}`,
          );
      } else if (
        top.kind === "interface"
          ? /[;)]\s*$|\{\s*(get|set|init)/.test(text)
          : /^(public|protected)\b/.test(text)
      ) {
        let sig = text.includes("=>") ? text.split("=>")[0] : text;
        if (!/\{\s*(get|set|init)/.test(sig)) sig = sig.replace(/\{.*$/, "");
        sig = sig.replace(/\s=\s[^=>].*;$/, ";");
        out.add(`${stack.map((s) => s.name).join(".")}: ${norm(sig)}`);
      }
    }
    for (const ch of line) {
      if (ch === "{") {
        depth++;
        const pending = stack.find((s) => s.depth === null);
        if (pending) pending.depth = depth;
      } else if (ch === "}") {
        if (stack.length && stack[stack.length - 1].depth === depth) stack.pop();
        depth--;
      }
    }
    // a type declared with a primary constructor and ";" (record X(...);) opens no body
    if (t && /;\s*$/.test(line) && !/\{/.test(line)) stack.pop();
  }
  return out;
}

const current = new Set();
for (const f of walkFiles(dir))
  if (f.endsWith(".cs")) for (const s of signatures(tryRead(f) ?? "")) current.add(s);
const before = new Set();
let listing = "";
try {
  listing = git(["ls-tree", "-r", "--name-only", base, "--", relDir]);
} catch (e) {
  console.error(`Cannot read ${base}: ${String(e.stderr ?? e.message).trim()}`);
  process.exit(2);
}
for (const f of listing.split("\n").filter((x) => x.endsWith(".cs")))
  for (const s of signatures(git(["show", `${base}:${f}`]))) before.add(s);

const removed = [...before].filter((s) => !current.has(s)).sort();
const added = [...current].filter((s) => !before.has(s)).sort();
const owner = (s) => s.split(": ")[0];
const changed = removed.filter((s) => added.some((a) => owner(a) === owner(s)));
const result = {
  base,
  contracts: relDir,
  breaking: removed,
  additive: added,
  note: "Removed or changed public members are breaking for consumers; added members are additive (except new members on interfaces that consumers implement, and new required constructor parameters).",
};
if (args.includes("--json")) console.log(JSON.stringify(result, null, 2));
else {
  console.log(`# Contract diff: ${relDir} vs ${base}`);
  console.log(`\nBREAKING (${removed.length}): removed or changed`);
  for (const s of removed)
    console.log(`  - ${s}${changed.includes(s) ? "   [signature changed]" : ""}`);
  console.log(`\nADDITIVE (${added.length}):`);
  for (const s of added) console.log(`  + ${s}`);
  console.log(`\n${result.note}`);
  if (removed.length)
    console.log(
      "Update every consumer in the same change (search for the contract namespace) and say so in the PR.",
    );
}
if (args.includes("--strict") && removed.length) process.exit(1);
