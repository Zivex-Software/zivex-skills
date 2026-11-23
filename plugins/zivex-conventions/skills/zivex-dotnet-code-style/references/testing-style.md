# Test style

## Stack and projects

- **xUnit with plain `Assert`**. No FluentAssertions or Shouldly (both are on the "not without an ADR" list). A mocking library only where the repository already has one.
- Testcontainers (PostgreSQL, RabbitMQ, Redis, MinIO) for integration tests; NetArchTest for architecture.
- One project per kind: `tests/{Unit,Integration,Architecture,Contract,Security}`, a folder per module inside each.

| Suite        | Proves                                                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Unit         | Domain rules, value objects, state machines, time and DST, money rounding                                                             |
| Architecture | Module boundaries, internals, host composition, forbidden source patterns                                                             |
| Integration  | API flows against a real database, outbox and inbox, worker end to end                                                                |
| Security     | Every endpoint: 401 anonymous, 403 wrong capability, CSRF, cross-tenant 404, permission matrix, dev-identity guard, hardening headers |
| Contract     | OpenAPI snapshot, event JSON schemas with golden fixtures, customer-safe projections with sentinel leakage tests                      |
| E2E          | Browser flows: permissions in the UI, conflict handling, narrow width, console errors, accessibility                                  |

## Naming

**Test names are full English sentences with underscores that state behaviour.** Do not use `_Should`:

`Create_review_send_and_the_customer_accepts_the_exact_version_once`, `Someone_elses_challenge_value_does_not_verify_my_domain`, `A_discount_cannot_exceed_the_price`, `Line_input_is_validated_per_field`.

- One test class per **aggregate, feature or flow**, not per use case: `OrderTests`, `OrderFlowTests`, `WorkspaceApiTests`. `public sealed class`, optionally with a `<summary>` naming the slice and specification section.

## Helpers instead of builders

No builder classes. **Static factory helpers at the top of the test class** (`NewOrder()`, `Sent()`, `Line(...)`, a `Build(...)` that returns a tuple), fixed clock constants, and other test classes reuse them.

```csharp
public sealed class OrderTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 5, 9, 0, 0, TimeSpan.Zero);

    internal static Order NewOrder() =>
        Order.Create("ORD-2026-0001", new CustomerId(Guid.CreateVersion7()), "Webshop relaunch", Currency.Eur, Now);

    [Fact]
    public void Drafts_compute_totals_and_margin()
    {
        var order = NewOrder();
        // ...
    }
}
```

## Integration tests

- `public sealed class OrderFlowTests(ApiFixture api) : IClassFixture<ApiFixture>`; real HTTP through `api.As(DevelopmentUsers.Sales)`; JSON bodies as anonymous objects.
- A `Sentinel` string proves internal fields never leak into customer-facing responses, events or logs.
- Every new resource gets a cross-tenant negative test.
- Security suites are separate projects and large: sweep every endpoint (401, 403, CSRF, cross-tenant 404) so a new endpoint without a policy fails the build.

## What not to do

- No `Thread.Sleep`, wall-clock time, unseeded randomness or order-dependent tests (inject `TimeProvider`, use fixed constants).
- No shared mutable statics between test classes; reuse helpers, not state.
- Container-backed suites run one or two at a time on a shared machine; report skipped suites as "written, not yet run".
