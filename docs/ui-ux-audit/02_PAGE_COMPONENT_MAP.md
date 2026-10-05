# Page to component map

Routes below are the live ones in `frontend/src/App.jsx` unless noted. Parent layout is `MainLayout` except auth pages and driver access.

Permission notes: `admin` bypasses `allowedRoles`. `PagePermissionGuard` wraps routes with a `canAccess` prop. Sidebar filtering in `Sidebar.jsx` is a second copy of those rules and can drift (finding H8).

## Authentication

| Screen | Route | File | Pieces |
| --- | --- | --- | --- |
| Login | `/login` | `LoginPage.jsx` | `.ikram-auth`, form fields, primary button |
| Forgot password | `/forgot-password` | `ForgotPasswordPage.jsx` | same auth shell |
| Change password | in-app modal plus page file | `ChangePasswordPage.jsx`, `ChangePasswordModal.jsx` | dialog |
| First admin | `/setup-admin` | `FirstAdminSetupPage.jsx` | auth shell |

## Operations

| Screen | Route | File | Pattern |
| --- | --- | --- | --- |
| Dashboard | `/dashboard` | `Dashboard.jsx` | `PageHeader`, `KpiCard`, `Button`, lucide icons including `ArrowLeft` |
| Assistant home | `/assistant-admin` | `AssistantAdminDashboard.jsx` | separate dashboard, not the main KPI page |
| Beneficiary list | `/beneficiaries` | `UnifiedBeneficiaryPage.jsx` | toolbar, search, filters, `DataTable`, pagination, export |
| Add citizen | `/beneficiaries/add-citizen` | `AddBeneficiaryPage.jsx` | long form, family table, `Button` |
| Add resident | `/beneficiaries/add-resident` | same file, `beneficiaryType="resident"` | same form, different type |
| Import | `/beneficiaries/import` | `BeneficiaryImportPage.jsx` | `SmartExcelImport` |
| Details | `/beneficiaries/:id` | `BeneficiaryDetails.jsx` | sections, raw tables, media modal, policy links |
| Edit | `/beneficiaries/:id/edit` | `EditBeneficiaryPage.jsx` | long form |
| Support request | `/beneficiaries/:id/support`, `/support/request` | `SupportRequestPage.jsx` | form |
| Daily list | `/daily-beneficiaries` | `DailyBeneficiariesPage.jsx` | tabs for list, receiving, inventory |
| Daily form | add and `:id/edit` | `DailyBeneficiaryForm.jsx` | form |
| Daily details | `/daily-beneficiaries/:id` | `DailyBeneficiaryDetails.jsx` | record |
| Staff list | `/staff` | `StaffListPage.jsx` | toolbar, filters, raw table, row actions |
| Staff add / edit / details / import | `/staff/add`, `/:id/edit`, `/:id`, `/staff/import` | matching files | forms, `SmartExcelImport` |
| Warehouse | `/warehouse` | `Warehouse.jsx` | list, movement forms, raw tables |
| Representatives | `/representatives` | `NeighborhoodRepsPage.jsx` | list and forms. Menu label says الجهات المستفيدة |
| Direct receive | `/receiver` | `DirectHandoverPage.jsx` | handover flow. `ReceiverPage.jsx` is not this route |
| Home delivery | `/delivery` | `HomeDeliveryPage.jsx` | assignments, driver actions |
| Support delivery | `/support-delivery` | `SupportDeliveryPage.jsx` | support queue |

`/send-support` redirects to `/support/request`. `/distributions` redirects to `/delivery`. `/driver/deliveries` redirects to `/driver-access`.

## Governance, admin, public

| Screen | Route | File | Pattern |
| --- | --- | --- | --- |
| Governance | `/governance` | `GovernancePage.jsx` | KPI cards, filters, four custom charts |
| Statistics alias | `/statistics` | same file | different `allowedRoles` |
| Audit | `/audit`, `/admin/audit-logs` | `AuditPage.jsx` | table, filters |
| Users | `/admin/users` | `Users.jsx` | `ikram-table`, permission matrix, dialogs |
| Drivers | `/admin/drivers` | `DriversDirectoryPage.jsx` | `ikram-table` |
| Settings | `/admin/settings` | `SystemSettingsPage.jsx` | financial settings plus `CommunicationsSettings` for admin |
| Policy review | policy review route | `PolicyDReviewPage.jsx` | review table |
| Policy runs | application-runs route | `PolicyApplicationRunsPage.jsx` | run list |
| Driver link | `/driver-access` via `main.jsx` | `DriverAccessPage.jsx` | own CSS, no sidebar |

## Duplicated patterns

These should become one component later. Do not build them in this phase.

| Pattern | Live example | Duplicate |
| --- | --- | --- |
| List toolbar + search + filters + table + pagination | `UnifiedBeneficiaryPage` uses `DataTable` | `StaffListPage`, `Users.jsx`, `Warehouse.jsx`, and unrouted `BeneficiaryList.jsx` use raw tables |
| Record header + sections | `PageHeader` + `PageSection` | several detail pages compose sections inline |
| Status chip | `StatusBadge` | local colored spans on older lists |
| Confirm | `ConfirmDialog` | inline confirm copy in legacy delivery pages |
| Excel import | `SmartExcelImport` | used by beneficiary and staff import |
| Charts | `GovernanceCharts.jsx` | CSS bars in unrouted `StatisticsPage.jsx` |

Beneficiary list, once redesigned, should stay: layout, toolbar, search, filters, `DataTable`, pagination, actions, export. Staff, users, warehouse, audit, and drivers should follow that same chain.
