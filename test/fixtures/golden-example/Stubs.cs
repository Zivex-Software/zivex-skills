global using System.Security.Claims;
global using Microsoft.AspNetCore.Builder;
global using Microsoft.AspNetCore.Http;
global using Microsoft.AspNetCore.Routing;
global using Microsoft.EntityFrameworkCore;
global using Microsoft.Extensions.Caching.Hybrid;

namespace Api;
public interface IFeature { static abstract void Map(IEndpointRouteBuilder app); }
public static class ModuleNames { public const string Catalog = "Catalog"; }
public static class Capabilities { public const string CatalogManage = "catalog.manage"; public static bool Has(ClaimsPrincipal u, string c) => u.HasClaim("cap", c); }
public static class CacheKeys { public static string TenantTag(Guid t, Guid? b) => $"tenant:{t}:branch:{b?.ToString() ?? "all"}"; }
public static class ApiResults
{
    public static IResult Forbidden(string code) => Results.Problem(statusCode: 403, extensions: new Dictionary<string, object?> { ["code"] = code });
    public static IResult Validation(Dictionary<string, string[]> e) => Results.ValidationProblem(e);
    public static IResult Conflict(string code, string detail) => Results.Problem(detail: detail, statusCode: 409, extensions: new Dictionary<string, object?> { ["code"] = code });
}
public static class RouteExt { public static TBuilder RequireModule<TBuilder>(this TBuilder b, string m) where TBuilder : IEndpointConventionBuilder => b; }
public sealed class TenantContext { public Guid TenantId { get; init; } public Guid? BranchId { get; init; } }
public sealed class Product { public Guid Id { get; set; } public string Sku { get; set; } = ""; public string Name { get; set; } = ""; public decimal Price { get; set; } public string Currency { get; set; } = ""; }
public sealed record ProductCreatedV1(Guid ProductId);
public sealed class OutboxMessage { public static OutboxMessage Create(object e, DateTimeOffset at) => new(); }
public sealed class AppDbContext(DbContextOptions<AppDbContext> o) : DbContext(o)
{
    public DbSet<Product> Products => Set<Product>();
    public DbSet<OutboxMessage> Outbox => Set<OutboxMessage>();
    public void Audit(string action, string type, Guid id) { }
}
