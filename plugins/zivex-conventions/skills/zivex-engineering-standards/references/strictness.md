# Strictness settings

Copy into every new repository; CI fails on any warning. The principle applies to every language you use: maximum compiler strictness, warnings as errors, a formatter check, lock files, and no skipped checks.

## C# / .NET (`Directory.Build.props`)

```xml
<PropertyGroup>
  <TargetFramework>net10.0</TargetFramework>
  <LangVersion>latest</LangVersion>
  <Nullable>enable</Nullable>
  <ImplicitUsings>enable</ImplicitUsings>
  <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
  <AnalysisLevel>latest</AnalysisLevel>
  <AnalysisMode>Recommended</AnalysisMode>          <!-- consider All for the most critical systems -->
  <EnforceCodeStyleInBuild>true</EnforceCodeStyleInBuild>
  <Deterministic>true</Deterministic>
  <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
  <RestorePackagesWithLockFile>true</RestorePackagesWithLockFile>
</PropertyGroup>
```

Plus:

- `.editorconfig` with `csharp_style_namespace_declarations = file_scoped:warning` and the rest of your style rules.
- CI: `dotnet restore --locked-mode`, `dotnet build`, `dotnet format --verify-no-changes`, tests, `dotnet list package --vulnerable --include-transitive`.
- `global.json` pins the SDK; pin the test runner there if you use the Microsoft.Testing.Platform runner.
- `.slnx` solution files for new repositories.
- `InternalsVisibleTo` only for the module's own test projects.
- Architecture tests (NetArchTest or similar) for module boundaries, internals and forbidden source patterns; optional Roslyn analyzers for house rules.
- Source-generated logging only (`[LoggerMessage]`).

## TypeScript (`tsconfig.base.json`)

```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "exactOptionalPropertyTypes": true,
  "noImplicitOverride": true,
  "noImplicitReturns": true,
  "noFallthroughCasesInSwitch": true,
  "noPropertyAccessFromIndexSignature": true,
  "useUnknownInCatchVariables": true,
  "verbatimModuleSyntax": true,
  "isolatedModules": true
}
```

ESLint flat config with a strict type-checked preset, framework hook rules and accessibility rules, `--max-warnings=0`; formatter check in CI; no `any`; parse external data with a schema library instead of casting; exact dependency versions and `npm ci`.

## Other languages (principle only)

- **Rust**: `unsafe_code = "forbid"` (allowed only in a documented FFI crate), clippy `all` and `pedantic` at deny, no `unwrap`/`expect`/`panic` outside tests, `cargo deny` for licences and advisories, a pinned toolchain.
- **Go**: pinned toolchain, a strict linter set (error checking, `govet`, `staticcheck`, `gosec`, `errorlint`, `noctx`, `bodyclose`), `go test -race -shuffle=on`, `govulncheck`, `context.Context` first, wrapped errors.
- **Swift/Kotlin edges**: warnings as errors, strict concurrency, linters in CI, no force unwraps.

## One command, same as CI

`task check` (or the repo's equivalent) runs exactly what CI runs and must be green on an empty skeleton, including architecture and security tests, before the first feature starts.
