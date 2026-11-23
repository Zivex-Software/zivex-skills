---
name: zivex-compliance-by-construction
description: Build systems so that audit and certification become collecting evidence that already exists - control to mechanism to test to evidence, a 30-control baseline mapped to ISO 27001, SOC 2, NIS2, GDPR and OWASP ASVS, the per-repository evidence pack, a strict claims policy (never claim certification you do not hold), and honest handling of small-team realities. Opt-in, use when a system handles personal data, access, logging, crypto, backups, suppliers or UI accessibility, or when answering a security questionnaire.
---

# Compliance by construction

Build so that a later audit is a matter of **collecting evidence that already exists**, not retrofitting, and so the system is never the reason a client fails _their_ audit. Opt-in; pairs with `zivex-architecture-workflow` (design) and `zivex-build-workflow` (enforcement). **Not legal advice**: verify the framework mappings against current official texts.

## Start here (module first)

1. Identify the module and its data: which entities hold personal or confidential data? Read the module's `AGENTS.md` and the repository's controls document.
2. Work per module: each module has its own rows in the data classification and the permission matrix.
3. Cross-module data flows go through contracts and events; classification and retention travel with them.

## Scope

| Always                                                                                                  | Conditional                                                                            |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **GDPR** and regional data residency                                                                    | Healthcare standards (for example NEN 7510, 7512, 7513)                                |
| **ISO/IEC 27001:2022** Annex A                                                                          | Government baselines (for example BIO2)                                                |
| **NIS2** art. 21 measures and art. 23 reporting                                                         | **EU AI Act** when the system uses AI                                                  |
| **SOC 2** trust services criteria (security, availability, confidentiality; privacy when relevant)      | Regional availability: a second-region stack, transfer mechanisms, state privacy laws  |
| **WCAG 2.2 AA** and the European Accessibility Act (EN 301 549)                                         | **OWASP MASVS** L1/L2 for mobile apps                                                  |
| **OWASP ASVS** level 2 by default, level 3 for the most critical planes (auth, payments, health, admin) | PCI DSS: avoided by design (card data never touches your systems; use hosted checkout) |

## Core principle: control -> mechanism -> test -> evidence

A requirement is only done when all four exist:

1. **Control**: what must be true (`CTL-nn`, mapped to framework references).
2. **Mechanism**: the code or configuration that makes it true (capability check, row-level security policy, outbox, backup tool, CSP header).
3. **Test**: something that fails when the mechanism breaks (security sweep, architecture test, restore drill).
4. **Evidence**: an artefact an auditor can see, produced automatically where possible (a CI run, generated test results, a drill log, a scan report, a signed-off ADR).

The baseline table is `references/control-matrix.md`; the per-repository document set is `references/evidence-pack.md`.

## Claims policy (hard rule)

Never write or say that a product **is** "ISO 27001 certified", "SOC 2 compliant", "GDPR compliant", "NIS2 compliant", "EU-only" or "WCAG conformant" unless the certificate, attestation or audit exists and is current. Use "built to support ...", "designed according to ...", "controls mapped to ...". Product copy, processing agreements and sales material use the subprocessor list and the control matrix as their only source.

## What design produces (L/XL)

- `docs/compliance/DATA-CLASSIFICATION.md`: per entity: class (public, internal, confidential, personal, special-category, secret), tenant scope, retention, deletion path, region, who may read.
- `docs/security/THREAT-MODEL.md`: STRIDE per trust boundary (browser to BFF, BFF to API, API to database, worker to broker, outbound integrations, native app to API, admin plane), with mitigations linked to tests.
- `docs/compliance/CONTROLS.md`: the system's control matrix (a subset of the baseline plus system-specific controls).
- `docs/legal/`: record of processing (art. 30), technical and organisational measures (art. 32), a processing-agreement draft when you are the processor, a DPIA when risk is high.
- `docs/security/SUBPROCESSORS.md` plus a machine-readable `subprocessors.json` guarded by a test.
- `docs/compliance/ACCESSIBILITY.md` and `docs/security/ASVS.md` (and `MASVS.md` for apps).

## What the build enforces (every phase)

- New endpoint -> a permission-matrix row, a cross-tenant negative test and an anonymous 401 sweep.
- New personal-data field -> a classification row, retention, inclusion in export and erasure, exclusion from logs and events.
- New supplier or external API -> a subprocessor row, plus an ADR if outside the agreed region.
- New UI -> accessibility scan clean, keyboard path, narrow width, visible focus, labels.
- Security-relevant change -> an audit entry in the same transaction.
- Release -> dependency scan, SBOM and generated test results stored as evidence.

## Small-team realities (be honest about them)

- **Segregation of duties** (SOC 2 CC8.1, ISO A.5.3): when one human maintains everything, compensating controls are a protected main branch, required CI gates, an independent AI review recorded on every large pull request, deployments only from CI, audited production access and a documented periodic access review. Flag this in every audit-readiness report.
- **SOC 2 Type II needs a period of operation** (typically 3 to 12 months of evidence): start collecting from day one.
- **NIS2** may not apply to you directly but applies to many clients: support their supply-chain duties with security questionnaires, incident notification within agreed hours and SBOMs.

## Pitfalls

- Policies without mechanisms: auditors and attackers both find the gap.
- Logging personal data "temporarily" for debugging: forbidden; use ids and correlation ids.
- Forgetting backups in erasure: document that erased data ages out of backups within the retention window.
- Analytics, fonts, CDNs or captcha loaded from vendors outside the agreed region without an ADR and a consent design.
- AI features: prompts may contain personal data; the AI boundary must define retention and no-training.

## References

- `references/control-matrix.md` - the 30-control baseline with mappings, mechanisms, tests and conditional additions.
- `references/evidence-pack.md` - the per-repository document set and how evidence is automated.
