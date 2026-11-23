#!/usr/bin/env node
// Security inventory for an ASP.NET Core repo: pipeline order, endpoint/authorization map, ownership-check candidates, vulnerable packages.
// Heuristic (text-based). It builds the map you audit from; it does not prove anything is secure.
// Usage: node audit.mjs [path] [--json] [--no-packages] [--thorough]   (--thorough also lists weak ownership candidates)
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const args = process.argv.slice(2);
const root = args.find((a) => !a.startsWith("--")) ?? process.cwd();
const SKIP = new Set(["bin", "obj", "node_modules", ".git", ".vs", "TestResults"]);
const isTest = (rel) => /(^|[\\/])[^\\/]*\.?tests?([\\/]|\.)/i.test(rel);

const files = [];
(function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (!SKIP.has(e.name)) walk(join(dir, e.name));
    } else if (e.name.endsWith(".cs")) {
      const rel = relative(root, join(dir, e.name)).split("\\").join("/");
      if (!isTest(rel)) files.push({ rel, text: readFileSync(join(dir, e.name), "utf8") });
    }
  }
})(root);

const report = {
  pipeline: [],
  endpoints: [],
  ownership: [],
  ownershipWeak: 0,
  ownershipStrongTotal: 0,
  packages: { status: "skipped", lines: [] },
};
const lineOf = (text, i) => text.slice(0, i).split("\n").length;

// 1. Pipeline order. Each pair [a, b] means "a must appear before b" (Microsoft Learn: middleware order, CORS, rate limiting, antiforgery, output caching, forwarded headers).
const ORDER = [
  [
    "UseForwardedHeaders",
    "UseHsts",
    "forwarded headers must run before HSTS/redirects so scheme and host are right",
  ],
  [
    "UseExceptionHandler",
    "UseAuthentication",
    "exception handler should wrap the rest of the pipeline",
  ],
  ["UseRouting", "UseCors", "UseCors goes after UseRouting"],
  ["UseCors", "UseAuthorization", "UseCors goes before UseAuthorization"],
  ["UseRouting", "UseRateLimiter", "endpoint-specific rate limits need UseRouting first"],
  ["UseAuthentication", "UseAuthorization", "authenticate before authorizing"],
  [
    "UseAuthorization",
    "UseAntiforgery",
    "UseAntiforgery goes after authentication and authorization",
  ],
  [
    "UseAuthorization",
    "UseOutputCache",
    "output cache must come after CORS, routing, authentication and authorization",
  ],
  [
    "UseResponseCompression",
    "UseStaticFiles",
    "compression must precede middleware that writes compressible responses",
  ],
];
const prog = files.find((f) => /WebApplication\.Create(Builder|SlimBuilder)/.test(f.text));
if (!prog)
  report.pipeline.push({
    level: "info",
    msg: "No WebApplication Program.cs found; pipeline checks skipped.",
  });
else {
  const calls = [...prog.text.matchAll(/\.\s*(Use[A-Za-z]+)\s*\(/g)].map((m) => ({
    name: m[1],
    line: lineOf(prog.text, m.index),
  }));
  const at = (n) => calls.find((c) => c.name === n);
  for (const [a, b, why] of ORDER) {
    if (at(a) && at(b) && at(a).line > at(b).line)
      report.pipeline.push({
        level: "high",
        file: prog.rel,
        line: at(b).line,
        msg: `${a} must come before ${b}: ${why}`,
      });
  }
  for (const [n, why] of [
    ["UseHttpsRedirection", "HTTP is not redirected (or the API should not listen on HTTP)"],
    [
      "UseAuthentication",
      "no authentication middleware (fine only if every auth scheme is added elsewhere)",
    ],
    ["UseAuthorization", "no authorization middleware"],
  ]) {
    if (!at(n))
      report.pipeline.push({ level: "medium", file: prog.rel, msg: `${n} not found: ${why}` });
  }
  if (!at("UseHsts") && !/IsDevelopment/.test(prog.text))
    report.pipeline.push({
      level: "low",
      file: prog.rel,
      msg: "UseHsts not found (production, browser-facing apps)",
    });
  if (!/AddRateLimiter|UseRateLimiter/.test(prog.text))
    report.pipeline.push({
      level: "low",
      file: prog.rel,
      msg: "No rate limiting configured (login, token and expensive endpoints)",
    });
}

// 2. Endpoint and authorization map.
// Authorization can sit on the endpoint, on the route group it belongs to, in a fallback policy, or inside the use case
// (EnsureAsync/AuthorizeAsync). The map follows groups declared in the same file; a group handed in from another file is "unknown".
const fallback = files.some((f) => /SetFallbackPolicy|FallbackPolicy\s*=/.test(f.text));
const AUTHISH =
  /Require(Authorization|Module|Permission|Capability|Role|Policy|Scope|Claim)\w*\s*\(|\[Authorize/;
const ROOT_NAMES = new Set(["app", "endpoints", "routes", "builder", "host"]);
report.inCodeChecks = files.filter((f) =>
  /\b(EnsureAsync|AuthorizeAsync)\b|Capabilities\./.test(f.text),
).length;
for (const f of files) {
  const classAuth =
    /\[Authorize\b[^\]]*\]\s*(\[[^\]]*\]\s*)*(public\s+)?(sealed\s+|abstract\s+)*class\b/.test(
      f.text,
    );
  // var x = parent.MapGroup("/path")....;  ->  state of x: "auth" | "anon" | "none" | "unknown" (parent not resolvable)
  const groups = new Map();
  for (const g of f.text.matchAll(
    /(?:var|RouteGroupBuilder|IEndpointRouteBuilder)\s+(\w+)\s*=\s*(\w+)\s*\.\s*MapGroup\s*\([^;]*?;/gs,
  )) {
    const parent = groups.get(g[2]) ?? (ROOT_NAMES.has(g[2]) ? "none" : "unknown");
    groups.set(g[1], AUTHISH.test(g[0]) ? "auth" : /AllowAnonymous/.test(g[0]) ? "anon" : parent);
  }
  for (const m of f.text.matchAll(/\.Map(Get|Post|Put|Delete|Patch)\s*\(\s*"([^"]*)"([^;]*?);/gs)) {
    const tail = m[3];
    const receiver = /(\w+)\s*$/.exec(f.text.slice(0, m.index))?.[1];
    const state = groups.get(receiver) ?? (ROOT_NAMES.has(receiver) ? "none" : "unknown");
    const auth = AUTHISH.test(tail)
      ? "authorized"
      : /AllowAnonymous/.test(tail)
        ? "anonymous (explicit)"
        : state === "auth"
          ? "authorized (group)"
          : state === "anon"
            ? "anonymous (explicit, group)"
            : fallback
              ? "fallback policy"
              : state === "unknown"
                ? "unknown (group set elsewhere)"
                : "NONE";
    report.endpoints.push({
      file: f.rel,
      line: lineOf(f.text, m.index),
      route: `${m[1].toUpperCase()} ${m[2]}`,
      auth,
    });
  }
  for (const m of f.text.matchAll(
    /((?:\[[^\]\n]+\]\s*)*)public\s+(?:async\s+)?[\w<>[\],.? ]+\s+(\w+)\s*\(/g,
  )) {
    const attrs = m[1];
    const verb = /\[Http(Get|Post|Put|Delete|Patch)/.exec(attrs);
    if (!verb) continue;
    const auth = /\[AllowAnonymous/.test(attrs)
      ? "anonymous (explicit)"
      : /\[Authorize/.test(attrs) || classAuth
        ? "authorized"
        : fallback
          ? "fallback policy"
          : "NONE";
    report.endpoints.push({
      file: f.rel,
      line: lineOf(f.text, m.index),
      route: `${verb[1].toUpperCase()} ${m[2]}`,
      auth,
    });
  }
}

// 3. Vulnerable packages (needs the dotnet SDK and network access to NuGet).
if (!args.includes("--no-packages")) {
  try {
    const out = execFileSync(
      "dotnet",
      ["list", root, "package", "--vulnerable", "--include-transitive"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 180_000 },
    );
    report.packages = {
      status: "ok",
      lines: out
        .split("\n")
        .filter((l) => /^\s*>\s|has the following vulnerable packages/.test(l))
        .map((l) => l.trim()),
    };
    if (!report.packages.lines.length) report.packages.lines = ["No vulnerable packages reported."];
  } catch (e) {
    report.packages = {
      status: "unavailable",
      lines: [String(e.code === "ENOENT" ? "dotnet SDK not found" : e.message).split("\n")[0]],
    };
  }
}

// 4. Ownership candidates: an entity is loaded by an id from the caller and nothing nearby mentions a tenant, owner, user or
// authorization check. Broken object-level authorization is the most common API flaw. A global query filter or a check in another
// layer makes a hit a false positive: confirm in context.
const LOAD =
  /\b(FindAsync|FirstOrDefaultAsync|SingleOrDefaultAsync|FirstAsync|SingleAsync|GetByIdAsync)\s*\(/;
const BY_ID = /\b(id|\w+Id)\b/;
const GUARD =
  /TenantId|[Tt]enant|OwnerId|ownerId|UserId|userId|AccountId|ClaimsPrincipal|\bUser\b|AuthorizeAsync|EnsureAsync|Capabilities|CurrentUser/;
// The guard may sit anywhere in the same method (typically its first statement), so look from the method signature to the next one.
const SIGNATURE = /^\s*(public|private|protected|internal)\b[^;={]*\(/;
const methodWindow = (lines, i) => {
  let start = i;
  while (start > 0 && i - start < 80 && !SIGNATURE.test(lines[start])) start--;
  let end = i + 1;
  while (end < lines.length && end - i < 80 && !SIGNATURE.test(lines[end])) end++;
  return lines.slice(start, end).join("\n");
};
// Global query filters (tenant or owner) make a load by id tenant-scoped even without a predicate in the method.
report.globalFilters = files.filter((f) => /HasQueryFilter\s*\(/.test(f.text)).length;
for (const f of files) {
  const lines = f.text.split("\n");
  lines.forEach((l, i) => {
    if (l.trimStart().startsWith("//") || !LOAD.test(l) || !BY_ID.test(l)) return;
    if (GUARD.test(methodWindow(lines, i))) return;
    // Strong: no guard hint anywhere in the file. Weak: a guard exists elsewhere in the file (often the public method calling this helper).
    const strong = !GUARD.test(f.text);
    if (!strong) report.ownershipWeak++;
    else report.ownershipStrongTotal++;
    if ((strong || args.includes("--thorough")) && report.ownership.length < 50)
      report.ownership.push({
        file: f.rel,
        line: i + 1,
        text: l.trim().slice(0, 120),
        strength: strong ? "strong" : "weak",
      });
  });
}

if (args.includes("--json")) console.log(JSON.stringify(report, null, 2));
else {
  console.log("## Pipeline");
  for (const p of report.pipeline)
    console.log(`${p.level.toUpperCase()}  ${p.file ?? ""}${p.line ? `:${p.line}` : ""}  ${p.msg}`);
  if (!report.pipeline.length) console.log("No ordering problems found.");
  console.log("\n## Endpoints");
  for (const e of report.endpoints)
    console.log(
      `${e.auth === "NONE" ? "!! " : "   "}${e.route.padEnd(36)} ${e.auth.padEnd(22)} ${e.file}:${e.line}`,
    );
  if (!report.endpoints.length) console.log("No endpoints found.");
  console.log(
    `Authorization is also enforced inside use cases (EnsureAsync/AuthorizeAsync/Capabilities) in ${report.inCodeChecks} file(s); "NONE" only means there is no endpoint-, group- or fallback-level policy.`,
  );
  console.log(
    "\n## Ownership-check candidates (a load by id with no tenant/owner/user/authorization hint nearby)",
  );
  for (const o of report.ownership) console.log(`   ${o.file}:${o.line}  ${o.text}`);
  if (!report.ownership.length) console.log("None found.");
  if (report.ownershipStrongTotal > report.ownership.length && !args.includes("--thorough"))
    console.log(
      `Showing ${report.ownership.length} of ${report.ownershipStrongTotal} strong candidates.`,
    );
  if (report.ownershipWeak && !args.includes("--thorough"))
    console.log(
      `${report.ownershipWeak} weaker candidate(s) not listed: a guard exists elsewhere in the same file (run with --thorough to list them).`,
    );
  console.log(
    `Global query filters (HasQueryFilter) are configured in ${report.globalFilters} file(s): where they cover tenant or owner, a load by id is already scoped, so only per-user ownership still needs a check.`,
  );
  console.log(`\n## Packages (${report.packages.status})`);
  for (const l of report.packages.lines) console.log(l);
}
