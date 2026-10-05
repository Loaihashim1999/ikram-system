# Phase 2 agent package

Entry point for the EKRAM phase-2 local implementation. This package does not authorize deployment or live SMS.

## Repository checkpoint

- Root: `C:\laragon\www\ikram-system`
- Branch: `main`
- Working tree: dirty on purpose. Preserve it. Do not stash, switch, commit, push, merge, or deploy.

## Roster

| Role | File | Mode |
| --- | --- | --- |
| A0 Orchestrator | [A0-ORCHESTRATOR.md](A0-ORCHESTRATOR.md) | Parent session. Owns scope, ownership, and acceptance. |
| A1 Repository Mapper | [A1-REPOSITORY-MAPPER.md](A1-REPOSITORY-MAPPER.md) | Read-only discovery |
| A2 Domain Architect | [A2-DOMAIN-ARCHITECT.md](A2-DOMAIN-ARCHITECT.md) | Contracts and docs only |
| A3 Backend Integration | [A3-BACKEND-INTEGRATION.md](A3-BACKEND-INTEGRATION.md) | Serialized shared backend |
| A4 Frontend Dashboard | [A4-FRONTEND-DASHBOARD.md](A4-FRONTEND-DASHBOARD.md) | Exclusive frontend writer |
| A5 Authorization | [A5-AUTHORIZATION-SECURITY.md](A5-AUTHORIZATION-SECURITY.md) | Assigned auth files only |
| A6 Beneficiaries Import | [A6-BENEFICIARIES-IMPORT.md](A6-BENEFICIARIES-IMPORT.md) | Assigned beneficiary files only |
| A7 Policy Support | [A7-POLICY-SUPPORT.md](A7-POLICY-SUPPORT.md) | Assigned policy/support files only |
| A8 Direct Handover | [A8-DIRECT-HANDOVER.md](A8-DIRECT-HANDOVER.md) | Assigned handover files only |
| A9 Driver Delivery | [A9-DRIVER-DELIVERY.md](A9-DRIVER-DELIVERY.md) | Preserve no-SMS driver flow |
| A10 Notifications | [A10-NOTIFICATIONS.md](A10-NOTIFICATIONS.md) | Assigned notification files only |
| A11 PDF Reporting | [A11-PDF-REPORTING.md](A11-PDF-REPORTING.md) | Assigned PDF/report files only |
| A12 Independent QA | [A12-INDEPENDENT-QA.md](A12-INDEPENDENT-QA.md) | Evidence only. No application repairs. |
| A13 Independent Review | [A13-INDEPENDENT-REVIEW.md](A13-INDEPENDENT-REVIEW.md) | Findings only. No application repairs. |

Shared rules: [COMMON_RULES.md](COMMON_RULES.md). Ownership: [FILE_OWNERSHIP.md](FILE_OWNERSHIP.md). Acceptance: [ACCEPTANCE_MATRIX.md](ACCEPTANCE_MATRIX.md).

## Concurrency

This Cursor session is A0. Child agents are local Task subagents. The tool allows parallel local subagents and does not publish a capacity of 14. Phase 2 therefore runs in successive waves of at most two child agents. Slots are reused. A12 and A13 stay independent of the writers they review.

## Dependency order

1. Discovery: A1 and A2. No application edits.
2. Core: A5, then A6, then A7. One writer at a time when files overlap.
3. Fulfillment: A8, then A9, then A10.
4. Reporting and UI: A11, then A4 against stabilized contracts.
5. Shared backend integration and safe cleanup: A3 after handoffs.
6. A12 QA, then A13 review.
7. Owner fixes, affected re-checks, then A0 acceptance and local preview.

A3 may take a single serialized integration earlier when a later role is blocked on a shared file. A4 may prepare an isolated component only after the relevant contract exists.

## Execution status

| Wave | Roles | Status |
| --- | --- | --- |
| 0 | A1, A2 | Accepted |
| 1 | A5, A6, then A7 | Handed back, including the fixture repair. |
| 2 | A8, A9, A10 | Handed back. A9 changed no files; driver capability tests later passed (2 tests, 28 assertions). |
| 3 | A11, A4 | Handed back. |
| 4 | A3 | Handed back. Route guards, ledger, and sidebar test are accepted. |
| 5 | A12 | Evidence is in `evidence/A12-QA.md`. First full PHPUnit failed 7 nationality fixture cases. A0 repaired those fixtures. Re-run: 950 tests, 948 passed, 2 skipped, 4932 assertions, exit 0. Full Vitest: 35 files, 149 passed, exit 0. Home delivery now expects `دليل السائقين`. |
| 6 | A13 | Findings recorded in `evidence/A13-REVIEW.md`. High and medium defects were fixed and covered by `BeneficiaryNationalityAndImportTest`, `NotificationPermissionTest`, and `NationalityReportAndPdfTest`: 11 passed, 349 assertions. |
| 7 | A0 acceptance | Local defects from A13 are closed. Not production ready. |

Update this table when a wave starts or finishes. Do not mark a requirement PASS in the matrix until its evidence exists.

## Local acceptance note

Phase 2 requirements in the matrix are PASS except E2E-006 and live E2E-007, which stay DEFERRED. `PdfFinalizationTest`, a browser pass, and guarded PostgreSQL stay NOT_RUN. «جهات المستفيد» is UNDEFINED. The elderly threshold is NONE. This is local verification only. It is not production readiness, and it does not authorize deployment or live SMS.

PDF samples for review:

- `docs/agentic/phase-2-prompts/evidence/pdf-samples/portrait-support-proof.pdf`
- `docs/agentic/phase-2-prompts/evidence/pdf-samples/landscape-governance-report.pdf`
