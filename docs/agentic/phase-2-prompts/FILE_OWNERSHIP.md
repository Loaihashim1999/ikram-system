# Phase 2 file ownership

A0 assigns writers. A role must not edit a file that is not in its current assignment. Status values: `reserved`, `writing`, `handed-back`, `read-only`.

## Coordination files

| Path | Owner | Status | Note |
| --- | --- | --- | --- |
| `docs/agentic/phase-2-prompts/*` | A0 | writing | Package and status |
| `docs/agentic/phase-2-prompts/evidence/A1-MAP.md` | A1 | handed-back | Accepted 2026-10-05. Delta only. Do not replace `docs/architecture/EKRAM-CURRENT-MAP.md`. |
| `docs/agentic/phase-2-prompts/evidence/A2-CONTRACTS.md` | A2 | handed-back | Accepted 2026-10-05 after A1 reconciliation. |
| `docs/agentic/phase-2-prompts/evidence/CLEANUP-LEDGER.md` | A3 | reserved | Uncertain files stay |
| `docs/agentic/phase-2-prompts/evidence/A12-QA.md` | A12 | reserved | Evidence only |
| `docs/agentic/phase-2-prompts/evidence/A13-REVIEW.md` | A13 | reserved | Findings only |

## Application files

Wave 0 is accepted. Only the rows below may be edited. Shared routes, support services, and frontend pages stay unassigned.

Existing charter ownership in `docs/agentic/EKRAM-FILE-OWNERSHIP.md` remains the baseline. Phase 2 assignments below override it only while status is `writing`.

| Path | Owner | Status | Handoff |
| --- | --- | --- | --- |
| `app/Http/Middleware/ModulePermission.php` | A5 | handed-back | Unchanged. Separation already enforced. |
| `frontend/src/utils/modulePermissions.js` | A5 | handed-back | 2026-10-05. Helpers match API denials. |
| `frontend/src/components/common/PagePermissionGuard.jsx` | A5 | handed-back | 2026-10-05. |
| `tests/Feature/Phase2/PermissionSeparationTest.php` | A5 | handed-back | 2 passed, 18 assertions. |
| `app/Http/Controllers/Beneficiaries/BeneficiaryController.php` | A6 | handed-back | 2026-10-05. Nationality derivation and receipt aggregate. |
| `app/Http/Controllers/SmartImportController.php` | A6 | handed-back | 2026-10-05. Import does not evaluate policy. |
| `app/Services/SmartExcelImportService.php` | A6 | handed-back | Unchanged |
| `app/Models/Beneficiary.php` | A6 | handed-back | 2026-10-05 |
| `app/Models/DailyBeneficiary.php` | A6 | handed-back | 2026-10-05 |
| `database/migrations/2026_10_05_100000_add_nationality_to_daily_beneficiaries.php` | A6 | handed-back | Additive. No backfill to سعودي. |
| `tests/Feature/Phase2/BeneficiaryNationalityAndImportTest.php` | A6 | handed-back | 6 passed, 108 assertions |
| `tests/Feature/Phase2/PermissionSeparationTest.php` | A6 | handed-back | Fixture repair. 27 passed across the six filters, 183 assertions. |
| `tests/Feature/PolicyE4RegistrationTest.php` | A6 | handed-back | Nationality added. Rule unchanged. |
| `tests/Feature/BeneficiaryControllerTest.php` | A6 | handed-back | Nationality added. Rule unchanged. |
| `tests/Feature/SmartExcelImportTest.php` | A6 | handed-back | target=permanent and nationality column. |
| `tests/Feature/BeneficiaryImportConfirmationTest.php` | A6 | handed-back | Confirmation refusal kept. |
| `frontend/src/pages/Dashboard.jsx` | A4 | handed-back | Labels updated. Delivered card unchanged. |
| `frontend/src/pages/beneficiaries/UnifiedBeneficiaryPage.jsx` | A4 | handed-back | Columns, filters, import, support link. |
| `frontend/src/pages/beneficiaries/AddBeneficiaryPage.jsx` | A4 | handed-back | Nationality and confirmation. |
| `frontend/src/pages/beneficiaries/BeneficiaryDetails.jsx` | A4 | handed-back | Support link kept. |
| `frontend/src/pages/beneficiaries/BeneficiaryImportPage.jsx` | A4 | handed-back | Target and confirmation. |
| `frontend/src/pages/beneficiaries/SupportRequestPage.jsx` | A4 | handed-back | Draft submit kept. |
| `frontend/src/pages/daily-beneficiaries/DailyBeneficiariesPage.jsx` | A4 | handed-back | Unchanged. The table is in the list component. |
| `frontend/src/pages/daily-beneficiaries/DailyBeneficiaryForm.jsx` | A4 | handed-back | Nationality and confirmation. |
| `frontend/src/components/common/SmartExcelImport.jsx` | A4 | handed-back | Target and nationality mapping. |
| `app/Http/Controllers/DailyBeneficiaryController.php` | A6 | handed-back | Index filters. `DailyBeneficiariesSystemTest` 7 passed, 65 assertions. |
| `tests/Feature/DailyBeneficiariesSystemTest.php` | A6 | handed-back | 7 passed, 65 assertions. |
| `frontend/src/App.jsx` | A3 | handed-back | `/governance` uses `governance.view`. Import uses `beneficiaries.import`. Vitest 14 passed. |
| `docs/agentic/phase-2-prompts/evidence/CLEANUP-LEDGER.md` | A3 | handed-back | No file removed. |
| `frontend/src/components/layout/Sidebar.jsx` | A3 | handed-back | Governance link uses `governance.view`. |
| `frontend/src/test/SidebarRouteRoleFiltering.test.jsx` | A3 | handed-back | 6 passed. Readonly without `governance.view` does not see `/governance`. |
| `docs/agentic/phase-2-prompts/evidence/A12-QA.md` | A12 | writing | Evidence only. No application repairs. |
| `frontend/src/test/UnifiedBeneficiaryPage.test.jsx` | A4 | handed-back | Included in 9 passed. |
| `frontend/src/test/E2eDashboardNavigation.test.jsx` | A4 | handed-back | Included in 9 passed. |
| `app/Services/BeneficiaryPolicy/PolicyRegistrationEvaluationService.php` | A7 | handed-back | Unchanged |
| `app/Services/BeneficiaryPolicy/BeneficiaryPolicyEvaluationService.php` | A7 | handed-back | Unchanged |
| `app/Services/BeneficiaryPolicy/PolicyFinancialEvaluationService.php` | A7 | handed-back | Unchanged |
| `app/Services/BeneficiaryPolicy/BeneficiaryPolicyEligibilityService.php` | A7 | handed-back | Unchanged |
| `app/Http/Controllers/BeneficiaryPolicy/BeneficiaryPolicyController.php` | A7 | handed-back | Unchanged |
| `tests/Feature/Phase2/PolicySupportInitiationTest.php` | A7 | handed-back | 3 passed, 27 assertions |
| `app/Services/Delivery/ReceiptVerificationService.php` | A8 | handed-back | Unchanged. Replay already idempotent. |
| `tests/Feature/Phase2/DirectHandoverReplayTest.php` | A8 | handed-back | 1 passed, 142 assertions |
| `app/Services/Delivery/DriverAccessService.php` | A9 | handed-back | Unchanged. Inspection only. |
| `app/Models/Driver.php` | A9 | handed-back | Unchanged |
| `app/Models/DriverAssignment.php` | A9 | handed-back | Unchanged |
| `app/Services/NotificationService.php` | A10 | handed-back | List, unread count, and mark-as-read hide restricted targets. |
| `app/Http/Controllers/NotificationController.php` | A10 | handed-back | 2026-10-05 |
| `app/Models/Notification.php` | A10 | handed-back | Unchanged |
| `frontend/src/context/NotificationContext.jsx` | A10 | handed-back | Unchanged. Existing edits left in place. |
| `tests/Feature/Phase2/NotificationPermissionTest.php` | A10 | handed-back | 1 passed, 29 assertions |
| `app/Http/Controllers/PdfExportController.php` | A11 | handed-back | Letterhead on export pages. |
| `app/Services/GovernanceReportService.php` | A11 | handed-back | `nationalityAnalysis`. |
| `app/Http/Controllers/AnalyticsController.php` | A11 | handed-back | Same analysis on analytics. |
| `resources/views/pdf/support_proof.blade.php` | A11 | handed-back | Portrait sample generated. |
| `resources/views/pdf/daily_report.blade.php` | A11 | handed-back | Landscape frame. |
| `resources/views/pdf/weekly_comprehensive_report.blade.php` | A11 | handed-back | Landscape frame. |
| `tests/Feature/Phase2/NationalityReportAndPdfTest.php` | A11 | handed-back | 1 passed, 175 assertions. |
| `docs/agentic/phase-2-prompts/evidence/pdf-samples/` | A11 | handed-back | Synthetic portrait and landscape samples. |
| `frontend/src/pages/governance/GovernancePage.jsx` | A4 | handed-back | Chart reads `nationality_analysis`. |
| `frontend/src/test/GovernanceNationalityChart.test.jsx` | A4 | handed-back | 1 passed. Mock totals 3, 12, 18. |
| `frontend/src/test/DailyBeneficiariesList.test.jsx` | A4 | handed-back | 1 passed. |
| `frontend/src/pages/daily-beneficiaries/DailyBeneficiariesList.jsx` | A4 | handed-back | One registration-date column. Daily list vitest 1 passed. |

## Rules

1. One writer per file.
2. Concurrent reads are allowed.
3. Shared files (`routes/api.php`, layout, sidebar, dashboard, shared support services) change only through A0, A3, or A4 after a recorded handoff.
4. A4 is the only frontend page writer once assigned. Domain roles supply contracts.
5. A12 and A13 do not edit application code.
6. Hand back a file by changing its status to `handed-back` and naming the next owner before that owner writes.
