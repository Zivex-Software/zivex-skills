# OpenTelemetry, metrics, traces

Sources: learn.microsoft.com/dotnet/core/diagnostics/observability-with-otel, /aspnet/core/log-mon/metrics/metrics, and the OpenTelemetry .NET docs (opentelemetry.io/docs/languages/dotnet: getting started, exporters, instrumentation). Documented there and used below: `AddOpenTelemetry`, `ConfigureResource`, `WithTracing`, `WithMetrics`, `AddAspNetCoreInstrumentation`, `AddHttpClientInstrumentation`, `AddSource`, `AddMeter`, `AddOtlpExporter` and `Logging.AddOpenTelemetry`. The single-call `UseOtlpExporter()` and the runtime-metrics instrumentation were not shown on the pages read, so they are not used here: check the package docs if you want them.

## Setup (typical)

```csharp
// packages: OpenTelemetry.Extensions.Hosting, OpenTelemetry.Instrumentation.AspNetCore,
//           OpenTelemetry.Instrumentation.Http, OpenTelemetry.Exporter.OpenTelemetryProtocol
//           (+ OpenTelemetry.Instrumentation.SqlClient / EF instrumentation as the repo needs)
builder.Services.AddOpenTelemetry()
    .ConfigureResource(r => r.AddService("orders-api"))
    .WithTracing(t => t.AddAspNetCoreInstrumentation().AddHttpClientInstrumentation().AddSource("Acme.Orders").AddOtlpExporter())
    .WithMetrics(m => m.AddAspNetCoreInstrumentation().AddHttpClientInstrumentation().AddMeter("Acme.Orders").AddOtlpExporter());
                                   // endpoint from OTEL_EXPORTER_OTLP_ENDPOINT
builder.Logging.AddOpenTelemetry(o => { o.IncludeScopes = true; o.AddOtlpExporter(); });
```

- The Aspire **ServiceDefaults** template wraps this as `builder.ConfigureOpenTelemetry()` and also adds `/health` and `/alive` endpoints and HTTP resilience: reuse it when the repo is Aspire-based.
- Configure through standard OTel environment variables (`OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME`, `OTEL_RESOURCE_ATTRIBUTES`); keep endpoints/keys out of source.
- Console exporters for local debugging only.

## Built-in ASP.NET Core metrics

- Meters `Microsoft.AspNetCore.Hosting` (instrument `http.server.request.duration`, active requests) and `Microsoft.AspNetCore.Server.Kestrel` (connections, TLS handshakes, queues); `Microsoft.AspNetCore.Identity` (10+).
- Opt endpoints out with `.DisableHttpMetrics()` (e.g. health checks) on .NET 10. Enrich with `IHttpMetricsTagsFeature` (low-cardinality tags only).
- 11+: built-in HTTP metrics follow OpenTelemetry semantic conventions; dashboards may change after upgrading.
- Runtime: `System.Runtime` (GC, allocations, thread pool). EF/ADO.NET provide command duration and query-cache metrics.

## Custom metrics (business and dependency signals)

```csharp
public sealed class OrderMetrics(IMeterFactory factory)
{
    private readonly Counter<long> _placed = factory.Create("Acme.Orders").CreateCounter<long>("orders.placed");
    private readonly Histogram<double> _pay = factory.Create("Acme.Orders").CreateHistogram<double>("orders.payment.duration", "s");
    public void Placed(string channel) => _placed.Add(1, new KeyValuePair<string, object?>("channel", channel));
    public void PaymentTook(double seconds) => _pay.Record(seconds);
}
```

- Create meters through **`IMeterFactory`** (DI-managed, testable with `MetricCollector<T>`), register the meter name with OpenTelemetry (`AddMeter`). Don't `new Meter()` ad hoc.
- Pick the instrument: counter (monotonic events), histogram (durations/sizes), up-down counter (in-flight/queue depth), observable gauge (current value sampled).
- Names: dotted lower-case, units in the metadata (`s`, `By`, `{request}`), consistent per module.
- **Cardinality**: tags must have a small, bounded value set (status class, route template, channel). Never user id, email, order id, raw path or exception message: it explodes storage and cost.

## Traces

- `ActivitySource("Acme.Orders")` per module; `using var a = source.StartActivity("ProcessOrder"); a?.SetTag("order.id", id);` around meaningful units (not every method). Register with `AddSource`.
- Context propagates over HttpClient and most messaging automatically (W3C `traceparent`); for custom queues put the trace context in the message and `StartActivity(name, kind, parentContext)`.
- Record errors: `a?.SetStatus(ActivityStatusCode.Error)` and `AddException(ex)`; don't put secrets or personal data in tags/events.
- Sampling: sample in the collector or `TraceIdRatioBased` for volume; always keep error traces.

## Dashboards and alerts (what to wire)

- **RED** per endpoint/dependency: Rate, Errors (5xx ratio), Duration (p95/p99). **USE** for resources: CPU, memory/GC, thread-pool queue, DB pool saturation.
- SLOs on user-visible outcomes (availability, latency); alert on burn rate, not on single spikes; every alert links to a runbook and a trace/log query.
- Alert on dead-letter growth, queue age, breaker open, rate-limit rejections, failed health checks.

## Testing

- `MetricCollector<T>` (Microsoft.Extensions.Diagnostics.Testing) to assert counters/histograms; `ActivityListener` to assert spans; fake logger to assert events/levels.
