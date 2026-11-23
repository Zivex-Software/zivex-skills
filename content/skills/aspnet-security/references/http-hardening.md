# HTTP hardening

Sources: learn.microsoft.com/aspnet/core/security/enforcing-ssl, /cors, /anti-request-forgery, /samesite, /host-and-deploy/proxy-load-balancer, /performance/rate-limit (checked for .NET 10).

## Pipeline order (host `Program.cs`)

1. `UseForwardedHeaders` (first, when behind a proxy) -> `UseExceptionHandler` / `UseHsts` (non-dev) -> `UseHttpsRedirection`
2. `UseStaticFiles` (fallback policy does not protect files served before authorization)
3. `UseRouting` -> `UseRateLimiter` (after routing when endpoint attributes are used) -> `UseCors` (after routing, before authorization) -> `UseAuthentication` -> `UseAuthorization` -> `UseAntiforgery` (after auth) -> `UseOutputCache` (after CORS/routing/auth)

The `audit.mjs` script of the `aspnet-security-audit` skill checks these pairs.

## HTTPS, HSTS

- APIs should not listen on HTTP, or must close the connection with 400; don't use `RequireHttpsAttribute` on Web APIs that receive sensitive data (a redirect leaks the first request).
- `UseHsts` is production-only (browsers cache it; `localhost` is excluded). Default `max-age` is 30 days; when first rolling out, start with a short value (at most a day) before raising it. `Preload` is not part of the HSTS RFC: only add it deliberately.
- Don't create a dev certificate in images (`DOTNET_GENERATE_ASPNET_CERTIFICATE=false`).

## Behind a proxy / load balancer

- `ForwardedHeadersOptions.ForwardedHeaders` defaults to `None`: set `XForwardedFor | XForwardedProto` (and Host if needed).
- **Trust only known proxies**: configure `KnownProxies`/`KnownNetworks` (defaults are loopback). Trusting everything lets clients spoof their IP and scheme. `ASPNETCORE_FORWARDEDHEADERS_ENABLED` does not set known proxies. `ForwardLimit` defaults to 1.
- Set `AllowedHosts` to your real host names (an empty/`*` value accepts any Host header and lets attackers spoof generated links).
- 11+: forwarded headers are ignored for connections without an IP address. Not on .NET 10.

## CORS

- Explicit origins: `WithOrigins("https://app.example.com")` (no trailing slash). `AllowAnyOrigin` + `AllowCredentials` is invalid and unsafe; `SetIsOriginAllowed(_ => true)` + credentials is equally unsafe.
- `UseCors` after `UseRouting`, before `UseAuthorization`. `[DisableCors]` does not override `RequireCors`.
- CORS relaxes the browser's same-origin policy; it is not an authentication control and an API is not safer by allowing it. Keep it off unless a browser on another origin must call the API.
- Wildcard sub-domains only with `SetIsOriginAllowedToAllowWildcardSubdomains()` and an exact parent domain.

## CSRF / antiforgery

- Cookie-authenticated, state-changing endpoints need protection. Never change state on GET; HTTPS alone does not prevent CSRF.
- Combine `SameSite` cookies with antiforgery tokens. Minimal APIs that accept **form** data validate tokens when `UseAntiforgery()` is added (POST/PUT/PATCH; opt out with `.DisableAntiforgery()` only for endpoints that don't use cookie auth).
- Pure bearer-token APIs (token in the `Authorization` header) are not CSRF-prone; cookie-based ones are.
- Farms: antiforgery needs the same Data Protection key ring.
- 11+: an automatic cross-site-request middleware (Sec-Fetch-Site/Origin based) exists in the .NET 11 docs; do not use it on .NET 10.

## Rate limiting

```csharp
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;   // the default is 503, so set 429 explicitly
    o.AddPolicy("per-user", ctx => RateLimitPartition.GetTokenBucketLimiter(
        ctx.User.Identity?.Name ?? ctx.Connection.RemoteIpAddress?.ToString() ?? "anon",
        _ => new TokenBucketRateLimiterOptions { TokenLimit = 20, TokensPerPeriod = 10,
            ReplenishmentPeriod = TimeSpan.FromSeconds(10), QueueLimit = 0 }));
});
app.UseRateLimiter();
app.MapPost("/login", Login).RequireRateLimiting("per-user");
```

- Limiters: fixed window, sliding window, token bucket, concurrency (caps concurrent requests, not rate). `QueueLimit = 0` disables queuing.
- Partition by user id or API key, falling back to IP; partitions built from user-controlled values can be abused for DoS (unbounded partitions).
- Counters are **per instance**: effective limits multiply with replicas; use an edge/gateway limiter for hard global limits.
- Always rate-limit login, token, password-reset, OTP and expensive endpoints. Add `Retry-After` in `OnRejected`.
- Apply named policies with `.RequireRateLimiting` or `[EnableRateLimiting]`; `[DisableRateLimiting]` overrides.

## Headers (browser-facing apps)

Set via middleware or the reverse proxy (the ASP.NET Core docs pages checked here do not prescribe a header set; use OWASP Secure Headers guidance): `Content-Security-Policy` (start report-only), `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, clickjacking protection (`frame-ancestors` in CSP). Remove `Server`/`X-Powered-By` where possible (`AddServerHeader = false` on Kestrel).

## Limits and timeouts

- Keep Kestrel limits at defaults unless justified; set `MaxRequestBodySize` per endpoint (`[RequestSizeLimit]`) instead of globally. Add request timeouts (`AddRequestTimeouts`) on slow endpoints.
- Response compression of dynamic pages over HTTPS can enable CRIME/BREACH-style attacks: `EnableForHttps` is off by default for that reason; mitigate with antiforgery tokens or leave it off for secret-bearing pages.
