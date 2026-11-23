# Audit procedure

Use with `scripts/audit.mjs`. Each section: what to look for -> how to find it -> good looks like.

## 1. Access control (broken object/function level authorization)

- **Find**: every endpoint without an authorization policy; every handler loading an entity by id from the route/body.
  `rg -n "Map(Get|Post|Put|Delete|Patch)\(" ; rg -n "\[Http(Get|Post|Put|Delete|Patch)" ; rg -n "FindAsync|FirstOrDefaultAsync\(.*\bid\b"`
- **Good**: fallback policy + explicit `AllowAnonymous`; the query includes the owner/tenant (`Where(o => o.TenantId == tenant.Id && o.Id == id)`) or an `AuthorizeAsync(user, resource, policy)` runs before use; 404 for foreign ids.
- **Bad**: `Find(id)` then return; role checks only in the UI; `userId` taken from the request instead of the principal; admin routes with only `[Authorize]`.
- Multi-tenancy: global query filters in place; `IgnoreQueryFilters()` call sites reviewed; background jobs set the tenant explicitly.

## 2. Injection

- **Find**: `rg -n "FromSqlRaw|ExecuteSqlRaw|SqlQueryRaw|CommandText\s*=|new SqlCommand"`, `Process.Start`, `Path.Combine(` with request data, `Html.Raw`, `MarkupString`, `XmlDocument`/`XmlReader` settings (DTD processing), `BinaryFormatter`, `TypeNameHandling`.
- **Good**: parameters or LINQ; identifiers allow-listed; encoders on output; XML with `DtdProcessing.Prohibit`.

## 3. Authentication and sessions

- JWT: issuer, audience and lifetime validated (defaults are true), `ValidateIssuerSigningKey = true` (its default is **false**), `RequireSignedTokens` left on, no `Validate* = false`; HTTPS metadata; short expiry; refresh token rotation if used.
- Cookies: `HttpOnly`, `Secure`, `SameSite`; Data Protection ring shared and persisted; logout invalidates server-side state where applicable.
- Identity: lockout on, confirmed account, strong password policy or passkeys, password reset tokens single-use and short-lived, no user enumeration via messages/timing on login and reset.
- Rate limiting on login/token/reset/OTP endpoints.

## 4. Configuration and deployment

- Pipeline order (script): forwarded headers first, routing -> CORS -> authentication -> authorization -> antiforgery.
- HTTPS redirection/HSTS; `AllowedHosts`; known proxies; CORS origins explicit; no developer exception page or OpenAPI exposed in production; no `EnableSensitiveDataLogging`.
- Secrets not in appsettings/source/Docker layers/CI logs; `git log -p -S"password" -- appsettings*` for history.
- Container: non-root, read-only filesystem where possible, no dev certificate, health endpoints not leaking details.

## 5. Data protection and privacy

- Personal data inventory: what is stored, why, retention, deletion path. Sensitive fields encrypted at rest where required (EF value converters / DB-level / Data Protection).
- DTOs expose only intended fields; no entities/ORM navigation graphs in responses; pagination caps; no PII in URLs.
- Logs and traces free of credentials and personal data; exception responses generic.
- Backups, exports and admin tools follow the same access rules.

## 6. Files and outbound calls

- Uploads: size limits, extension allow-list + content check, random stored name, outside the app dir, `nosniff`.
- Outbound HTTP with user-provided URLs: allow-list, private-range block, redirects controlled, timeouts (SSRF).
- Webhooks received: signature verification, replay protection (timestamp/nonce), idempotency.

## 7. Dependencies

- `dotnet list package --vulnerable --include-transitive` (script section 3); outdated runtime (.NET 8/9 unsupported since 10 Nov 2026).
- Unmaintained or unexpected packages (`dotnet list package --deprecated`), floating versions, missing lock file / central package management.

## 8. Logging and detection

- Authentication failures, authorization denials, admin actions, and rate-limit rejections are logged with identifiers (not secrets) and a trace id.
- Alerting exists; no log injection (structured templates).

## Quick patterns worth grepping

```text
AllowAnyOrigin|SetIsOriginAllowed\(_\s*=>\s*true      DangerousAcceptAnyServerCertificateValidator
Validate(Issuer|Audience|Lifetime|IssuerSigningKey)\s*=\s*false      RequireHttpsMetadata\s*=\s*false
DisableAntiforgery|UseDeveloperExceptionPage|EnableSensitiveDataLogging
MD5\.|SHA1\.|new Random\(\)      "(Password|Secret|ApiKey|Token)"\s*:\s*"[^"]{6,}"
```
