# OpenAPI and versioning

Sources: learn.microsoft.com/aspnet/core/fundamentals/openapi/overview, /release-notes/aspnetcore-10.0 (checked). API versioning libraries: not covered by the docs pages read: confirm package/API on NuGet before use.

## Built-in OpenAPI (`Microsoft.AspNetCore.OpenApi`)

```csharp
builder.Services.AddOpenApi();                       // document generation + transformers
if (app.Environment.IsDevelopment()) app.MapOpenApi();   // serves /openapi/v1.json
```

- .NET 10 generates **OpenAPI 3.1** by default (Microsoft.OpenApi 2.0; breaking: `OpenApiAny` replaced by `JsonNode`). Pin with `options.OpenApiVersion = OpenApiSpecVersion.OpenApi3_1` (or 3.0 if tools need it). YAML: `app.MapOpenApi("/openapi/{documentName}.yaml")`.
- The template maps it **only in Development**: expose in production only deliberately and with authorization (the spec reveals your surface).
- Build-time document (for clients/CI diffs): `Microsoft.Extensions.ApiDescription.Server` with `OpenApiGenerateDocumentsOnBuild` and `OpenApiDocumentsDirectory`.
- Customize with document/operation/schema **transformers** (`options.AddDocumentTransformer(...)`): servers, security schemes (`bearer`), descriptions.
- UI: the package gives the document, not a UI; add Scalar/Swagger UI/Redoc if you want one, in development.

## Make the document accurate

- Return `TypedResults`/`Results<...>` unions, or add `.Produces<T>(200)`, `.ProducesProblem(404)`, `.ProducesValidationProblem()`.
- `WithName` (operationId), `WithSummary`, `WithDescription`, `WithTags`; XML doc comments for schemas if enabled.
- Describe auth (`AddSecurityScheme` via transformer) and rate-limit/idempotency headers.
- Lint the spec in CI (Spectral) and **diff against the previous release** to catch breaking changes (removed fields, tightened types, changed status codes).

## Versioning

- Decide before the first external consumer. Options: URL segment (`/v1/orders`, easiest to cache/route/document), header (`Api-Version: 1`), media type. Pick one for the whole API.
- Library: Asp.Versioning (`Asp.Versioning.Http`/`.Mvc`) with `MapGroup("/v{version:apiVersion}")` and `ApiVersionSet`; verify packages/versions in the current docs.
- Rules: additive changes (new optional fields/endpoints) are non-breaking; removing/renaming fields, changing types/semantics/status codes, making optional required are **breaking** -> new version.
- Deprecation: `Deprecation`/`Sunset` headers + documentation + usage metrics before removal; support N and N-1.
- Internal module contracts (`.Contracts`) are versioned by **compatibility** (see `dotnet-module-contract`), not by URL.

## Public vs internal APIs

- Separate documents per audience (`AddOpenApi("public")`, `AddOpenApi("internal")`) and filter endpoints by group/metadata; never publish internal/admin endpoints in the public document.
