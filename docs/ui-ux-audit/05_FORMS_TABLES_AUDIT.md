# Forms and tables

## Forms

Shared pieces exist: `FormField`, `FormSection`, `Input`, `.ikram-control`, `.ikram-form-grid`, `.ikram-label`. Large pages often skip them and render native inputs with local class strings.

### Beneficiary registration and edit

`AddBeneficiaryPage.jsx` and `EditBeneficiaryPage.jsx` carry identity, nationality type (citizen vs resident), family rows, documents, and financial fields in one scroll. Family members are an inline `<table>`. Required markers and helper text are not uniform. Validation is field-level where the API returns 422; the page does not use one error summary.

These forms should be visually split later into: basic data, family, financial, documents. Do not change fields or the citizen/resident split in the visual pass.

### Other forms

| Form | File | Note |
| --- | --- | --- |
| Daily beneficiary | `DailyBeneficiaryForm.jsx` | shorter, still custom controls |
| Staff add/edit | `AddStaffPage.jsx`, `EditStaffPage.jsx` | dependents table inside the form |
| Users and permissions | `Users.jsx` | dense permission grid, easy to miss a module |
| Settings | `SystemSettingsPage.jsx` | financial fields plus communications block |
| Representatives | `NeighborhoodRepsPage.jsx` | the only “organization-like” form |
| Support request | `SupportRequestPage.jsx` | operational, should stay short |
| Login / forgot / setup | auth pages | acceptable length |
| Import | `SmartExcelImport.jsx` | preview table, not a data-entry form |

### Form checklist

| Check | Current state |
| --- | --- |
| Labels | Present on most fields; some icon buttons are unlabeled (C8) |
| Grouping | Weak on beneficiary and staff forms (H1) |
| Required | Asterisk usage is inconsistent |
| Errors | API 422 messages surface near fields on newer forms; wording is sometimes the raw validator key |
| Helper text | Sparse |
| Control height | `.ikram-btn` and `.ikram-control` target 44px. Legacy inputs do not |
| Dates and numbers | Native inputs, RTL alignment varies |
| Disabled / read-only | Opacity 50 on buttons. Read-only record views are separate pages, which is correct |
| Submit / cancel | Primary button plus a back link. Placement is not shared |
| Destructive | Not consistently `ConfirmDialog` (H5) |
| Keyboard | Focus ring exists globally (`:focus-visible`). Tab order follows DOM, which is correct for RTL if the DOM is RTL |

## Tables

### What exists

`DataTable` and `TablePagination` are the intended pattern. The live beneficiary list uses them. Other operational lists use `<table>` or `.ikram-table`:

- `StaffListPage.jsx`
- `Users.jsx`
- `DriversDirectoryPage.jsx`
- `Warehouse.jsx`
- `AuditPage.jsx` (four raw tables)
- Family and dependent tables inside forms
- Unrouted `BeneficiaryList.jsx` (large, three tables)

### Evaluation

| Topic | Finding |
| --- | --- |
| Density | List tables use `text-xs` in legacy files and `text-sm` in `.ikram-table`. Too small for Arabic diacritics-free but long labels |
| Alignment | `text-right` matches RTL. Numeric columns are not tabular-nums |
| Actions | Mixed text buttons and icon buttons at the row end |
| Sort / filter / search | Beneficiary list has them. Other lists vary. There is no shared `FilterBar` adoption on every list |
| Pagination | `TablePagination` exists and is not universal |
| Mobile | Min width causes horizontal scroll (C4) |
| Overflow | Names and notes truncate without a title tooltip pattern |
| Status | `StatusBadge` exists; many rows still use ad hoc colors |
| Empty | `EmptyState` exists and is not on every list |
| Export | Beneficiary and governance/statistics actions differ (Excel vs print) |

### Future table pattern (do not build now)

One `DataTable`: toolbar (search, filters, primary action, export), column definitions, row actions menu, status cell, empty state, loading state, pagination, and a narrow-screen definition that stacks the primary columns. Preview tables inside import can stay compact.

## Dashboard charts

See `06` for RTL and `07` for accessibility. Composition notes: `GovernancePage.jsx` places four charts (column, line, funnel, pie) after KPI cards. `Dashboard.jsx` has KPI cards and no chart. The dashboard does not show a date filter. Card grids wrap, but the hierarchy is “counts”, not “attention, change, status, action” (C5).
