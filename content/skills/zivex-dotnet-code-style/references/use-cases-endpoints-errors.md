# Use cases, endpoints, errors, events

## Use-case recipe (authorize first, one commit)

```csharp
internal sealed class ArchiveProject(IStaffAccess access, ProjectsDbContext db, TimeProvider time)
{
    public async Task<ProjectResponse> HandleAsync(Guid id, ArchiveProjectRequest request, CancellationToken ct)
    {
        await access.EnsureAsync(Capabilities.ProjectsManage, ct);            // 1. authorize first
        var project = await db.Projects.SingleOrDefaultAsync(p => p.Id == id, ct)
            ?? throw new NotFoundException("project");                         // 2. load (tenant-filtered)
        project.EnsureVersion(request.ExpectedVersion);                         // 3. optimistic concurrency -> 409
        project.Archive(time.GetUtcNow());                                      // 4. domain rule (422 on violation)
        db.Audit("project.archived", "project", project.Id, project.OwnerAccountId,
                 new { previousStatus = project.PreviousStatus });              // 5. audit facts, never free text
        db.Publish(new ProjectArchivedV1(project.Id, project.OwnerAccountId));  // 6. outbox event: ids only
        await db.SaveChangesAsync(ct);                                          // 7. ONE commit
        return ProjectResponse.From(project);
    }
}
```

- One service per aggregate with one `XxxAsync` method per use case (or one class per use case, if the repository does that). The first line authorizes. Mutations take `expectedVersion`. Audit and publish happen before the single save.
- Lists are bounded (`PageRequest`, max 200) with explicit filters and sorts; never return unbounded collections.

## Endpoint mapping

Minimal APIs only. A static `<Name>Endpoints` class with one line per route; lambdas call the service; kebab-case action routes (`/{id:guid}/reject-review`), `{id:guid}` constraints, `WithTags`.

```csharp
var group = api.MapGroup("/orders").WithTags("Orders");
group.MapGet("/counts", (OrderService s, CancellationToken ct) => s.CountsAsync(ct));
group.MapPost("/", async (CreateOrderRequest r, OrderService s, CancellationToken ct) =>
{
    var created = await s.CreateAsync(r, ct);
    return Results.Created($"/api/orders/{created.Id}", created);
});
group.MapPost("/{id:guid}/submit", (Guid id, OrderVersionRequest r, OrderService s, CancellationToken ct) => s.SubmitAsync(id, r, ct));
```

- Variant: a route table at the top and named `private static ... Async` handler methods below (`mine.MapGet("/inbox", InboxAsync)`); pick one per repository.
- Document error surfaces on the group: `ProducesProblem(401)`, `(403)`, `(404)`, `(409)`, `(422)`; `Produces<TDto>(200)`; `If-Match` header for versions where the repository uses ETags.
- Versioned public surfaces: `/api/v1/...`; an internal surface (cookie + CSRF through the BFF) and a public surface (bearer) stay separate.

## Error handling

Throw typed exceptions; middleware maps them to RFC 9457 problem details with `code` and `traceId`.

| Exception                                             | HTTP | Notes                                             |
| ----------------------------------------------------- | ---- | ------------------------------------------------- |
| `ValidationException(field, message)`                 | 400  | camelCase field paths such as `lines[0].quantity` |
| `NotFoundException("Order")`                          | 404  | also used for another tenant's row                |
| `ForbiddenException`                                  | 403  | only for resources the caller may know exist      |
| `ConcurrencyConflictException` / `DuplicateException` | 409  | `version_conflict`, unique violations             |
| `DomainRuleViolationException(code, message)`         | 422  | stable snake_case code                            |
| dependency failure                                    | 503  | with `Retry-After` when known                     |

```csharp
var account = await customers.FindAsync(new CustomerAccountId(r.CustomerAccountId), ct)
    ?? throw new ValidationException("customerAccountId", "Choose an existing customer.");
if (account.Status == CustomerStatus.Archived)
{
    throw new DomainRuleViolationException("customer_archived", "Archived customers cannot get new orders.");
}
```

- Common to every variant: **a stable snake_case machine code plus a human sentence that tells the user what to do** ("Someone else changed this job since you opened it. Reload it and apply your change again.").
- Pick one error model per repository (typed exceptions, typed outcomes such as `ReviewOutcome.Conflict("revoke_needs_person", "...")`, or `Result<T>` with static error catalogues) and keep it.
- A single `DomainException(code, message)` with dotted codes (`workspace.organization_required`) is fine for small codebases.

## Events

- Integration events carry a version suffix and fixed type metadata: `OrderPaidV1` with `static string EventType => "orders.order.paid"; static int EventVersion => 1;`.
- Event names are dotted lowercase (`identity.session.step_up_required`); audit actions are `noun.verb` (`project.archived`).
- Events carry **ids and minimal facts**, never secrets, content or personal data; consumers are idempotent (inbox).
- Customer-facing events are state transfer ("complete customer-safe state, keep the highest projection version"), so consumers can recover from lost or reordered messages.
- Do not use the `XxxIntegrationEvent` suffix in new code.
