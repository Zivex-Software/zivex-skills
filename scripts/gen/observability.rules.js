const RULES = [
  {
    id: "OBS001",
    level: "medium",
    re: /\bLog(Trace|Debug|Information|Warning|Error|Critical)\s*\(\s*\$@?"/,
    msg: "Interpolated string in a log call (loses structure, allocates when disabled)",
    fix: 'Use a message template: LogInformation("Order {OrderId} paid", id); or [LoggerMessage] source generation.',
  },
  {
    id: "OBS002",
    level: "medium",
    re: /\bLog(Error|Warning|Critical)\s*\(\s*(?!ex\b|e\b|exception\b|\w*Exception\b)[^;]*\b(ex|e|exception)\.Message\b/,
    msg: "Exception logged by message only (stack trace lost)",
    fix: 'Pass the exception first: LogError(ex, "Failed to {Action}", action);',
  },
  {
    id: "OBS003",
    level: "high",
    re: /\bLog(Trace|Debug|Information|Warning|Error|Critical)\s*\([^;]*\b(password|passwd|secret|bearer|authorization|apikey|access_token)\b/i,
    msg: "Log call mentions a credential-like value",
    fix: "Never log credentials/tokens; log ids and redact.",
  },
  {
    id: "OBS004",
    level: "low",
    re: /\bConsole\.(Write|WriteLine)\s*\(/,
    msg: "Console output instead of ILogger",
    fix: "Use ILogger<T> so output is structured, levelled and exported.",
  },
  {
    id: "OBS005",
    level: "medium",
    project: (files) => {
      const prog = files.find(
        (f) => f.cs && /WebApplication\.Create(Builder|SlimBuilder)/.test(f.text),
      );
      return prog && !anyFile(files, /MapHealthChecks|AddHealthChecks/) ? [{ file: prog.rel }] : [];
    },
    msg: "No health checks (orchestrators cannot tell live from ready)",
    fix: 'AddHealthChecks(); MapHealthChecks("/health/live", predicate: _ => false) and a /health/ready that runs tagged dependency checks.',
  },
  {
    id: "OBS006",
    level: "low",
    project: (files) => {
      const prog = files.find(
        (f) => f.cs && /WebApplication\.Create(Builder|SlimBuilder)/.test(f.text),
      );
      return prog &&
        !anyFile(
          files,
          /AddOpenTelemetry|ConfigureOpenTelemetry|UseOtlpExporter|AddOtlpExporter|AddApplicationInsights|UseSerilog/,
        )
        ? [{ file: prog.rel }]
        : [];
    },
    msg: "No telemetry pipeline configured (OpenTelemetry/Serilog/App Insights)",
    fix: "Add OpenTelemetry traces + metrics + logs with an OTLP exporter (or the Aspire ServiceDefaults pattern).",
  },
  {
    id: "OBS008",
    level: "medium",
    re: /new\s+Meter\s*\(|new\s+ActivitySource\s*\(/,
    msg: "Meter/ActivitySource created by hand",
    fix: "Inject IMeterFactory for Meters (DI-scoped, testable); register the ActivitySource name with OpenTelemetry (AddSource).",
  },
];
