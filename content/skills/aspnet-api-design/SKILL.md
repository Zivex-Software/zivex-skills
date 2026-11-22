---
name: aspnet-api-design
description: Designs and implements ASP.NET Core HTTP APIs - minimal APIs vs controllers, request/response contracts, validation, ProblemDetails error handling, status codes, pagination, idempotency, versioning and OpenAPI - with a scanner script. Use when adding or changing endpoints, error handling, contracts or API documentation.
---

# ASP.NET Core API design

Target **.NET 10 (LTS)**. For new projects Microsoft recommends **minimal APIs**; keep controllers where the repo already uses them or you need features that are hard in minimal APIs (model-binder extensibility, `IModelValidator`, application model, OData). Do not mix styles inside one module without a reason.

## Start here (module first)

1. Identify the module that owns the endpoint and read its `AGENTS.md`; follow the module's existing endpoint style (route groups, handler shape, result types).
2. An endpoint belongs to the module that owns the use case. If it needs data or behaviour from another module, call that module's `.Contracts` interface; never its internals.
3. The host composes: each module exposes one `Map<Module>Endpoints(this IEndpointRouteBuilder)` extension; the host calls it. Don't scatter `app.Map*` across projects.

## Workflow

1. **Define the contract first**: method + route (nouns, plural, lower-case kebab), request record, response record(s), status codes, error cases, auth policy, idempotency need, pagination. Write it down in the PR/description before code.
2. **Implement the slice** (see `dotnet-feature-slice`): bind -> validate -> authorize -> handler -> map to DTO -> return typed result. Keep endpoints thin; no business logic in the route lambda.
3. **Errors in one place**: `AddProblemDetails()` + `IExceptionHandler` + `UseExceptionHandler()`; map domain/validation errors to `ProblemDetails`/`ValidationProblem`. See `references/errors-problemdetails.md`.
4. **Document**: built-in OpenAPI (`AddOpenApi`/`MapOpenApi`), with `Produces`/`ProducesProblem` metadata, summaries and examples. See `references/openapi-versioning.md`.
5. **Check**: `node scripts/check-api.mjs <path>` (candidates: exception details leaked, missing global handler/ProblemDetails, untyped bodies, entities returned, missing cancellation tokens). Then `aspnet-security` for authz/input and `dotnet-testing` for endpoint tests.
6. **Verify** with `dotnet-verify`; breaking contract changes follow `dotnet-module-contract`.

## Defaults

- Typed results: `TypedResults.Ok/Created/NoContent/NotFound/Problem` and return types `Results<Ok<T>, NotFound, ValidationProblem>` so OpenAPI is accurate.
- Request/response **records**, never entities. Validate (`AddValidation()` on .NET 10 minimal APIs or the repo's validator). Cap page sizes.
- Idempotent PUT/DELETE; POST that creates returns **201** with `Location`; accept an `Idempotency-Key` header for POSTs that clients may retry.
- 4xx for caller mistakes, 5xx only for server faults; **never** return exception messages/stack traces; include a trace id in ProblemDetails.
- Use `CancellationToken` parameters; async only.
- Route groups (`MapGroup`) carry common policies: `RequireAuthorization()`, `WithTags`, `ProducesProblem`, rate limits, versioning.
- Versioning from the first public release; additive changes preferred; deprecate with headers and a date.

## References

- `references/endpoints-validation.md` - minimal API structure, binding, groups, filters, validation (.NET 10 `AddValidation`), typed results, controllers when.
- `references/errors-problemdetails.md` - `IExceptionHandler`, ProblemDetails (RFC 9457), status code map, validation errors, correlation id, handler pitfalls.
- `references/openapi-versioning.md` - built-in OpenAPI (3.1 on .NET 10), transformers, build-time generation, versioning strategies, deprecation.
- `references/contracts-pagination-idempotency.md` - pagination shapes, filtering/sorting, partial updates, idempotency keys, long-running operations (202), streaming/SSE, ETags.
