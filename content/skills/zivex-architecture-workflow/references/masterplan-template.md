# Masterplan template

Number every section (`# 12. Orders`): numbers are cited everywhere (`section 12`). Keep numbers stable; append new sections at the end of their part instead of renumbering. For L-size work keep every heading but write 3 to 10 lines each.

```markdown
# <System> - Product, Architecture & Implementation Masterplan

> **Status:** Greenfield | Draft for approval | Approved <date>
> **Repository:** `<repo-name>` - **Size:** L | XL - **Tier:** 0 (auth/money/health) | 1 (business-critical) | 2
> **Client / product:** <who> - **Commercial model:** fixed price per phase | other
> **Purpose:** <one sentence>
>
> The architectural rule is: **<System> owns <truth>. <Other> owns <other truth>.**

## Part A - Product

# 1. Vision and measurable outcome

# 2. What <System> is

# 3. What <System> is NOT (as important as 2; it kills scope creep)

# 4. Users, roles and tenancy (who is the tenant; mapping to identity organisations/environments)

# 5. Product boundaries (truth-ownership table: identity / content / integration / AI / operations / external)

# 6. Core flows (numbered steps, happy path plus every failure path, who may do each step)

# 7. Domain model (aggregates, invariants, state machines in ASCII, human numbers like ABC-000123)

# 8. Navigation and screens per client

# 9. Notifications and communication

## Part B - Architecture

# 10. System context (C4 L1) (ASCII or Mermaid)

# 11. Containers and hosts (C4 L2) (api, worker, web, native core and edges, services)

# 12. Modules (table: module, owns, schema, .Contracts, events out/in, capabilities)

# 13. Data architecture (per entity: tenant scope, classification, retention, deletion, region)

# 14. Authorization (capability table, role -> capability matrix, 404 vs 403 rules, delegation)

# 15. API strategy (surfaces, errors, versioning, idempotency, concurrency)

# 16. Events and integration (event catalogue <product>.<aggregate>.<event>.v1, outbox/inbox, webhooks)

# 17. AI usage (human in the loop; risk classification; omit if none)

# 18. Clients (web/portal, islands, native core and edges, offline and sync)

# 19. Non-functional requirements (numbers: p95 latency, availability, RPO/RTO, volumes, cost ceiling)

# 20. Observability and operations (traces, metrics, logs and what is never logged, health, alerts, runbooks)

# 21. Security (summary plus link to the threat model; verification level)

# 22. Compliance (summary plus link to the control matrix; claims we may and may not make)

# 23. Infrastructure and deployment (topology, environments, regions)

# 24. Repository structure

# 25. Tech stack (house default; every deviation -> ADR)

## Part C - Delivery

# 26. Scope: V1 / V1.5 / V2 / later / never

# 27. Assumptions (A-nn) and open questions (Q-nn, owner, due)

# 28. Phases (each a demoable vertical slice plus Given/When/Then acceptance criteria)

# 29. Required vertical slices (the end-to-end flows that define "core done")

# 30. Change triggers (what turns a request into a change request)

# 31. Risks (RSK-nn) (likelihood x impact, mitigation, owner)

# 32. Required ADRs

# 33. Required docs

# 34. Testing strategy (suites, what each proves, golden/contract/leakage tests)

# 35. Definition of Done (generic plus domain-specific)

# 36. Hard rules for agents ("Never: ..." list, each enforced by a test where possible)

# 37. Agent orchestration (lead plus subagents and what each owns)

# 38. Initial production target (the flows that must work before "V1 done")

# 39. Final instruction to the coding agent
```

## Writing rules

- **Concrete over generic**: "Owner and Admin can archive a project; archived projects are read-only and hidden from the default list; restore within 30 days", not "projects can be managed".
- Every flow names its failure modes (validation, unauthorized, conflict 409, dependency down 503, duplicate request).
- Every "later" item says why later, so nobody builds it early.
- Section 39 ends with the vertical-first instruction: the first goal is the thinnest secure end-to-end flow, not "all modules scaffolded". Then: "Always preserve: <truth-ownership list>".
