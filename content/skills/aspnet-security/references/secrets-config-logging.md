# Secrets, configuration, Data Protection, logging, dependencies

Sources: learn.microsoft.com/aspnet/core/security/app-secrets, /key-vault-configuration, /data-protection/configuration/overview, /ef/core/logging-events-diagnostics (checked).

## Secrets

- **Never** store passwords or tokens in source or committed config. Secret Manager (`dotnet user-secrets init/set/list/remove/clear`) is development-only and unencrypted: not a trusted store. `WebApplication.CreateBuilder` loads user secrets in Development.
- Environment variables use `__` for hierarchy (`ConnectionStrings__Default`), on every platform.
- Production: a vault (Azure Key Vault via `Azure.Extensions.AspNetCore.Configuration.Secrets` + `Azure.Identity`) with a managed identity (`ManagedIdentityCredential`; `DefaultAzureCredential` is for development). Key Vault names use `--` for `:`. One vault per app and environment. Secrets are cached until reload: plan rotation (`ReloadInterval`).
- Prefer **no password at all**: managed identity / integrated auth to databases and queues.
- If a secret was committed, rotate it (history is not a safe place) before anything else.

## Data Protection (cookies, antiforgery, tokens)

- Defaults suit a single machine. In containers and multi-instance deployments **persist the key ring** to shared storage (blob/Redis with persistence/database/volume) and set `SetApplicationName` identically on all instances.
- Changing the persistence location removes automatic encryption at rest: add `ProtectKeysWith...` (certificate, Key Vault). Restrict access to the key storage to the app only. Default key lifetime is 90 days.
- Without a shared ring users get logged out and antiforgery fails after restarts/scale-out.

## Configuration hygiene

- `appsettings.json` holds non-secret defaults only; no real hosts/ids of production. Bind with `IOptions<T>` + `ValidateDataAnnotations().ValidateOnStart()` so missing secrets fail at startup.
- Different configuration per environment; `ASPNETCORE_ENVIRONMENT=Production` in prod (developer pages and sensitive logging stay off).
- `AllowedHosts` set to real hosts.

## Logging and personal data

- Log identifiers (order id, user id), not payloads, tokens, passwords, connection strings, full request bodies or personal data (names, e-mail, addresses, health, financial data). Redact or hash when you must correlate.
- EF: values are not in exception messages by default; `EnableSensitiveDataLogging()` writes parameter values to logs: development only. `EnableDetailedErrors()` likewise.
- Use message templates (structured logging), not interpolation (see `aspnet-observability`).
- Retention and access to logs follow the same rules as the data itself (GDPR: purpose limitation, retention, deletion on request). Don't ship logs with personal data to third parties without a basis.

## Dependencies and supply chain

- `dotnet list package --vulnerable --include-transitive` in CI; enable NuGet audit (`<NuGetAudit>true</NuGetAudit>`, `NuGetAuditMode=all`) and treat high/critical as build errors.
- Pin versions with `Directory.Packages.props` (central package management) and a lock file (`RestorePackagesWithLockFile`) for reproducible restores. Use Dependabot/Renovate.
- Add a package only with a reason; prefer ones already in the repo; check maintenance and licence.
- Supported runtime: .NET 8 and 9 are out of support since 10 Nov 2026: unpatched vulnerabilities. Run on .NET 10 (support until 14 Nov 2028).
- Container images: pin base image digests, run as non-root, no secrets in layers.
