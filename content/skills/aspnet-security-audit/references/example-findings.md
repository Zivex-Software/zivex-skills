# Example findings (report format)

Four worked findings from lead to fix. Copy the shape: where, what, attack, impact, fix, status.

## 1. [HIGH] Orders can be read by any signed-in user (BOLA)

- **Where**: `src/Orders/Features/GetOrder.cs:24` (lead: `audit.mjs` ownership candidates)
- **What**: the handler loads `db.Orders.FirstOrDefaultAsync(o => o.Id == id)`; no tenant or owner predicate and no global query filter on `Order`.
- **Attack**: sign in to tenant A, call `GET /orders/{id}` with an order id of tenant B (ids appear in e-mails and URLs).
- **Impact**: any tenant's orders, customer names and addresses are readable.
- **Fix**: add the tenant to the query (`Where(o => o.TenantId == tenant.Id && o.Id == id)`) or a global filter plus a test; return 404 for foreign ids. Add the negative test `Another_tenants_order_is_not_found`.
- **Status**: confirmed (reproduced locally with two seeded tenants).

## 2. [HIGH] JWT signing key is not validated (misconfiguration)

- **Where**: `src/Api/Program.cs:41`
- **What**: `ValidateIssuerSigningKey` is never set; its default is **false**. Keys come from configuration, not from a metadata endpoint.
- **Attack**: depends on how the key is supplied; if an attacker can influence the key source or a token's `kid` resolution, validation of the key itself is skipped.
- **Impact**: weakened token validation.
- **Fix**: set `ValidateIssuerSigningKey = true`; keep `RequireSignedTokens` on; prefer `Authority` with discovery.
- **Status**: confirmed by reading the configuration; exploitability depends on the key source (unconfirmed).

## 3. [MEDIUM] Login endpoint has no rate limit (resource consumption / authentication)

- **Where**: `src/Api/Program.cs` (lead: `audit.mjs` "No rate limiting configured")
- **What**: `POST /login` accepts unlimited attempts; lockout is configured but a distributed attack across accounts is not throttled.
- **Attack**: credential stuffing from many IPs against many accounts.
- **Impact**: account takeover for weak or reused passwords.
- **Fix**: `AddRateLimiter` with a per-IP and per-account token bucket on `/login`, `/token` and `/password-reset` (`RequireRateLimiting`), `Retry-After` on rejection; set `RejectionStatusCode` to 429 (the default is 503).
- **Status**: confirmed.

## 4. [LOW] Exception messages returned to the client (information disclosure)

- **Where**: `src/Billing/Features/Pay.cs:57` (lead: `check-api.mjs` API001)
- **What**: `catch (Exception ex) { return Results.Problem(ex.Message); }`.
- **Attack**: send malformed input and read database or file-path details from the error.
- **Impact**: reveals internals that help further attacks.
- **Fix**: remove the catch; let the global exception handler return a generic ProblemDetails with a trace id and log the exception.
- **Status**: confirmed.

## Writing tips

- One finding, one root cause; reference every location in a list.
- Say what you verified and how; keep "unconfirmed" honest.
- Never paste secrets; give the location and a redacted preview.
- Put fixes in the language of the codebase (policy names, types), not generic advice.
