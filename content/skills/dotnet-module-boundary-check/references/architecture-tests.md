# Architecture tests

The script finds problems on demand; **architecture tests** make the rules part of `dotnet test` so a violation fails the build for everyone. Libraries exist for this (names confirmed in their READMEs): **NetArchTest** is the package `NetArchTest.Rules` with fluent `Types.InAssembly(...)` rules; **ArchUnitNET** is `TngTech.ArchUnitNET` plus a test-framework package (`TngTech.ArchUnitNET.xUnit`, `.xUnitV3`, NUnit and MSTestV2 variants). Their APIs differ (ArchUnitNET checks `Classes().That()...` rules against an `Architecture`), so the sketches below apply to NetArchTest only.

## Where they live

A dedicated project `tests/Architecture.Tests` that references the host and every module's assemblies (it is the one project allowed to). Rules are data-driven so a new module is covered automatically.

## Rule 1 - modules depend on each other only through contracts

```csharp
// NetArchTest sketch: Types.InAssembly(...).ShouldNot().HaveDependencyOn(...).GetResult().IsSuccessful are documented in its README
public static IEnumerable<object[]> ModulePairs() =>
    from a in Modules.All
    from b in Modules.All
    where a != b
    select new object[] { a, b };

[Theory, MemberData(nameof(ModulePairs))]
public void Module_does_not_depend_on_another_modules_internals(ModuleInfo a, ModuleInfo b)
{
    var result = Types.InAssembly(a.ImplementationAssembly)
        .ShouldNot().HaveDependencyOn(b.ImplementationNamespace)   // e.g. "Orders" root namespace, excluding "Orders.Contracts"
        .GetResult();

    Assert.True(result.IsSuccessful, $"{a.Name} depends on internals of {b.Name}"); // the README says the result also lists the failing types: check the property name for your version
}
```

## Rule 2 - contracts are clean

- `*.Contracts` assemblies reference no ORM, web or messaging framework types.
- Public types in contracts are interfaces, `record`s, enums or events; none inherit from entities.
- No contract type exposes `HttpContext`, `DbContext`, `IQueryable`, `Task<IActionResult>`.

## Rule 3 - implementation is internal

- All types in `<Module>` (implementation) are `internal` except the registration/endpoint-mapping extension class.

```csharp
[Fact]
public void Only_the_module_registration_is_public()
{
    var publicTypes = Types.InAssembly(typeof(OrdersModule).Assembly).That().ArePublic().GetTypes();
    Assert.Equal(new[] { nameof(OrdersModule) }, publicTypes.Select(t => t.Name));
}
```

## Rule 4 - slices stay in their lane (optional)

- Types in `Features/A` do not reference `Features/B` (extract shared code deliberately).
- Endpoints do not reference `DbContext` directly when the repo routes through handlers.

## Rule 5 - no cycles

- Build the module dependency graph from project references and assert it is acyclic (a few lines of code), or call `scripts/check-boundaries.mjs --strict --json` from a test and assert `findings` is empty.

## Wiring it into CI

1. Run `dotnet test tests/Architecture.Tests` in the pipeline (fast: no database).
2. Also run `node .../check-boundaries.mjs <repo> --strict` as a cheap early step; it needs only Node and works without building.
3. Make failing messages actionable: name the module pair and the type that violates the rule.

## Keeping rules honest

- Start with `--strict` only (high findings) and fix the codebase; then add architecture tests for medium rules.
- When a rule blocks a legitimate case, change the **design** (contract/event) first; only then consider a documented, time-boxed exception.
