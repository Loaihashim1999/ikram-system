# EKRAM Skills & Agents Engineering Charter

> Purpose: Reusable operating contract for Codex/Work agents working on the EKRAM system.
> Scope: Architecture, implementation, testing, review, release readiness.
> Rule: This file does **not** authorize production deployment by itself.

---

## 1. Global Engineering Rules

1. Work from the current reviewed working tree. Do not reset to `HEAD` or discard existing reviewed fixes.
2. Preserve all confirmed EKRAM fixes, including IKR-001 through IKR-013 and approved E2E fixes.
3. No two implementation agents may modify the same file concurrently.
4. A0 Orchestrator owns file assignment, sequencing, integration, and release gates.
5. A12 QA and A13 Reviewer may identify defects but must not silently repair them.
6. Backend authorization is authoritative. Do not weaken backend permissions just to make a page pass.
7. UI visibility/route guards must match the APIs actually required by the page.
8. Use synthetic test data only for E2E. Test business records must include `EKRAM-E2E-TEST`.
9. Never expose passwords, tokens, connection strings, SAS URLs, signed-link secrets, or private keys.
10. Do not declare `READY` without evidence from the defined quality gates.
11. Drivers are not ordinary EKRAM application users. They are a dedicated delivery-domain entity accessed through secure scoped links.
12. Direct handover and home delivery are two separate workflows and two separate user experiences.

---

# 2. Shared Skills

## Skill 01 — `ekram-repo-map`

### Purpose
Maintain the authoritative map of the current EKRAM repository.

### Scope
- Laravel backend
- React/frontend
- routes
- controllers
- models
- services
- middleware
- policies
- events/listeners
- queues/jobs
- notifications
- migrations
- reports/exports
- tests
- deployment/config

### Inputs
- repository tree
- `routes/api.php`
- `routes/web.php`
- backend/frontend entrypoints
- test suites
- deployment docs

### Rules
- Trace UI → API → service/controller → database.
- Reference paths; do not duplicate full source files into the skill.
- Mark legacy/deprecated flows explicitly.

### Required checks
- Route inventory
- permission dependencies
- shared services
- legacy modules
- duplicated implementations

### Do not
- infer behavior from page names only
- modify application code

### Outputs
- current architecture map
- route/API map
- dependency notes
- legacy/deprecation notes

---

## Skill 02 — `ekram-domain-workflows`

### Purpose
Define business domains, state machines, and cross-domain boundaries.

### Scope
1. Beneficiary Registry
2. Registration & Confirmation
3. Policy / Eligibility
4. Support Case Management
5. Inventory
6. Direct Handover & Receipt
7. Home Delivery
8. Notifications & Communications
9. Accounts & Permissions
10. Documents / Governance / Reporting

### Rules
- Design workflows before pages.
- Make state transitions explicit.
- Reuse current valid states/models where possible.
- Preserve audit history.

### Key target flow
`Beneficiary Draft → Review → Confirmed → Policy Evaluation → Support Case → Approval → Stock/Preparation → Fulfillment`

Fulfillment branches:
- `DIRECT_HANDOVER`
- `HOME_DELIVERY`

### Outputs
- state machine
- transition rules
- event map
- domain ownership boundaries

---

## Skill 03 — `ekram-laravel-backend`

### Purpose
Define safe Laravel backend implementation conventions.

### Scope
- controllers
- Form Requests / validators
- services
- transactions
- policies/middleware
- events
- audit logs
- queue jobs
- API responses

### Rules
- Use transactions for multi-write business operations.
- Verify database state, not only HTTP status.
- Do not swallow required audit failures silently.
- Preserve PostgreSQL compatibility.
- Avoid fat controllers when workflow logic belongs in a service.

### Required checks
- validation
- authorization
- transaction boundaries
- idempotency
- audit/history
- error contract
- rollback behavior

### Outputs
- safe backend implementation
- targeted tests
- integration notes

---

## Skill 04 — `ekram-react-ux`

### Purpose
Define stable, accessible EKRAM frontend behavior.

### Scope
- forms
- route guards
- navigation
- RTL
- loading/error/empty states
- responsive behavior
- keyboard usage
- dialogs/wizards
- API error handling

### Rules
- Inputs must not remount during typing.
- Do not use changing `key` values tied to input values.
- Do not reset whole forms on every `onChange`.
- Preserve typed data across validation errors.
- Permission visibility must match backend/API requirements.
- Surface meaningful 4xx validation errors to the user.

### Preserve
- E2E-004 focus/remount lesson
- E2E-005 request-contract/error-surfacing lesson

### Outputs
- stable UX
- component tests
- route/menu behavior
- accessibility evidence

---

## Skill 05 — `ekram-auth-permissions`

### Purpose
Keep backend authorization and frontend visibility aligned.

### Scope
- roles
- grants
- `ModulePermission`
- route guards
- page/API dependencies
- IDOR
- nested parent-child boundaries
- signed URLs

### Rules
- Backend authorization is authoritative.
- Never grant broad access just to remove a 403.
- A visible page must be able to access its required APIs.
- Nested resources must prove parent-child relationship.

### Preserve lessons
- IKR-005
- IKR-012
- IKR-013
- E2E-002
- E2E-003

### Required checks
- allowed role
- denied role
- wrong-object ID
- wrong-parent + valid child
- page/API permission dependency

### Outputs
- route-permission matrix
- frontend visibility rules
- security tests

---

## Skill 06 — `ekram-policy-support`

### Purpose
Own beneficiary eligibility/policy and support-case workflow.

### Scope
- policy versions
- active policy
- policy evaluation
- immutable snapshots
- eligibility
- support requests
- approval/rejection
- inventory reservation
- fulfillment method

### Rules
- Policy evaluation must be visible and auditable.
- Repeated evaluations preserve historical snapshots.
- Support uses the existing unified support engine where valid.
- Do not duplicate support subsystems.

### Target support states
Map to existing real states where available:
- REQUESTED
- EVALUATED
- APPROVED
- REJECTED
- STOCK_RESERVED
- READY
- COMPLETED
- CANCELLED

### Outputs
- policy workflow
- support workflow
- tests
- UI contract

---

## Skill 07 — `ekram-direct-handover`

### Purpose
Own direct support handover/receipt at the association/service point.

### Scope
- verification code
- beneficiary receipt
- direct handover
- receipt history
- filters
- Excel
- PDF/receipt
- audit
- idempotency

### Rules
- This is **not** home delivery.
- No driver registration here.
- Code confirmation must not double-decrement inventory.
- Repeated confirmation must be idempotent.

### Target UI
- code input
- verify action
- beneficiary/support summary
- receipt confirmation
- table with filters
- export to Excel/PDF

### Outputs
- handover page
- receipt workflow
- audit/tests
- export verification

---

## Skill 08 — `ekram-driver-delivery`

### Purpose
Own home delivery, drivers, signed driver access, and delivery confirmation.

### Core rule
**Driver is not a normal EKRAM User account.**

### Driver entity
Suggested domain fields:
- `id`
- `name`
- `phone`
- `status`
- `notes`
- timestamps

### Driver portal target design
A secure scoped driver link opens a mobile-first page that shows **the list of beneficiaries assigned to that driver**, not a single generic task.

Each row/card must include:
- beneficiary name
- beneficiary phone
- address
- task/reference number
- support type
- delivery status
- action to confirm delivery

Only beneficiaries assigned to that driver may appear.

### Delivery confirmation by code
For each assigned beneficiary:

`Driver opens beneficiary task → enters receipt/verification code → server validates code + assignment + state → delivery becomes Delivered`

On successful confirmation:
- set delivered state
- record `delivered_at`
- record driver
- persist verification result
- update related support/distribution state
- apply inventory effect only once
- create receipt/delivery record
- create audit/history
- notify authorized supervisor
- generate delivery proof document

### Supervisor delivery view
Authorized supervisor sees:
- beneficiary name
- phone
- address
- support type
- driver details
- task number
- delivery date/time
- current status
- delivery-proof document

### Security
Driver link must be:
- signed/unguessable
- scoped to the driver/assignments
- expiring
- resistant to tampering
- not a general login
- minimal-data access only

### Idempotency
Repeated confirmation must NOT:
- decrement stock twice
- create duplicate receipt
- create duplicate delivery
- create duplicate movement

### Current registered defect
**E2E-007 — Driver link / driver portal is not proven operational.**

Required future proof:
`distribution → assignment → signed link → SMS → clean browser → beneficiary list → verification code → delivered → supervisor view → document`

### Outputs
- driver domain
- driver portal
- assignment workflow
- signed-link security
- delivery E2E tests

---

## Skill 09 — `ekram-sms-notifications`

### Purpose
Own domain notifications, deep links, SMS templates, queues, and provider integration.

### Scope
- domain events
- recipient resolution
- notification persistence
- notification detail/deep link
- SMS templates
- queue/jobs
- provider requests
- retry/idempotency
- phone normalization
- provider status
- logging/security

### Current registered defect
**E2E-006 — SMS is not proven operational in production.**

### Authorized production E2E phone
- local: `0574917155`
- E.164 if required: `+966574917155`

No other real number may be used without explicit authorization.

### SMS state model
Do not conflate states:
- REQUESTED
- QUEUED
- PROVIDER_ACCEPTED
- SENT
- DELIVERED
- FAILED

Never report `DELIVERED` unless provider evidence proves it.

### Test SMS rules
- max one basic test SMS + one driver-link SMS unless a retry is technically required
- prefix/meaning must clearly indicate `EKRAM TEST`
- no beneficiary PII
- no password
- no token
- no financial data

### Notification deep-link contract
Persist enough metadata:
- event type
- target type
- target id
- recipient
- title
- message
- action route
- read_at

Click:
`mark read → navigate/open exact target`

### Outputs
- notification event matrix
- SMS provider flow
- deep-link behavior
- queue/provider tests
- E2E evidence

---

## Skill 10 — `ekram-documents-reporting`

### Purpose
Own PDF, Excel, governance reports, charts, branding, and display labels.

### Document design system
All official PDFs must use one reusable association layout:
- logo
- association name
- document title
- reference number when applicable
- generated date
- consistent content frame
- page X of Y
- footer/confidentiality/system note where appropriate

### Apply to
- beneficiary card
- receipt
- delivery proof
- direct handover receipt
- governance report
- inventory report
- support report
- policy report

### Avoid
- browser URL in print footer
- browser-generated headers
- blank trailing pages
- raw internal codes

### Excel
- association name
- report title
- date/range
- Arabic headers
- complete matching dataset
- correct data types
- useful sheet names

### Display vocabulary
Internal stable codes may remain internally, but UI/PDF/Excel must use localized labels.

### Outputs
- branded templates
- export tests
- label resolver
- report consistency

---

## Skill 11 — `ekram-database-migrations`

### Purpose
Own PostgreSQL-safe schema/data migration strategy.

### Scope
- foreign keys
- indexes
- historical data
- backward compatibility
- migration rollback
- driver-user migration
- support/delivery schema evolution

### Rules
- additive/backward-compatible where possible
- no destructive production assumptions
- no blind deletion of historical driver identities
- preserve attribution/audit references
- derive rollback/test behavior from the migration ledger where applicable

### Outputs
- migration plan
- migration tests
- data mapping report
- rollback notes

---

## Skill 12 — `ekram-qa-release`

### Purpose
Own independent quality gates and release readiness.

### Scope
- PHPUnit
- frontend tests
- PostgreSQL guarded tests
- Chrome
- Edge
- E2E
- SMS
- driver link
- cleanup
- candidate validation
- Azure release gates

### Required evidence
- backend regression
- frontend regression
- PostgreSQL regression
- Chrome E2E
- Edge E2E
- no unresolved Critical/High
- no unexplained application 5xx
- no visible page/API permission mismatch
- test-data cleanup

### Rules
- browser-extension noise is not an EKRAM defect unless source is proven to be the EKRAM origin
- QA does not silently repair
- READY must be evidence-based

### Outputs
- test report
- E2E report
- release recommendation
- remaining-risks report

---

## Skill 13 — `ekram-design-system`

### Purpose
Make every EKRAM page one coherent product.

### Scope
Tokens, typography, spacing, cards, buttons, inputs, tables, filters, tabs, dialogs, badges, empty/loading states, Arabic RTL, mobile driver portal.

### Inputs
`frontend/src/theme/tokens.js`, shared components, page screenshots.

### Rules
Reuse shared components. No page-specific visual systems. Consistent page header, action hierarchy, and table structure. Driver portal keeps EKRAM identity and is mobile-first.

### Required checks
Shared tokens used. Primary/secondary/danger actions distinct. RTL and numeric alignment reviewed.

### Do not
Scatter arbitrary colors or spacing. Redesign a page without the shared system.

### Outputs
Shared frontend components. `docs/design/EKRAM-DESIGN-SYSTEM.md`.

---

## Skill 14 — `ekram-beneficiary-workspace`

### Purpose
Own the beneficiary operational experience.

### Scope
List, details, registration, edit, archive, restore, family, finance, documents, policy, support, receipt history.

### Inputs
Beneficiary routes, detail page, permissions, related APIs.

### Rules
Detail is the workspace. Actions follow permissions. No dead tabs or disconnected counters. No final registration without confirmation.

### Required checks
Registration, review, confirmation, persistence, archive, restore, policy linkage, support linkage.

### Do not
Show actions the API rejects. Invent fields that are not stored.

### Outputs
Workspace behavior and tests.

---

## Skill 15 — `ekram-policy-scoring`

### Purpose
Make policy scoring deterministic, explainable, and auditable.

### Scope
Rules, inputs, points, thresholds, classification, breakdown, score sort/filter, immutable snapshots.

### Inputs
Published policy version, beneficiary snapshot, `PolicyScoringService`.

### Rules
`total_score` is the sum of applicable rule points from one evaluated policy version. Scoring is server-side. Historical evaluations stay immutable.

### Required checks
Each rule exposes rule id, label, input, condition, awarded points, max points, and reason. Re-evaluation creates a new record.

### Do not
Score only in the UI. Rewrite an old evaluation when beneficiary data changes. Apply citizen policy silently to residents.

### Outputs
Score service, breakdown, classification mapping, tests, UI representation.

---

## Skill 16 — `ekram-operational-metrics`

### Purpose
Make dashboard and report calculations match the fulfillment domain.

### Scope
Date range, due, completed, pending, not received, overdue, delivered, unique beneficiaries, driver and support metrics.

### Inputs
Selected period, support/delivery operations, completion timestamps.

### Rules
`TOTAL_DUE` counts operations due or ready in the period. `COMPLETED` counts those with a valid completion timestamp. `NOT_COMPLETED = TOTAL_DUE - COMPLETED`. `OVERDUE` counts due operations past the period end without completion. Operation counts stay distinct from unique beneficiary counts. «لم يستلم» is not all beneficiaries minus delivered beneficiaries.

### Required checks
Same date field for every period metric. Null completion is not completed. Labels state operation versus beneficiary.

### Do not
Mix an all-table snapshot into a period metric without a label.

### Outputs
`docs/analytics/EKRAM-METRIC-DEFINITIONS.md` and metric tests.

---

## Skill 17 — `ekram-driver-link`

### Purpose
Generate and validate driver links on the canonical host.

### Scope
Canonical URL, `APP_URL`, capability token, HTTPS, host, expiry, assignment scope, regeneration.

### Inputs
`DriverAccessService`, production host `https://systemben.ekramfb.org.sa`.

### Rules
Operational links use the canonical host, not a Container Apps revision hostname. A link opens the matching driver and only that driver's assignments. Do not weaken validation to make a link open.

### Required checks
Generate, store, open, accept, correct driver, correct assignments.

### Do not
Put the capability token in query logs. Treat a driver as a normal user account.

### Outputs
Host-correct link proof.

---

## Skill 18 — `ekram-professional-pdf`

### Purpose
Replace browser-style prints with one institutional PDF system.

### Scope
A4, RTL, Arabic type, branding, frame, header, footer, pagination, tables, charts.

### Inputs
Association document layout and official document templates.

### Rules
No browser URL, browser date, browser header/footer, empty trailing page, clipped content, or raw technical codes. Page X of Y. Repeat table headers. Break pages only when content requires it.

### Required checks
Beneficiary, governance, policy, support, receipt, and delivery-proof PDFs.

### Do not
Print a browser page as an official document.

### Outputs
Shared PDF layout and document-specific templates.

---

## Skill 19 — `ekram-data-quality`

### Purpose
Classify bad operational data without mutating real records.

### Scope
Phones, duplicate drivers, `EKRAM-E2E-TEST` rows, orphan assignments, support without beneficiary, delivery without assignment, completion without timestamp, invalid policy snapshots, inconsistent statuses.

### Inputs
Read-only operational queries. Production database access remains forbidden from this workspace.

### Rules
Classify each issue as auto-fix safe, manual review, test data, valid data, or unknown. Delete only conclusively identified synthetic business data at the cleanup stage.

### Required checks
Inventory of active `EKRAM-E2E-TEST` business records. No real-record deletion.

### Do not
Automatically update production rows. Delete audit records required for retention.

### Outputs
`reports/EKRAM-DATA-QUALITY.md`.

---

## Skill 20 — `ekram-ui-audit`

### Purpose
Reject pages that work but do not look like the rest of EKRAM.

### Scope
Title, breadcrumb, primary action, KPI cards, filters, tables, Arabic wording, spacing, type, empty/error states, menus, pagination, mobile.

### Inputs
Implemented pages after functional freeze.

### Rules
Run after functional implementation and before final QA. Compare major pages side by side.

### Required checks
Shared header, table, filter, and action patterns. Driver page usable on a phone.

### Do not
Accept a technically working page with a one-off visual system.

### Outputs
UI consistency findings.

---

# 3. Agent Team

## A0 — Orchestrator / Engineering Lead

### Mission
Own the full execution plan and integration.

### Owned scope
- sequencing
- file ownership
- conflict resolution
- architecture decisions
- integration
- release gates

### Allowed changes
Coordination docs and integration changes after agent handoff.

### Required handoff
Final integration summary with:
- merged scopes
- conflicts
- risks
- gates

### Quality gate
No concurrent writers on the same file.

---

## A1 — Repository Mapper

### Mission
Produce read-only current-system map.

### Owned scope
Routes, controllers, models, services, pages, tests, legacy modules.

### Allowed changes
Documentation only.

### Quality gate
UI → API → DB trace completed for target modules.

---

## A2 — Domain Architect

### Mission
Define target business domains/state machines.

### Owned scope
Beneficiary, policy, support, fulfillment, driver, notification boundaries.

### Allowed changes
Architecture docs.

### Quality gate
No ambiguous ownership between Direct Handover and Home Delivery.

---

## A3 — Laravel Backend Engineer

### Mission
Implement backend APIs/services safely.

### Owned scope
Laravel backend implementation assigned by A0.

### Quality gate
Authorization + validation + transaction + audit + tests.

---

## A4 — React / UX Engineer

### Mission
Implement stable frontend experience.

### Owned scope
Pages, components, forms, navigation, route guards.

### Quality gate
No focus/remount regressions; no hidden 422; RTL/responsive behavior.

---

## A5 — Authorization & Security Engineer

### Mission
Protect authorization boundaries and signed access.

### Owned scope
Middleware, policies, grants, IDOR, signed links, security review.

### Quality gate
Backend rules preserved; page/API contracts aligned.

---

## A6 — Beneficiary Registration Engineer

### Mission
Own beneficiary wizard, review, confirmation, details, archive/delete.

### Quality gate
No final beneficiary without explicit confirmation.

---

## A7 — Policy & Support Engineer

### Mission
Own policy evaluation and support-case lifecycle.

### Quality gate
Policy evaluation visible/persisted; support can be submitted and progressed.

---

## A8 — Direct Handover Engineer

### Mission
Own direct handover/receipt page and code confirmation.

### Quality gate
Receipt code + filters + Excel/PDF + idempotency pass.

---

## A9 — Home Delivery / Driver Engineer

### Mission
Own driver entity, assignments, driver portal, signed links, delivery confirmation.

### Quality gate
Driver beneficiary list + code confirmation + supervisor visibility + delivery document + idempotency pass.

---

## A10 — SMS / Notifications Engineer

### Mission
Own notification events, deep links, SMS queue/provider/status.

### Quality gate
SMS is proven through real state chain; no duplicate send; deep links work.

---

## A11 — Documents / Reports Engineer

### Mission
Own branded PDF/Excel/reporting system.

### Quality gate
No browser-print artifacts; localized labels; multi-page documents correct.

---

## A12 — QA / Browser / PostgreSQL Engineer

### Mission
Independently verify implementation.

### Owned scope
Tests/evidence only.

### Rule
Must not silently fix defects.

### Quality gate
Backend + frontend + PostgreSQL + Chrome + Edge evidence.

---

## A13 — Independent Reviewer / Red Team

### Mission
Attempt to falsify READY status.

### Scope
Architecture, authorization, data integrity, UX, signed links, notification routing, reports, migration safety.

### Rule
Return defects to A0/owner. No hidden repairs.

---

# 4. File Ownership Protocol

A0 maintains a table:

| Path | Owner | Status | Dependencies |
|---|---|---|---|

Rules:
1. One writer per file at a time.
2. Agents may read the same files concurrently.
3. Ownership must be handed back before another agent edits the file.
4. A12/A13 are read/test/review only unless A0 explicitly reassigns ownership.
5. Integration changes happen only after owner handoff.

---

# 5. Execution Waves

## Wave 0 — Discovery / Architecture
- A1 Repository Mapper
- A2 Domain Architect

## Wave 1 — Core Data / Authorization
- A5 Authorization
- A6 Beneficiary Registration
- A7 Policy & Support

## Wave 2 — Fulfillment / Communication
- A8 Direct Handover
- A9 Home Delivery / Driver
- A10 SMS / Notifications

## Wave 3 — Documents / UX
- A11 Documents / Reports
- A4 Cross-system UX

## Wave 4 — Backend Integration
- A3 Laravel Backend
- A5 Security review

## Wave 5 — Verification
- A12 QA / Browser / PostgreSQL

## Wave 6 — Independent Review
- A13 Red Team

## Wave 7 — Release Decision
- A0 Orchestrator

---

# 6. Agent Handoff Contract

Every implementation agent returns:

```text
Agent:
Scope:
Files inspected:
Files changed:
Architecture assumptions:
Tests:
Risks:
Dependencies:
Ready for integration: YES / NO
```

No agent may claim READY without test evidence.

---

# 7. Current Registered E2E Requirements

## E2E-006 — SMS Delivery Failure

### Symptom
SMS is not proven operational in production.

### Required proof
`UI/API → communication record → queue → provider → authorized TEST phone → provider/delivery status`

### Production E2E phone
Only:
- `0574917155`
- or `+966574917155` if E.164 is required

---

## E2E-007 — Driver Link / Driver Portal Failure

### Symptom
Driver link is reported not working and the driver page does not appear correctly.

### Required proof
`distribution → driver assignment → signed link → SMS → clean browser → assigned beneficiary list → verification code → Delivered → supervisor view → delivery proof document`

Driver page must display, for the assigned driver only:
- beneficiary names
- phone numbers
- addresses
- task/reference numbers
- support types
- statuses
- confirmation action/code

---

# 8. Quality Gates

## Architecture Gate
- domain boundaries documented
- direct handover != home delivery
- driver != normal user

## Security Gate
- no permission weakening
- IDOR/nested-resource checks
- signed driver link scoped
- no secret leakage

## Data Gate
- migrations safe
- historical references preserved
- inventory never negative
- idempotent receipt/delivery

## Backend Gate
- targeted tests pass
- full backend regression passes

## Frontend Gate
- targeted tests pass
- full frontend regression passes
- stable typing/focus
- correct permission visibility
- clear validation errors

## PostgreSQL Gate
- guarded PostgreSQL regression passes

## Browser Gate
- Chrome PASS
- Edge PASS

## E2E Gate
- beneficiary full journey
- policy/support
- direct handover
- home delivery
- SMS
- driver portal
- receipt
- notifications
- documents
- cleanup

## Release Gate
No READY if:
- any unresolved Critical/High
- unexplained 5xx
- broken SMS/driver workflow
- test data cleanup failed
- Chrome or Edge critical journey fails

---

# 9. Definition of Done

EKRAM may be declared ready for controlled deployment only when:

1. Policy works end-to-end.
2. Beneficiary detail/actions are complete.
3. Beneficiary cannot become final without explicit confirmation.
4. Safe archive/delete works.
5. Support can be submitted from beneficiary.
6. Direct handover and home delivery are separate.
7. Home delivery includes driver registration, driver list, assignment counts, delivered/in-progress/remaining metrics.
8. Driver portal lists assigned beneficiaries with phone, address, task number, support type, status.
9. Driver confirms each delivery using the verification/receipt code.
10. Successful driver confirmation appears to authorized supervisors with beneficiary, address, support type, driver details, and delivery date.
11. A delivery-proof document is generated.
12. Repeated confirmation is idempotent.
13. Drivers do not require normal application accounts.
14. SMS works through the defined provider-state chain.
15. Notifications cover the defined domains.
16. Notification click opens the correct target.
17. Generated PDFs use association branding.
18. Excel exports contain complete matching data.
19. Raw technical codes are not exposed in normal UI/reports.
20. Backend/page/API authorization is aligned.
21. Backend regression passes.
22. Frontend regression passes.
23. PostgreSQL regression passes.
24. Chrome E2E passes.
25. Edge E2E passes.
26. Test-data cleanup passes.
27. No unresolved Critical/High finding remains.

---

# 10. Production Safety

This charter does not authorize automatic production modification.

Before production deployment:
- build immutable candidate image
- validate on Linux
- create controlled revision
- keep rollback revision
- verify health/readiness/liveness
- perform candidate E2E
- promote only after gates pass

Never:
- delete old revision during validation
- expose secrets
- use real beneficiary data for tests
- run destructive migrations
- weaken backend security to pass UI tests
