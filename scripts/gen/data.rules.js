const RULES = [
  {
    id: "EF001",
    level: "high",
    fn: (text) =>
      linesInLoops(text).filter((n) =>
        /\bawait\s+[\w.]*(db|Db|context|Context|ctx|dbContext|_db|_context)\w*\.[\w.]*(FirstOrDefault|First|Single|SingleOrDefault|Find|ToList|Any|Count|Sum|Max|Min|Contains)Async\b|\bawait\s+[\w.]*(db|Db|context|Context|ctx)\w*\.[\w.]+\.(FirstOrDefault|Single|ToList|Any|Count)Async\b/.test(
          text.split("\n")[n - 1],
        ),
      ),
    msg: "Database query inside a loop (N+1)",
    fix: "Load once: Include / projection with Select, or one query with Where(ids.Contains(x.Id)), then group in memory.",
  },
  {
    id: "EF002",
    level: "high",
    re: /(FromSqlRaw|ExecuteSqlRaw|SqlQueryRaw)\s*\(\s*(\$@?"|@?\$"|"[^"]*"\s*\+)/,
    msg: "Raw SQL built by interpolation or concatenation",
    fix: "FromSql/ExecuteSql with an interpolated string parameterise values; FromSqlRaw needs explicit DbParameters. Column and table names cannot be parameterised: allow-list them.",
  },
  {
    id: "EF003",
    level: "medium",
    re: /\.(Database\.)?Migrate(Async)?\s*\(\s*(\w+)?\s*\)/,
    msg: "Migrations applied from application code",
    fix: "For production prefer a migration bundle or reviewed SQL script run as one deployment job (every replica must not migrate at startup).",
  },
  {
    id: "EF004",
    level: "medium",
    re: /EnableSensitiveDataLogging\s*\(/,
    msg: "Sensitive data logging enabled",
    fix: "Development only: it writes parameter values and data into logs.",
  },
  {
    id: "EF005",
    level: "high",
    re: /AddSingleton\s*<[^>]*DbContext|static\s+\w*DbContext\s+\w+\s*(=|;)/,
    msg: "DbContext with singleton/static lifetime (not thread-safe)",
    fix: "Register with AddDbContext (scoped) or AddDbContextPool; use IDbContextFactory in singletons and background services.",
  },
  {
    id: "EF006",
    level: "medium",
    re: /\.IgnoreQueryFilters\s*\(\s*\)/,
    msg: "All query filters ignored (tenant/soft-delete leakage)",
    fix: "Ignore only the named filter you need (EF 10 named filters) and re-apply tenant checks explicitly.",
  },
  {
    id: "EF007",
    level: "medium",
    re: /\b(_?db|_?context|_?dbContext|ctx)\.SaveChanges\s*\(\s*\)/,
    msg: "Synchronous SaveChanges",
    fix: "await SaveChangesAsync(cancellationToken).",
  },
  {
    id: "EF008",
    level: "low",
    multi: /\.Skip\s*\([^)]*\)\s*\.Take\s*\(/g,
    msg: "Offset pagination (Skip/Take)",
    fix: "Fine for small, bounded sets. For large or infinite lists use keyset pagination with a unique ordering.",
  },
  {
    id: "EF010",
    level: "medium",
    project: (files) => {
      const retry = firstFile(files, /EnableRetryOnFailure/);
      const tx = firstFile(files, /BeginTransaction(Async)?\s*\(/);
      return retry && tx && !anyFile(files, /CreateExecutionStrategy/) ? [{ file: tx.rel }] : [];
    },
    msg: "EnableRetryOnFailure with user transactions but no CreateExecutionStrategy",
    fix: "Wrap the whole transaction in db.Database.CreateExecutionStrategy().ExecuteAsync(...); retrying strategies reject user-initiated transactions.",
  },
  {
    id: "EF011",
    level: "medium",
    fn: (text) =>
      /ExecuteUpdate(Async)?\s*\(|ExecuteDelete(Async)?\s*\(/.test(text) &&
      /SaveChanges(Async)?\s*\(/.test(text)
        ? [text.split("\n").findIndex((l) => /ExecuteUpdate|ExecuteDelete/.test(l)) + 1]
        : [],
    msg: "ExecuteUpdate/ExecuteDelete mixed with SaveChanges in one file",
    fix: "Bulk operations bypass the change tracker and run in their own transactions; do not mix on tracked entities, and add a concurrency token to the Where.",
  },
  {
    id: "EF012",
    level: "low",
    multi: /(\.Include\s*\([^;]*?){3,}/g,
    msg: "Three or more Include calls in one query (cartesian explosion)",
    fix: "Project with Select, or AsSplitQuery() (accept the consistency trade-off).",
  },
];
