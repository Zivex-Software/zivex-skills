// Inventory of the vertical slices in a repository: for every slice (a feature folder, or a single feature file) it shows which
// parts exist - endpoint, handler, validation, an authorization hint, a cancellation token - and whether any test mentions the slice.
// Heuristic (text based): it points at slices that look incomplete; confirm each in context.
// Usage: node slice-inventory.mjs [path] [--module <Name>] [--json] [--strict]
//   --strict: exit 1 when any slice has no endpoint-or-handler, no authorization hint or no test
//@@MODULES@@
const args = process.argv.slice(2);
const flagValue = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
const onlyModule = flagValue("--module");
const root = resolve(
  args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--module") ?? process.cwd(),
);
const projects = readProjects(root);
const modules = moduleNames(projects);
const ROOT_NAMES = /^(features|usecases|slices)$/i;
const MAPPING = /\.Map(Get|Post|Put|Delete|Patch)\s*\(|static\s+void\s+Map\s*\(|\bIFeature\b/;
const HANDLER = /HandleAsync\s*\(|class\s+\w*Handler\b/;
const csOf = (dir) => [...walkFiles(dir)].filter((f) => f.endsWith(".cs"));
const text = (f) => tryRead(f) ?? "";

const scope = projects.filter(
  (p) => p.role === "impl" && (!onlyModule || p.module?.toLowerCase() === onlyModule.toLowerCase()),
);
const testFiles = projects
  .filter((p) => p.role === "test")
  .map((p) => ({ module: p.module, files: csOf(p.dir).map((f) => ({ path: f, text: text(f) })) }));

function* dirsNamed(dir, depth = 0) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory() || SKIP_DIRS.has(e.name) || depth > 12) continue;
    if (ROOT_NAMES.test(e.name)) yield join(dir, e.name);
    else yield* dirsNamed(join(dir, e.name), depth + 1);
  }
}

const slices = [];
for (const project of scope) {
  for (const rootDir of dirsNamed(project.dir)) {
    const add = (name, group, files) =>
      slices.push({
        module: project.module ?? "(none)",
        project: project.name,
        slice: name,
        group,
        files,
      });
    for (const e of readdirSync(rootDir, { withFileTypes: true })) {
      const path = join(rootDir, e.name);
      if (e.isFile() && e.name.endsWith(".cs")) {
        if (MAPPING.test(text(path)) || HANDLER.test(text(path)))
          add(basename(e.name, ".cs"), "", [path]);
        continue;
      }
      if (!e.isDirectory() || SKIP_DIRS.has(e.name)) continue;
      const files = csOf(path);
      const mapped = files.filter((f) => MAPPING.test(text(f)));
      // Features/<Module>/<Action>.cs: several mapped files in one folder are separate slices; otherwise the folder is the slice.
      if (mapped.length >= 2) for (const f of mapped) add(basename(f, ".cs"), e.name, [f]);
      else if (files.length) add(e.name, "", files);
    }
  }
}

const mentions = (name, module) => {
  // The slice name may continue with an uppercase letter or a non-letter (CancelOrderTests, CancelOrderHandlerTests, CancelOrder_x) but not a lowercase one (CancelOrders).
  const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z])`);
  const pool = testFiles.filter(
    (t) => !module || t.module === module || t.module == null || !modules.length,
  );
  return pool.flatMap((t) => t.files).filter((f) => re.test(f.text) || re.test(basename(f.path)))
    .length;
};

const rows = slices.map((s) => {
  const body = s.files.map(text).join("\n");
  const row = {
    module: s.module,
    slice: s.slice,
    group: s.group || undefined,
    files: s.files.map((f) => posix(relative(root, f))),
    endpoint: MAPPING.test(body),
    handler: HANDLER.test(body),
    validation: /Validator|Validate\s*\(|ValidationProblem|DataAnnotations|\[Required/.test(body),
    authorization:
      /RequireAuthorization|RequireModule|\[Authorize|Capabilities|EnsureAsync|AuthorizeAsync|AllowAnonymous/.test(
        body,
      ),
    cancellation: /CancellationToken|\bct\b/.test(body),
    tests: mentions(s.slice, s.module === "(none)" ? undefined : s.module),
  };
  const hasInput = /record\s+\w*(Request|Command|Input)\b/.test(body);
  row.missing = [
    !row.endpoint && !row.handler && "endpoint or handler",
    !row.authorization && "authorization",
    hasInput && !row.validation && "validation",
    !row.cancellation && "cancellation token",
    row.tests === 0 && "tests",
  ].filter(Boolean);
  return row;
});

if (args.includes("--json")) console.log(JSON.stringify({ modules, slices: rows }, null, 2));
else if (!rows.length)
  console.log(
    `No Features, UseCases or Slices folder with slices found${onlyModule ? ` for module ${onlyModule}` : ""}: this code may not use vertical slices.`,
  );
else {
  const yes = (b) => (b ? "yes" : " - ");
  console.log(`${"module".padEnd(14)} ${"slice".padEnd(30)} endpt hndlr valid  auth cancel tests`);
  for (const r of rows) {
    console.log(
      `${r.module.padEnd(14)} ${(r.group ? `${r.group}/${r.slice}` : r.slice).padEnd(30)} ${yes(r.endpoint).padStart(5)} ${yes(r.handler).padStart(5)} ${yes(r.validation).padStart(5)} ${yes(r.authorization).padStart(5)} ${yes(r.cancellation).padStart(6)} ${String(r.tests).padStart(5)}`,
    );
  }
  const weak = rows.filter((r) => r.missing.length);
  console.log(
    `\n${rows.length} slice(s), ${weak.length} with gaps (heuristic: confirm in context):`,
  );
  for (const r of weak)
    console.log(
      `  ${r.group ? `${r.group}/` : ""}${r.slice} (${r.module}): missing ${r.missing.join(", ")}`,
    );
}
if (
  args.includes("--strict") &&
  rows.some((r) =>
    r.missing.some((m) => ["endpoint or handler", "authorization", "tests"].includes(m)),
  )
)
  process.exit(1);
