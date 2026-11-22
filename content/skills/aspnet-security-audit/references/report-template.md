# Report template

```markdown
# Security audit - <scope> - <date>

**Scope**: modules/paths audited. **Runtime**: .NET <version> (<supported/unsupported>). **Method**: audit.mjs, check-security.mjs, manual review of <areas>.
**Not covered**: <infrastructure, IdP config, penetration testing, ...>

## Summary

<3-5 lines: overall posture, number of findings per severity, the one thing to fix first.>

## Findings

### [CRITICAL|HIGH|MEDIUM|LOW] <short title>

- **Where**: `path/File.cs:42`
- **What**: <the flaw in one sentence>
- **Attack**: <what an attacker does and needs (unauthenticated? other tenant?)>
- **Impact**: <data/function exposed>
- **Fix**: <concrete change, with a code snippet if short>
- **Status**: confirmed | unconfirmed (<what is missing to confirm>)

## Positive observations

<what is done well; keeps the report credible and tells the team what to keep>

## Follow-ups

<tickets, tests to add (negative authorization tests), process changes (NuGetAudit in CI, --strict scan in CI)>
```

Severity: **Critical** unauthenticated access to data/function, RCE, committed production secret. **High** authz bypass between users/tenants, injection, authentication flaw. **Medium** misconfiguration or missing hardening that needs another weakness to exploit. **Low/Info** defence-in-depth, hygiene.
