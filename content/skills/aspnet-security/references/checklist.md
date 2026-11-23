# Pre-merge security checklist (OWASP Top 10 mapped)

Tick each line or write why it does not apply.

**A01 Broken access control**

- [ ] Fallback policy requires authentication; public endpoints are explicit `AllowAnonymous`.
- [ ] Every read/write of owned data checks ownership/tenant on the server (resource-based authz); ids from the client are not trusted.
- [ ] Admin/management endpoints have their own policy; no authorization only in the UI.
- [ ] CORS lists explicit origins; never wildcard + credentials.

**A02 Cryptographic failures**

- [ ] HTTPS everywhere, HSTS in production; no sensitive data in URLs/query strings.
- [ ] Passwords hashed with Identity's hasher (or Argon2/bcrypt/PBKDF2); no MD5/SHA-1 for security.
- [ ] Data Protection keys persisted and shared across instances; secrets from a vault.

**A03 Injection**

- [ ] Only parameterised data access; no `FromSqlRaw`/`ExecuteSqlRaw` with interpolation; identifiers allow-listed.
- [ ] No shell/process composed from input; paths normalised and checked against a base directory.
- [ ] Output encoded for its context; no `Html.Raw`/`MarkupString` with untrusted data.

**A04 Insecure design**

- [ ] Abuse cases considered (enumeration, brute force, replay, mass assignment); rate limits on login/OTP/reset/expensive endpoints.
- [ ] Request types are dedicated records (no entity binding); page size capped.

**A05 Security misconfiguration**

- [ ] No developer exception page or sensitive logging outside Development; Swagger/OpenAPI only in dev or authorised.
- [ ] `AllowedHosts` and known proxies configured; security headers set; default accounts/keys removed.
- [ ] Middleware order correct (run `aspnet-security-audit`'s `audit.mjs`).

**A06 Vulnerable and outdated components**

- [ ] `dotnet list package --vulnerable --include-transitive` clean (or accepted with a ticket); on a supported runtime (.NET 10+).

**A07 Identification and authentication failures**

- [ ] Lockout/throttling on credential checks; confirmed accounts; token validation fully on (issuer, audience, lifetime validated; `ValidateIssuerSigningKey` set to true because it defaults to false).
- [ ] Cookie flags `HttpOnly`, `Secure`, sensible `SameSite`; sessions invalidated on logout/password change.

**A08 Software and data integrity failures**

- [ ] No unsafe deserialization (`BinaryFormatter`, `TypeNameHandling`); CI pins and verifies dependencies; webhooks verify signatures.

**A09 Logging and monitoring failures**

- [ ] Authentication failures, access-denied and admin actions are logged (without secrets/PII); alerts exist for spikes.

**A10 Server-side request forgery**

- [ ] User-supplied URLs go through allow-lists, private-range blocking, redirect control, timeouts and size caps.

Run `node scripts/check-security.mjs <path> --strict` and attach the output (or "0 findings") to the change.
