# Endpoints and validation

Sources: learn.microsoft.com/aspnet/core/fundamentals/minimal-apis/overview, /release-notes/aspnetcore-10.0 (checked).

## Minimal API structure

```csharp
public static class OrdersEndpoints
{
    public static IEndpointRouteBuilder MapOrdersEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/orders").WithTags("Orders").RequireAuthorization();
        g.MapGet("/{id:guid}", GetOrder);
        g.MapPost("/", CreateOrder).RequireRateLimiting("writes");
        return app;
    }

    static async Task<Results<Ok<OrderDto>, NotFound>> GetOrder(Guid id, IOrderQueries q, CancellationToken ct)
        => await q.FindAsync(id, ct) is { } dto ? TypedResults.Ok(dto) : TypedResults.NotFound();

    static async Task<Results<Created<OrderDto>, ValidationProblem>> CreateOrder(
        CreateOrder request, IOrderService svc, CancellationToken ct)
    {
        var dto = await svc.CreateAsync(request, ct);
        return TypedResults.Created($"/orders/{dto.Id}", dto);
    }
}
```

- Handlers are **static methods or small classes**, not inline lambdas with logic: testable, named in OpenAPI, no closure allocations.
- Group by resource; groups carry auth, tags, rate limits, filters, versioning.
- Inject services as parameters (DI), `CancellationToken`, `ClaimsPrincipal`; bind complex input to a record (`[FromBody]` implicit for complex types on POST/PUT).
- Return `TypedResults`/`Results<...>` unions so the OpenAPI document is correct without `Produces` boilerplate.

## Controllers: when

Microsoft recommends minimal APIs for new projects. Use controllers when the module already does, or you need model-binder extensibility (`IModelBinderProvider`), `IModelValidator`-based advanced validation, application parts/model conventions or OData; large teams familiar with MVC may prefer them. Don't add a second style to a module that already has one.

## Validation

- **.NET 10 minimal APIs**: `builder.Services.AddValidation();` validates query, header and body parameters using DataAnnotations; failures produce a 400 `ValidationProblem`. `.DisableValidation()` per endpoint. The source generator only discovers validatable types in the **assembly where `AddValidation` is called**, so call it in the assembly that defines the endpoints and their request types; request types that live in another project (for example a `.Contracts` project) are not discovered from the host, so validate those with the repo's validator. (`[ValidatableType]` is documented for the Blazor forms model; the minimal-API section does not mention it.) The APIs live in `Microsoft.Extensions.Validation`.
- .NET 8/9 or richer rules: an endpoint filter calling the repo's validator (FluentValidation or similar) returning `Results.ValidationProblem(errors)`.
- Validate **shape** (required, length, range, format) at the boundary; **business rules** (uniqueness, state transitions) in the handler/domain, mapped to 409/422.
- Unknown JSON properties are ignored by default; set `JsonUnmappedMemberHandling.Disallow` for strict contracts.
- Never bind entities; use `init` records so request objects can't be mutated downstream.

## Binding gotchas

- A complex-type GET parameter binds from the query only with `[AsParameters]`; GET with a body is not portable.
- Enum/Guid/DateOnly parsing errors become 400 automatically; keep route constraints (`:guid`, `:int`) for early rejection.
- `IFormFile` needs antiforgery (see `aspnet-security`) and size limits.
- Don't read `HttpContext.Request.Body` manually in handlers; bind it.

## Cross-cutting with endpoint filters

- `AddEndpointFilter` for validation, logging scopes, idempotency, tenant checks: attach on the group so every endpoint gets it. Keep filters small and ordered deliberately.

## Testing endpoints

- `WebApplicationFactory<Program>`: .NET 10 source-generates `public partial class Program` for top-level apps (no manual partial needed). Test status code, ProblemDetails shape, auth (401/403), validation (400) and the happy path; see `dotnet-testing`.
