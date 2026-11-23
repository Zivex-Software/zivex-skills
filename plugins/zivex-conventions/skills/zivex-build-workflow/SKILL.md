---
name: zivex-build-workflow
description: The Zivex way to build - turn an approved architecture into working, tested, documented software phase by phase using the vertical-slice loop, a definition of done per kind of work, autonomy rules with explicit hard stops, orchestration of subagents by module ownership, bug-fix discipline, and an honest per-phase report. Opt-in, use when implementing a phase or slice, or any XS-M change, the Zivex way.
---

# Zivex build workflow

Turn an approved architecture into working, tested, documented software, phase by phase, autonomously, with a report per phase. Opt-in: pairs with `zivex-engineering-standards` and `zivex-dotnet-code-style`; load `zivex-compliance-by-construction` when a phase touches data, access, logging, suppliers or UI.

## Start here (module first)

1. Read the repository's `AGENTS.md`, `docs/project/STATUS.md` and the masterplan sections and ADRs for this work.
2. Identify the module(s), their `.Contracts` and the **closest existing example** of the same pattern; stay inside the module and reach others through contracts.
3. Classify XS/S/M/L/XL (see the deliverables-by-size reference of `zivex-architecture-workflow`). **L or XL without an approved masterplan or ADR: stop and run the architecture workflow first.**
4. Run the repository's check (`task check` or equivalent) to know the baseline is green. **Never build on red.**

## The vertical-slice loop

A phase is a user-visible flow through every layer, not a layer.

1. **Plan**: list the flow steps, endpoints, capabilities, events, data changes, UI states and tests, in the module doc or a short phase plan.
2. **Tests first where it pays**: domain rules, authorization (permission-matrix rows), tenant-isolation negatives, bug regressions. Watch them fail.
3. **Implement**: domain -> application (authorize -> load -> domain -> audit -> publish -> one save) -> API -> UI.
4. **Run the check**; fix root causes. **Never weaken architecture or security tests, analyzers or lint rules.**
5. **Browser-validate** UI: console errors, keyboard-only path, loading/empty/error/conflict states, narrow width, accessibility scan clean; keep screenshots for the report.
6. **Observe**: traces, metrics and logs exist for the flow, and nothing sensitive is logged.
7. **Document**: update `STATUS.md`, `BACKLOG.md` (deferred items), `DECISIONS.md`, the module doc, the API docs, ADRs, and the controls document when a control changed.
8. **Verify** with `dotnet-verify` and report with `references/phase-report.md`; continue with the next phase unless a hard stop applies.

## Definition of done (every feature)

Requirements complete - authorization (capabilities, permission matrix) - tenant isolation with negative tests - validation after authorization - idempotency where retried - audit - failure handling (409, 422, 503 paths) - observability - unit, integration and security tests - end-to-end tests for critical flows - accessibility (WCAG 2.2 AA) and browser validation - docs updated - **zero** compiler, type, lint, format and analyzer warnings. Additions per kind of work (customer-facing, commercial, time-based, integrations, AI): `references/definition-of-done.md`.

## Autonomy and hard stops

After the owner approved the masterplan, work autonomously per phase. **Stop and ask** before anything that:

- can lose or corrupt data, or migrates production data;
- touches production, DNS, certificates, billing, app-store releases, or sends real e-mail, SMS or payments;
- needs secrets or credentials (never type, invent or commit them; use the secret store);
- weakens a security, tenant, or customer/internal boundary, or an architecture or security test;
- adds a service outside the agreed region, a dependency from the "not without an ADR" list, or a new deployable;
- chooses between fundamentally different product directions, or changes fixed-price scope.

Otherwise make the reasonable choice, record it in `DECISIONS.md`, and continue. Commits follow the repository's `AGENTS.md`: on a worktree branch, a plain-sentence message with a `Co-Authored-By` trailer. **Never push, never force-push, never merge to the main branch**: a human maintainer does.

## Orchestration (L/XL)

The main agent is engineering lead, architecture owner, integration manager and security coordinator. Split work by **module ownership, never by layer**, and give each subagent the full context it needs (it knows nothing else): the repository rules, the relevant masterplan sections, the files to touch and the definition of done. Verify their claims yourself by running the tests. Use git worktrees per parallel slice; integration, security review, end-to-end tests and an independent review (a reviewer without the build context) always happen after parallel work merges.

## Bug fixes

Reproduce -> a failing regression test -> fix the root cause, not the symptom -> search for the same bug pattern elsewhere -> note it in the pitfalls of `AGENTS.md` if it can recur.

## Pitfalls

- Saying "done" without running the full check: always run it and quote real output; say "written, not yet run" otherwise.
- Building all modules' skeletons first: build one flow end to end.
- Fakes leaking into production paths: guard, test and bundle check.
- Several container-backed suites at once on a shared machine: run one or two at a time.
- Reusing ports from another stack: check `AGENTS.md` and your port list.
- Stopping a dev process by name (`pkill node`): other projects' servers share the name. Signal only the process group you started.
- Skipping verification because a toolchain is missing locally: run the check in the pinned official container image instead.

## References

- `references/definition-of-done.md` - extra done-criteria per kind of work.
- `references/phase-report.md` - the per-phase report and the honest `STATUS.md` table.
