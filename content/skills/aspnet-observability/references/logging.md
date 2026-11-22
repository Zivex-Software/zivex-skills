# Logging

Sources: learn.microsoft.com/dotnet/core/extensions/logging/{overview,source-generation}, /ef/core/logging-events-diagnostics (checked).

## Templates and structure

- Use message templates: `logger.LogInformation("Order {OrderId} paid by {CustomerId}", orderId, customerId);`. The arguments are passed to the logging system (structured), not just the formatted string. **String interpolation in log calls** (`LogInformation($"...")`) loses structure and can cause performance issues (analyzer CA2254 flags non-constant templates).
- Placeholders are **ordinal** (matched by position, not by name); keep names PascalCase and consistent across the codebase (`OrderId`, not `orderId`/`order_id`).
- No asynchronous logger methods exist: logging is synchronous; keep it cheap and let providers batch/export.

## `[LoggerMessage]` source generation (recommended for hot paths)

```csharp
public static partial class Log
{
    [LoggerMessage(EventId = 1001, Level = LogLevel.Information, Message = "Order {OrderId} paid")]
    public static partial void OrderPaid(this ILogger logger, Guid orderId);

    [LoggerMessage(EventId = 1002, Level = LogLevel.Error, Message = "Payment failed for order {OrderId}")]
    public static partial void PaymentFailed(this ILogger logger, Exception ex, Guid orderId);
}
```

- Method must be `partial`, return `void`, names and parameter names must not start with `_`, no `params`/`out`/`scoped`. Static methods need an `ILogger` parameter; instance methods use an `ILogger` field or (.NET 9+) a primary-constructor parameter.
- An `Exception` parameter is logged as the exception; omit `Level` to pass `LogLevel` as a parameter. Unmatched template/parameter names warn (SYSLIB1015). Allocation-free when the level is disabled.
- Stable `EventId`s make alerts and searches robust. Keep one `Log` partial class per module/feature.

## Levels

| Level       | Use                                                           |
| ----------- | ------------------------------------------------------------- |
| Trace/Debug | developer detail, off in production                           |
| Information | business milestones, startup/shutdown, state transitions      |
| Warning     | unexpected but handled, degraded mode, retries exhausted soon |
| Error       | operation failed (exception object attached)                  |
| Critical    | process cannot continue, data loss risk                       |

- Default minimum is Information when unset. Configure per category in `Logging:LogLevel` (`Microsoft.AspNetCore` = Warning, `Microsoft.EntityFrameworkCore.Database.Command` = Warning in production).
- Caller mistakes (4xx, validation) are not errors: log at Information/Debug, or not at all. Log each failure **once**, at the boundary that handles it (not at every layer that rethrows).
- Category = fully qualified class name via `ILogger<T>`.

## Exceptions

- `LogError(ex, "...")`: passes the exception object so stack trace and inner exceptions are kept. `ex.Message` alone loses them; `ex.ToString()` in the message duplicates.
- Don't log and rethrow at every layer. Handled exceptions in `IExceptionHandler` are **not** logged automatically on .NET 10: log there.

## Scopes and correlation

```csharp
using (logger.BeginScope(new Dictionary<string, object> { ["OrderId"] = id, ["TenantId"] = tenantId }))
{
    ...
}
```

- Enable scopes in the exporter/console formatter; ASP.NET Core adds `TraceId`/`SpanId` automatically when `Activity` is active. Put the trace id in ProblemDetails so support can find the request.
- In `BackgroundService` handlers create a scope per message with the message id and tenant.

## Personal data and secrets

- Never log credentials, tokens, `Authorization` headers, connection strings, full request/response bodies, card numbers, health data. Log ids, not names/e-mails/addresses; hash or truncate when correlation is needed.
- Use redaction (`Microsoft.Extensions.Compliance.Redaction`) or a destructuring policy for objects that may carry personal data; don't log whole entities/DTOs.
- Logs are personal data stores too: apply retention, access control and deletion rules (GDPR). Control who can read production logs.
- Log injection: structured placeholders keep user input as data; never concatenate user input (with newlines) into the template.
- EF: `EnableSensitiveDataLogging()` writes parameter values: development only.

## Volume and cost

- Don't log in tight loops or per item of large batches (summarise: "Processed {Count} items in {ElapsedMs} ms").
- Prefer metrics for counts/rates, traces for timing, logs for events.
- Sample or filter noisy categories in production; keep Error/Warning complete.

## Anti-patterns

`Console.WriteLine`, `LogInformation($"...")`, `LogError(ex.Message)`, logging secrets, logging the same failure at every layer, per-item logs in hot loops, logs without ids (can't correlate), high-cardinality values as the _only_ way to find something.
