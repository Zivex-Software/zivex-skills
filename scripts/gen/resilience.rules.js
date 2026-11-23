const RULES = [
  {
    id: "RES001",
    level: "medium",
    re: /\bnew\s+HttpClient\s*\(/,
    msg: "HttpClient created directly (no pooling, no resilience handler)",
    fix: "Register with AddHttpClient and AddStandardResilienceHandler().",
  },
  {
    id: "RES002",
    level: "medium",
    project: (files) => {
      const f = firstFile(files, /\.AddHttpClient\s*[<(]/);
      return f &&
        !anyFile(
          files,
          /AddStandardResilienceHandler|AddStandardHedgingHandler|AddResilienceHandler|AddPolicyHandler/,
        )
        ? [{ file: f.rel }]
        : [];
    },
    msg: "HttpClients registered but no resilience handler anywhere",
    fix: "Add .AddStandardResilienceHandler() (timeouts, retry, circuit breaker) from Microsoft.Extensions.Http.Resilience.",
  },
  {
    id: "RES003",
    level: "medium",
    project: (files) => {
      const f = firstFile(files, /AddStandardResilienceHandler|AddStandardHedgingHandler/);
      return f &&
        !anyFile(
          files,
          /DisableForUnsafeHttpMethods|Retry\.DisableFor|DisableFor\s*\(\s*HttpMethod/,
        )
        ? [{ file: f.rel }]
        : [];
    },
    msg: "Standard resilience handler retries ALL methods unless told otherwise (POST/PUT/PATCH/DELETE too)",
    fix: "options.Retry.DisableForUnsafeHttpMethods() unless the downstream call is idempotent (idempotency key).",
  },
  {
    id: "RES004",
    level: "medium",
    re: /\.Timeout\s*=\s*(Timeout\.InfiniteTimeSpan|TimeSpan\.MaxValue|System\.Threading\.Timeout\.InfiniteTimeSpan)/,
    msg: "Infinite HTTP timeout",
    fix: "Set a finite per-attempt and total timeout (resilience handler) and pass the request CancellationToken.",
  },
  {
    id: "RES005",
    level: "medium",
    multi: /catch\s*(\([^)]*\))?\s*\{\s*\}/g,
    msg: "Empty catch swallows failures",
    fix: "Handle, log with the exception object, or rethrow; swallow only a specific, documented exception type.",
  },
  {
    id: "RES006",
    level: "low",
    re: /\bTask\.Delay\s*\(\s*[^,()]*(\([^)]*\))?[^,()]*\)\s*[;)]/,
    msg: "Task.Delay without a CancellationToken",
    fix: "Pass stoppingToken so shutdown is not delayed.",
  },
  {
    id: "RES007",
    level: "medium",
    re: /^\s*_\s*=\s*(Task\.Run\s*\(|\w[\w.]*Async\s*\()/,
    msg: "Fire-and-forget task (failures unobserved, lost on shutdown)",
    fix: "Use a hosted BackgroundService with a Channel<T> queue, or await it.",
  },
  {
    id: "RES008",
    level: "medium",
    fn: (text) =>
      /:\s*BackgroundService\b/.test(text) &&
      /ExecuteAsync/.test(text) &&
      !/catch\s*(\(|\{)/.test(text)
        ? [text.split("\n").findIndex((l) => /ExecuteAsync/.test(l)) + 1]
        : [],
    msg: "BackgroundService.ExecuteAsync without any catch (one failure stops the host or the loop silently)",
    fix: "Catch and log per iteration, honour stoppingToken, and decide the BackgroundServiceExceptionBehavior deliberately.",
  },
  {
    id: "RES009",
    level: "medium",
    fn: (text) =>
      /:\s*BackgroundService\b/.test(text)
        ? text
            .split("\n")
            .flatMap((l, i) =>
              /private\s+readonly\s+\w*DbContext\b/.test(l) ||
              (!/Create(Async)?Scope\s*\(/.test(text) &&
                /GetRequiredService\s*<\s*\w*(DbContext|Repository)\w*\s*>/.test(l))
                ? [i + 1]
                : [],
            )
        : [],
    msg: "Scoped service (DbContext) used from a BackgroundService singleton",
    fix: "Inject IServiceScopeFactory (or IDbContextFactory) and create a scope per unit of work.",
  },
  {
    id: "RES010",
    level: "low",
    re: /\bwhile\s*\(\s*true\s*\)/,
    msg: "while (true) loop",
    fix: "Loop on !stoppingToken.IsCancellationRequested (or PeriodicTimer) so the service stops cleanly.",
  },
];
