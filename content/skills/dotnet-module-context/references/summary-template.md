# Context summary

Write this (5-10 lines) before changing code, and put the useful part in the PR description.

```markdown
**Task**: <restated in your words, including what is out of scope>
**Module**: Orders (src/Modules/Orders) - owns orders and their lifecycle; per AGENTS.md: <the 1-2 rules that matter here>
**Touch**: Orders/Features/CancelOrder/_, Orders/Persistence/OrderConfiguration.cs, tests/Orders.Tests/Features/CancelOrder/_
**Contracts**: consumes Billing.Contracts (IBillingApi.RefundAsync); Orders.Contracts unchanged (consumed by: Shipping, Reporting)
**Pattern**: mirrors Features/PayOrder (handler + validator + typed-results endpoint)
**Data**: migration needed: yes/no - <what and why>; tenant filter applies
**Verify**: dotnet test tests/Orders.Tests; node scripts/affected.mjs --run; boundary check
**Risks / questions**: <anything unclear that needs the user>
```

If the task crosses modules, add one block per module and the order you will do them in (producer contract first, then consumers).
