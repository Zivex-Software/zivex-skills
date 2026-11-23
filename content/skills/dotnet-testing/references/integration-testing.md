# Integration testing

## WebApplicationFactory

```csharp
public class OrdersApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly MsSqlContainer _db = new MsSqlBuilder().Build();   // Testcontainers.MsSql (package name: verify current version)

    public async Task InitializeAsync() => await _db.StartAsync();
    public new async Task DisposeAsync() => await _db.DisposeAsync();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<OrdersDbContext>>();
            services.AddDbContext<OrdersDbContext>(o => o.UseSqlServer(_db.GetConnectionString()));
            services.AddSingleton<TimeProvider>(new FakeTimeProvider());   // Microsoft.Extensions.TimeProvider.Testing
        });
    }
}
```

- `Program` must be accessible to the test project. **.NET 10**: a source generator emits `public partial class Program` for top-level-statement apps (release notes), so no manual partial is needed; on .NET 8/9 add `public partial class Program { }`.
- Override **only the edges** (database connection, clock, external HTTP clients, message bus). Keep the real pipeline: routing, filters, validation, auth, serialization, exception handler.
- Share the factory per test class/collection (xUnit `IClassFixture`/`ICollectionFixture`): starting the host and a container per test is slow.
- Use a testing environment/config that cannot reach production resources (no real connection strings or API keys; fail fast if a real external host is called).

## Real databases

- Use the same engine as production (Testcontainers for SQL Server/PostgreSQL, or a local database from the repo's compose file). SQLite in-memory is acceptable only when the repo targets it; the EF **InMemory provider is not**: it enforces no constraints or transactions.
- Apply the real **migrations** to the test database (`Database.MigrateAsync()` is fine in tests): that also proves the migrations run.
- **Isolation**, pick one and stay consistent: (a) a fresh database/schema per test class, (b) a shared database with data reset between tests (Respawn-style reset of tables, keeping seed/reference data), (c) a transaction rolled back per test (only if the code under test does not commit its own transactions). Never rely on test order.
- Tests that need Docker are tagged (`[Trait("Category","Integration")]`) so they can be run or skipped explicitly; document the requirement in the module's `AGENTS.md`.

## Authentication and authorization

- Prefer testing real policies: issue a test token or use a test authentication handler registered in `ConfigureServices` that creates a `ClaimsPrincipal` from headers (`X-Test-User`, `X-Test-Tenant`).
- For every protected endpoint test: no credentials -> 401, wrong role/scope -> 403, **another user's/tenant's resource -> 404/403** (the most common real-world bug), and the happy path.
- Never disable authorization in the test host to "make it easy".

## Faking dependencies

- HTTP: register the typed client with a fake `HttpMessageHandler` (or a local test server) returning canned responses, including 500s, timeouts and slow responses to test resilience behaviour.
- Time: `FakeTimeProvider.Advance(...)` instead of delays; code under test takes `TimeProvider` (in .NET since 8).
- Messaging: an in-memory bus/outbox you can inspect; assert the published event, then run the consumer twice to prove idempotency.
- Email/SMS/storage: fakes that record calls.

## What to assert at this level

- Status code, `Content-Type`, and the **ProblemDetails** shape for errors (no stack traces/internal details leaked).
- Persisted state (query the database afterwards through a new scope/context, not the one the request used).
- Headers: `Location` on 201, caching/ETag where promised, `Retry-After` on 429.
- Logs and metrics when they are part of the behaviour: fake `ILoggerProvider`, `MetricCollector<T>` from `Microsoft.Extensions.Diagnostics.Testing` (verify package version), `ActivityListener` for spans.

## Speed

- Share expensive fixtures; start containers once per run; run test classes in parallel only when they use isolated data; keep integration tests few and meaningful (see `test-pyramid.md`).
