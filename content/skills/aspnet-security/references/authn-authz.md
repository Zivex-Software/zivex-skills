# Authentication and authorization

Sources: learn.microsoft.com/aspnet/core/security/authorization/policies, /authentication/cookie, /authentication/api-endpoint-auth, /authentication/identity (checked for .NET 10).

## Default deny

```csharp
builder.Services.AddAuthorizationBuilder()
    .SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build());
```

- Every endpoint without its own policy now requires an authenticated user. Public endpoints say so: `.AllowAnonymous()` / `[AllowAnonymous]`.
- The fallback policy is **not combined** with a named or default policy. Static files served before the authorization middleware are not protected by it.
- `[Authorize]` without a policy name uses the default policy (authenticated user). `Roles=` builds its own policy. Several policies on one endpoint are ANDed.

## Policies and resource-based authorization

- Prefer **policies** (claims/requirements) over role strings scattered in code: `AddPolicy("CanApprove", p => p.RequireClaim("scope", "orders.approve"))`, applied with `RequireAuthorization("CanApprove")`.
- **Resource-based** checks decide per object (the order belongs to this user/tenant): `await authz.AuthorizeAsync(user, order, "OrderOwner")`. Do this in the handler/service, after loading the resource, for every read and write of owned data. Ownership/tenant checks are the most common real-world flaw (broken object-level authorization).
- Authorization handlers can run in any order and run even when authentication failed: never depend on ordering; use `context.Fail()` only when failure must be guaranteed.
- Attributes implementing `IAuthorizationRequirementData` are enforced only on minimal-API and routed endpoints.
- Return **404** instead of 403 when revealing the existence of a resource is itself a leak.

## JWT bearer (APIs)

```csharp
builder.Services.AddAuthentication().AddJwtBearer(o =>
{
    o.Authority = config["Auth:Authority"];       // discovery + signing keys
    o.Audience = config["Auth:Audience"];
    // TokenValidationParameters validate issuer, audience, lifetime and signing key by default.
    o.TokenValidationParameters.ClockSkew = TimeSpan.FromMinutes(1);
});
```

- Never set `ValidateIssuer/ValidateAudience/ValidateLifetime/ValidateIssuerSigningKey = false`. (Defaults and exact option names: not re-verified in this pass; confirm in the JwtBearer docs when changing.)
- Keep `RequireHttpsMetadata` true outside local development. Short token lifetimes; validate `scope`/`role` claims in policies, not just "has a token".
- Do not use the Resource Owner Password Credentials grant. Prefer an identity provider (OIDC) over rolling your own token issuing.
- `dotnet user-jwts` is for **development** tokens only.

## Cookies (browser apps)

- Encrypted with Data Protection; in a farm or container set a shared key ring and the same application name (see `secrets-config-logging.md`).
- Set `HttpOnly`, `Secure` (always), and `SameSite` (cookie auth defaults to `Lax`; `Strict` breaks cross-site sign-in flows such as OAuth). Sliding expiration with an absolute cap for sensitive apps.
- `UseCookiePolicy` goes before cookie authentication.
- **.NET 10:** cookie-authenticated **API endpoints** (`[ApiController]`, minimal APIs that read/write JSON, `TypedResults`, SignalR hubs) return **401/403** instead of a 302 redirect to login. Override with `DisableCookieRedirect()` / `AllowCookieRedirect()`; app-wide opt-out is the `Microsoft.AspNetCore.Authentication.Cookies.IgnoreRedirectMetadata` switch. On .NET 8/9 expect redirects and handle them in the client or events.

## ASP.NET Core Identity

- Require confirmed accounts in production (`RequireConfirmedAccount = true`).
- Lockout needs `PasswordSignInAsync(..., lockoutOnFailure: true)`.
- Set password and lockout options explicitly; the documented sample values (length 6, 5 attempts) are examples, not recommendations: use at least 12 characters or passkeys.
- .NET 10 adds WebAuthn/FIDO2 **passkeys** to Identity (release notes; details not verified here): prefer them for new sign-in flows when the repo uses Identity.
- Never roll your own password hashing; never log or email passwords.

## Pitfalls to flag

- Authorization only in the UI/client; endpoints reachable without a policy.
- `[AllowAnonymous]` on a controller that later gains sensitive actions.
- Trusting `X-Forwarded-*` or a `userId` in the body/route instead of the authenticated principal.
- Role checks by string compare in business code.
