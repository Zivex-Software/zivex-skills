---
name: zivex-dotnet-code-style
description: How Zivex .NET code looks - file and namespace layout, sealed internal classes with primary constructors, positional record DTOs, minimal-API endpoint mapping, authorize-first use cases, exception-to-HTTP mapping with stable error codes, versioned events, source-generated logging, EF Core and migration naming, comment style, and test style (xUnit plain asserts, sentence-style test names, static factory helpers). Opt-in, use when writing or reviewing .NET code the Zivex way.
---

# Zivex .NET code style

How Zivex backend code actually looks, distilled from many repositories into one style. **Opt-in**: it makes new code consistent with the Zivex house style; it never overrides what an existing repository already does (copy the closest existing file instead).

## Start here (module first)

1. Identify the module and read its `AGENTS.md`; open the closest existing use case, endpoint and test and **mirror them**. This skill is the tie-breaker when a repository has no precedent.
2. Pick one style per repository and keep it: do not mix a service-per-aggregate style with handler-per-use-case in one codebase.
3. Stay inside the module; other modules only through `.Contracts`.

## Workflow

1. **Layout and classes** (`references/layout-and-classes.md`): build baseline, namespaces, `internal sealed` classes, primary constructors, record DTOs, ids, enums, modern C#.
2. **Use cases, endpoints, errors, events** (`references/use-cases-endpoints-errors.md`): the authorize-first use-case recipe, minimal-API mapping, exception -> HTTP table, event naming and versioning.
3. **Data and logging** (`references/data-logging-comments.md`): EF Core conventions, one schema per module, migrations naming, `[LoggerMessage]`, comment style.
4. **Tests** (`references/testing-style.md`): suites per kind, xUnit plain asserts, sentence-style test names, static factory helpers, integration fixtures, sentinel leak tests.
5. **Check**: `dotnet build` with warnings as errors, `dotnet format --verify-no-changes`, then `dotnet-verify`. Standards behind the style: `zivex-engineering-standards`. Slice shape: `zivex-vertical-slice`.

## The style in twelve lines

- `internal sealed class` for everything that is not a contract; primary constructors for dependency injection.
- `public sealed record` for requests, responses and DTOs; positional parameters.
- Enums with explicit values starting at 1, stored as strings.
- `TimeProvider` injected everywhere; UUIDv7 ids; limits as constants on the aggregate that EF reuses.
- Minimal APIs only (no controllers): a static `<Name>Endpoints` class, kebab-case action routes, `{id:guid}` constraints, `WithTags`.
- First statement of every use case: the capability check. Then load (tenant-filtered), concurrency check, domain rule, audit, publish, **one** `SaveChangesAsync`.
- Errors are typed exceptions or outcomes mapped once to problem details with a stable snake_case `code`.
- Every async method ends in `Async`; the token parameter is `cancellationToken` (`ct` in endpoint lambdas).
- `[LoggerMessage]` source generation only, ids only, never personal data.
- English in code and comments; `/// <summary>` on types, explaining behaviour and why, not what.
- No MediatR, AutoMapper or generic repositories; mapping is a static `From(...)` on the DTO.
- Tests: xUnit with plain `Assert`; names are full English sentences with underscores stating behaviour; static factory helpers at the top of the test class.

## References

- `references/layout-and-classes.md` - build baseline, layout, class shape, DO/DON'T.
- `references/use-cases-endpoints-errors.md` - use-case recipe, endpoint mapping, error mapping, events.
- `references/data-logging-comments.md` - EF Core, migrations, logging, comments.
- `references/testing-style.md` - test projects, naming, helpers, fixtures, security and contract tests.
