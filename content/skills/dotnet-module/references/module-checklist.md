# Module checklist

**Boundary**

- [ ] One-sentence responsibility written in `AGENTS.md`, including what the module does **not** own.
- [ ] `<Name>.Contracts` contains only interfaces, DTO records and events; no ORM/web packages; no reference to the implementation.
- [ ] The implementation is `internal` except `Add<Name>Module` / `Map<Name>Endpoints`.
- [ ] No project reference or `using` into another module's implementation (`check-boundaries.mjs --strict` is clean).

**Data**

- [ ] Own schema/tables (and ideally own `DbContext` + migrations history table); no cross-module joins or foreign keys.
- [ ] Migrations reviewed; deploy order of all modules' migrations defined.
- [ ] Tenant and soft-delete filters applied where the repo uses them.

**Behaviour and tests**

- [ ] First slice works end to end (HTTP -> handler -> database) with handler and integration tests.
- [ ] Starter registration test passes; module tests run in `dotnet test`.
- [ ] Authorization policy on the endpoint group; negative authorization tests (other tenant/user).

**Operations**

- [ ] Options validated on start; secrets from the secret store.
- [ ] Logging category and (if the repo uses them) `Meter`/`ActivitySource` named after the module.
- [ ] Health check added if the module owns a critical dependency.

**Docs**

- [ ] `AGENTS.md` (purpose, contract, layout, rules, test command) written; root module map updated.
- [ ] Contract documented where consumers look (XML docs / OpenAPI for public endpoints).
