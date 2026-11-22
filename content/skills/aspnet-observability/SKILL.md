---
name: aspnet-observability
description: Adds production-grade observability to ASP.NET Core - structured logging with LoggerMessage, OpenTelemetry traces/metrics/logs, health checks (liveness vs readiness), correlation ids, safe logging without PII, and alerting basics - with a scanner script. Use when adding logging, tracing, metrics, health endpoints, or diagnosing production behaviour.
---

# ASP.NET Core observability

Target **.NET 10 (LTS)**. Three signals - **logs, metrics, traces** - exported with OpenTelemetry (OTLP) to whatever backend the repo uses. 11+ items (e.g. HTTP metrics aligned with OpenTelemetry semantic conventions) are noted and must not be assumed on .NET 10.

## Start here (module first)

1. Identify the module and read its `AGENTS.md`. Each module logs with its own category (`ILogger<T>`), defines its own `Meter` (via `IMeterFactory`) and `ActivitySource`, named `<Company>.<Module>`.
2. Host-level wiring (OpenTelemetry setup, health endpoints, log filtering) lives in `Program.cs`; modules only emit signals, they don't configure exporters.
3. Don't log another module's internals; log at your module's boundary (contract calls in/out) with ids.

## Workflow

1. **Decide the question each signal answers**: logs = what happened to this entity/request; metrics = how often/how fast/how many (alerts); traces = where did the time go across calls. Add only what answers one.
2. **Logging**: message templates + `[LoggerMessage]` source generation, correct levels, exception object, scopes with ids; no secrets/PII. See `references/logging.md`.
3. **Metrics and traces**: OpenTelemetry with ASP.NET Core, HttpClient, EF/SqlClient instrumentation, plus your own `Meter`/`ActivitySource` for business signals. See `references/opentelemetry-metrics.md`.
4. **Health**: `/health/live` (process only) and `/health/ready` (dependencies needed to serve). See `references/health-checks.md`.
5. **Check**: `node scripts/check-observability.mjs <path>` (interpolated logging, exception message only, secret-like values, `Console.WriteLine`, missing health/telemetry, hand-made meters). Confirm each hit.
6. **Verify** with `dotnet-verify`; for personal-data rules also `aspnet-security`.

## Rules

- **Message templates, never interpolation**: `LogInformation("Order {OrderId} paid", id)`; use `[LoggerMessage]` for hot or recurring messages. Placeholders are ordinal.
- Log the **exception object**: `LogError(ex, "Failed to {Action}", action)`; not `ex.Message` concatenated.
- Levels: Trace/Debug dev detail; Information business milestones; Warning recoverable/unexpected; Error operation failed; Critical process-level failure. Default minimum is Information; set filters per category.
- **No secrets, tokens, passwords, connection strings, full payloads or personal data** in logs, span attributes, metric tags or health output.
- Metric tags are **low-cardinality** (status, route template, tenant tier): never user ids, order ids or raw URLs.
- Every request/job has a **trace id** that appears in logs and in ProblemDetails.
- Health endpoints expose status only; protect or restrict detailed output.
- Instrument at boundaries (incoming request, outgoing call, queue message, DB), not inside tight loops.
- Observability is code: test that important events/metrics are emitted (`MetricCollector<T>`, fake logger).

## References

- `references/logging.md` - templates, `[LoggerMessage]`, levels, scopes, exceptions, redaction/PII, sampling and volume, anti-patterns.
- `references/opentelemetry-metrics.md` - OpenTelemetry setup, built-in meters, custom `Meter`/`ActivitySource`, naming, cardinality, alerts and SLOs.
- `references/health-checks.md` - liveness vs readiness, registering and mapping checks, exposure, background-worker health, publishers.
