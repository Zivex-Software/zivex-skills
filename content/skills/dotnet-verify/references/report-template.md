# Verification report

Paste into the PR description or the final message. Be specific and honest; "not run" is an acceptable entry, hiding it is not.

```markdown
## Verification

**Change**: <one sentence> - module(s): <Orders, ...> - contract changed: <no | additive | breaking (consumers updated: ...)>

**Ran** (`node scripts/affected.mjs --run`, or the repo's own commands):

| Step          | Command                                                | Result                                     |
| ------------- | ------------------------------------------------------ | ------------------------------------------ |
| Build         | `dotnet build src/Modules/Orders/Orders/Orders.csproj` | PASS                                       |
| Test          | `dotnet test tests/Orders.Tests/Orders.Tests.csproj`   | PASS (42 passed)                           |
| Format        | `dotnet format ... --verify-no-changes`                | PASS                                       |
| Boundaries    | `check-boundaries.mjs --strict`                        | PASS (0 findings)                          |
| Security scan | `check-security.mjs src/Modules/Orders`                | 1 medium, confirmed false positive (<why>) |

**Tests added/changed**: <names> - fail without the change: <yes, verified | n/a>

**Not run** (and why): <integration tests needing Docker | consumer module Billing tests | load test>
Command to run them: `<command>`

**Risks / follow-ups**: <migration needs a maintenance window | flaky test #123 | performance not measured>

**Migration**: <none | `Add_Order_Status` reviewed, expand/contract, not applied to shared databases>
```

Rules: list only what you actually ran; name the exact commands; explain every non-PASS; never write "all tests pass" unless the whole plan ran.
