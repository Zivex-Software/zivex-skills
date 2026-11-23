# Evidence pack: the per-repository document set

Keep this set next to the code; it is the audit trail.

```text
docs/
  compliance/
    CONTROLS.md                  control matrix for this system (CTL rows -> mechanism -> test -> evidence -> status)
    DATA-CLASSIFICATION.md       per entity: class, tenant scope, retention, deletion, region, readers
    ACCESSIBILITY.md             WCAG 2.2 AA approach, known gaps, statement draft
    AUDIT-READINESS.md           per framework: what exists, what is missing, compensating controls
    evidence/                    generated, never hand-edited:
      TEST-RESULTS-<version>.md    output of the full test run
      dependency-scan-<version>.*  vulnerability scan report
      sbom-<version>.cdx.json      CycloneDX SBOM
      restore-drill-<date>.md      backup restore or point-in-time recovery drill results
  security/
    THREAT-MODEL.md              STRIDE per trust boundary, mitigations -> tests
    ASVS.md                      verification checklist at the chosen level with status per requirement
    MASVS.md                     (apps only)
    SUBPROCESSORS.md             human-readable list (company, seat, purpose, what it sees, location, legal basis, ADR)
    subprocessors.json           machine-readable; a test keeps both in sync
    KEY-MANAGEMENT.md            keys, purposes, rotation, custody
    PENTEST-SCOPE.md             scope for an external test before go-live (critical tiers)
  legal/
    RECORD-OF-PROCESSING.md      GDPR art. 30 (as controller and as processor)
    TOMS.md                      art. 32 technical and organisational measures (references CONTROLS.md)
    DPA-DRAFT.md                 processor agreement annex when you process for a client
    DPIA-<topic>.md              when risk is high
    PRIVACY-NOTICE-DRAFT.md      for end users
    INCIDENT-AND-BREACH-PROCEDURE.md   detection -> triage -> client notification -> authority notification -> NIS2 timelines
    RETENTION.md                 retention per data class plus legal basis (for example fiscal 7 years)
  operations/
    BACKUP-RESTORE.md, RUNBOOKS.md, SLO.md
```

## Automation

- A `task evidence` step (or part of `task release`) writes `docs/compliance/evidence/*` from CI artefacts; evidence is generated, never typed.
- CI keeps artefacts for at least 13 months (a SOC 2 Type II window plus margin) in storage inside the agreed region.
- When a control's evidence expires (for example a restore drill older than three months), a compliance overview should flag it.

## Rules for the documents

- Each claim in a document points to a mechanism and a test; a document without both is a wish.
- `AUDIT-READINESS.md` states what is missing, plainly. Never claim more than the evidence (see the claims policy in `SKILL.md`).
- Documents describe the system as it is; when a control changes, update `CONTROLS.md` in the same change.
