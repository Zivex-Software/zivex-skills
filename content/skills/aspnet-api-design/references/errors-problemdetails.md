# Errors and ProblemDetails

Sources: learn.microsoft.com/aspnet/core/fundamentals/error-handling (checked, Nov 2026).

## One global pipeline

```csharp
builder.Services.AddProblemDetails(o => o.CustomizeProblemDetails = ctx =>
{
    ctx.ProblemDetails.Extensions["traceId"] = Activity.Current?.Id ?? ctx.HttpContext.TraceIdentifier;
});
builder.Services.AddExceptionHandler<DomainExceptionHandler>();   // singleton; runs in registration order
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();   // last: generic 500

app.UseExceptionHandler();      // required: registering handlers alone does nothing
app.UseStatusCodePages();       // bodies for bare 404/401/...
```

```csharp
sealed class DomainExceptionHandler(IProblemDetailsService problems) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext ctx, Exception ex, CancellationToken ct)
    {
        var (status, title) = ex switch
        {
            NotFoundException => (404, "Resource not found"),
            ConflictException => (409, "Conflict"),
            ValidationException => (400, "Validation failed"),
            _ => (0, null)
        };
        if (status == 0) return false;                     // next handler
        ctx.Response.StatusCode = status;
        return await problems.TryWriteAsync(new() { HttpContext = ctx, Exception = ex,
            ProblemDetails = { Status = status, Title = title } });
    }
}
```

Facts from the docs:

- `IExceptionHandler.TryHandleAsync` returns `true` to stop; handlers run in **registration order**; lifetime is singleton (don't capture scoped services: resolve from `ctx.RequestServices`).
- `UseExceptionHandler()` without arguments needs `AddProblemDetails()` (or a path/lambda), otherwise startup throws.
- A handler that returns `true` without writing a status/body yields a 404 and a log line: always set the status.
- .NET 10: **handled exceptions are not logged/diagnosed by default** (`SuppressDiagnosticsCallback` changes it): log inside your handler (without secrets) so failures stay visible.
- Rate limiter + status-code pages: `UseStatusCodePagesWithReExecute` goes before `UseRouting`/`UseRateLimiter`.

## Status code map

| Situation                              | Code                         | Notes                             |
| -------------------------------------- | ---------------------------- | --------------------------------- |
| Malformed/invalid input                | 400 `ValidationProblem`      | field errors dictionary           |
| Not authenticated / not allowed        | 401 / 403                    | 404 when existence must not leak  |
| Not found                              | 404                          | `ProblemDetails` body             |
| State conflict, duplicate, concurrency | 409                          | include current version if useful |
| Semantically invalid (business rule)   | 422 (or 400)                 | pick one and stay consistent      |
| Too many requests                      | 429 + `Retry-After`          | from rate limiter `OnRejected`    |
| Created / accepted / no content        | 201 + `Location` / 202 / 204 |                                   |
| Server fault                           | 500                          | generic message + trace id        |
| Dependency down/timeout                | 503 / 504                    | `Retry-After` if known            |

## Shape (RFC 9457 `application/problem+json`)

`type`, `title`, `status`, `detail` (safe, human), `instance`, plus extensions: `traceId`, `errors` (validation), a stable machine `code`. **Never** include exception messages, stack traces, SQL, file paths, or internal ids in `detail` in production.

## Rules

- Throw domain exceptions (or return result types) in the module; map to HTTP in **one** place (the handler), not in every endpoint.
- Don't catch `Exception` in endpoints to return 500 manually; let it reach the handler. Catch only what you can handle.
- Don't use exceptions for expected control flow on hot paths (slow); use result types/`TryX`.
- Keep error `code`s stable and documented in OpenAPI (`ProducesProblem`).
- Log at the right level: 4xx caller errors at Information/Warning without noise, 5xx at Error with the exception object and trace id (see `aspnet-observability`).
- Test the error contract: status, `application/problem+json`, no leaked details.
