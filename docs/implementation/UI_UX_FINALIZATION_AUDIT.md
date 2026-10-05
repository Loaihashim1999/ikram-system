# UI/UX Finalization Audit

Date: 2026-09-24  
Scope: React frontend presentation, shared components, RTL, accessibility, and responsive behavior. Backend contracts and business behavior are excluded.

## Frontend inventory

The routed application contains 44 JSX page files across authentication, dashboard, beneficiary case management, daily operations, warehouse, support/delivery, receiver, staff, organizations, policy administration, governance, audit, accounts, and settings. The shared layer already contains `MainLayout`, `Sidebar`, `TopBar`, `PageHeader`, `Button`, `DataTable`, `TablePagination`, `StatusBadge`, `Tabs`, `Dialog`, `ConfirmDialog`, `Drawer`, `EmptyState`, `LoadingState`, `FormField`, and `KpiCard`.

## Design-system findings

| Area | Existing state | Gap / risk | Finalization direction |
|---|---|---|---|
| Tokens | Green/gold/amber palette and warm page/surface colors exist, mostly as repeated arbitrary Tailwind values | Repeated literals, mixed gray/slate families, inconsistent radii/shadows, and remote Google Font import | Promote tokens and reusable utility classes in `index.css`; local/system Arabic font fallback; calm borders and small shadows |
| Page shell | Most current pages use `MainLayout`; many use `PageHeader` | Older pages use ad-hoc padding, max widths, and headings; policy pages bypass the layout | Standard content width/padding in `MainLayout`; bring policy pages into the same shell without changing routes/actions |
| Headers | `PageHeader` supports title, subtitle, badge, breadcrumbs, and actions | Title scale is large on phones; actions have inconsistent width/wrapping | Compact responsive type, full-width mobile action rail, consistent lower divider |
| Buttons | Shared hierarchy exists | Many pages still use raw button classes; focus/disabled behavior varies | Strengthen shared focus/disabled behavior and global controls; replace raw clusters on representative pages |
| Cards / sections | `KpiCard` exists | Pages repeatedly hand-code white rounded cards; section heading hierarchy varies | Add `PageSection` and `SummaryCard`; retain domain-specific content hierarchy |
| Filters | Every module builds its own white card and inputs | Mobile wrapping, active-filter feedback, reset placement, and spacing vary | Add `FilterBar` with primary/advanced areas and filter count; apply first to unified beneficiaries and Governance |
| Tables | `DataTable` has loading/empty/error/pagination and internal scrolling | Most older pages use hand-built tables; action clusters and cell density vary | Make shared table the language reference; add semantic table CSS to legacy tables without changing behavior |
| Forms | `FormField` and `Input` exist | Registration/edit pages use long uninterrupted sections and inconsistent labels/errors | Add `FormSection`; normalize labels, required markers, error association, focus, and responsive grids |
| Dialogs | Shared dialog primitives exist | Older raw dialogs use large shadows/rounding and inconsistent footers | Normalize size, title/footer spacing, focus styling, and phone viewport constraints |
| Status | `StatusBadge` maps common states | Policy/support/delivery states often render as plain text | Expand semantic mappings and use status text plus color on representative workflow pages |
| States | `LoadingState` and `EmptyState` exist | Several pages render plain paragraphs/spinners; error presentation is inconsistent | Add `ErrorState` and use shared states on representative pages; global state utility classes for remaining pages |
| Navigation | Sidebar is role/permission aware | Dense grouping and mobile navigation need consistent active/focus behavior | Refine hierarchy, target sizes, active indicator, and page-level overflow containment |
| Accessibility | Arabic labels exist on most forms; dialogs have shared behavior | Some icon buttons lack labels, raw inputs lack visible focus, policy pages use very small text | Global `:focus-visible`, 44px phone targets where practical, accessible labels and status text |

## Page and module audit

| Module | Pages inspected | Information hierarchy | Primary inconsistency |
|---|---|---|---|
| Dashboard | `Dashboard`, `AssistantAdminDashboard` | Executive/operational entry point | Hand-built cards and slightly oversized decorative treatment |
| Beneficiaries | Unified list, permanent list, add/edit/import, details | Case management | Unified behavior is sound; list/detail/forms use different table, filter, section, and action patterns |
| Daily beneficiaries | Daily hub/list/details/form/receiving/inventory | Today operations | Strong domain distinction exists, but duplicated cards/tables and forms differ from permanent patterns |
| Warehouse | General warehouse | Inventory operations | Dense raw dialogs/forms and inline action buttons; semantics are correct and must remain separate from daily inventory |
| Support / delivery | Support engine, send support, distribution, delivery, driver dashboard/access | Workflow operations | Current support page is comparatively plain; legacy pages use different spacing/colors and large action treatments |
| Receiver | Receipt verification | Focused counter workflow | Oversized cards, heavy shadows, decorative animation inconsistent with institutional shell |
| Policy | POLICY settings, POLICY-D review, POLICY-E runs | Controlled administrative workflow | POLICY-D/E bypass `MainLayout` and shared header; raw fields/tables make high-risk actions difficult to scan |
| Governance | Governance page/charts | Executive analytics | Correct content, but hand-built filters/KPIs/table need the shared layout language and denser executive hierarchy |
| Accounts/settings | Users, settings, system settings, communications | Administration | Users permission matrix is dense; legacy settings pages use emoji and unrelated styling |
| Organizations/staff | Neighborhood reps, staff list/add/edit/details/import | Registry administration | Tables/forms mostly functional but rely on repeated bespoke styling and action clusters |
| Audit/statistics | Audit pages and legacy statistics | Oversight | Duplicate/legacy surfaces have inconsistent page headers and card styles |
| Authentication | Login, setup, recovery, password pages | Focused identity flows | Generally isolated and usable; shared focus, font, contrast, and card treatment should apply |

## Responsive and RTL risks

- Several pages add their own `p-4 lg:p-6` inside `MainLayout`, creating inconsistent gutters.
- Hand-built tables correctly use internal horizontal scrolling in many places, but this is not universal.
- Header actions can crowd 360–430 px widths.
- Permission matrices, policy run tables, and Governance filters need controlled internal scrolling and stacked actions.
- `App.css` contains unused starter/demo styles and nested CSS unrelated to the application.
- `index.css` imports fonts from Google at runtime, conflicting with a fully local, zero-remote acceptance gate.

## Implementation passes

1. Establish shared tokens and primitives (`PageSection`, `SummaryCard`, `FilterBar`, `FormSection`, `ErrorState`, `ActionMenu`) and strengthen existing components.
2. Apply the system to the unified Beneficiaries page and daily operations surfaces while preserving ALL/PERMANENT/DAILY behavior and domain separation.
3. Restructure beneficiary detail and registration/edit presentation into readable case sections without altering fields or submits.
4. Apply workflow hierarchy to support, delivery, inventory, POLICY-D, and POLICY-E.
5. Polish Governance, accounts/settings, organizations, and staff with module-specific hierarchy.
6. Resolve remaining global spacing, focus, RTL, overflow, legacy starter CSS, and responsive inconsistencies; run representative local browser acceptance at all required widths.

