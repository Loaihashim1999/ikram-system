# A13 independent review

Date: 2026-10-05. Branch: `main`. Repository: `C:\laragon\www\ikram-system`.

This review tries to disprove local readiness. It does not repair code. No PHPUnit or Vitest command was started. Aggregate counts from A12 and from A0 are not treated as passes.

## Findings

### 1. High — Unified daily rows ignore soft delete

Owner: A6.

`daily_beneficiaries` has `softDeletes()`, and `DailyBeneficiary` uses `SoftDeletes`. `DailyBeneficiaryController::index` therefore hides deleted rows. `DailyBeneficiaryController::destroy` soft-deletes.

`BeneficiaryController::unifiedQuery` reads daily rows with `DB::table('daily_beneficiaries')` and never applies `deleted_at is null`. `unifiedIndex` and `unifiedExport` both use that query. A deleted daily beneficiary stays on the unified list and in the export, and the grouped receipt aggregate still attaches that row. `GovernanceReportService::daily` uses the Eloquent model, so the nationality populations omit the same person. The list and the report no longer describe one population.

Phase-2 tests do not cover a soft-deleted daily id, so a green `DailyBeneficiariesSystemTest` does not disprove this.

Files: `app/Http/Controllers/Beneficiaries/BeneficiaryController.php` (`unifiedQuery`), `app/Models/DailyBeneficiary.php`, `app/Http/Controllers/DailyBeneficiaryController.php` (`destroy`), `database/migrations/2026_09_09_000001_create_daily_beneficiaries_system_tables.php`.

### 2. High — Daily import does not skip a soft-deleted national id

Owner: A6.

A2 section 3: an existing `national_id` is skipped and is not updated. `SmartImportController::importBeneficiary` uses `DailyBeneficiary::where('national_id', ...)->exists()`, which hides soft-deleted rows. The column is unique for every row, including deleted ones. The insert then hits that unique index. `store` runs the whole file in one transaction and does not catch the query exception, so the confirmed import returns an error and rolls back rows that had already been accepted. It does not return `skipped` for that national id.

Files: `app/Http/Controllers/SmartImportController.php` (`importBeneficiary`, `store`), `database/migrations/2026_09_09_000001_create_daily_beneficiaries_system_tables.php`.

### 3. High — Support notifications remain visible after the notifications grant is removed

Owner: A10.

`NotificationService::notifyAll` stores a support notification only when `permissions.support.notifications` is true. `recipientMaySeeTarget` then allows every non-admin to read a `support_*` row when `permissions.support.view` is true. It does not consult `support.notifications`.

`NotificationController` uses that check for the list, the unread count, and mark-as-read. After `support.notifications` is turned off, a user who still has `support.view` still receives the stored body, related record id, and action URL. Support messages include the distribution id, and the stored action URL points at the delivery or handover task.

`NotificationPermissionTest` only removes `beneficiaries.view` on a `beneficiary_changed` row. That path does require both `view` and `notifications`. A pass of that test does not cover this support branch.

Other modules on read require the role, `view`, and `notifications`. Support is the exception.

Files: `app/Services/NotificationService.php` (`notifyAll`, `recipientMaySeeTarget`), `app/Http/Controllers/NotificationController.php`, `tests/Feature/Phase2/NotificationPermissionTest.php`.

### 4. Medium — Governance PDF still publishes a second nationality table

Owner: A11.

`nationalityAnalysis` is the contract population: registered by `created_at`, active as an undated snapshot, served by one completed receipt, missing nationality labeled `غير مسجلة`. The PDF section تحليل الجنسية reads that payload, and the on-screen chart reads `nationality_analysis.chart` and `populations`.

The same PDF still prints `breakdowns.nationality` under the heading الجنسية — لقطة حالية. Those rows are the period-filtered permanent query (`whereBetween('created_at')`), and a null nationality is labeled `غير مسجل`. A blank string is not trimmed into that label. That table does not reconcile with registered, active, or served.

Files: `app/Services/GovernanceReportService.php` (`build` breakdown group), `resources/views/pdf/weekly_comprehensive_report.blade.php`.

### 5. Medium — A notification with an empty event type skips the permission check

Owner: A10.

`recipientMaySeeTarget` returns true when `event_type` is empty, for any non-admin owner. The row can still contain `message_body`, `action_url`, and `related_record_id`. New `notifyAll` writes set `event_type`. The exemption still applies to an already stored row. R-NOT-01 does not exempt historical rows that lack an event type. This was not executed against stored data.

Files: `app/Services/NotificationService.php` (`recipientMaySeeTarget`, `targetModule`).

## Checks that did not disprove the claim

- Nationality: `Beneficiary::classificationFromNationality` trims, rejects empty with `الجنسية مطلوبة.`, maps exact `سعودي` to `citizen`, maps every other non-empty value to `resident`, and rejects a disagreeing `beneficiary_type` or `type`. The daily migration adds nullable columns and does not backfill `سعودي`.
- Registration update does not call `PolicyRegistrationEvaluationService`. `BeneficiaryChanged` only notifies. `classifyPriority` remains uncalled. No recipient type was added for جهات المستفيد.
- `importExcel` refuses and points at smart import. Smart import requires `target` and `reviewed_confirmation`, does not call policy evaluation, and passes the derived type into `FinancialCalculationService::calculate` before insert. The calculator’s missing-type default was not edited.
- Permanent receipt counts group `support_receipts` once per distribution. The receipt link is unique. Latest summaries are loaded with `whereIn` for the page, not once per row. Daily address and `family_status` are selected as null.
- Dashboard card تم التوصيل والإنهاء still counts legacy `Distribution` status `delivered`.
- `DriverAccessService::reveal` audits a view and does not rotate or queue a notice. `resend` is the rotation path. The capability attribute is hidden and cast as encrypted. No capability URL is recorded here.
- `createMpdf` sets the letterhead header and footer for odd and even pages. Governance and daily report exports call it with landscape. `PdfFinalizationTest` was not run, so this is a code reading, not a test pass.
- `ModulePermission` requires `governance.view` for analytics, separate export grants for the comprehensive Excel and PDF routes, and `beneficiaries.import` for smart import of beneficiaries. Unified tabs require the matching module view, and export also requires export.
- Cleanup ledger removals are none. The eight uncertain pages it names are still unmounted from `App.jsx`. They were not deleted by this review.

## Not scored as a phase-2 defect

Working tree versus `HEAD` has three unstaged deletions: `frontend/src/components/common/QrWhatsAppCard.jsx`, `frontend/src/pages/auth/ResetPasswordPage.jsx`, and `tests/Feature/AdminPasswordRecoveryTest.php`. Nothing under `frontend/src` imports those symbols. `/forgot-password` remains mounted. The cleanup ledger does not name these paths. They were not restored.

A12’s `FulfillmentSeparation` failure does not match the current test: the delivery example expects the دليل السائقين link and expects تسجيل سائق to be absent. That test was not re-run. The loading and connection failures in `ChangePasswordHttpFlow` and `UserEditHttpFlow` were not re-run and are not treated as product passes.

```text
Agent: A13
Scope: Independent review of phase-2 local readiness on branch main. Evidence only. No application repair.
Files inspected: docs/agentic/phase-2-prompts/COMMON_RULES.md, ACCEPTANCE_MATRIX.md, FILE_OWNERSHIP.md, A13-INDEPENDENT-REVIEW.md; evidence/A2-CONTRACTS.md, CLEANUP-LEDGER.md, A12-QA.md; BeneficiaryController, Beneficiary, DailyBeneficiary, DailyBeneficiaryController, SmartImportController, NotificationService, NotificationController, ModulePermission, GovernanceReportService, weekly_comprehensive_report.blade.php, PdfExportController, DriverAccessService, DriverAssignment, FinancialCalculationService::calculate, Dashboard.jsx, UnifiedBeneficiaryPage.jsx, GovernancePage.jsx, App.jsx, FulfillmentSeparation.test.jsx, NotificationPermissionTest, daily beneficiaries migration.
Files changed: docs/agentic/phase-2-prompts/evidence/A13-REVIEW.md
Contracts used: COMMON_RULES.md, A2-CONTRACTS.md sections 1–8, ACCEPTANCE_MATRIX.md, FILE_OWNERSHIP.md, CLEANUP-LEDGER.md
Tests and counts: A13 ran none. A0’s reported nationality re-run (11 tests, 269 assertions) was not repeated and is not a readiness proof. A12 targeted PHPUnit 23 passed / 592 assertions and the full-suite failures are historical evidence only.
Findings: High A6, unified daily query includes soft-deleted rows. High A6, daily import does not skip a soft-deleted national id and fails the batch. High A10, support notifications stay readable after support.notifications is removed. Medium A11, PDF nationality breakdown is a second mislabeled population. Medium A10, empty event_type skips the read check.
Dependencies: A6 and A10 must close the high findings before local integration. A11 owns the medium PDF table.
Unresolved decisions: جهات المستفيد UNDEFINED. Elderly threshold NONE. E2E-006 and live E2E-007 deferred. PdfFinalizationTest and the browser pass were not run.
Ready for integration: NO
```

## A0 follow-up

The five findings were fixed without weakening nationality validation.

- Unified daily rows now require `deleted_at` to be null.
- Daily import treats a soft-deleted national id as skipped, including when the same file also creates a new row.
- A support notification stays hidden after `support.notifications` is removed, even if `support.view` remains.
- A stored notification with an empty event type is hidden from non-admins.
- The governance PDF no longer prints `الجنسية — لقطة حالية`. تحليل الجنسية remains the nationality table.

`php artisan test --filter=BeneficiaryNationalityAndImportTest|NotificationPermissionTest|NationalityReportAndPdfTest`: 11 passed, 349 assertions, exit 0.
