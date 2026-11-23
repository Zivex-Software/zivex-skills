# Prompts for speed

Name **what** (module, action, fields, rules, tests), not **how**: the project's `AGENTS.md` carries the how.

```text
/new-slice Catalog UpdateProductPrice
Fields: ProductId (Guid), NewPrice (decimal > 0, EUR), Reason (string, max 200).
Rules: only status Active; publish ProductPriceChangedEvent; invalidate product and list cache.
Tests: happy path, and another tenant gets 404.
```

- **Batch**: an entity, all its slices and the web page in one prompt; run the feedback loop once at the end.
- **"Same shape as CreateProduct"** beats any description of structure.
- **Bugs**: "Reproduce with a test first, then fix. Do not touch the query filter."
- **Teams**: one agent per module or folder; shared files (`AppDbContext`, `ModuleNames`, `Program.cs`) owned by one agent; agents never run git or the full suite; the lead builds and integrates.
- **Evidence**: ask for build output, the generated client hook name and test names; say "written, not yet run" when something was not executed.
- **Questions**: ask the owner (in their language) with multiple choice and an "Other" option, and only when blocked.
