# Frontend inventory

## Stack verification

- `frontend/package.json`: `react` 19.2, `react-dom`, `vite` 8, `tailwindcss` 3.4, `react-router-dom` 7, `lucide-react`, `@tanstack/react-query`, `react-hook-form`, `axios`, `react-hot-toast`, `@fontsource/ibm-plex-sans-arabic`, `html5-qrcode`, `qrcode`, `xlsx`, `@sentry/react`.
- `composer.json`: `laravel/framework` ^13.8.
- Searches found no Livewire, Alpine, Vue, or Bootstrap in the SPA.
- Vite config: `frontend/vite.config.js`. Global CSS entry: `frontend/src/index.css`. Extra CSS: `frontend/src/pages/driver/driver-access.css`.
- Icons: lucide-react only.
- Charts: none in dependencies. Custom components in `frontend/src/pages/governance/GovernanceCharts.jsx`.

## Blade

| File | Role |
| --- | --- |
| `resources/views/app.blade.php` | SPA host |
| `resources/views/welcome.blade.php` | Laravel default, not the product UI |
| `resources/views/pdf/*.blade.php` | 11 print layouts (receipts, reports, letterhead, bar chart) |

## React pages (`frontend/src/pages`, 48 files)

Routed from `frontend/src/App.jsx` or `main.jsx`:

| Area | File |
| --- | --- |
| Auth | `auth/LoginPage.jsx`, `ForgotPasswordPage.jsx`, `ChangePasswordPage.jsx`, `FirstAdminSetupPage.jsx` |
| Home | `Dashboard.jsx`, `admin/AssistantAdminDashboard.jsx` |
| Beneficiaries | `beneficiaries/UnifiedBeneficiaryPage.jsx`, `AddBeneficiaryPage.jsx`, `EditBeneficiaryPage.jsx`, `BeneficiaryDetails.jsx`, `BeneficiaryImportPage.jsx`, `SupportRequestPage.jsx` |
| Daily | `daily-beneficiaries/DailyBeneficiariesPage.jsx`, `DailyBeneficiaryForm.jsx`, `DailyBeneficiaryDetails.jsx` |
| Staff | `staff/StaffListPage.jsx`, `AddStaffPage.jsx`, `EditStaffPage.jsx`, `StaffDetailsPage.jsx`, `StaffImportPage.jsx` |
| Warehouse | `warehouse/Warehouse.jsx` |
| Delivery | `delivery/HomeDeliveryPage.jsx`, `DirectHandoverPage.jsx`, `SupportDeliveryPage.jsx` |
| Representatives | `representatives/NeighborhoodRepsPage.jsx` |
| Governance | `governance/GovernancePage.jsx`, `governance/GovernanceCharts.jsx` |
| Audit | `audit/AuditPage.jsx` |
| Admin | `admin/Users.jsx`, `DriversDirectoryPage.jsx`, `SystemSettingsPage.jsx`, `CommunicationsSettings.jsx`, `PolicyDReviewPage.jsx`, `PolicyApplicationRunsPage.jsx` |
| Public driver | `driver/DriverAccessPage.jsx` (mounted in `main.jsx`, not in the router) |

Present on disk and not mounted by `App.jsx`:

`BeneficiaryList.jsx`, `daily-beneficiaries/DailyBeneficiariesList.jsx`, `DailyInventoryPage.jsx`, `DailyBeneficiaryReceivingPage.jsx`, `delivery/DeliveryPage.jsx`, `DistributionPage.jsx`, `SendSupportPage.jsx`, `DriverDashboard.jsx`, `receiver/ReceiverPage.jsx`, `statistics/Statistics.jsx`, `statistics/StatisticsPage.jsx`, `admin/Settings.jsx`, `admin/BeneficiaryPolicySettings.jsx`.

Daily receiving and inventory routes redirect to tabs on `DailyBeneficiariesPage`. `/send-support` redirects to `/support/request`. `/distributions` redirects to `/delivery`.

## Shared components (44 files)

Layouts (4): `layout/MainLayout.jsx`, `Sidebar.jsx`, `TopBar.jsx`, `NotificationCenter.jsx`.

UI kit (20): `PageHeader`, `Button`, `Input`, `IconButton`, `FormField`, `FormSection`, `PageSection`, `DataTable`, `TablePagination`, `FilterBar`, `Tabs`, `KpiCard`, `SummaryCard`, `StatusBadge`, `EmptyState`, `LoadingState`, `ErrorState`, `ActionMenu`, `Toast`.

Overlays (4): `Dialog`, `Drawer`, `ConfirmDialog`, `Scrim`.

Feature components: `SmartExcelImport`, `PagePermissionGuard`, `SupportOperations`, `QrScannerModal`, `ChangePasswordModal`, `ReceiptCounterModal`, `ReceiptHistoryTimeline`, `HistoricalDistributionReferenceCard`, `FilterableTableHeader`, `BeneficiaryMediaModal`, `CategoryBadge`, `FamilySummary`, `PolicyReviewLinks`, `ErrorButton`.

## Shell structure

`MainLayout` renders sidebar, top bar, and `<main class="ikram-stage lg:mr-72 mt-16">`. Page width class is `ikram-page` (`max-w-7xl`). No footer component exists.
