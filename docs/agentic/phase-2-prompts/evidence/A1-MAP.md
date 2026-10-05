# A1 repository map — phase 2

Evidence from source on `main` at `C:\laragon\www\ikram-system`. Read-only. Does not replace `docs/architecture/EKRAM-CURRENT-MAP.md`.

Authenticated API group: `routes/api.php` `Route::middleware(['auth:sanctum', ModulePermission::class])`. Admin bypasses module checks in `ModulePermission::handle`. Driver roles are limited to `api/me` and `api/logout` there; delivery uses `/api/driver-access`.

## 1. Pages, headings, sidebar

Sidebar labels are in `frontend/src/components/layout/Sidebar.jsx`. Headings below are the rendered `PageHeader` / `h1`, not the sidebar text.

| Route (`App.jsx` unless noted) | Sidebar label | Page heading | Page symbol |
| --- | --- | --- | --- |
| `/dashboard` | لوحة التحكم | `مرحباً بك، {name}` (`Dashboard`) | `frontend/src/pages/Dashboard.jsx` |
| `/beneficiaries` | إدارة وقوائم المستفيدين | قائمة المستفيدين الموحدة | `UnifiedBeneficiaryPage` |
| `/daily-beneficiaries` | المستفيدون اليوميون | منظومة المستفيدين اليوميين الموحدة | `DailyBeneficiariesPage` |
| `/beneficiaries/add-citizen` | none | تسجيل مستفيد مواطن جديد | `AddBeneficiaryPage` (`type` from path) |
| `/beneficiaries/add-resident` | none | تسجيل مستفيد مقيم جديد | same page |
| `/daily-beneficiaries/add` | none | إضافة مستفيد يومي جديد | `DailyBeneficiaryForm` |
| `/beneficiaries/import` | none | الاستيراد الذكي للمستفيدين (`h1`) | `BeneficiaryImportPage` |
| `/support/request`, `/beneficiaries/:id/support` | none | طلب دعم للمستفيد | `SupportRequestPage` |
| `/send-support` | none | redirect to `/support/request` | no page |
| `/receiver` | الاستلام المباشر | الاستلام المباشر | `DirectHandoverPage` |
| `/support-delivery` | not in sidebar | same heading | `SupportDeliveryPage` re-exports `DirectHandoverPage` |
| `/delivery` | إدارة وتوصيل المنازل | التوصيل للمنازل | `HomeDeliveryPage` |
| `/admin/drivers` | دليل السائقين | دليل السائقين | `DriversDirectoryPage` |
| `/driver-access` | none | مهام التوصيل / اكتمل التكليف | mounted in `frontend/src/main.jsx`, not `App.jsx` |
| `/governance`, `/statistics` | الحوكمة والمؤشرات | منظومة الحوكمة والتحليلات الشاملة | `GovernancePage` |
| no route | none | مركز الإشعارات والتنبيهات | `NotificationCenter` opened from `TopBar.jsx` |
| `/admin/users` | إدارة الحسابات والصلاحيات | إدارة الحسابات ومصفوفة الصلاحيات | `UsersPage` → `pages/admin/Users.jsx` |
| `/admin/settings` | إعدادات النظام المالية | إعدادات النظام وضوابط التصنيف المالي والمستودع | `SystemSettingsPage` |

`/driver/deliveries` redirects to `/driver-access`. `/distributions` redirects to `/delivery`. `/daily-beneficiaries/receiving` and `/inventory` redirect to tabs on the daily page.

Unmounted legacy pages (no `App.jsx` import): `BeneficiaryList`, `SendSupportPage`, `DeliveryPage`, `DistributionPage`, `DriverDashboard`, `ReceiverPage`.

## 2. Page → API → permission → service

| UI | API | Controller method | `ModulePermission` | Service |
| --- | --- | --- | --- | --- |
| Dashboard cards | `GET /beneficiaries`, `GET /distributions` | `BeneficiaryController::index`, `DistributionController::index` | `beneficiaries.view`; `delivery.view` | none; client counts the JSON |
| Unified list | `GET /beneficiaries/unified`, `GET /beneficiaries/unified/export` | `unifiedIndex`, `unifiedExport` | tab modules `beneficiaries` and/or `daily_beneficiaries`, action `view` or `export` | query in the controller |
| Permanent create | `POST /beneficiaries` | `store` | `beneficiaries.create` | `FinancialCalculationService::calculate`, `PolicyRegistrationEvaluationService::evaluateNewBeneficiary` |
| Daily list / create | `GET|POST /daily-beneficiaries` | `DailyBeneficiaryController::index`, `store` | `daily_beneficiaries.view` / `create` | controller writes `DailyBeneficiary` directly |
| Smart import | `POST /smart-import/beneficiaries/preview`, `POST /smart-import/beneficiaries` | `SmartImportController::preview`, `store` | `beneficiaries.import` | `SmartExcelImportService` |
| Legacy import (list page only) | `POST /beneficiaries/import` | `BeneficiaryController::importExcel` | `beneficiaries.import` | inline PhpSpreadsheet plus the two services above |
| Support draft | `POST /support/distributions` | `SupportDistributionController::store` | `support.create` | `SupportDistributionService::create` |
| Direct handover | `POST /support/distributions/{id}/verify-preview`, `POST .../verify` | `DeliveryCommunicationController::previewReceipt`, `verify` | `support.fulfill`; readonly and driver roles denied | `ReceiptVerificationService` |
| Home delivery | `GET|POST /support/drivers`, `GET|POST /support/assignments`, `POST /support/assignments/reassign`, `GET .../link`, `POST .../resend`, `POST .../revoke` | `drivers`, `assignments`, `reassign`, `link`, `resend`, `revoke` | GET `support.view`; POST `support.create`; PATCH `support.edit`. `drivers()` also `abort_unless` admin | `DriverAccessService` for assignments; `drivers()` writes `Driver` in the controller |
| Driver portal | `GET /api/driver-access`, `GET /api/driver-access/tasks/{id}`, `POST .../confirm` | `DeliveryCommunicationController::driver` | outside Sanctum; throttle only | `DriverAccessService` |
| Governance | `GET /governance/analytics` via `getAnalytics` | `GovernanceReportController::index` | `governance.view` | `GovernanceReportService::build` → `AnalyticsController::index` |
| Governance files | `GET /reports/comprehensive/pdf`, `GET /reports/comprehensive/excel` | `exportWeeklyComprehensiveReport`, `exportComprehensiveExcel` | `governance.export_pdf` / `export_excel` | same `build` |
| Notifications | `GET /notifications`, `GET /notifications/unread-count`, `POST /notifications/{id}/mark-as-read`, `POST /notifications/mark-all-read` | `NotificationController` | any active user; recipient filter in `records()` | reads `Notification`; does not call `NotificationService` |
| Users | `GET|POST /users`, `PUT /users/{id}`, `DELETE /users/{id}` | `UserController` resource | non-admin `abort(403)` on segment `users` | controller + `User` |
| Settings | `GET|POST /settings` | `SettingsController::index`, `update` | `settings.view` / `settings.edit`; route is admin-only in `App.jsx` | controller |

`GET /drivers` is `UserController::drivers` (`User` roles `driver` / `delivery_driver`). The mounted directory and home-delivery pages call `/support/drivers` (`Driver` records). `DeliveryPage` and `DriverDashboard` still call `/drivers`; they are unmounted.

## 3. Nationality, classification, confirmation

Permanent UI (`AddBeneficiaryPage`): path chooses `beneficiary_type`. Citizen form sets `nationality` to `سعودي` and hides the field. Resident form requires a free-text الجنسية. Step 5 is مراجعة وتأكيد; submit sends `reviewed_confirmation=1`. Also requires `family_status`.

Permanent API (`BeneficiaryController::rules`): `beneficiary_type` required `citizen|resident`. `nationality` is `required_if:beneficiary_type,resident` only. The backend does not derive citizen from سعودي and does not reject a missing nationality on citizens. `store` requires `reviewed_confirmation` accepted and sets `confirmed_at` / `confirmed_by`.

Daily UI (`DailyBeneficiaryForm`) and `DailyBeneficiaryController::store`: `national_id` regex `/^[12]\d{9}$/` with messages that 1 means national ID and 2 means residency. No `nationality`, no `beneficiary_type`, no `reviewed_confirmation`.

Smart import (`SmartImportController::importRow`): unmapped type becomes `citizen` via `enum(..., 'citizen')`. `nationality` is a mappable field in `fields()` and is not used to derive type. Store requires `reviewed_confirmation` for entity `beneficiaries` and sets `confirmed_at`. `SmartExcelImport.jsx` appends that flag automatically.

Legacy `importExcel`: non-`resident`/`مقيم` values become `citizen`. Missing nationality is stored null. Also requires `reviewed_confirmation` and sets `confirmed_at`.

## 4. Import entry points

Mounted: `/beneficiaries/import` → `BeneficiaryImportPage` → `SmartExcelImport` entity `beneficiaries` → `SmartImportController` + `SmartExcelImportService`.

Still routed, not mounted from `App.jsx`: `POST /beneficiaries/import` → `BeneficiaryController::importExcel`, called by `beneficiaryApi.importExcel` from unmounted `BeneficiaryList`.

Both paths call `FinancialCalculationService::calculate` and `PolicyRegistrationEvaluationService::evaluateNewBeneficiary`. There is no separate importer class; the reader is `SmartExcelImportService`, and row creation is inside the two controllers.

## 5. Support, handover, delivery

Mounted support start: `BeneficiaryDetails` link إنشاء طلب دعم → `/beneficiaries/:id/support`. `/support/request` searches `GET /beneficiaries` then `POST /support/distributions` with `fulfillment_method` `pickup` or `delivery`. Submit label is حفظ مسودة طلب الدعم. Success navigates to `/receiver?task=` or `/delivery?task=`. This creates a draft; it does not verify a receipt.

The phrase إرسال الدعم is on unmounted `BeneficiaryList` (confirm button تأكيد وإرسال الدعم وتسجيل المرجع التاريخي → `distributionApi.create` → `POST /distributions` → `DistributionController::store`), plus unmounted `SendSupportPage`, `DistributionPage`, and staff/rep dispatch. Those are legacy.

Direct handover (`/receiver`): code form posts `verify-preview` then `verify`. Copy says أدخل رمز الاستلام and تأكيد الاستلام. `/support-delivery` renders the same component.

Home delivery (`/delivery`): driver pick from `/support/drivers`, assign/reassign/link/resend/revoke on `/support/assignments`. Heading التوصيل للمنازل. Sidebar still says إدارة وتوصيل المنازل.

Driver completion is a third caller of the same verify service: `DriverAccessPage` `POST /api/driver-access/tasks/{id}/confirm`.

## 6. PDFs and report data

`PdfExportController`:

| Method | View | Data |
| --- | --- | --- |
| `exportSupportProof` | `pdf.support_proof` | `SupportReceipt`; `proof_snapshot` when present, otherwise current support fields. Header `X-Proof-Source` |
| `exportBeneficiaryCard` | `pdf.beneficiary_card` | `Beneficiary`, latest completed `BeneficiaryPolicyEvaluation`, latest `PolicyDecision` |
| `exportIndividualReceipt` | `pdf.individual_receipt` | legacy `Distribution` + `Basket` |
| `exportTotalDelivery` | `pdf.total_delivery` | legacy `Distribution` history |
| `exportRepresentativeReceipt` | `pdf.representative_receipt` | `NeighborhoodRep` and beneficiaries matched by district/city |
| `exportStaffReceipt` | `pdf.staff_receipt` | `Staff` and `staff->distributions` |
| `exportDailyReceivingVoucher` | `pdf.daily_receiving_voucher` | `DailyReceivingTransaction` |
| `exportDailyReport` | `pdf.daily_report` | that day's daily transactions, `DailyInventoryMovement`, and `Distribution` count |
| `exportWeeklyComprehensiveReport` / `exportComprehensiveExcel` | `pdf.weekly_comprehensive_report` | `GovernanceReportService::build` |

`GovernanceReportService::build` calls `AnalyticsController::index`, then adds period counts from `Beneficiary`, `DailyBeneficiary`, `BeneficiaryPolicyEvaluation`, `PolicyDecision`, and `SupportDistribution` (`support_completed` = status `completed`). Nationality breakdown groups permanent beneficiaries created in the period on column `nationality`, bucket `غير مسجل`. The pie titled صفة الإقامة — لقطة حالية is `beneficiary_type` citizen vs resident, not the nationality column. Chart series `receipts` counts legacy `Distribution` status `delivered`. `AnalyticsController` `beneficiaries.received_count` is distinct `Distribution.beneficiary_id` with status `delivered|received|completed`. Daily `received_count` is distinct `DailyReceivingTransaction.daily_beneficiary_id`. `grand_total_served` adds those two. It does not count `SupportReceipt`.

## 7. Completed receipts

Authoritative write: `ReceiptVerificationService` creates `SupportReceipt` and sets `SupportDistribution.status` to `completed` (replay returns `already_completed`).

Counts today:

- `SupportDistributionController::index` metrics: `completed` is rows with status `completed`; `delivered_beneficiaries` is distinct `beneficiary_id` on those rows. Each row gets `receipt` and `proof_available`.
- `GovernanceReportService` KPI `support_completed`.
- `DeliveryCommunicationController::drivers` metric `delivered` is support status `completed` per driver.
- Dashboard and governance “served” cards use legacy `Distribution` or daily receiving, not `SupportReceipt`.

List receipt summaries: `GET /support/distributions` returns them. `BeneficiaryController::unifiedQuery` selects identity and registration columns only. `BeneficiaryController::index` eager-loads legacy `distributions()`, not `SupportReceipt`. `DailyBeneficiaryController::index` loads `category` only. Unified columns are السجل، المستفيد، النوع، المدينة، الحي، الحالة، تاريخ التسجيل. No phone, family status, nationality, or receipt count on that table.

## 8. Dashboard metrics and Arabic cards

`Dashboard` loads `GET /beneficiaries` and `GET /distributions`, then counts the returned arrays in the browser. It does not call `/governance/analytics`.

| Card title | Subtitle | Source |
| --- | --- | --- |
| إجمالي المستفيدين | مستفيد دائم مسجل | length of `/beneficiaries` payload; opens `/beneficiaries` |
| إجمالي التوزيعات | سلة ومساعدة ممنوحة | length of `/distributions` |
| قيد التجهيز والانتظار | بانتظار الصرف أو التوصيل | legacy status `pending`, `preparing`, or `ready` |
| تم التوصيل والإنهاء | استلام مكتمل ميدانياً | legacy status `delivered` |

The last three open `/delivery` only when `canViewSupport`. Shortcut cards use sidebar-like names, including نقطة الاستلام والمسح (QR) → `/receiver` and تسليم مساعدات اليوميين → `/daily-beneficiaries/receiving`.

## 9. Services to reuse, and real duplication

Reuse, do not replace:

- `FinancialCalculationService::calculate` (registration and both imports) and `::calculatePolicyFinancials` (policy). `PolicyFinancialEvaluationService` calls the second method.
- Policy: `PolicyRegistrationEvaluationService::evaluateNewBeneficiary` on create/import. Versioned review/simulation stays under `app/Services/BeneficiaryPolicy/` (`BeneficiaryPolicyEvaluationService`, `PolicyApplicationSimulationService`, `PolicyApplicationExecutionService`). Simulation routes are separate from `evaluate`.
- `NotificationService::notifyAll` (support transitions, driver assign, receipt verify, inventory alerts). `NotificationController` is the reader.
- `DriverAccessService` for assignment, link, revoke, and the public driver portal.
- `ReceiptVerificationService` for pickup verify and driver confirm.
- Inventory: `SupportDistributionService::transition` locks `InventoryItem`. Daily stock is `DailyInventoryController` / `DailyReceivingController` on `DailyInventoryItem`. Keep them separate.

Real duplication found:

- Two beneficiary importers: `SmartImportController::importRow` and `BeneficiaryController::importExcel`. Both default a missing type to citizen and both run policy evaluation.
- Two “served/completed” counters: `SupportDistribution`/`SupportReceipt` versus legacy `Distribution` status `delivered|received|completed` (dashboard, `AnalyticsController`, several PDF methods).
- Two driver lists: `Driver` via `/support/drivers` versus `User` via `UserController::drivers`. Mounted UI uses `Driver`.
- Legacy stock guard in `DistributionController::store` also locks `InventoryItem`, parallel to `SupportDistributionService`.

`SupportDeliveryPage` is not a third fulfillment service; it re-exports the handover page.

## 10. Recommended ownership (paths only)

Shared files stay with A3 until A0 names a single writer. Frontend pages stay with A4.

**A5**

- `app/Http/Middleware/ModulePermission.php`
- `frontend/src/utils/modulePermissions.js`
- `frontend/src/components/common/PagePermissionGuard.jsx`

**A6**

- `app/Http/Controllers/DailyBeneficiaryController.php`
- `app/Http/Controllers/SmartImportController.php`
- `app/Services/SmartExcelImportService.php`
- `app/Models/Beneficiary.php`
- `app/Models/DailyBeneficiary.php`
- `frontend/src/components/common/SmartExcelImport.jsx` is presentation; prefer A4 if the form changes

`app/Http/Controllers/Beneficiaries/BeneficiaryController.php` is shared by A6 (rules, unified query, `importExcel`) and A7 (registration calls policy). Assign it through A3.

**A7**

- `app/Services/BeneficiaryPolicy/PolicyRegistrationEvaluationService.php`
- `app/Services/BeneficiaryPolicy/BeneficiaryPolicyEvaluationService.php`
- `app/Services/BeneficiaryPolicy/PolicyFinancialEvaluationService.php`
- `app/Services/BeneficiaryPolicy/BeneficiaryPolicyEligibilityService.php`
- `app/Http/Controllers/BeneficiaryPolicy/BeneficiaryPolicyController.php`

`app/Services/SupportDistributionService.php` and `app/Http/Controllers/SupportDistributionController.php` are shared with A8 (reserve, complete, inventory, list metrics). Assign them through A3.

**A8**

- `app/Services/Delivery/ReceiptVerificationService.php`

**A9**

- `app/Services/Delivery/DriverAccessService.php`
- `app/Models/Driver.php`
- `app/Models/DriverAssignment.php`

`app/Http/Controllers/DeliveryCommunicationController.php` serves handover verify, driver directory, assignments, and the public portal. Assign it through A3.

**A10**

- `app/Services/NotificationService.php`
- `app/Http/Controllers/NotificationController.php`
- `app/Models/Notification.php`
- `frontend/src/context/NotificationContext.jsx`

**A11**

- `app/Http/Controllers/PdfExportController.php`
- `app/Services/GovernanceReportService.php`
- `app/Http/Controllers/AnalyticsController.php`
- `resources/views/pdf/support_proof.blade.php`
- `resources/views/pdf/beneficiary_card.blade.php`
- `resources/views/pdf/individual_receipt.blade.php`
- `resources/views/pdf/total_delivery.blade.php`
- `resources/views/pdf/representative_receipt.blade.php`
- `resources/views/pdf/staff_receipt.blade.php`
- `resources/views/pdf/daily_receiving_voucher.blade.php`
- `resources/views/pdf/daily_report.blade.php`
- `resources/views/pdf/weekly_comprehensive_report.blade.php`
- `resources/views/pdf/letterhead_template.blade.php`
- `resources/views/pdf/report_bar_chart.blade.php`

**A4**

- `frontend/src/pages/Dashboard.jsx`
- `frontend/src/components/layout/Sidebar.jsx`
- `frontend/src/components/layout/TopBar.jsx`
- `frontend/src/components/layout/NotificationCenter.jsx`
- `frontend/src/pages/beneficiaries/UnifiedBeneficiaryPage.jsx`
- `frontend/src/pages/beneficiaries/AddBeneficiaryPage.jsx`
- `frontend/src/pages/beneficiaries/BeneficiaryDetails.jsx`
- `frontend/src/pages/beneficiaries/BeneficiaryImportPage.jsx`
- `frontend/src/pages/beneficiaries/SupportRequestPage.jsx`
- `frontend/src/pages/daily-beneficiaries/DailyBeneficiariesPage.jsx`
- `frontend/src/pages/daily-beneficiaries/DailyBeneficiaryForm.jsx`
- `frontend/src/pages/delivery/DirectHandoverPage.jsx`
- `frontend/src/pages/delivery/HomeDeliveryPage.jsx`
- `frontend/src/pages/delivery/SupportDeliveryPage.jsx`
- `frontend/src/pages/admin/DriversDirectoryPage.jsx`
- `frontend/src/pages/driver/DriverAccessPage.jsx`
- `frontend/src/pages/governance/GovernancePage.jsx`
- `frontend/src/pages/admin/Users.jsx`
- `frontend/src/pages/admin/SystemSettingsPage.jsx`
- `frontend/src/main.jsx`

`frontend/src/App.jsx` is shared with A5 guards. Assign it through A3.

**A3**

- `routes/api.php`
- `app/Http/Controllers/Beneficiaries/BeneficiaryController.php`
- `app/Http/Controllers/SupportDistributionController.php`
- `app/Services/SupportDistributionService.php`
- `app/Http/Controllers/DeliveryCommunicationController.php`
- `frontend/src/App.jsx`

## Gaps

- No backend derivation of citizen/resident from nationality. Daily registration has no nationality field.
- Mounted beneficiary list does not return or show receipt summaries.
- Mounted إرسال الدعم flow is a draft save titled طلب دعم للمستفيد. The labeled إرسال الدعم UI is legacy and unmounted.
- Dashboard “تم التوصيل والإنهاء” counts legacy `Distribution.status = delivered`, not completed `SupportReceipt` rows.
