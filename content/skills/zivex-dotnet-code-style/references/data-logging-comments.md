# EF Core, migrations, logging, comments

## EF Core

- PostgreSQL with `UseSnakeCaseNamingConvention()`; **one schema per module** (`public const string SchemaName = "orders";`); the module context derives from a building-block `ModuleDbContext`; a design-time factory per context.
- Configuration inline in `ConfigureModule(ModelBuilder)` with the lambda variable `b`, looping over property names for repeated configuration, or `IEntityTypeConfiguration<T>` classes under `Persistence/Configurations/` if the repository does that. Pick one.

```csharp
modelBuilder.Entity<Order>(b =>
{
    b.ToTable("orders");
    b.Property(x => x.Title).HasMaxLength(Order.MaxTitleLength);
    b.Property(x => x.CurrencyCode).HasMaxLength(3).IsFixedLength();
    foreach (var property in new[] { nameof(Order.Status), nameof(Order.Decision) })
    {
        b.Property(property).HasConversion<string>().HasMaxLength(30);
    }
    b.HasIndex(x => x.SourceRequestId).IsUnique().HasFilter("source_request_id IS NOT NULL");
});
```

- Private backing fields with `UsePropertyAccessMode(Field)`; constants on the aggregate reused for lengths.
- Many CHECK constraints, each with a comment saying why the database enforces it as well (`ck_work_order_diagnoses_code`).
- **No cross-schema foreign keys** (module boundary). Optimistic concurrency through a `Version` (long) property.
- Row-level security on tenant tables (`FORCE RLS`, keyed on a session setting) for systems that need the second isolation layer.
- JSON (jsonb) columns are change-tracked by reference: replace lists and records, never mutate them in place.

## Migrations

- Standard EF timestamp plus a **PascalCase noun phrase describing the change**: `20261008115325_SourceRequest`, `20261012211333_MultisiteInheritance`. The first per module is `Initial` or `Initial<Module>`.
- Sentence-style names are fine when they explain more: `..._InvoicesSayWhenTheyWereCancelled`.
- When several branches add migrations, round the timestamp by hand to order the merge (`20261111200000`, `20261111200100`).
- Migrations run through a `migrate` command or a migrator tool, **never** on API startup; expand -> migrate -> contract.

## Logging

`[LoggerMessage]` source generators only, as `private partial void LogXxx(...)` at the bottom of the class, with named placeholders and identifiers only:

```csharp
[LoggerMessage(Level = LogLevel.Warning, Message = "Workflow engine unavailable at {Address}; retrying")]
private partial void LogUnavailable(Exception exception, string? address);

[LoggerMessage(Level = LogLevel.Information, Message = "Account {UserId} erased after its deletion grace period")]
private partial void LogErased(Guid userId);
```

No string interpolation in log calls, no personal data, no request bodies.

## Comments

- **English only** in code; Dutch (or any other language) only in UI strings and fixtures.
- `/// <summary>` on almost every type, written as a plain-English sentence about **behaviour and why**, citing the specification where one exists (`(section 15-19, ADR-011)`). `<param>` and `<remarks>` for subtle rules. Typical density is 6 to 9 percent comment lines; long `<para>` essays belong only where a trade-off needs explaining.
- Inline `//` comments explain the non-obvious **why** or show worked numbers: `// 3 x 33.335 = 100.005 -> 100.01 (away from zero); 10% off 19.99 x 3 = 53.973 -> 53.97.`
- Do not write "what" comments or TODO lists in code; open questions go to `STATUS.md` or an ADR.
