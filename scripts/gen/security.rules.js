const RULES = [
  {
    id: "SEC001",
    level: "high",
    multi:
      /AllowAnyOrigin\s*\(\s*\)[\s\S]{0,200}?AllowCredentials\s*\(\s*\)|AllowCredentials\s*\(\s*\)[\s\S]{0,200}?AllowAnyOrigin\s*\(\s*\)/g,
    msg: "CORS: AllowAnyOrigin combined with AllowCredentials",
    fix: "List explicit origins with WithOrigins(...); never combine wildcard origins with credentials.",
  },
  {
    id: "SEC002",
    level: "high",
    re: /SetIsOriginAllowed\s*\(\s*\w*\s*=>\s*true\s*\)/,
    msg: "CORS: every origin is accepted",
    fix: "Validate against an explicit allow-list.",
  },
  {
    id: "SEC003",
    level: "high",
    re: /(FromSqlRaw|ExecuteSqlRaw|SqlQueryRaw)\s*\(\s*(\$@?"|@?\$"|"[^"]*"\s*\+)/,
    msg: "Raw SQL built by interpolation or concatenation (SQL injection)",
    fix: "Use FromSql/ExecuteSql with an interpolated string (parameterised) or pass DbParameter values.",
  },
  {
    id: "SEC004",
    level: "high",
    re: /Validate(Issuer|Audience|Lifetime|IssuerSigningKey)\s*=\s*false/,
    msg: "JWT validation switched off",
    fix: "Leave issuer, audience, lifetime and signing-key validation on; configure the valid values instead.",
  },
  {
    id: "SEC005",
    level: "medium",
    re: /RequireHttpsMetadata\s*=\s*false/,
    msg: "JWT metadata may be fetched over HTTP",
    fix: "Keep RequireHttpsMetadata true outside local development.",
  },
  {
    id: "SEC006",
    level: "high",
    json: true,
    re: /"[^"]*(Password|Pwd|Secret|ApiKey|Api_Key|PrivateKey|ClientSecret|AccessToken|Token)[^"]*"\s*:\s*"(?!\s*"|\$\{|<|\*+|CHANGE|REPLACE|your[-_ ])[^"]{6,}"/i,
    msg: "Possible secret committed in appsettings",
    fix: "Move it to user-secrets (dev), environment variables or a vault; commit an empty placeholder.",
  },
  {
    id: "SEC007",
    level: "high",
    json: true,
    re: /"\s*:\s*"[^"]*\b(Password|Pwd)\s*=\s*(?!\s*;|\s*"|\{|\$)[^;"\s]{3,}/i,
    msg: "Connection string with an inline password in appsettings",
    fix: "Use integrated/managed identity auth or load the password from a secret store.",
  },
  {
    id: "SEC008",
    level: "medium",
    re: /EnableSensitiveDataLogging\s*\(/,
    msg: "EF sensitive data logging enabled",
    fix: "Only in local development, behind IsDevelopment(); it writes parameter values to logs.",
  },
  {
    id: "SEC009",
    level: "medium",
    re: /\.DisableAntiforgery\s*\(/,
    msg: "Antiforgery disabled on an endpoint",
    fix: "Keep it only for token-authenticated APIs that do not use cookies; otherwise require antiforgery.",
  },
  {
    id: "SEC010",
    level: "medium",
    re: /\bRedirect\s*\(\s*(returnUrl|redirectUrl|url|next|Request\.(Query|Form))/i,
    msg: "Redirect to a caller-supplied URL (open redirect)",
    fix: "Use LocalRedirect / Results.LocalRedirect, or check Url.IsLocalUrl(...) first.",
  },
  {
    id: "SEC011",
    level: "medium",
    re: /\b(MD5|SHA1)\.(Create|HashData)\s*\(|new\s+(MD5|SHA1)(CryptoServiceProvider|Managed)\b/,
    msg: "Weak hash (MD5/SHA-1)",
    fix: "Use SHA-256+ for integrity; use ASP.NET Core Identity's PasswordHasher (or Argon2/bcrypt/PBKDF2) for passwords.",
  },
  {
    id: "SEC012",
    level: "high",
    re: /DangerousAcceptAnyServerCertificateValidator|ServerCertificateCustomValidationCallback\s*=\s*[^;]*(=>\s*true|return\s+true)/,
    msg: "TLS certificate validation disabled",
    fix: "Trust the right CA instead (import the certificate); never disable validation in production code.",
  },
  {
    id: "SEC013",
    level: "high",
    re: /TypeNameHandling\s*=\s*TypeNameHandling\.(All|Auto|Objects|Arrays)|\bBinaryFormatter\b/,
    msg: "Unsafe deserialization",
    fix: "Use System.Text.Json or Newtonsoft with TypeNameHandling.None; BinaryFormatter is removed from supported use.",
  },
  {
    id: "SEC014",
    level: "medium",
    re: /Process\.Start\s*\([^)]*(\$"|\+)/,
    msg: "Process started with composed arguments (command injection)",
    fix: "Use ProcessStartInfo.ArgumentList and a fixed executable; never pass user input through a shell.",
  },
  {
    id: "SEC015",
    level: "high",
    re: /Path\.Combine\s*\([^)]*\.FileName\b/,
    msg: "Uploaded file name used in a path (path traversal)",
    fix: "Generate the name with Path.GetRandomFileName(); store outside the app directory; keep the original only as metadata (encoded).",
  },
  {
    id: "SEC016",
    level: "high",
    re: /\bLog(Trace|Debug|Information|Warning|Error|Critical)\s*\([^;]*\b(password|passwd|secret|token|authorization|apikey)\b/i,
    msg: "Log call mentions a secret-like value",
    fix: "Log identifiers, never credentials or tokens; redact before logging.",
  },
  {
    id: "SEC017",
    level: "low",
    json: true,
    re: /"AllowedHosts"\s*:\s*"\*"/,
    msg: "AllowedHosts is '*'",
    fix: "List your real host names so spoofed Host headers are rejected.",
  },
  {
    id: "SEC018",
    level: "medium",
    re: /new\s+Random\s*\(\s*\)[\s\S]{0,120}?(token|password|otp|code|secret)|Random\.Shared\.Next[\s\S]{0,60}?(token|otp|secret)/i,
    msg: "Non-cryptographic random near a token/secret",
    fix: "Use RandomNumberGenerator for tokens, codes and keys.",
  },
  {
    id: "SEC019",
    level: "medium",
    re: /\.UseDeveloperExceptionPage\s*\(\s*\)/,
    msg: "Developer exception page",
    fix: "Wrap in if (app.Environment.IsDevelopment()); production uses UseExceptionHandler + ProblemDetails.",
  },
  {
    id: "SEC020",
    level: "medium",
    project: (files) => {
      const hasMaps = anyFile(
        files,
        /\.Map(Get|Post|Put|Delete|Patch)\s*\(|\[Http(Get|Post|Put|Delete|Patch)\b/,
      );
      const hasAuthz = anyFile(files, /SetFallbackPolicy|RequireAuthorization\s*\(|\[Authorize\b/);
      return hasMaps && !hasAuthz
        ? [
            {
              file:
                (firstFile(files, /\.Map(Get|Post|Put|Delete|Patch)\s*\(|\[Http(Get|Post)/) ?? {})
                  .rel ?? ".",
            },
          ]
        : [];
    },
    msg: "Endpoints found but no authorization anywhere (no [Authorize], RequireAuthorization or fallback policy)",
    fix: "Add a fallback policy requiring an authenticated user and mark public endpoints AllowAnonymous explicitly.",
  },
];
