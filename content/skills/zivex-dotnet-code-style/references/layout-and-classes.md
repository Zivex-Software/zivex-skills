# Layout and class shape

## Build baseline (every repository)

`net10.0`, `LangVersion latest`, `Nullable enable`, `ImplicitUsings enable`, `TreatWarningsAsErrors true`, `AnalysisLevel latest`; central packages (`Directory.Packages.props`) with lock files and `dotnet restore --locked-mode` in CI; `global.json` pins the SDK; `.slnx` solution files; `.editorconfig` with file-scoped namespaces as a warning. Details: the strictness reference of `zivex-engineering-standards`.

## File and namespace layout

```text
backend/src/Modules/Orders/
  Acme.Modules.Orders.Contracts/OrdersContracts.cs       public cross-module ports, ids, events
  Acme.Modules.Orders/
    OrdersModule.cs            AddOrdersModule() + MapOrdersEndpoints()
    Api/OrderEndpoints.cs      route mapping only: no DbContext here
    Application/OrderService.cs, OrderDtos.cs, OrderPublisher.cs ...
    Domain/Order.cs, OrderMath.cs     aggregates, value objects, invariants: no EF Core/ASP.NET/broker types
    Infrastructure/OrdersDbContext.cs, Migrations/
```

- Namespace = project + folder: `Acme.Modules.Orders.Application`.
- Split a big service into **partial files by concern** (`OrderService.cs`, `.Create.cs`, `.Queries.cs`, `.Reports.cs`), and endpoints the same way, instead of one 2000-line file.
- Several small related types per file is normal: enums, input records and the aggregate together; the DTOs of a module in one `OrderDtos.cs`.
- One schema and one `DbContext` per module; a shared `platform` schema for outbox, inbox, audit, idempotency and number allocation.

## Class shape

DO

- `internal sealed class` for everything that is not a contract; **primary constructors** for dependency injection.
- `public sealed record` for DTOs, requests and responses; positional, one parameter per line when long.
- Strongly typed ids where the repo uses them: `internal readonly record struct OrderId(Guid Value);` (plain `Guid` is fine where it does not).
- Enums with explicit values starting at 1 (`Draft = 1, Sent = 2`), stored as strings (`HasConversion<string>()`).
- `TimeProvider` injected everywhere; ids from `Guid.CreateVersion7(time.GetUtcNow())` or the repo's id factory.
- Limits as constants on the aggregate (`public const int MaxTitleLength = 200;`), reused by EF configuration and validation.
- Modern C#: collection expressions (`[.. page.Select(Map)]`), `is { } x` and `is { Length: > 0 }` patterns, `?? throw`.
- `ArgumentNullException.ThrowIfNull(x)` at public entry points.

```csharp
/// <summary>
/// Staff side of orders. Reading needs <c>orders.read</c>, changing needs <c>orders.manage</c>.
/// Every use case authorizes first.
/// </summary>
internal sealed class OrderService(OrdersDbContext db, IStaffAccess access, TimeProvider time)
{
    public async Task<OrderPage> ListAsync(OrderListQuery query, CancellationToken cancellationToken)
    {
        await access.EnsureAsync(Capabilities.OrdersRead, cancellationToken);
        var orders = db.Orders.AsNoTracking().IgnoreAutoIncludes();
        if (Search.ContainsPattern(query.Search) is { } pattern)
        {
            orders = orders.Where(o => EF.Functions.ILike(o.Title, pattern));
        }
        // ...bounded page, explicit sort...
    }
}
```

DON'T

- No MediatR, AutoMapper or Mapster; mapping is a static `From(...)` on the DTO or a hand-written projection.
- No repository per entity (the service uses the module `DbContext` directly), no `IXxxService` interface layers for their own sake.
- No controllers, no `static` mutable state, no `DateTime.Now`/`UtcNow`, no `double` money, no `Thread.Sleep`.
- No second style: do not introduce `Result<T>` plus exceptions plus outcome records in one repository.

## Async and parameters

- Every async method ends in `Async` (`ListAsync`, `HandleAsync`, `EnsureAsync`), including endpoint handlers.
- The cancellation token parameter is spelled `cancellationToken`; in endpoint lambdas it is `ct`.
- Public methods take what they need, not `HttpContext`.
