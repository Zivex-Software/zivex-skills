# Slice checklist

**Contract and routing**

- [ ] Route uses nouns; method matches semantics (GET safe, PUT/DELETE idempotent, POST creates or acts); status codes and ProblemDetails documented (`Produces*`/typed results).
- [ ] Request/response are dedicated records; no entity in or out; page size capped for lists.
- [ ] Creating returns 201 + `Location`; long work returns 202 with a status resource.

**Security**

- [ ] Authorization policy on the endpoint/group; ownership/tenant checked in the query or handler; 404 for foreign ids.
- [ ] Input validated at the boundary (shape) and in the handler (rules); sizes bounded.
- [ ] No secrets/PII in logs, errors or responses.

**Behaviour**

- [ ] Business rules live in the domain object/handler, not the endpoint.
- [ ] Failure modes mapped: validation 400, not found 404, conflict/concurrency 409, unexpected 500 via the global handler.
- [ ] Idempotency considered (retries, duplicate submits); concurrency token where lost updates matter.

**Data**

- [ ] `Select`/`AsNoTracking` for reads; no N+1; one `SaveChangesAsync`; migration added and reviewed if the model changed.
- [ ] Cross-module data via contract only.

**Operations**

- [ ] `CancellationToken` flows to every I/O call; outbound calls have timeouts/resilience.
- [ ] Log message with ids (templates); metric/trace where operationally relevant.

**Tests**

- [ ] Handler tests: success + each rule failure + edge cases; integration test: happy path through the real pipeline/database; negative authorization test (other tenant/user).
- [ ] `dotnet-verify` run; scanners run on the module and every hit confirmed.
