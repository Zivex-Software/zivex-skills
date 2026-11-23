# Module anatomy

```text
src/Modules/Orders/
  AGENTS.md                      purpose, contract, rules, test command
  Orders/                        implementation (internal)
    Orders.csproj                references Orders.Contracts, framework/packages it needs
    OrdersModule.cs              AddOrdersModule(services) + MapOrdersEndpoints(app): the only public surface here
    Features/<UseCase>/...       request, validator, handler, endpoint (see dotnet-feature-slice)
    Persistence/                 OrdersDbContext, entity configurations, Migrations/
  Orders.Contracts/              public contract: interfaces, DTO records, integration events
    Orders.Contracts.csproj      no reference to Orders, no ORM/web packages
    IOrdersApi.cs
tests/Orders.Tests/              module tests (handler + integration)
```

Siblings, not nesting: a project inside another project's folder is compiled into it by the SDK's default globbing.

## Registration (host composes, modules register themselves)

```csharp
// host Program.cs
builder.Services.AddOrdersModule(builder.Configuration);
builder.Services.AddBillingModule(builder.Configuration);
...
app.MapOrdersEndpoints();
app.MapBillingEndpoints();
```

```csharp
public static class OrdersModule
{
    public static IServiceCollection AddOrdersModule(this IServiceCollection services, IConfiguration config)
    {
        services.AddDbContext<OrdersDbContext>(o => o.UseSqlServer(config.GetConnectionString("Orders"))); // schema/history table owned here
        services.AddScoped<IOrdersApi, OrdersApi>();       // implementation internal, exposed only as the contract
        services.AddOptions<OrdersOptions>().BindConfiguration("Orders").ValidateDataAnnotations().ValidateOnStart();
        return services;
    }

    public static IEndpointRouteBuilder MapOrdersEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/orders").WithTags("Orders").RequireAuthorization();
        // g.MapGet(...), g.MapPost(...)
        return app;
    }
}
```

- Everything else in the implementation is `internal`; add `InternalsVisibleTo("<Name>.Tests")` only for the module's own tests.
- The host knows modules by their registration methods, not their internals. Cross-cutting concerns (auth, rate limiting, ProblemDetails, OpenTelemetry) are configured once in the host.

## Data ownership

- Each module owns its tables. Prefer a separate **schema** per module (`orders.*`) and a separate `DbContext`; set a per-module migrations history table (`MigrationsHistoryTable("__EFMigrationsHistory", "orders")`).
- No cross-module foreign keys, joins or shared DbContexts. Need another module's data? Call its contract (query interface) or keep a local read model fed by its integration events.
- Migrations belong to the module that owns the schema; one deployment job applies all modules' migrations in a defined order (see `aspnet-data-efcore`).
- Multi-tenancy: global query filters in the module's context; tenant resolved once by the host (see `aspnet-data-efcore`).

## Configuration

- One options class per module bound to a section named after the module; validate on start. Secrets come from the secret store, never from the module's appsettings.

## Cross-module communication

- **Synchronous** (need an answer now): call the other module's contract interface (in-process).
- **Asynchronous** (something happened): publish an integration event defined in your `.Contracts`; consumers handle it idempotently. Use an outbox when delivery must survive crashes (see the events-and-outbox reference of `dotnet-module-contract`).
- Never reach into another module's `DbContext`, tables or internal types.

## Naming

- Module name = domain noun, PascalCase, singular or plural consistently with the repo (`Orders`, `Billing`).
- Namespaces start with the module name (`Orders.Features...`, `Orders.Contracts`); contracts live in `<Name>.Contracts` so the boundary is visible in `using` directives (checked by `dotnet-module-boundary-check`).

## When not to create a module

- A single use case with no own data and no second consumer: make it a slice in an existing module.
- A technical concern (logging, email sending): a shared building block, not a business module.
