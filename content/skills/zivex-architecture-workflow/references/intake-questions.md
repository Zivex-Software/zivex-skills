# Intake question bank

Pick the questions whose **Decides** column is still open after recon. Ask in rounds of at most five, the most decision-heavy first, each with your recommendation. Anything left unanswered becomes a labelled assumption `A-nn`.

## Round 1 - outcome and shape (always)

| Question                                                                                                                | Decides                                                      |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| What problem does this solve, for whom, and how do we know it worked (a measurable outcome in 6 to 12 months)?          | Vision, success criteria, what phase 1 must prove            |
| Is this client work, an own product, an internal tool, an integration or a website? Who owns the IP and the source?     | Repository ownership, tenancy, licensing, exit and handover  |
| Who are the users and roles: internal staff, the client's staff, the client's customers, anonymous visitors, machines?  | Authorization model, identity organisation mapping, surfaces |
| What is the tenant (an identity organisation, a workspace inside it, an environment)? Can one person belong to several? | Tenant key, isolation design, row-level security             |
| Which clients: web app, portal, islands in a website, iOS, Android, desktop, a third-party API, a CLI?                  | Client architecture, shared core, delivery effort            |

## Round 2 - domain and data

| Question                                                                                                         | Decides                                                                     |
| ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Walk me through the 3 to 5 most important flows step by step. What goes wrong today?                             | Core flows, vertical slices, phase 1                                        |
| Which data is personal? Special categories (health, biometric, criminal, children)? Financial?                   | Classification, DPIA need, sector standards, encryption, verification level |
| What must be kept how long, and what must be deletable on request? Legal retention (for example 7 years fiscal)? | Retention, deletion paths, archival                                         |
| Is there existing data or a legacy system to migrate or run in parallel?                                         | Migration phase, import tooling, cut-over plan                              |
| Which states can the main objects have, and who may move them between states?                                    | State machines, invariants, capabilities                                    |
| Is money involved: currencies, VAT, payments, invoices?                                                          | Money model, payment boundary, commercial definition of done                |

## Round 3 - integrations, scale, operations

| Question                                                                                                                | Decides                                            |
| ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Which external systems must it talk to (ERP, CRM, accounting, e-mail, payment, government APIs)? Who owns the API keys? | Integration boundary, adapters, credential storage |
| Does it need AI? For what exactly, and may a person always review the output?                                           | AI boundary, human in the loop, risk class         |
| Expected volumes at launch and in two years: users, requests, records, files, events per second? Peaks?                 | Capacity, queue and analytics needs, cost          |
| How bad is downtime (minutes, hours, days)? How much data may be lost?                                                  | Availability tier, SLOs, RPO/RTO, topology         |
| Must data stay in one region, or do some customers need another?                                                        | Region design, residency per tenant, subprocessors |
| Sector: healthcare, government, financial, children?                                                                    | Conditional frameworks, verification level, audits |
| Languages, locales and time zones?                                                                                      | i18n design, time defaults                         |
| Who supports it after launch, with which service level?                                                                 | Observability depth, alerting, support process     |

## Round 4 - delivery constraints (fixed price or fixed scope)

| Question                                                                                          | Decides                         |
| ------------------------------------------------------------------------------------------------- | ------------------------------- |
| A hard deadline or event (launch, season, contract end)?                                          | Phase cut, V1 scope             |
| What is definitely **out** of V1? What would the client assume is included but we will not build? | Scope-out list, change triggers |
| Who decides on the client side, and who tests acceptance?                                         | Acceptance process per phase    |
| Design: an existing brand or design system, or do we design it?                                   | Design phase, UI effort         |

## Website or shop

Pages, content types and who edits what; catalogue size, variants, stock source, payment and shipping providers, B2B prices; forms and where submissions go; SEO, languages and redirects from an old site; whether an accessibility statement is required (the European Accessibility Act covers webshops).

## Native app

Offline use (which data and actions must work without network); device features (camera, location, push, biometrics, NFC, Bluetooth, background work); distribution (public stores, private, installers, auto-update); whether tablet and desktop share the app.
