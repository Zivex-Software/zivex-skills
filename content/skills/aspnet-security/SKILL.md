---
name: aspnet-security
description: Builds secure ASP.NET Core code - authentication and authorization, input validation, CORS/CSRF, HTTPS/HSTS, rate limiting, secrets, Data Protection and safe logging - and checks it with a scanner script. Use when writing or changing endpoints, auth, configuration, file handling, or anything that touches user input, secrets or personal data.
---

# Secure ASP.NET Core code

Target: **.NET 10 (LTS)**. Notes mark what differs on .NET 8/9 (both out of support since 10 Nov 2026: recommend upgrading) and on .NET 11 (STS). Items marked "11+" must not be used on .NET 10.

## Start here (module first)

1. Identify the module the task belongs to and read its `AGENTS.md`. A repo without modules is one module.
2. Work only inside that module; reach other modules only through their `.Contracts` project.
3. Security rules are per module **and** per host: authorization policies, CORS, rate limits and headers live in the host (`Program.cs`), endpoints and data access in the module. Check both.

## Workflow

1. **Classify the change**: new endpoint, auth/session change, file/upload, outbound HTTP, data access, configuration/secret, logging. Open the matching reference below.
2. **Default deny**: set a fallback authorization policy (`RequireAuthenticatedUser`) and mark public endpoints `AllowAnonymous` explicitly. Authorize by resource (ownership/tenant) on the server, never by trusting ids from the client.
3. **Validate at the boundary**: bind to a dedicated request type; validate it (DataAnnotations/`AddValidation()` on .NET 10 minimal APIs, or the repo's validator); never bind persistence entities from requests (over-posting).
4. **Write the secure version first**, then run the scanner:
   `node scripts/check-security.mjs <repo-or-module-path>` (add `--strict` in CI to fail on HIGH findings). It is regex-based: confirm each hit in context; no hits is not proof of safety.
5. **Test the negative paths**: unauthenticated -> 401, wrong user/tenant -> 403/404, invalid input -> 400 ProblemDetails, rate-limited -> 429. Use `dotnet-testing`.
6. **Verify** with `dotnet-verify`. For a whole-codebase review use `aspnet-security-audit`.

## Non-negotiables

- No secrets, connection strings with passwords, tokens or personal data in source, appsettings, logs, errors or test fixtures.
- SQL only through EF LINQ, `FromSql`/`ExecuteSql` (interpolated = parameterised) or `DbParameter`; table/column names are never parameters: allow-list them.
- Never disable TLS validation, antiforgery, CORS checks or authorization "to make it work".
- State-changing operations are never GET.
- Errors to clients are generic ProblemDetails with a trace id; details go to logs (without secrets).
- Passwords: ASP.NET Core Identity's hasher (or Argon2/bcrypt/PBKDF2), never MD5/SHA-1/plain SHA-256.
- Tokens, codes, keys: `RandomNumberGenerator`, not `Random`.

## References (open the one you need)

- `references/authn-authz.md` - policies, fallback policy, resource-based authz, JWT bearer, cookies, Identity, the .NET 10 401/403 change.
- `references/input-output.md` - validation, over-posting, SQL, open redirects, file uploads, SSRF, XSS, deserialization, command/path injection.
- `references/http-hardening.md` - HTTPS/HSTS, forwarded headers, CORS, CSRF/antiforgery, rate limiting, security headers, request limits, pipeline order.
- `references/secrets-config-logging.md` - user-secrets, environment/Key Vault, Data Protection key ring, safe logging and PII, dependencies and supply chain.
- `references/checklist.md` - one-page pre-merge security checklist mapped to OWASP Top 10.
