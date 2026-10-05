# A12 — Independent QA evidence

Date: 2026-10-05. Branch: `main`. Local SQLite only. No application code, tests, routes, or frontend pages were edited. No repair was made.

Process environment `DB_CONNECTION`, `DB_DATABASE`, `DB_URL`, `DB_HOST`, `APP_CONFIG_CACHE`, and `COMMUNICATION_PROVIDER` was cleared before each PHPUnit command. `phpunit.xml` forces `DB_CONNECTION=sqlite` and `DB_DATABASE=:memory:`. PostgreSQL was not used. No secrets or driver capability URLs are recorded.

A browser pass and `PdfFinalizationTest` were not part of this command list and were not run. Guarded PostgreSQL was not run. This file does not claim production readiness.

## Commands and counts

### 1. Targeted PHPUnit — PASS

```text
php artisan test --filter=BeneficiaryNationalityAndImportTest|PermissionSeparationTest|PolicySupportInitiationTest|DirectHandoverReplayTest|NotificationPermissionTest|NationalityReportAndPdfTest|DailyBeneficiariesSystemTest|test_assignment_survives_sms_enqueue_failure_and_the_link_still_opens|test_revealing_a_driver_link_does_not_rotate_it
```

Passed 23, failed 0, skipped 0, assertions 592, duration 7814 ms, exit 0.

Every method below was inside that filter. Assertion totals are for the combined command only.

| Class or method | Methods | Result |
| --- | --- | --- |
| `BeneficiaryNationalityAndImportTest` | 6 | passed |
| `DailyBeneficiariesSystemTest` | 7 | passed |
| `PolicySupportInitiationTest` | 3 | passed |
| `PermissionSeparationTest` | 2 | passed |
| `DirectHandoverReplayTest` | 1 | passed |
| `NotificationPermissionTest` | 1 | passed |
| `NationalityReportAndPdfTest` | 1 | passed |
| `test_assignment_survives_sms_enqueue_failure_and_the_link_still_opens` | 1 | passed |
| `test_revealing_a_driver_link_does_not_rotate_it` | 1 | passed |

### 2. Targeted Vitest — PASS

Working directory: `frontend`.

```text
npx vitest run src/test/GovernanceNationalityChart.test.jsx src/test/DailyBeneficiariesList.test.jsx src/test/SidebarRouteRoleFiltering.test.jsx src/test/E2eAuthorizationPages.test.jsx src/test/UnifiedBeneficiaryPage.test.jsx src/test/E2eDashboardNavigation.test.jsx
```

Test files 6 passed. Tests passed 28, failed 0, skipped 0, duration 2.11 s, exit 0.

| File | Passed |
| --- | --- |
| `E2eDashboardNavigation.test.jsx` | 2 |
| `SidebarRouteRoleFiltering.test.jsx` | 6 |
| `GovernanceNationalityChart.test.jsx` | 1 |
| `DailyBeneficiariesList.test.jsx` | 1 |
| `UnifiedBeneficiaryPage.test.jsx` | 4 |
| `E2eAuthorizationPages.test.jsx` | 14 |

`GovernanceNationalityChart.test.jsx` showed mock totals 3, 12, and 18, and kept `غير مسجلة` as its own category.

### 3. Full PHPUnit — FAIL

Run only after steps 1 and 2 passed.

```text
php artisan test
```

Tests 950, passed 941, failed 7, skipped 2, assertions 4752, duration 441623 ms, exit 1. The reporter did not name the two skipped tests.

| Test | Assertion | Owner |
| --- | --- | --- |
| `Tests\Feature\DailyBeneficiaryUpdateAuditTest::test_success_has_exactly_one_correctly_targeted_audit_event` with data set `admin` | Expected 200, received 422. `nationality`: الجنسية مطلوبة. `DailyBeneficiaryUpdateAuditTest.php` line 102. | A6 |
| Same method, data set `assistant_admin` | Same 422 assertion. Line 102. | A6 |
| Same method, data set `reception` | Same 422 assertion. Line 102. | A6 |
| Same method, data set `staff` | Same 422 assertion. Line 102. | A6 |
| `DailyBeneficiaryUpdateAuditTest::test_validation_failure_cannot_mutate_or_create_success_audit` | Expected a validation error for `status`. Response errors are only `nationality`: الجنسية مطلوبة. Line 145. | A6 |
| `DailyBeneficiaryUpdateAuditTest::test_audit_persistence_failure_is_observable_and_business_update_remains_best_effort` | Expected 200, received 422. `nationality`: الجنسية مطلوبة. Line 155. | A6 |
| `Tests\Feature\FullFunctionalQaTest::test_daily_beneficiary_crud_filters_pagination_upload_and_soft_delete` | Expected 200, received 422. `nationality`: الجنسية مطلوبة. Line 25. The PUT body at line 52 omits `nationality`. | A6 |

`DailyBeneficiaryController` is assigned to A6. `DailyBeneficiaryUpdateAuditTest.php` and `FullFunctionalQaTest.php` are not in the phase-2 assignment table. The update payloads omit `nationality`.

### 4. Full Vitest — FAIL

Run after the full PHPUnit command, from `frontend`.

```text
npx vitest run
```

Test files 3 failed, 32 passed (35). Tests 3 failed, 146 passed (149), skipped 0, duration 27.53 s, exit 1.

| Test | Assertion | Owner |
| --- | --- | --- |
| `src/test/FulfillmentSeparation.test.jsx` > loads only delivery and exposes driver operations with no handover confirmation form | Unable to find text `تسجيل سائق` (`FulfillmentSeparation.test.jsx` line 40). The rendered page title was `التوصيل للمنازل`. The page points driver registration to `دليل السائقين` and does not render `تسجيل سائق`. | A9 |
| `src/test/ChangePasswordHttpFlow.test.jsx` > runs the production page and auth client against an isolated local Laravel HTTP endpoint | Unable to find text `تغيير كلمة المرور المؤقتة` (line 48). The document stayed on `loading`. | Unassigned. Return to A0. |
| `src/test/UserEditHttpFlow.test.jsx` > saves the real account edit form to an isolated Laravel database and preserves authorization/security state | Unable to find text `EKRAM-E2E-TEST-STAFF` (line 26). stderr: `AxiosError: read ECONNRESET`. The table stayed on `جاري تحميل قائمة الحسابات...`. The authorization assertions later in the test did not run. | Unassigned. Return to A0. |

## Not run in this command list

| Check | Status |
| --- | --- |
| Browser pass | NOT_RUN |
| `PdfFinalizationTest` | NOT_RUN |
| Guarded PostgreSQL | NOT_RUN |
| Live SMS | DEFERRED |

`NationalityReportAndPdfTest` passing does not stand in for `PdfFinalizationTest`.

## Acceptance matrix

Status is from this run only. `DEFERRED` and `NOT_RUN` are not passes.

| ID | Status | This run |
| --- | --- | --- |
| R-BEN-01 | PASS | Nationality derivation, missing nationality, and confirmation methods are inside the targeted PHPUnit filter (23 passed, 592 assertions). Daily update regressions outside that filter failed in the full suite and are defects for A6. Registration-form Vitest and a browser pass were not in the command list. |
| R-BEN-02 | PASS | `DailyBeneficiariesList.test.jsx` 1 passed. A blank nationality is not shown as `سعودي`. Browser pass NOT_RUN. |
| R-BEN-03 | PASS | `DailyBeneficiariesSystemTest` (7 methods) passed inside the targeted filter. `UnifiedBeneficiaryPage.test.jsx` 4 passed, including combined filters sent to `/beneficiaries/unified`. |
| R-IMP-01 | PASS | Import preview and confirmed-import methods are inside `BeneficiaryNationalityAndImportTest`, which passed in the targeted filter. Frontend import preview Vitest was not in the command list. |
| R-SUP-01 | PASS | `PolicySupportInitiationTest` (3 methods) passed in the targeted filter. List and details labels for إرسال الدعم were not in the Vitest command list. |
| R-DASH-01 | PASS | `E2eDashboardNavigation.test.jsx` 2 passed, including the `التوصيل للمنازل` link. The dashboard mapping table was not walked in a browser. Browser pass NOT_RUN. |
| R-POL-01 | PASS | `PolicySupportInitiationTest` passed in the targeted filter, including simulation that does not write a policy decision. |
| R-AUTH-01 | PASS | `PermissionSeparationTest` (2 methods) passed. Sidebar role test 6 passed. `E2eAuthorizationPages.test.jsx` 14 passed. Readonly without `governance.view` does not see `/governance` in the sidebar test. `UserEditHttpFlow` failed before its authorization assertions; that failure is recorded above and is not treated as a pass. |
| R-ARCH-01 | NOT_RUN | No command in this run inspected the cleanup ledger. |
| R-HO-01 | PASS | `DirectHandoverReplayTest` (1 method) passed in the targeted filter. |
| R-DRV-01 | FAIL | The two named driver methods passed inside the targeted PHPUnit filter. Full Vitest `FulfillmentSeparation.test.jsx` failed: `تسجيل سائق` was not found on the home-delivery page. |
| R-NOT-01 | PASS | `NotificationPermissionTest` (1 method) passed in the targeted filter. Live SMS stays deferred. |
| R-PDF-01 | PASS | `NationalityReportAndPdfTest` (1 method) passed in the targeted filter. `PdfFinalizationTest` was NOT_RUN. A pass of the nationality PDF test does not prove every PDF template. |
| R-RPT-01 | PASS | `NationalityReportAndPdfTest` passed in the targeted filter. `GovernanceNationalityChart.test.jsx` 1 passed. Mock totals 3, 12, and 18 were shown. `غير مسجلة` stayed its own category. |
| E2E-006 | DEFERRED | Live SMS delivery proof was not run. |
| E2E-007 live | DEFERRED | Live driver SMS proof was not run. The local no-SMS methods are under R-DRV-01. |

## Open decisions

Unchanged from the acceptance matrix. «جهات المستفيد» remains UNDEFINED. Elderly threshold remains NONE. This run did not add either rule.

```text
Agent: A12
Scope: Independent QA of the phase-2 command list on branch main. Evidence only. No application repair.
Files inspected: docs/agentic/phase-2-prompts/A12-INDEPENDENT-QA.md, ACCEPTANCE_MATRIX.md, COMMON_RULES.md, FILE_OWNERSHIP.md, A9-DRIVER-DELIVERY.md; phpunit.xml DB defaults; the targeted test classes and the three failing Vitest files; DailyBeneficiaryUpdateAuditTest payload; FullFunctionalQaTest daily update body; HomeDeliveryPage labels.
Files changed: docs/agentic/phase-2-prompts/evidence/A12-QA.md
Contracts used: COMMON_RULES.md, ACCEPTANCE_MATRIX.md, A12-INDEPENDENT-QA.md
Tests and counts: Targeted PHPUnit passed 23, failed 0, skipped 0, assertions 592. Targeted Vitest passed 28, failed 0, skipped 0. Full PHPUnit tests 950, passed 941, failed 7, skipped 2, assertions 4752. Full Vitest files 32 passed / 3 failed (35); tests 146 passed / 3 failed (149); skipped 0.
Findings: Seven full-suite PHPUnit failures reject daily updates that omit nationality (422, الجنسية مطلوبة). Owner A6. FulfillmentSeparation cannot find تسجيل سائق. Owner A9. ChangePasswordHttpFlow stayed on loading. UserEditHttpFlow hit ECONNRESET and never showed EKRAM-E2E-TEST-STAFF. Those two files are unassigned; return them to A0. Browser, PdfFinalizationTest, and PostgreSQL were not run.
Dependencies: None added. Defects return to A6, A9, and A0.
Unresolved decisions: جهات المستفيد UNDEFINED. Elderly threshold NONE. E2E-006 and live E2E-007 remain deferred.
Ready for integration: YES
```

Ready for integration means this evidence file is complete. It does not mean the product is ready.

## A0 follow-up after this report

The seven PHPUnit failures were fixture gaps. A0 added `nationality` to the daily update payloads in `DailyBeneficiaryUpdateAuditTest.php` and `FullFunctionalQaTest.php`. The audit rows were created with `سعودي` / `citizen` so an unchanged nationality does not require a new confirmation. The invalid-status case still asserts `status`. Validation was not weakened.

Re-run of those two classes: 11 passed, 269 assertions, exit 0.

Full PHPUnit re-run: 950 tests, 948 passed, 2 skipped, 4932 assertions, duration 523123 ms, exit 0.

Full Vitest re-run in the same window: 35 files, 148 passed, 1 failed, exit 1. The only failure was `FulfillmentSeparation.test.jsx` looking for `تسجيل سائق` on home delivery. The page links driver registration to `دليل السائقين` at `/admin/drivers`. A0 changed that expectation. Re-run of that file: 4 passed, exit 0. The earlier `ChangePasswordHttpFlow` and `UserEditHttpFlow` failures did not repeat in this re-run.
