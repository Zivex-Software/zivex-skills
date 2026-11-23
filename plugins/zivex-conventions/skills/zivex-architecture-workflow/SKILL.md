---
name: zivex-architecture-workflow
description: The Zivex workflow from vague idea to build-ready architecture - recon, intake interview in rounds with recommendations, size classification XS-XL, truth-ownership table, numbered masterplan, ADR set with enforcement, security and compliance pack, delivery readiness (scope, phases with acceptance criteria, change triggers, risks), a single approval gate and repository bootstrap. Opt-in, use when designing a new system, module or architecture change the Zivex way.
---

# Zivex architecture workflow

Take any idea (client work, own product, integration, website, app) from a vague request to a **build-ready architecture** that a coding agent can implement without ever seeing the conversation. Opt-in: use it for new systems (L/XL) and for architecture, security or contract changes; smaller changes go straight to `zivex-build-workflow`.

## Start here (module first)

1. Recon before you ask anything: read the repository's `AGENTS.md`, ADRs, masterplans and module docs; search the codebase for related code and prior decisions. **Never ask the user something the code or the ADRs already answer.**
2. Work module by module: every new capability names its owning module and its `.Contracts`; cross-module needs go through contracts and events.
3. If the work is XS to M inside an existing module, you do not need a masterplan: hand off to `zivex-build-workflow`.

## The pipeline

| #   | Step                         | Output                                                                                 | Gate               |
| --- | ---------------------------- | -------------------------------------------------------------------------------------- | ------------------ |
| 0   | Recon                        | Reuse map: which existing platform parts and repositories apply                        | -                  |
| 1   | Intake interview             | Answers plus explicit assumptions `A-nn` and open questions `Q-nn`                     | -                  |
| 2   | Classify XS-XL               | Deliverable set from `references/deliverables-by-size.md`                              | -                  |
| 3   | Platform fit                 | Truth-ownership table (who owns which data)                                            | -                  |
| 4   | Masterplan                   | `docs/project/MASTERPLAN.md` from `references/masterplan-template.md`                  | -                  |
| 5   | ADR set                      | `docs/adr/ADR-0nn-*.md` from `references/adr-template.md`                              | -                  |
| 6   | Security and compliance pack | Threat model, data classification, control matrix (`zivex-compliance-by-construction`) | -                  |
| 7   | Delivery readiness           | Scope in/out/later, phases with acceptance criteria, change triggers, risk register    | -                  |
| 8   | **Review with the owner**    | A one-screen summary: decisions, trade-offs, risks, open questions                     | **Owner approves** |
| 9   | Bootstrap the repository     | `AGENTS.md`, docs tree, task runner, CI, test skeletons                                | -                  |
| 10  | Handoff                      | `zivex-build-workflow` builds phase by phase                                           | Phase reports      |

**One approval gate** after the masterplan (step 8). After approval, build autonomously phase by phase with a report per phase; the hard stops in `zivex-build-workflow` always apply.

## Step notes

- **Intake** (`references/intake-questions.md`): rounds of **at most five questions**, the most decision-heavy first. Each question carries your **recommendation** and a one-line _why it matters_, so the owner can answer "agreed". Stop when every "Decides" column is answered **or** covered by an explicit labelled assumption (`A-07: at most 50 concurrent users at launch; revisit at phase 3`). Usually 2 to 3 rounds; do not drag a website through 15 questions, and do not start a platform with 3. Ask in the owner's language; write code, repo docs, ADRs and `AGENTS.md` in English.
- **Classify and fit**: when in doubt go one size up for anything touching authentication, money, special-category personal data, multi-tenancy or a public contract. Write the **truth-ownership table first**: one authoritative owner per kind of data; duplicated ownership is the biggest source of long-term pain.
- **Masterplan**: numbered (`section 1...n`) so ADRs, `AGENTS.md` and reviews cite it. Concrete over generic; every flow names its failure modes; every "later" item says why later.
- **ADRs**: every non-obvious choice, with alternatives, consequences and **enforcement** (which test, analyzer, constraint or CI gate makes the decision mechanical). A new system starts with the baseline set even when the answer equals the house default: the ADR is the evidence auditors ask for.
- **Mechanisms, not only rules**: design which architecture test, security sweep, analyzer, database constraint or CI gate enforces every rule. Rules without enforcement are wishes.
- **Diagrams** as ASCII or Mermaid inside markdown (C4 level 1 and 2, key sequences, state machines).
- **Delivery readiness**: scope in/out/later (V1, V1.5, V2) with no vague items ("reporting" -> which reports, which filters); phases as independently demoable vertical slices with Given/When/Then criteria; assumptions that change the price or plan if false; change triggers; a risk register (`RSK-nn`: likelihood x impact, mitigation, owner). Do not produce prices or hour estimates unless asked.
- **Bootstrap**: copy proven building blocks (outbox, inbox, audit, access, architecture tests) from the closest existing repository instead of reinventing them, note the origin in the ADR; `task check` must be green on the empty skeleton before phase 1 starts; create directories only when they get content.

## Quality bar (self-review before step 8)

- [ ] Could a fresh agent build phase 1 from the docs alone? Every term defined, every flow has failure paths.
- [ ] Every data entity has an owner, a tenant scope, a classification, a retention period and a deletion path.
- [ ] Every endpoint group has capabilities, 404-vs-403 behaviour and tenant-isolation tests planned.
- [ ] Every asynchronous side effect goes through outbox/inbox with idempotency defined.
- [ ] Non-functional requirements are numbers (p95 latency, availability tier, RPO/RTO, volumes), not adjectives.
- [ ] Compliance controls map to mechanisms and evidence, and no claim exceeds the facts.
- [ ] Phase 1 is the thinnest end-to-end flow that proves the riskiest assumption, not "set up all modules".
- [ ] Deviations from `zivex-engineering-standards` each have an ADR.

## Pitfalls

- Designing modules before the truth-ownership table: duplicated state and sync bugs later.
- Rebuilding auth, organisations, roles or billing that the central identity provider already provides.
- Microservices by default: the default is a .NET modular monolith; a Rust or Go service needs an ADR with a concrete reason (performance, isolation, independent scaling, a different runtime).
- "Phase 1: infrastructure": phases are user-visible flows; infrastructure is built inside the first slice.
- Vague masterplans: thousands of lines are fine for a platform and not for a website.
- Silent assumptions: if you assumed it, label it `A-nn` and put it in the review.

## References

- `references/intake-questions.md` - the question bank in rounds, with what each answer decides.
- `references/masterplan-template.md` - the numbered masterplan skeleton and writing rules.
- `references/adr-template.md` - ADR template, supersede rule, and the baseline ADR set.
- `references/deliverables-by-size.md` - what to produce for XS, S, M, L, XL and per system type.
