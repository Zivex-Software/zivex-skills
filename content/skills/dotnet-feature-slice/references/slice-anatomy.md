# Slice anatomy

Default shape when the module has none. If the module already has slices, copy those instead.

```text
Orders/Features/CancelOrder/
  CancelOrder.cs           request record + handler (+ validator) - one file is fine while small
  CancelOrderEndpoint.cs   route mapping
tests/Orders.Tests/Features/CancelOrder/
  CancelOrderHandlerTests.cs
  CancelOrderEndpointTests.cs
```

## A complete worked example (minimal API, no mediator)

```csharp
// CancelOrder.cs
namespace Orders.Features.CancelOrder;

internal sealed record CancelOrderRequest(string Reason);

internal sealed class CancelOrderValidator
{
    public Dictionary<string, string[]> Validate(CancelOrderRequest r)
    {
        var errors = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(r.Reason)) errors[nameof(r.Reason)] = ["A reason is required."];
        else if (r.Reason.Length > 500) errors[nameof(r.Reason)] = ["At most 500 characters."];
        return errors;
    }
}

internal sealed class CancelOrderHandler(OrdersDbContext db, TimeProvider time, ILogger<CancelOrderHandler> log)
{
    public async Task<Result> HandleAsync(Guid orderId, CancelOrderRequest request, Guid tenantId, CancellationToken ct)
    {
        // Tenant/ownership is part of the query: another tenant's order is simply not found.
        var order = await db.Orders.FirstOrDefaultAsync(o => o.Id == orderId && o.TenantId == tenantId, ct);
        if (order is null) return Result.NotFound();

        if (!order.TryCancel(request.Reason, time.GetUtcNow(), out var error)) return Result.Conflict(error);  // rule lives in the entity

        await db.SaveChangesAsync(ct);                       // one transaction; concurrency token throws DbUpdateConcurrencyException
        log.OrderCancelled(orderId);                          // [LoggerMessage] template, ids only
        return Result.Ok();
    }
}
```

```csharp
// CancelOrderEndpoint.cs
internal static class CancelOrderEndpoint
{
    public static void Map(RouteGroupBuilder g) =>
        g.MapPost("/{id:guid}/cancel", async Task<Results<NoContent, NotFound, ValidationProblem, Conflict<ProblemDetails>>> (
            Guid id, CancelOrderRequest request, CancelOrderValidator validator, CancelOrderHandler handler,
            ITenantContext tenant, CancellationToken ct) =>
        {
            var errors = validator.Validate(request);
            if (errors.Count > 0) return TypedResults.ValidationProblem(errors);

            var result = await handler.HandleAsync(id, request, tenant.Id, ct);
            return result.Status switch
            {
                ResultStatus.Ok => TypedResults.NoContent(),
                ResultStatus.NotFound => TypedResults.NotFound(),
                _ => TypedResults.Conflict(new ProblemDetails { Title = "Order cannot be cancelled", Detail = result.Error })
            };
        })
        .WithName("CancelOrder")
        .RequireAuthorization("orders.write");
}
```

```csharp
// Handler test (real database through the module's fixture; fake clock)
[Fact]
public async Task Paid_orders_cannot_be_cancelled_after_shipping()
{
    var order = await Seed.Order().Shipped().BuildAsync(db);
    var result = await new CancelOrderHandler(db, new FakeTimeProvider(), NullLogger<CancelOrderHandler>.Instance)
        .HandleAsync(order.Id, new("changed my mind"), order.TenantId, default);

    Assert.Equal(ResultStatus.Conflict, result.Status);
    Assert.Equal(OrderStatus.Shipped, (await db.Orders.AsNoTracking().SingleAsync(o => o.Id == order.Id)).Status);
}
```

Notes on the example:

- Replace `Result`, the validator and tenant types with the module's real ones. If the repo uses MediatR/Wolverine/FluentValidation, keep that style: the slice shape stays the same.
- The business rule (`TryCancel`) lives on the entity/domain object, not in the endpoint or the handler's `if` chains.
- Tenant/ownership checks are in the **query**; authorization policy is on the endpoint.

## Queries vs commands

- **Command** (changes state): load aggregate -> behaviour method -> `SaveChangesAsync`; returns minimal data (id, `NoContent`, 201 + `Location`).
- **Query** (reads): `AsNoTracking` + `Select` straight to the response DTO, paginated, no entity returned. May use a read-optimised model; never changes state.
- Keep them separate slices even when the data overlaps.

## Events

- A slice that must tell other modules something raises an **integration event** defined in the module's `.Contracts`, written in the same transaction (outbox) and published afterwards. See `dotnet-module-contract`.
- A slice that reacts to another module's event is its own slice with an idempotent handler.

## Granularity

- One slice = one use case = one reason to change. If two endpoints always change together, they may be one slice; if one handler grows branches per caller, split it.
