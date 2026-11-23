# Breaking-change checklist

`scripts/contract-diff.mjs` compares **public signatures** against a git ref. It classifies:

- **BREAKING**: a public type or member present in the base but gone or changed in the working tree (including interface members, record parameters, enum values).
- **ADDITIVE**: new public members/types.

It is a text heuristic: it cannot see the things below. Review them by hand.

## Breaking even though signatures look the same

- **Semantics**: a method now throws where it returned null, returns different units, or enforces a new precondition.
- **Nullability**: `string` -> `string?` (or the reverse) changes what callers must handle.
- **Ordering and paging**: default sort, page size or stability changed.
- **Behaviour of events**: when it is raised, what ids it carries, whether it is raised for new cases.
- **Serialisation**: JSON property names/casing, enum string values, date formats, optional vs required fields.
- **Error contract**: different error codes/exceptions for the same situation.
- **Performance contract**: an operation consumers call in a loop became expensive.

## Additive but still dangerous

- A new member on an **interface that consumers implement** (they fail to compile): add a new interface or a default interface member instead.
- A new **required** record/constructor parameter: give it a default or add an overload.
- A new **enum value**: consumers with exhaustive `switch` expressions may throw on it: document "treat unknown as other".
- A new **event field** consumers must handle: give old messages a safe default.

## Procedure for a breaking change

1. **Decide**: can it be done additively or as `V2`? Prefer that.
2. **List consumers**: `node ../dotnet-module-context/scripts/module-context.mjs <Module>` ("consumed by") and search the contract namespace and type names across the repo.
3. **Update all consumers in the same change** (inside a monolith they compile together) and keep every test green; or keep the old member `[Obsolete]` for a release.
4. **Test**: owner tests, each consumer's tests against the new contract, event round-trips.
5. **Communicate**: PR description lists the breaking members, the consumers updated, and any migration steps (data, config).
6. **Record**: update the module's `AGENTS.md` contract section and the changelog/ADR.
7. **CI**: `contract-diff.mjs --base origin/main --strict` in the pipeline fails on unplanned breaking changes; an intentional break is approved explicitly (label or allowlist) instead of silently passing.

## Beyond the repo

If the contract (or an HTTP API) is used outside this repository, real versioning applies: new package/API version, deprecation period with dates, usage telemetry, and a support window. See `aspnet-api-design` for HTTP APIs.
