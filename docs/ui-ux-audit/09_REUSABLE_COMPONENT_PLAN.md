# Reusable component plan

Recommendation only. Build nothing in the audit phase.

The kit already exists under `frontend/src/components`. The work is to use it everywhere and fill two gaps (breadcrumb, date field). Do not create parallel names.

| Future name | Existing file | Action when implementation starts |
| --- | --- | --- |
| AppLayout | `layout/MainLayout.jsx` | Keep. Add logical margin |
| Sidebar | `layout/Sidebar.jsx` | Keep. One permission source |
| Header | `layout/TopBar.jsx` | Keep |
| PageHeader | `ui/PageHeader.jsx` | Keep as the only `h1` |
| Breadcrumb | none | Add for record depth only (H4) |
| SectionCard | `ui/PageSection.jsx` | Use this name in docs; do not fork |
| StatsCard | `ui/KpiCard.jsx`, `SummaryCard.jsx` | Keep both roles: one metric vs one summary |
| DataTable | `ui/DataTable.jsx` | Adopt on every list (H2) |
| TableToolbar | part of list pages | Extract only if `DataTable` callers repeat the same toolbar twice |
| SearchInput | inside lists | Use `Input` with one search variant |
| FilterPanel | `ui/FilterBar.jsx` | Adopt |
| PrimaryButton / Secondary / Danger / IconButton | `ui/Button.jsx`, `IconButton.jsx` | Variants already exist (`.ikram-btn-*`) |
| FormField | `ui/FormField.jsx` | Add error id and required marker |
| SelectField | `Input` or native select | One select style |
| DateField | none | Thin wrapper around the native date input with RTL isolation |
| Modal | `overlays/Dialog.jsx` | Keep. Cap height |
| ConfirmDialog | `overlays/ConfirmDialog.jsx` | Use for every destructive action |
| Drawer | `overlays/Drawer.jsx` | Keep for filters and the mobile sidebar pattern |
| Alert | toasts | One channel (M2) |
| Badge / StatusBadge | `ui/StatusBadge.jsx` | Map status to tokens that are not brand green |
| EmptyState / LoadingState | existing | Required on every list (M3) |
| Pagination | `ui/TablePagination.jsx` | Required with `DataTable` |
| Tabs | `ui/Tabs.jsx` | Already used by daily beneficiaries |
| DropdownMenu | `ui/ActionMenu.jsx` | Row actions |

Domain components stay domain-specific: `SmartExcelImport`, `SupportOperations`, `FamilySummary`, `CategoryBadge`, `QrScannerModal`, `NotificationCenter`, `PagePermissionGuard`.

Driver access should consume tokens and `Button` / `FormField` only. It should not render `MainLayout`.

PDF Blade templates are out of this component set until the SPA tokens are stable (L1).
