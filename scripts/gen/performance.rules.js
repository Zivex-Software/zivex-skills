const RULES = [
  {
    id: "PERF001",
    level: "high",
    re: /^(?!.*\b(RuleFor|Result)\s*[(<]).*\.(Result|Wait\s*\(\s*\)|GetAwaiter\s*\(\s*\)\.GetResult\s*\(\s*\))(?![\w(>])/,
    msg: "Blocking on a Task (thread-pool starvation, deadlocks); ignore if .Result is a plain property",
    fix: "Make the call chain async and await it.",
  },
  {
    id: "PERF002",
    level: "high",
    re: /\basync\s+void\b(?!.*(object\s+sender|EventArgs))/,
    msg: "async void (unobservable exceptions)",
    fix: "Return Task; async void is only for event handlers.",
  },
  {
    id: "PERF003",
    level: "medium",
    re: /\bnew\s+HttpClient\s*\(/,
    msg: "HttpClient created directly (socket exhaustion / stale DNS)",
    fix: "Use IHttpClientFactory (typed or named client) or a shared SocketsHttpHandler with PooledConnectionLifetime.",
  },
  {
    id: "PERF004",
    level: "medium",
    re: /\.(ToList|ToArray)\s*\(\s*\)\s*\.(Where|Select|Count|Any|First|FirstOrDefault|OrderBy|Skip|Take)\b|\.AsEnumerable\s*\(\s*\)\s*\.Where\b/,
    msg: "Materialising a sequence before filtering or counting",
    fix: "Filter/project/count in the query (database) and materialise once at the end.",
  },
  {
    id: "PERF005",
    level: "medium",
    re: /\bThread\.Sleep\s*\(/,
    msg: "Thread.Sleep on a server thread",
    fix: "await Task.Delay(..., cancellationToken) in async code.",
  },
  {
    id: "PERF006",
    level: "medium",
    fn: (text) =>
      text
        .split("\n")
        .flatMap((l, i) =>
          /Request\.Form\s*\[/.test(l) ||
          (/Request\.Body/.test(text) && /\.ReadToEnd\s*\(\s*\)/.test(l))
            ? [i + 1]
            : [],
        ),
    msg: "Synchronous request body/form read (Kestrel disallows sync IO)",
    fix: "Use ReadToEndAsync / ReadFormAsync / ReadFromJsonAsync.",
  },
  {
    id: "PERF007",
    level: "medium",
    re: /\bGC\.Collect\s*\(/,
    msg: "Explicit GC.Collect",
    fix: "Remove; fix the allocation pattern or GC settings instead.",
  },
  {
    id: "PERF008",
    level: "medium",
    re: /^\s*(private|protected|internal|public)\s+(readonly\s+)?HttpContext\??\s+_?\w+\s*;/,
    msg: "HttpContext stored in a field (not thread-safe, outlives the request)",
    fix: "Pass the data you need; resolve per request; use IHttpContextAccessor only at the point of use.",
  },
  {
    id: "PERF009",
    level: "low",
    re: /\bnew\s+JsonSerializerOptions\s*\(/,
    msg: "JsonSerializerOptions created at call site",
    fix: "Create once (static readonly) or use ConfigureHttpJsonOptions; options caches metadata per instance.",
  },
  {
    id: "PERF010",
    level: "low",
    re: /\bnew\s+Regex\s*\(|\bRegex\.(IsMatch|Match|Matches|Replace)\s*\(/,
    msg: "Regex on a possibly hot path",
    fix: "Use [GeneratedRegex] (source generated) and a match timeout.",
  },
  {
    id: "PERF011",
    level: "low",
    fn: (text) =>
      /\bIMemoryCache\b/.test(text)
        ? text.split("\n").flatMap((l, i) => (/\.GetOrCreate(Async)?\s*\(/.test(l) ? [i + 1] : []))
        : [],
    msg: "IMemoryCache.GetOrCreate is not atomic (factory can run many times)",
    fix: "Use HybridCache.GetOrCreateAsync for stampede protection.",
  },
  {
    id: "PERF012",
    level: "low",
    re: /\bTask\.Run\s*\(\s*(async\s*)?(\(\s*\)\s*=>|\w+\s*=>)?[^;]*\)\s*\.?(Result|Wait)/,
    msg: "Task.Run then blocking",
    fix: "Await the work directly; do not wrap async work in Task.Run.",
  },
  {
    id: "PERF013",
    level: "medium",
    fn: (text) =>
      linesInLoops(text).filter((n) =>
        /\bawait\s+[\w.]*(Http|client|Client)\w*\.(Get|Post|Put|Send|Delete)\w*Async\s*\(/.test(
          text.split("\n")[n - 1],
        ),
      ),
    msg: "Sequential HTTP call inside a loop",
    fix: "Batch the call, or run bounded-parallel with Parallel.ForEachAsync / Task.WhenAll plus a limit.",
  },
  {
    id: "PERF014",
    level: "medium",
    project: (files) => {
      const f = files.find(
        (x) => x.cs && /WebApplication\.Create|AddControllers|AddEndpointsApiExplorer/.test(x.text),
      );
      return f &&
        !anyFile(
          files,
          /AddHybridCache|AddOutputCache|AddResponseCaching|AddMemoryCache|AddDistributedMemoryCache|AddStackExchangeRedisCache/,
        )
        ? [{ file: f.rel }]
        : [];
    },
    msg: "No caching registered anywhere in this web app",
    fix: "Add HybridCache for expensive reads and output caching for cacheable GET responses; measure first.",
  },
];
