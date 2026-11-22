const RULES = [
  {
    id: "API001",
    level: "high",
    re: /(Results\.\w+|return\s+(Ok|BadRequest|Problem|StatusCode|Json|Content)|WriteAsync)\s*\([^;]*\b(ex|e|exception)\.(Message|StackTrace|ToString\s*\()/,
    msg: "Exception details returned to the client (information disclosure)",
    fix: "Log the exception server-side; return a ProblemDetails with a generic title and a correlation/trace id.",
  },
  {
    id: "API002",
    level: "medium",
    project: (files) => {
      const prog = files.find(
        (f) => f.cs && /WebApplication\.Create(Builder|SlimBuilder)/.test(f.text),
      );
      return prog &&
        !/UseExceptionHandler|AddExceptionHandler/.test(prog.text) &&
        !anyFile(files, /UseExceptionHandler/)
        ? [{ file: prog.rel }]
        : [];
    },
    msg: "No global exception handling (UseExceptionHandler / IExceptionHandler)",
    fix: "Add AddProblemDetails() + AddExceptionHandler<T>() and app.UseExceptionHandler(); map domain errors to status codes in one place.",
  },
  {
    id: "API003",
    level: "medium",
    project: (files) => {
      const prog = files.find(
        (f) => f.cs && /WebApplication\.Create(Builder|SlimBuilder)/.test(f.text),
      );
      return prog &&
        anyFile(files, /\.Map(Get|Post|Put|Delete|Patch)\s*\(|\[ApiController\]/) &&
        !anyFile(files, /AddProblemDetails/)
        ? [{ file: prog.rel }]
        : [];
    },
    msg: "ProblemDetails not registered; errors will not use RFC 9457 bodies",
    fix: "builder.Services.AddProblemDetails() so errors and status-code pages return application/problem+json.",
  },
  {
    id: "API004",
    level: "low",
    re: /public\s+async\s+Task<[^>]*>\s+\w+\s*\((?![^)]*CancellationToken)[^)]*\)/,
    msg: "Async action without a CancellationToken parameter",
    fix: "Accept CancellationToken (bound to RequestAborted) and pass it to EF/HttpClient calls.",
  },
  {
    id: "API005",
    level: "low",
    re: /\[Route\(\s*"[^"]*\/(get|create|delete|update|add|remove|list)\w*[/"]/i,
    msg: "Verb in the route",
    fix: "Use nouns in routes; the HTTP method is the verb.",
  },
  {
    id: "API006",
    level: "medium",
    re: /\[FromBody\]\s*(Dictionary<|object\b|dynamic\b|JsonElement\b)/,
    msg: "Untyped request body",
    fix: "Bind to a dedicated request record with validation attributes; reject unknown fields if you need strictness.",
  },
  {
    id: "API007",
    level: "medium",
    re: /(return\s+Ok\s*\(|Results\.Ok\s*\(|TypedResults\.Ok\s*\()\s*(await\s+)?[\w.]*(_?db|_?context|_?dbContext)\.[\w.]+\s*(\.ToListAsync\s*\(\s*\))?\s*\)/,
    msg: "Endpoint returns persistence entities directly (over-posting/over-exposure risk)",
    fix: "Return DTOs via Select(...) so only intended fields leave the service; never bind entities from the request.",
  },
  {
    id: "API008",
    level: "low",
    re: /StatusCode\s*\(\s*500\s*\)|StatusCodes\.Status500InternalServerError/,
    msg: "Handler returns 500 explicitly",
    fix: "Let the exception handler produce 500 (with ProblemDetails); return 4xx for caller errors.",
  },
  {
    id: "API009",
    level: "low",
    project: (files) => {
      const prog = files.find(
        (f) => f.cs && /AddOpenApi|AddSwaggerGen|UseSwagger|MapOpenApi/.test(f.text),
      );
      return prog &&
        /(UseSwagger|MapOpenApi)\s*\(/.test(prog.text) &&
        !/IsDevelopment\s*\(/.test(prog.text)
        ? [{ file: prog.rel }]
        : [];
    },
    msg: "OpenAPI/Swagger exposed without an IsDevelopment() guard",
    fix: "Expose the document only in development, or protect it with authorization.",
  },
];
