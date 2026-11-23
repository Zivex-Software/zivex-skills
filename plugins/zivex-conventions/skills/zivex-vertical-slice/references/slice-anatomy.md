# Slice anatomy

File: `Features/{Module}/{Action}.cs`. Copy the golden example; never reorder the parts.

1. File-scoped `namespace Api.Features.{Module};`
2. **Top-level** records: `public sealed record {Action}Request(...)` (writes) and `{Action}Response(...)`. Names must be unique per slice: they become the OpenAPI and client schema names.
3. Validation: FAST uses a second top-level class `{Action}Validator : AbstractValidator<{Action}Request>` attached with `.WithValidation<{Action}Request>()`; STRICT uses a private static `Validate(...)` in the feature class, **called after the capability check**.
4. `public sealed class {Action} : IFeature` with `public static void Map(IEndpointRouteBuilder app)`: verb, route, `.RequireModule(ModuleNames.X)`, `.WithName("camelCase")`, `.WithTags(ModuleNames.X)`, `.Produces<{Action}Response>`, `.ProducesProblem`.
5. `private static async Task<IResult> HandleAsync(...)` in the same class: the injected request, `AppDbContext`, `TenantContext`, `HybridCache`, `TimeProvider`, `CancellationToken`; FAST adds `IPublishEndpoint`, STRICT adds `ClaimsPrincipal` and starts with `Capabilities.Has`. A direct EF query, no repository.
6. Write path: entity (UUIDv7; tenant and branch stamped by `AppDbContext.SaveChanges`) -> save (handle the unique-index race as 409) -> event (FAST: `bus.Publish` **after** save; STRICT: audit entry and `OutboxMessage.Create` added **before** the single save) -> `cache.RemoveByTagAsync(CacheKeys.TenantTag(...))`.
7. Return `Results.Created/Ok` with the response record through a hand-written `ToResponse`; errors through `ApiResults.Conflict/Problem/Validation/Forbidden` with a stable `code`.
8. Nothing else to register: slices are found by assembly scan; edit no other file.

## Golden example (STRICT, writes)

Illustrative: replace the domain parts, keep the order. Types such as `AppDbContext`, `TenantContext`, `CacheKeys` and `ApiResults` are your project's `Common/` building blocks.

```csharp
namespace Api.Features.Catalog;

public sealed record CreateProductRequest(string Sku, string Name, decimal Price, string Currency);
public sealed record CreateProductResponse(Guid Id, string Sku, string Name, decimal Price, string Currency);

public sealed class CreateProduct : IFeature
{
    public static void Map(IEndpointRouteBuilder app) =>
        app.MapPost("/catalog/products", HandleAsync)
            .RequireModule(ModuleNames.Catalog)
            .WithName("createProduct").WithTags(ModuleNames.Catalog)
            .Produces<CreateProductResponse>(StatusCodes.Status201Created)
            .ProducesProblem(StatusCodes.Status409Conflict);

    private static async Task<IResult> HandleAsync(
        CreateProductRequest request, ClaimsPrincipal user, AppDbContext db, TenantContext tenant,
        HybridCache cache, TimeProvider time, CancellationToken ct)
    {
        if (!Capabilities.Has(user, Capabilities.CatalogManage)) return ApiResults.Forbidden("catalog.manage_required");   // 1. capability first
        if (Validate(request) is { Count: > 0 } errors) return ApiResults.Validation(errors);                                 // 2. then validate

        var product = new Product                                                                                              // 3. entity: UUIDv7; tenant stamped on save
        {
            Id = Guid.CreateVersion7(time.GetUtcNow()),
            Sku = request.Sku.Trim(), Name = request.Name.Trim(), Price = request.Price, Currency = request.Currency,
        };
        db.Products.Add(product);
        db.Audit("product.created", "product", product.Id);                                                                    // 4. audit + outbox in the SAME save
        db.Outbox.Add(OutboxMessage.Create(new ProductCreatedV1(product.Id), time.GetUtcNow()));
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException)
        {
            // 5. unique-index race -> 409 (await is not allowed inside a catch filter, so check inside the block)
            if (await db.Products.AsNoTracking().AnyAsync(p => p.Sku == request.Sku.Trim(), ct))
                return ApiResults.Conflict("catalog.sku_taken", "That SKU is already in use. Choose another one.");
            throw;
        }

        await cache.RemoveByTagAsync(CacheKeys.TenantTag(tenant.TenantId, tenant.BranchId), ct);                               // 6. invalidate in the write slice
        return Results.Created($"/catalog/products/{product.Id}", ToResponse(product));
    }

    private static Dictionary<string, string[]> Validate(CreateProductRequest r)
    {
        var errors = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(r.Sku) || r.Sku.Length > 40) errors["sku"] = ["Enter a SKU of at most 40 characters."];
        if (r.Price <= 0) errors["price"] = ["The price must be greater than zero."];
        if (r.Currency is not { Length: 3 }) errors["currency"] = ["Use a three-letter currency code."];
        return errors;
    }

    private static CreateProductResponse ToResponse(Product p) => new(p.Id, p.Sku, p.Name, p.Price, p.Currency);
}
```

## FAST differences

- Validation is a second top-level class `CreateProductValidator : AbstractValidator<CreateProductRequest>` attached with `.WithValidation<CreateProductRequest>()`; no `Validate(...)` method and no capability check beyond the module policy.
- Events: inject `IPublishEndpoint` and call `await bus.Publish(new ProductCreatedEvent(product.Id), ct)` **after** a successful save; no outbox row, no audit entry in the same transaction. Accept that an event can be lost between save and publish.
- Event records are named `{Thing}{PastTense}Event` and live in `Contracts/{Module}/` with ids and minimal facts.

## Read slice (list)

`Map` plus `HandleAsync` only. Cache with `HybridCache.GetOrCreateAsync(CacheKeys.Key(...), ..., tags: [CacheKeys.TenantTag(...)])`. Lists are bounded (maximum 200) with explicit filters and sort. No tracking, project to the response record.

## New slice in six steps

1. Pick module and action. 2. Copy the profile's golden example. 3. Replace the domain parts, keep the anatomy. 4. New entity -> `ITenantEntity` + `DbSet` + migration; new event -> `Contracts/{Module}/`. 5. Happy-path test and cross-tenant test (404). 6. Feedback loop green.
