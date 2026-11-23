---
name: aspnet-security-audit
description: Audits an existing ASP.NET Core codebase or diff for security problems and produces a ranked, evidence-based report - pipeline order, endpoint authorization map, vulnerable packages, injection, secrets, CORS/CSRF, data exposure. Use for security reviews, pre-release checks, pull-request review of risky changes, or after incidents.
---

# Audit ASP.NET Core security

Read-only by default: report, do not fix, unless the user asks. Target **.NET 10 (LTS)**; flag .NET 8/9 as unsupported since 10 Nov 2026.

## Start here (module first)

1. Identify the module(s) in scope (or the whole repo if it has no modules) and read each module's `AGENTS.md`.
2. Audit inside the scope; for cross-module findings go through `.Contracts` and note the other module instead of auditing it.
3. Host-level settings (`Program.cs`, middleware, CORS, rate limits, headers) are always in scope because they protect every module.

## Procedure

1. **Map the attack surface** (fast, scripted):
   `node scripts/audit.mjs <path>` prints four sections: pipeline order problems, an endpoint -> authorization table (anything marked `NONE` is a lead), **ownership-check candidates** (an entity loaded by an id with no tenant, owner, user or authorization hint nearby: the usual place for broken object-level authorization), and `dotnet list package --vulnerable --include-transitive` output (needs the SDK and network; add `--no-packages` to skip).
2. **Scan for known anti-patterns**: if `aspnet-security` is installed run its `scripts/check-security.mjs <path>`; otherwise search for the patterns in `references/audit-procedure.md`.
3. **Walk the checklist** in `references/audit-procedure.md` per area (`references/authorization-review.md` is the deep procedure for access control, and `references/owasp-api-top10.md` maps findings to the OWASP API risks) (access control, injection, auth, config, data, dependencies, logging). For each endpoint with `NONE`/anonymous, decide if public is intended; for each owned-data endpoint, find the ownership/tenant check or flag its absence.
4. **Confirm each finding in context**: open the code, trace input to sink, check whether a guard exists elsewhere (filter, handler, policy). Scripts produce candidates; the report contains only findings you confirmed or clearly label "unconfirmed".
5. **Rank** by exploitability x impact: Critical (unauthenticated data access/RCE/secret exposure), High (authz bypass, injection, auth flaws), Medium (misconfiguration, missing hardening), Low/Info. Use the format in `references/report-template.md`.
6. **Report what you did not check** (e.g. infrastructure, IdP config, runtime settings, dependencies you could not restore).

## Rules

- Evidence over opinion: every finding has `file:line`, the attacker action, the impact, and a concrete fix.
- Never print secrets you find; give the location and a redacted preview, and recommend rotation.
- Do not run exploits against shared or production systems; reproduce with tests or local data only.
- No findings is a valid result: say what was covered and what was not.

## References

- `references/audit-procedure.md` - area-by-area checklist with grep patterns and what a good answer looks like.
- `references/report-template.md` - report skeleton and severity definitions.
- `references/authorization-review.md` - the step-by-step review of object-, function- and property-level authorization, with vulnerable and fixed code.
- `references/owasp-api-top10.md` - the OWASP API Security Top 10 mapped to what to check, which script finds leads, and the skill that fixes it.
- `references/example-findings.md` - four worked findings in the report format, from lead to evidence to fix.
