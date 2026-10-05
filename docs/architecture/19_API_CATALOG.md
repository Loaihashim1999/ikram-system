# دليل نقاط نهاية واجهة برمجة التطبيقات (API Endpoint Catalog)
**مشروع:** نظام إكرام (IKRAM SYSTEM)  
**الحالة:** تدقيق معمارية الوضع الراهن (AS-IS Architecture Audit)  
**إجمالي المسارات:** 102 نقطة نهاية API مسجلة في Laravel Router  
**التاريخ:** سبتمبر 2026

---

## 1. مسارات المصادقة والأمان العامة (Public & Auth Endpoints)

| المسار (URI) | الطريقة (Method) | المتحكم والتابع (Action) | الوسائط والقيود (Middleware) |
|---|:---:|---|---|
| `api/setup-admin/status` | GET | `FirstAdminSetupController@status` | `throttle:30,1` |
| `api/setup-admin` | POST | `FirstAdminSetupController@store` | `throttle:5,1` |
| `api/login` | POST | `LoginController@login` | `throttle:6,1` |
| `api/forgot-password` | POST | `PasswordRecoveryController@sendResetLink` | `throttle:3,1` |
| `api/reset-password` | POST | `PasswordRecoveryController@reset` | `throttle:5,1` |
| `api/me` | GET | `LoginController@me` | `auth:sanctum` |
| `api/logout` | POST | `LogoutController@logout` | `auth:sanctum` |
| `api/change-password` | POST | `LoginController@changePassword` | `auth:sanctum` |

---

## 2. مسارات المستفيدين الدائمين (Permanent Beneficiaries Endpoints)

| المسار (URI) | الطريقة (Method) | المتحكم والتابع (Action) | الصلاحية المطلوبة |
|---|:---:|---|---|
| `api/beneficiaries` | GET | `BeneficiaryController@index` | `beneficiaries:view` |
| `api/beneficiaries` | POST | `BeneficiaryController@store` | `beneficiaries:create` |
| `api/beneficiaries/{id}` | GET | `BeneficiaryController@show` | `beneficiaries:view` |
| `api/beneficiaries/{id}` | PUT/PATCH | `BeneficiaryController@update` | `beneficiaries:edit` |
| `api/beneficiaries/{id}` | DELETE | `BeneficiaryController@destroy` | `beneficiaries:delete` |
| `api/beneficiaries/{id}/dependents` | POST | `BeneficiaryController@storeDependent` | `beneficiaries:create` |
| `api/beneficiaries/{id}/dependents/{dep}`| DELETE | `BeneficiaryController@destroyDependent`| `beneficiaries:delete` |
| `api/beneficiaries/{id}/documents` | POST | `BeneficiaryController@uploadDocument` | `beneficiaries:create` |
| `api/beneficiaries/{id}/documents/{doc}` | DELETE | `BeneficiaryController@destroyDocument` | `beneficiaries:delete` |
| `api/beneficiaries/export/excel` | GET | `BeneficiaryController@exportExcel` | `beneficiaries:export` |
| `api/beneficiaries/import` | POST | `BeneficiaryController@importExcel` | `beneficiaries:import` |
| `api/categories` | GET/POST | `CategoryController` (CRUD) | `beneficiaries:view/edit` |

---

## 3. مسارات المستفيدين اليوميين الموحدة (Daily Beneficiaries Endpoints)

| المسار (URI) | الطريقة (Method) | المتحكم والتابع (Action) | الصلاحية المطلوبة |
|---|:---:|---|---|
| `api/daily-beneficiaries` | GET/POST | `DailyBeneficiaryController` (CRUD) | `daily_beneficiaries` |
| `api/daily-beneficiaries/{id}` | GET/PUT/DEL| `DailyBeneficiaryController` (CRUD) | `daily_beneficiaries` |
| `api/daily-receiving` | GET/POST | `DailyReceivingController` | `daily_beneficiaries` |
| `api/daily-receiving/{id}` | GET/PUT/DEL| `DailyReceivingController` | `daily_beneficiaries` |
| `api/daily-receiving/{id}/pdf` | GET | `PdfExportController@exportDailyReceivingVoucher` | `daily_beneficiaries:issue_document` |
| `api/daily-inventory` | GET/POST | `DailyInventoryController` | `daily_beneficiaries` |
| `api/daily-inventory/movements` | GET/POST | `DailyInventoryController@movement` | `daily_beneficiaries` |

---

## 4. مسارات المستودع والمخزون (Warehouse Endpoints)

| المسار (URI) | الطريقة (Method) | المتحكم والتابع (Action) | الصلاحية المطلوبة |
|---|:---:|---|---|
| `api/inventory` | GET | `InventoryController@index` | `warehouse:view` |
| `api/inventory` | POST | `InventoryController@store` | `warehouse:create` |
| `api/inventory/{id}` | GET/PUT/DEL| `InventoryController` (CRUD) | `warehouse:edit/delete` |
| `api/inventory/movements` | GET/POST | `InventoryController@movements` | `warehouse:create` |
| `api/inventory/alerts` | GET | `InventoryController@alerts` | `warehouse:view` |

---

## 5. مسارات التوصيل والاستلام والتحقق (Delivery & Receiver Endpoints)

| المسار (URI) | الطريقة (Method) | المتحكم والتابع (Action) | الصلاحية المطلوبة |
|---|:---:|---|---|
| `api/distributions` | GET/POST | `DistributionController` (CRUD) | `delivery:view/create` |
| `api/distributions/{id}` | GET/PUT/DEL| `DistributionController` | `delivery:edit` |
| `api/drivers` | GET/POST | `Delivery\DriverController` | `delivery` |
| `api/driver/deliveries` | GET | `DistributionController@driverDeliveries` | `delivery:view` (السائق) |
| `api/receiver/scan/{code}` | GET | `ReceiverController@scan` | `receiver:view` (جميع الأدوار) |
| `api/receiver/confirm/{code}` | POST | `ReceiverController@confirm` | `receiver:edit` (جميع الأدوار) |

---

## 6. مسارات الحوكمة والتقارير والتدقيق والإدارة (Governance, Audit & Settings)

| المسار (URI) | الطريقة (Method) | المتحكم والتابع (Action) | الصلاحية المطلوبة |
|---|:---:|---|---|
| `api/analytics` | GET | `AnalyticsController@index` | `governance:view` |
| `api/reports/daily/pdf` | GET | `PdfExportController@exportDailyReport` | `governance:export` |
| `api/reports/comprehensive/pdf` | GET | `PdfExportController@exportWeeklyComprehensiveReport` | `governance:export` |
| `api/reports/comprehensive/excel` | GET | `PdfExportController@exportComprehensiveExcel` | `governance:export` |
| `api/audit` | GET | `AuditController@index` | `audit:view` (`admin` فقط) |
| `api/users` | GET/POST/PUT/DEL | `UserController` (User Management) | `admin` فقط |
| `api/settings` | GET/POST | `SettingsController` | `settings:view/edit` (`admin` فقط للتعديل) |
| `api/smart-import/{entity}` | POST | `SmartImportController@store` | بحسب الكيان |
| `api/smart-import/{entity}/preview` | POST | `SmartImportController@preview` | بحسب الكيان |

---

## 7. مسارات إصدار السندات والوثائق (Document PDF Endpoints)

| المسار (URI) | الطريقة (Method) | المتحكم والتابع (Action) | الصلاحية المطلوبة |
|---|:---:|---|---|
| `api/documents/beneficiary-card/{id}` | GET | `PdfExportController@exportBeneficiaryCard` | `beneficiaries:issue_document` |
| `api/documents/individual-receipt/{id}`| GET | `PdfExportController@exportIndividualReceipt` | `delivery:issue_document` |
| `api/documents/total-delivery/{id}` | GET | `PdfExportController@exportTotalDelivery` | `beneficiaries:issue_document` |
| `api/documents/rep-receipt/{id}` | GET | `PdfExportController@exportRepresentativeReceipt` | `representatives:issue_document` |
| `api/documents/staff-receipt/{id}` | GET | `PdfExportController@exportStaffReceipt` | `staff:issue_document` |
