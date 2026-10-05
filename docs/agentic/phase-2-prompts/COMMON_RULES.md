# Phase 2 common rules

Keep this file as the shared contract. Task files add role-specific work only.

## Scope

Local implementation and verification of phase 2 on `C:\laragon\www\ikram-system`, branch `main`. Preserve the approved dashboard visual system and every existing uncommitted change.

Approved visual reference: Figma file `addBBvDEvCYI3RtOgDDd14`, node `15:5`. Do not replace that system with a new theme.

## Safety

- Do not stash, switch branches, commit, push, merge, or deploy.
- Do not delete or revert unrelated changes.
- Do not access production, operational, or Aiven databases.
- Do not print secrets, `.env` contents, tokens, or complete driver capability URLs.
- Do not send live SMS or activate production workers, schedulers, or webhooks.
- Use isolated synthetic data and `COMMUNICATION_PROVIDER=fake`.
- PostgreSQL checks use only the existing guarded local QA bootstrap. Do not print the QA password.
- A 404 is not proof of authorization.
- Backend permissions stay authoritative.

## Architecture

- PostgreSQL is authoritative for real data. Tests may use isolated SQLite.
- Reuse `FinancialCalculationService`, versioned policy evaluation, `NotificationService`, inventory services, support/delivery transitions, and receipt verification.
- Income category and score category stay separate. Citizen policy is not applied to residents.
- Do not overwrite historical evaluations, decisions, or issued PDFs.
- Simulation does not create real evaluations or final decisions.
- Direct handover and home delivery stay separate experiences.
- Drivers are Driver records, not ordinary User accounts.
- Do not add a framework or a parallel business-logic layer to satisfy a pattern.
- One file has one writer. Read access may be shared. Do not expand your own file ownership.

## Requirement index

| ID | Requirement |
| --- | --- |
| R-BEN-01 | Permanent and daily registration select nationality. Saudi maps to citizen. Any other nationality maps to resident. The backend derives and validates the classification. Missing nationality is not treated as Saudi. Switching nationality updates fields and validation. Historical evaluations, decisions, and receipts stay unchanged. Explicit confirmation remains required. |
| R-BEN-02 | Beneficiary lists show name, classification, phone, address, district, family status, registration date, latest completed receipt summary and date, completed-receipt count, and authorized edit, archive/delete, detail, and attachment actions. |
| R-BEN-03 | Combined filters for classification, district, family status, and nationality. Counts and latest receipt come from authoritative completed receipts, without duplicate counting or per-row queries. Search, sort, pagination, and export stay consistent. |
| R-IMP-01 | Beneficiary import lives in beneficiary management, with an explicit permanent or daily target. Reuse the existing importer. Preview, validation, duplicate handling, explicit confirmation, and accurate results are required. Import does not overwrite silently and does not run eligibility, support, or communications. |
| R-POL-01 | Keep the authoritative calculator, separate income and score categories, resident behavior, program rules, immutable history, and simulation. Do not invent an elderly threshold or a nationality preference. |
| R-SUP-01 | Existing إرسال الدعم starts from list selection and from beneficiary details for eligible beneficiaries, including elderly beneficiaries only under the existing age rule. Initiating support is not the same as confirming physical receipt. |
| R-AUTH-01 | View, create, edit, delete, import, and support permissions stay separate. Hide unauthorized navigation, dashboard shortcuts, actions, dialogs, empty states, and notification actions. Backend responses omit restricted records and aggregates. Permission removal blocks later access, including stale pages. Denied requests have no side effects. |
| R-HO-01 | New support entry points still reach direct pickup with code verification, permissions, completed-receipt counting, inventory effects, receipts, and replay safety. |
| R-DRV-01 | Preserve no-SMS operation: driver directory, active-driver selection, assignment and reassignment, view/copy without rotation, explicit rotation, scoped expiry, revocation, inactive-driver denial, sibling-task rules, and idempotent completion. Copying does not send SMS or duplicate communication intents. |
| R-NOT-01 | Audit recipient selection, persistence, retrieval, unread counts, detail, and deep links. Historical notifications must not disclose targets after permissions change. Live SMS and reconciliation stay deferred. |
| R-PDF-01 | Redesign every PDF template with the official frame on each page, including continuations. Governance PDFs are landscape. Preserve wording, values, calculations, signatures, notes, stamps, receipt snapshots, and QR data. Do not overwrite issued historical PDFs. |
| R-RPT-01 | Nationality analysis counts a defined unique population, separates registered, active, and served, uses the right dates, avoids join duplication, shows missing nationality, respects scope, and reconciles charts, tables, totals, and PDF exports. |
| R-DASH-01 | Dashboard cards, headings, descriptions, tooltips, and view-all links use established page names and routes. Do not rename pages to match the dashboard. Do not relabel an unrelated count as another module's statistic. |
| R-ARCH-01 | Incremental structure only, with a demonstrated benefit. No duplicated business rules. Cleanup requires a ledger. Uncertain files stay. |

## Terminology hold

If «جهات المستفيد» does not match an existing recipient-entity type, record the question and continue unrelated work. Do not invent the entity.

## Reporting

Each role returns:

```text
Agent:
Scope:
Files inspected:
Files changed:
Contracts used:
Tests and counts:
Findings:
Dependencies:
Unresolved decisions:
Ready for integration: YES / NO
```

Matrix values are `NOT_RUN`, `PASS`, `FAIL`, `BLOCKED`, or `DEFERRED`. Blocked, deferred, and unrun checks are not passes.

## Verification limits

Run the smallest targeted test that proves the change. Do not run conflicting fixtures against the same database at the same time. Do not claim production readiness. E2E-006 and the live portion of E2E-007 stay open.
