# Migrations

Source: learn.microsoft.com/ef/core/managing-schemas/migrations/applying (checked), EF 10 what's new.

## Authoring

- `dotnet ef migrations add <Name> -p <DataProject> -s <StartupProject>`; one migration per logical change; descriptive names; commit the migration **and** the updated model snapshot.
- Review the generated code **and** SQL (`dotnet ef migrations script <from> <to>`): data loss (drops, narrowing columns), long locks (index builds, column rewrites), default values on large tables, renames detected as drop+add.
- Never edit or delete a migration that has been applied anywhere shared; add a new one. Squash only before first release.
- Destructive changes in two steps (expand/contract): add new column -> deploy code writing both -> backfill -> switch reads -> drop old in a later release.
- Data migrations: SQL inside the migration (`migrationBuilder.Sql`) kept idempotent and batched for large tables.
- Each module owns its migrations and (ideally) its schema/`__EFMigrationsHistory` table (`MigrationsHistoryTable("__EFMigrationsHistory", "orders")`).
- Down methods: write them if rollback is realistic; otherwise state "roll forward only" in the PR.

## CI checks

- `dotnet ef migrations has-pending-model-changes` fails the build when the model changed without a migration (EF 9+ also throws `PendingModelChangesWarning` from `Migrate`).
- Generate the idempotent script in CI as an artifact; run migrations against a real database in an integration test stage.

## Deploying

The docs recommend, in order:

1. **Migration bundle** for automated deployment: `dotnet ef migrations bundle --output artifacts/efbundle` then run `./efbundle --connection "<cs>"` as a **one-shot deployment job**. Set `ASPNETCORE_ENVIRONMENT=Production` when generating and running. A bundle runs `UseSeeding` and uses migration locking.
2. **SQL script** when SQL must be reviewed/approved/archived (DBA): `dotnet ef migrations script --idempotent --output artifacts/migrations.sql`. No seeding, no locking.
3. **`Database.MigrateAsync()` from app code**: the docs say to consider carefully for production. Drawbacks: runs with the app's (elevated) permissions, no SQL review, hard rollback, and every replica racing at startup (migration locking since EF 9 mitigates but doesn't remove startup coupling). Acceptable for local development, tests and single-instance internal tools.

- In containers/Kubernetes: don't run migrations from every replica's entrypoint; use an init job/pipeline step that completes before rollout.
- Don't call `EnsureCreatedAsync()` before `MigrateAsync()`; don't wrap `MigrateAsync` in an explicit transaction (unsupported). EF 10 no longer spans all migrations in one transaction.
- Use a separate, more privileged connection string for migrations than for the running app (app = DML only).

## Seeding

- Reference data: `UseSeeding`/`UseAsyncSeeding` (EF 9+) or `HasData` for static rows; environment/demo data in a dev-only seeder. Never seed default admin passwords.

## Zero-downtime notes

- Old and new app versions run against the same schema during rollout: every migration must be compatible with the previous app version (expand/contract, nullable-first, no renames in one step).
