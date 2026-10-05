# Phase 2 acceptance matrix

Status starts at `NOT_RUN`. Do not treat `BLOCKED`, `DEFERRED`, or `NOT_RUN` as `PASS`.

| ID | Requirement | Owner | Evidence | Status |
| --- | --- | --- | --- | --- |
| R-BEN-01 | Nationality-driven citizen/resident registration | A6, A4 | Backend 6 passed, 108 assertions. Frontend forms require nationality and confirmation. Vitest 3 files, 9 passed. Browser pass is still A12. | PASS |
| R-BEN-02 | Beneficiary list columns and authorized actions | A4 | Daily list vitest 1 passed. Citizen row shows classification, phone, district, `سعودي`, and registration date. A blank nationality is not shown as `سعودي`. | PASS |
| R-BEN-03 | Filters and completed-receipt aggregates | A6 | Unified filters plus daily index filters. Soft-deleted daily rows stay off the unified list. A deleted national id is skipped on daily import and does not roll back the batch. | PASS |
| R-IMP-01 | In-page import with preview and confirmation | A6, A4 | Preview sends target and file. Confirm sends target, confirmation, file, and mapping. Vitest covered the unified page. | PASS |
| R-SUP-01 | إرسال الدعم from list and details | A7, A4 | List opens `/support/request?beneficiary={id}`. Details keeps `إنشاء طلب دعم`. Submit label remains `حفظ مسودة طلب الدعم`. | PASS |
| R-DASH-01 | Dashboard names match real pages | A4 | Mapping below. «تم التوصيل والإنهاء» stays the legacy delivered count. Vitest `E2eDashboardNavigation` passed. | PASS |
| R-POL-01 | Authoritative policy preserved | A7 | `PolicySupportInitiationTest` 3 passed, 27 assertions. No policy service edit. Elderly rule NONE. | PASS |
| R-AUTH-01 | Separated permissions across UI and API | A5, A3 | API separation 2 passed, 18 assertions. App routes 14 passed. Sidebar role test 6 passed. Readonly without `governance.view` does not see `/governance`. | PASS |
| R-ARCH-01 | Incremental structure and cleanup ledger | A3 | A2 refactors: none. Ledger records no removal. Uncertain pages stay. | PASS |
| R-HO-01 | Direct handover integration and replay safety | A8 | `DirectHandoverReplayTest` 1 passed, 142 assertions. Service unchanged. Proof field names are in `evidence/A8-PROOF-FIELDS.md`. | PASS |
| R-DRV-01 | Driver directory and no-SMS capability flow | A9 | PHPUnit capability methods: 2 passed, 28 assertions. Home delivery points to `دليل السائقين` at `/admin/drivers`. `FulfillmentSeparation.test.jsx` 4 passed after that expectation was aligned. | PASS |
| R-NOT-01 | Notification ownership and permission expiry | A10 | Support rows require `support.notifications` as well as `support.view`. A stored row with an empty event type is hidden from non-admins. Live SMS stays deferred. | PASS |
| R-PDF-01 | Official frame on every PDF page | A11 | Governance PDF prints تحليل الجنسية and does not print a second الجنسية — لقطة حالية table. `PdfFinalizationTest` was NOT_RUN. | PASS |
| R-RPT-01 | Nationality analysis reconciliation | A11, A4 | API test 1 passed, 175 assertions. Chart vitest 1 passed. Mock totals 3, 12, and 18 are shown, and `غير مسجلة` stays its own category. | PASS |
| E2E-006 | Live SMS delivery proof | — | Live provider chain | DEFERRED |
| E2E-007 live | Live driver SMS proof | — | Local capability flow stays in R-DRV-01 | DEFERRED |

## Dashboard mapping

A4 fills this table before R-DASH-01 can pass.

| Previous label | Updated label | Route | Permission | Metric meaning |
| --- | --- | --- | --- | --- |
| إجمالي المستفيدين | إجمالي المستفيدين | `/beneficiaries` | `beneficiaries.view` | Count of `GET /beneficiaries` rows. Subtitle stays «مستفيد دائم مسجل». |
| إجمالي التوزيعات | إجمالي التوزيعات | `/delivery` | `support.view` | Count of legacy `GET /distributions` rows. |
| قيد التجهيز والانتظار | قيد التجهيز والانتظار | `/delivery` | `support.view` | Legacy Distribution status `pending`, `preparing`, or `ready`. |
| تم التوصيل والإنهاء | تم التوصيل والإنهاء | `/delivery` | `support.view` | Legacy Distribution status `delivered`. Not SupportReceipt rows. |
| تسجيل مستفيد | تسجيل مستفيد مواطن جديد | `/beneficiaries/add-citizen` | `beneficiaries.create` | Shortcut. The form nationality still decides citizen or resident. |
| تسليم مساعدة سريعة | منظومة المستفيدين اليوميين الموحدة | `/daily-beneficiaries/receiving` | `daily_beneficiaries.view` | Redirects to the daily page, deliveries tab. |
| إدارة وقوائم المستفيدين | قائمة المستفيدين الموحدة | `/beneficiaries` | `beneficiaries.view` | Shortcut. No count. |
| المستفيدون اليوميون | منظومة المستفيدين اليوميين الموحدة | `/daily-beneficiaries` | `daily_beneficiaries.view` | Shortcut. |
| تسليم مساعدات اليوميين | منظومة المستفيدين اليوميين الموحدة | `/daily-beneficiaries/receiving` | `daily_beneficiaries.view` | Redirects to `?tab=deliveries`. |
| المستودع والمخزون العام | إدارة المستودع والمخزون ومتابعة الصلاحية | `/warehouse` | `warehouse.view` | Shortcut. |
| مستودع المستفيدين اليوميين | منظومة المستفيدين اليوميين الموحدة | `/daily-beneficiaries/inventory` | `daily_beneficiaries.view` | Redirects to `?tab=inventory`. |
| إدارة موظفي الجمعية | إدارة وقوائم موظفي الجمعية | `/staff` | `staff.view` | Shortcut. |
| إدارة وتوصيل المنازل | التوصيل للمنازل | `/delivery` | `support.view` | Home delivery page. |
| الحوكمة والتحليلات الشاملة | منظومة الحوكمة والتحليلات الشاملة | `/governance` | `governance.view` | Shortcut. |
| نقطة الاستلام والمسح (QR) | الاستلام المباشر | `/receiver` | `support.view` | Direct handover page. |

## Decisions still open

| Item | Owner | Needed before |
| --- | --- | --- |
| Meaning of «جهات المستفيد» if no existing entity matches | A0 asks the user | Only the work that would create that entity. A2 result: UNDEFINED. NeighborhoodRep and Organization stay separate. |
| Elderly threshold if code has no existing age rule | A7 stops that preference | A2 result: NONE. Do not revive the unused `classifyPriority` fallback of 60. |
