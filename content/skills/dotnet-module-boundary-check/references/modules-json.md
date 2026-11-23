# modules.json

The scripts detect modules by convention:

1. the folder after `Modules/` (`src/Modules/Orders/...` -> `Orders`), otherwise
2. the project name minus a role suffix (`.Contracts`, `.Tests`, `.IntegrationTests`, `.Infrastructure`, `.Domain`, `.Application`, `.Api`, `.Endpoints`, `.Migrations`) and a company prefix shared by most projects (`Acme.Orders.Contracts` -> `Orders`).

Projects named `Shared`, `SharedKernel`, `BuildingBlocks`, `Common` or `Kernel` are treated as shared (no module). A project is a **contracts** project when its name ends with `.Contracts`, and a **test** project when it is named `*Tests`, sets `<IsTestProject>true</IsTestProject>` or references `Microsoft.NET.Test.Sdk`.

When conventions do not fit, put a `modules.json` at the repository root. It wins over conventions:

```json
{
  "modules": {
    "Orders": ["src/Sales/Orders", "src/Sales/OrderContracts", "tests/Sales/Orders.Tests"],
    "Billing": ["src/Finance/Billing", "src/Finance/Billing.Contracts"]
  },
  "shared": ["src/Platform"]
}
```

- Values are path **prefixes** relative to the repository root (forward slashes). A project belongs to the first module whose prefix matches its `.csproj` path.
- `shared` prefixes are exempt from boundary rules (use sparingly; shared code needs an owner).
- A contracts project must still end in `.Contracts` to be recognised as one; rename it or add a suffix convention in the team's docs.
- Commit `modules.json`; mention it in the root `AGENTS.md`. Every `dotnet-*` script that detects modules (`check-boundaries.mjs`, `module-context.mjs`, `inspect-repo.mjs`, `contract-diff.mjs`, `affected.mjs`, `new-module.mjs`) honours it.
- A repository with a single module (or none) needs no file: the scripts report that there is nothing to check across modules.
