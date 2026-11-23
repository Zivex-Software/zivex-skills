# Definition of done: additions by kind

On top of the generic definition of done in `SKILL.md`.

## Customer-facing (data shown to a client's customers)

An explicit public contract type - no internal fields (explicit customer-safe fields, no fallback to internal text) - a customer authorization test - a cross-customer negative test - projection idempotency - an event contract test (JSON schema plus golden fixture) - a **sentinel leakage test** over every outbound channel (responses, events, logs) - a public copy review.

## Commercial (quotes, contracts, orders, prices, change requests)

Versioning - concurrency (`expectedVersion`) - money precision (`decimal`, rounding rules, VAT) - audit - status invariants (state-machine tests) - exactly-once acceptance (idempotency key) - the customer-visible representation.

## Time-based (SLA, scheduling, renewals, deadlines)

Time zone defined - business calendar defined - DST transitions tested - pause conditions tested - deterministic calculation with an injected `TimeProvider`.

## Integrations

Idempotent per external id or operation id - retries with backoff and a park or dead-letter state - a replay tool - credentials encrypted, never returned or logged - provider errors stored as fixed texts - a fake provider with failure injection for tests - mapping golden fixtures - a 202 is not success.

## AI features

A human reviews before anything is applied - rate limited - inputs treated as untrusted (never as instructions) - prompts and outputs not stored or logged unless an ADR says so - the fake provider in Development only - transparency text where users interact with AI.

## Website or shop

Content editable as specified - all locales complete (no untranslated strings) - SEO metadata and structured data - the redirect map live - the performance budget met on mobile - WCAG 2.2 AA and an accessibility statement - forms deliver and are encrypted - screenshots at desktop and narrow width - no third-party requests outside the agreed region without an ADR and consent.

## Native app (core plus edges)

Logic in the core with tests - edges contain no business rules - every screen reachable by route or deep link - offline and conflict behaviour tested - tokens only in platform secure storage - the mobile security checklist updated - screen-reader and keyboard checks - builds for all edges green in CI - signed artefacts.

## Rust or Go service

An extraction ADR exists - API and event contracts tested - SLOs measured (load test) - container hardened (non-root, read-only, SBOM, clean scan) - health endpoints - a runbook.
