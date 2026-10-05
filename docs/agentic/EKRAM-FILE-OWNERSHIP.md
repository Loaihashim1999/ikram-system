# EKRAM File Ownership

Source: [Canonical EKRAM charter](EKRAM_SKILLS_AND_AGENTS.md). The charter remains authoritative; existing repository safety rules still apply. This document does not authorize later phases or production actions.

# 4. File Ownership Protocol

A0 maintains a table:

| Path | Owner | Status | Dependencies |
|---|---|---|---|
| `docs/agentic/*`, `reports/*`, `.tmp/ekram-remediation/*` | A0 | Coordination / evidence | Master remediation authorization 2026-10-04 |
| `docs/architecture/EKRAM-CURRENT-MAP.md`, `EKRAM-ROUTE-PERMISSION-MATRIX.md` | A1 | Wave 0 documentation | Read-only discovery |
| `docs/architecture/EKRAM-TARGET-ARCHITECTURE.md`, `EKRAM-WORKFLOW-STATES.md` | A2 | Wave 0 documentation | Read-only discovery |

Wave 0 is complete: four architecture documents and [A0 remediation plan](EKRAM-REMEDIATION-PLAN.md) exist. Existing uncommitted work is the starting point. Baseline file hashes and Git status are recorded in `.tmp/ekram-remediation/baseline.json`.

| Application scope | Exclusive writer | Status | Dependencies |
|---|---|---|---|
| BeneficiaryController, Beneficiary model, SupportDistributionService archive guard; beneficiary pages/API, PolicyReviewLinks, new SupportRequestPage; lifecycle migration and focused tests | A1 acting A6/A7/A3/A4 | Assigned implementation | Existing policy/financial engines; route requests through A0 |
| DeliveryCommunicationController, SupportDistributionController, DriverAccessService, ReceiptVerificationService, PdfExportController, unified proof view; focused fulfillment PHP/Postgres tests | A2 acting A8/A9/A11 | Assigned implementation | Existing support engine; route/middleware requests through A0 |
| CommunicationService, SendCommunication, NotificationService, notification frontend/context, CommunicationsSettings, displayVocabulary; focused tests/additive notification metadata migration | A10 | Assigned implementation | Shared controller/console route requests through A0 |
| App, Sidebar, ModulePermission, routes/api.php, routes/console.php, UserController, Users account UI, separate fulfillment pages, DriverAccessPage, operational frontend tests, excelExport metadata | A0 acting A4/A5 | Assigned implementation/integration | Backend contracts coordinated with A2; display vocabulary coordinated with A10 |

Agents must request ownership before modifying additional files. Test processes use explicit isolated SQLite/fake-provider/blank-telemetry overrides; PostgreSQL verification uses the existing guarded QA bootstrap only. A12/A13 will be assigned read/test/review ownership after implementation handoff.

Rules:
1. One writer per file at a time.
2. Agents may read the same files concurrently.
3. Ownership must be handed back before another agent edits the file.
4. A12/A13 are read/test/review only unless A0 explicitly reassigns ownership.
5. Integration changes happen only after owner handoff.

---

## Final handoff

A1 and A2 returned all implementation files to A0 after targeted verification. A10 returned communications implementation to A0 before acting as independent A12 browser QA. A0 serialized integration and repaired defects returned by A12/A13, including beneficiary import confirmation, housing upload validation and notification overlay behavior. A13 edited only its review report. A12 owns tests/Browser/ekram-remediation-gate.mjs, its fixture and the E2E evidence reports; it returns defects without repairing application source. All application implementation ownership is now with A0 for final verification and documentation.
