# Phase report and honest status

## Phase report

Write it in the owner's language (code, docs and ADRs stay English). Short, factual, with evidence.

```markdown
## Phase N - <name>: done | blocked

**What works now:** <the flow in 2-3 sentences, from the user's point of view>
**Evidence:** `task check` green (<test counts per suite>), end-to-end <flows>, screenshots: <paths>
**Decisions taken:** D-0xx ... (link to DECISIONS.md or an ADR)
**Deviations from the plan:** ... (or: none)
**Compliance:** controls touched or updated: CTL-...
**Open / risks:** ...
**Learned:** <at most 3 lines: which rule or document changed>
**Next phase:** <name> - starts immediately unless you want a change.
```

## STATUS.md: never claim more than the evidence

`docs/project/STATUS.md` is an `Item | Status | Evidence` table:

| Item           | Status      | Evidence                                   |
| -------------- | ----------- | ------------------------------------------ |
| Order creation | VERIFIED    | integration suite green (CI run, 42 tests) |
| Order export   | IMPLEMENTED | written, not yet run                       |
| Refunds        | DESIGNED    | ADR-014                                    |
| Reporting      | NOT_STARTED | -                                          |

Statuses: `VERIFIED` (checked in the real environment) - `TESTED` (automated tests green) - `IMPLEMENTED` (code exists) - `DESIGNED` (documented only) - `NOT_STARTED`. Test counts are generated, not typed. "Written, not yet run" is a valid and honest evidence entry.

## Commit messages

A plain sentence of what now holds, with an optional `Area:` prefix, ADR or section references and honesty markers: `Orders: archived orders become read-only (ADR-011, tests written, not yet run)`. No conventional-commit prefixes unless the repository already uses them.
