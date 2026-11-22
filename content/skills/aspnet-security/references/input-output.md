# Input, output and data handling

Sources: learn.microsoft.com/aspnet/core/security/preventing-open-redirects, /cross-site-scripting, /mvc/models/file-uploads, /ef/core/querying/sql-queries (checked).

## Validation and over-posting

- Bind to **request records** with only the fields the caller may set. Never bind EF entities from requests; never return them (map with `Select` to DTOs).
- .NET 10 minimal APIs: `builder.Services.AddValidation();` validates query, header and body via DataAnnotations (400 on failure). Opt out per endpoint with `.DisableValidation()`. On .NET 8/9 or complex rules use the repo's validator (FluentValidation, etc.).
- Unknown JSON members are ignored unless you set `JsonUnmappedMemberHandling.Disallow`; use it on endpoints where strictness matters.
- Validation is not authorization, and "never rely on validation alone" for XSS/SQL: encode and parameterise as well.
- Limit sizes: collection lengths, string lengths, page sizes (cap `pageSize`), request body size.

## SQL

- Safe: LINQ, `FromSql($"... {x}")` / `ExecuteSql($"...")` (interpolation becomes parameters), explicit `DbParameter`s.
- Unsafe: `FromSqlRaw`/`ExecuteSqlRaw` with string interpolation or concatenation. Column and table names can't be parameters: map user choices through an allow-list (`switch` to a fixed identifier).
- Dapper/ADO.NET: always parameters.

## Open redirects

- `LocalRedirect(url)` / `Results.LocalRedirect(url)` throw for non-local URLs. Otherwise check `Url.IsLocalUrl(returnUrl)` (MVC) or `RedirectHttpResult.IsLocalUrl(url)` (.NET 10+) before `Redirect`.
- Allow-list external redirect targets (e.g. OAuth `redirect_uri`) exactly; never prefix/`Contains` match.

## File uploads

- Enforce size limits (`RequestSizeLimit`, `RequestFormLimits`; `FormOptions.MultipartBodyLengthLimit` defaults to 128 MB, Kestrel `MaxRequestBodySize` ~28.6 MB per docs summary: confirm for your version) and stream large files instead of buffering.
- Allow-list extensions **and** verify content (signature/magic bytes); scan for malware if files are shared with other users.
- Generate the stored name (`Path.GetRandomFileName()`); never use the client file name in a path (path traversal). Keep the original name only as encoded metadata.
- Store outside the application directory (or in blob storage), with execute permission disabled; serve with `Content-Disposition: attachment` and the correct `Content-Type` plus `X-Content-Type-Options: nosniff`.

## Outbound requests (SSRF)

- When a URL comes from a user (webhooks, import-from-URL): allow-list schemes (https) and hosts, resolve and **block private/loopback/link-local ranges** (including cloud metadata `169.254.169.254`), disable auto-redirects or re-validate each hop, set short timeouts, cap response size.
- Use named `HttpClient`s with a resilience handler (see `aspnet-resilience`).

## XSS and output encoding

- Razor/Blazor encode by default; the danger is `Html.Raw`, `MarkupString`, building HTML/JS by concatenation and untrusted data in URLs/attributes. Encode for the context (HTML, attribute, JavaScript, URL).
- Don't use untrusted input as part of a URL path. In JavaScript use `textContent`/`createElement`, not `innerHTML`.
- APIs returning JSON: set `Content-Type: application/json`; add a Content-Security-Policy and `X-Content-Type-Options: nosniff` on anything browser-facing (see `http-hardening.md`).

## Deserialization, process and path injection

- Use System.Text.Json. Newtonsoft `TypeNameHandling` other than `None` and `BinaryFormatter` allow remote code execution.
- Start processes with `ProcessStartInfo.ArgumentList` and a fixed executable; no shell with user input.
- For any user-influenced path: `Path.GetFullPath` then verify it starts with the allowed base directory.
- Logging: never write raw user input containing newlines into log messages as part of the template; use structured placeholders (see `aspnet-observability`).

## Errors

- Production: `UseExceptionHandler` + `AddProblemDetails()`. No stack traces, SQL, file paths or internal ids in responses. `UseDeveloperExceptionPage` only inside `IsDevelopment()`.
