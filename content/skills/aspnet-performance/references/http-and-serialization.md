# HTTP, protocols, serialization, pagination

Sources: learn.microsoft.com/aspnet/core/performance/{response-compression,timeouts}, /fundamentals/servers/kestrel/{options,http3}, /fundamentals/native-aot, /dotnet/core/extensions/httpclient-factory, /dotnet/fundamentals/networking/http/httpclient-guidelines, /dotnet/standard/serialization/system-text-json/source-generation (checked).

## HttpClient

- Register with `AddHttpClient<TClient>()` / named clients. Each `CreateClient()` returns a cheap `HttpClient`; the factory pools handlers (default handler lifetime **2 minutes**, `SetHandlerLifetime`).
- Never `new HttpClient()` per request (port exhaustion, no pooling). A static/singleton `HttpClient` is fine **with** `SocketsHttpHandler.PooledConnectionLifetime` set (DNS refresh; the **default is `InfiniteTimeSpan`**, so connections are never recycled; the docs example uses 2 minutes). `PooledConnectionIdleTimeout` defaults to 1 minute in .NET 6 and later.
- **Typed clients are transient**: don't inject them into singletons (stale handler). In singletons use `IHttpClientFactory` or a `SocketsHttpHandler`-based client.
- Cookies: avoid `IHttpClientFactory` (pooled handlers share `CookieContainer`s) unless you disable cookies.
- Add timeouts and resilience: see `aspnet-resilience`.

## Response compression

- Prefer compression at the reverse proxy/CDN (Kestrel has none built in). If in-app: `AddResponseCompression`, `UseResponseCompression` before middleware that writes compressible responses; Brotli + Gzip on .NET 10 (11+ adds Zstandard and always sends `Vary: Accept-Encoding`).
- `EnableForHttps` is off by default (CRIME/BREACH risk for secret-bearing dynamic pages). No wildcard MIME types (`text/*` unsupported). Don't compress tiny (<~1 KB) or already compressed payloads (PNG, zip).
- Nginx can strip `Accept-Encoding` and silently disable compression.

## Protocols and Kestrel

- HTTP/3 is opt-in (`Http1AndHttp2AndHttp3` + HTTPS; keep HTTP/1.1 and 2 for proxies that lack HTTP/3). It needs MsQuic; Kestrel falls back when unavailable.
- Kestrel `AllowSynchronousIO` is false (keep it). HTTP/2 defaults: 100 streams/connection, 16 KB frames. Other defaults (`KestrelServerLimits` API reference): request headers timeout 30 s, keep-alive timeout 130 s, headers 32 KB, request body 30,000,000 bytes (about 28.6 MB), minimum data rate 240 bytes/s with a 5 s grace period; `ListenOptions.Protocols` defaults to HTTP/1.x and HTTP/2. Check them before tuning. Prefer per-endpoint body limits (`[RequestSizeLimit]`) over global changes.
- Request timeouts: `AddRequestTimeouts()`; `UseRequestTimeouts()` after `UseRouting`; per endpoint `.WithRequestTimeout(...)`; they cancel `RequestAborted`, your code must honour it. Not enforced under a debugger.

## JSON

- System.Text.Json; reuse options; `JsonSerializerContext` + `[JsonSerializable(typeof(Dto))]` and insert it first in `JsonOptions.SerializerOptions.TypeInfoResolverChain`.
- Set `<JsonSerializerIsReflectionEnabledByDefault>false</JsonSerializerIsReflectionEnabledByDefault>` in AOT/trimmed apps so reflection fallbacks fail loudly. Under Native AOT use `JsonStringEnumConverter<TEnum>` (non-generic one is not AOT-safe).
- Fast-path "Serialization" generation mode doesn't support async serialization; keep `Metadata` mode for streaming responses.
- Return DTOs, not entities; omit nulls only if clients accept it; avoid deep object graphs and cycles.

## Native AOT (only if startup/size matters)

- `PublishAot`, `WebApplication.CreateSlimBuilder` (no IIS, HTTPS endpoints, HTTP/3, EventLog by default; opt in with `UseKestrelHttpsConfiguration`/`UseQuic`). Minimal APIs are partially supported, MVC and Blazor Server are not; JWT, CORS, rate limiting, output caching, response compression, health checks are supported. Fix all AOT warnings; test the published binary.

## Pagination and payload size

- Always paginate collection endpoints; cap page size server-side; return total/next-link metadata in the body or headers.
- Offset (`Skip/Take`) is simple but slow for deep pages and unstable under concurrent writes; **keyset pagination** (`WHERE (key) > @last ORDER BY key`) for large or live data. Ordering must be fully unique (add the id as a tiebreaker). See `aspnet-data-efcore`.
- Prefer `fields`/projection or separate endpoints over giant "include everything" responses; stream huge exports (`IAsyncEnumerable<T>`, NDJSON) instead of building them in memory. .NET 10: `TypedResults.ServerSentEvents` for streams to clients.
