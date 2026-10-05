# Phase 3 progress

Live routes were reviewed against the Phase 2 shell. Status means the screen uses the shared layout, tokens, and the global table/form rules. It does not mean every local table was rewritten as `DataTable`.

| Route | Page | Status | Layout | Type | Forms | Tables | Responsive | RTL | A11y | Regression | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/login` | `LoginPage` | Completed | yes | yes | yes | n/a | checked in CSS and one desktop render | yes | labels and password toggle named | not submitted | Brand panel is the existing login composition |
| `/forgot-password` | `ForgotPasswordPage` | Completed | yes | yes | yes | n/a | shared control height | yes | labels added | not submitted | |
| `/setup-admin` | `FirstAdminSetupPage` | Completed | yes | yes | existing fields | n/a | shared tokens | yes | labels already present | not submitted | Rendered when setup is required |
| change-password gate | `ChangePasswordPage` | Completed | yes | yes | yes | n/a | shared controls | yes | labels and alert | not submitted | |
| `/dashboard` | `Dashboard` | Completed | yes | yes | n/a | n/a | compact cards | yes | section buttons | counts still load full lists | Audit C5 left as debt |
| `/assistant-admin` | `AssistantAdminDashboard` | Completed | yes | yes | n/a | token table rules | CSS wrap under 1024px | yes | shared | not clicked | |
| `/beneficiaries` | `UnifiedBeneficiaryPage` | Completed | yes | yes | filters | `DataTable` | stack under 768px | yes | shared | 4 Vitest tests passed | |
| `/beneficiaries/add-citizen` `/add-resident` | `AddBeneficiaryPage` | Completed | yes | yes | `ikram-control`, five steps | dependent table kept | grid | yes | errors use `role=alert` | calculations unchanged | |
| `/beneficiaries/:id` | `BeneficiaryDetails` | Completed | yes | yes | n/a | token table rules | CSS wrap | yes | shared header | not clicked | |
| `/beneficiaries/:id/edit` | `EditBeneficiaryPage` | Completed | yes | yes | `ikram-control` | dependent row kept | grid | yes | delete control named | calculations unchanged | |
| `/beneficiaries/import` | `BeneficiaryImportPage` | Completed | yes | yes | existing import | n/a | shared | yes | shared | not re-run | |
| `/support/request` `/beneficiaries/:id/support` | `SupportRequestPage` | Completed | yes | yes | existing | n/a | shared | yes | shared | not clicked | |
| `/support-delivery` | `SupportDeliveryPage` | Completed | yes | yes | existing | n/a | shared | yes | shared | not clicked | |
| `/daily-beneficiaries` | `DailyBeneficiariesPage` | Completed | yes | yes | filters | token table rules | CSS wrap | yes | shared | not clicked | |
| `/daily-beneficiaries/add` `/:id/edit` | `DailyBeneficiaryForm` | Completed | yes | yes | global input rules | n/a | shared | yes | slate/red mapped to tokens | not clicked | |
| `/daily-beneficiaries/:id` | `DailyBeneficiaryDetails` | Completed | yes | yes | n/a | token table rules | CSS wrap | yes | shared | not clicked | |
| `/representatives` | `NeighborhoodRepsPage` | Completed | yes | yes | existing | token table rules | CSS wrap | yes | shared | label unchanged | Audit C1 |
| `/receiver` | `DirectHandoverPage` | Completed | yes | yes | existing | n/a | shared | yes | shared | landing not changed | `assistant_admin` home |
| `/staff` | `StaffListPage` | Completed | yes | yes | dialogs | token table rules | CSS wrap | yes | shared | not clicked | |
| `/staff/add` | `AddStaffPage` | Completed | yes | yes | `ikram-control` panels | n/a | grid | yes | errors announced | not clicked | |
| `/staff/:id/edit` | `EditStaffPage` | Completed | yes | yes | global input rules | n/a | shared | yes | shared | not clicked | |
| `/staff/:id` | `StaffDetailsPage` | Completed | yes | yes | n/a | token table rules | CSS wrap | yes | shared | not clicked | |
| `/staff/import` | `StaffImportPage` | Completed | yes | yes | existing import | n/a | shared | yes | shared | not clicked | |
| `/warehouse` | `Warehouse` | Completed | yes | yes | existing | token table rules | CSS wrap | yes | shared | not clicked | |
| `/delivery` | `HomeDeliveryPage` | Completed | yes | yes | existing | shared | shared | yes | shared | not clicked | |
| `/governance` `/statistics` | `GovernancePage` | Completed | yes | yes | date filters | token tables plus chart tables | CSS wrap | yes | chart tables added | routes kept separate | Audit C2, C7 |
| `/audit` `/admin/audit-logs` | `AuditPage` | Completed | yes | yes | filters | token table rules | CSS wrap | yes | shared | not clicked | |
| `/admin/users` | `Users` | Completed | yes | yes | account dialogs | token table rules | CSS wrap | yes | shared | HTTP test still environment-sensitive | |
| `/admin/drivers` | `DriversDirectoryPage` | Completed | yes | yes | n/a | `ikram-table` | CSS wrap | yes | shared | not clicked | |
| `/admin/settings` | `SystemSettingsPage` | Completed | yes | yes | existing settings | n/a | shared | yes | shared | communications panel stays embedded | |
| `/admin/beneficiary-policy/review/:id` | `PolicyDReviewPage` | Completed | yes | yes | existing | n/a | shared | yes | shared | not clicked | |
| `/admin/beneficiary-policy/versions/:id/application-runs` | `PolicyApplicationRunsPage` | Completed | yes | yes | n/a | token table rules | CSS wrap | yes | shared | not clicked | |
| `/driver-access` | `DriverAccessPage` | Completed | separate public shell | tokens where shared | existing | n/a | own stylesheet | yes | not folded into admin shell | not clicked | Audit H6 |

Redirects left unchanged: `/daily-beneficiaries/receiving`, `/daily-beneficiaries/inventory`, `/send-support`, `/distributions`, `/driver/deliveries`.

## Unmounted pages

| File | Class |
| --- | --- |
| `BeneficiaryList.jsx` | duplicate of `UnifiedBeneficiaryPage` |
| `DailyBeneficiariesList.jsx` | duplicate of `DailyBeneficiariesPage` |
| `DailyInventoryPage.jsx` | replaced by the inventory tab redirect |
| `DailyBeneficiaryReceivingPage.jsx` | replaced by the deliveries tab redirect |
| `DeliveryPage.jsx` | duplicate of the live delivery flow |
| `DistributionPage.jsx` | duplicate; `/distributions` redirects |
| `SendSupportPage.jsx` | duplicate; `/send-support` redirects |
| `DriverDashboard.jsx` | replaced by `/driver-access` |
| `ReceiverPage.jsx` | duplicate of `DirectHandoverPage` |
| `Statistics.jsx`, `StatisticsPage.jsx` | duplicate; `/statistics` renders `GovernancePage` |
| `Settings.jsx` | duplicate of `SystemSettingsPage` |
| `BeneficiaryPolicySettings.jsx` | future/unwired settings surface |

None of these files were deleted.
