# EKRAM design system

Phase 1 foundation. One system, Arabic first. Driver mobile layout stays for a later phase.

## Source of truth

| Concern | File |
|---|---|
| Color, type, spacing, radius, focus | `frontend/src/index.css` and `frontend/src/theme/tokens.js` |
| Page hierarchy | `frontend/src/components/ui/PageShell.jsx` |
| Shared entry | `frontend/src/components/ui/index.js` |

`frontend/FRONTEND_DESIGN_SYSTEM.md` still describes an older amber action color. Operational UI uses the green `#1F4D3A` and gold `#A6843D` tokens in `index.css`.

## Page order

Breadcrumb, title, description, primary action, KPI row when the page has period or status counts, filters, then the main table or form. Secondary actions sit with the primary action and use the secondary or outline button, not a second primary.

## Shared components

PageShell, PageHeader, Breadcrumbs, SectionCard, KpiCard, FilterBar, DataTable, StatusBadge, FormField, Button, PrimaryButton, SecondaryButton, DangerButton, ActionMenu, Tabs, EmptyState, LoadingState, ErrorState, ConfirmationDialog.

## RTL

Pages stay `dir="rtl"`. Phone numbers, identifiers, and counts use `ikram-numeric` so digits stay tabular and left-to-right inside the Arabic row. Tables scroll horizontally instead of clipping long values. Focus is the gold ring `--focus-ring`. Controls are at least `--control-height` (2.75rem).

## Responsive baseline

The shell, table, filter bar, and buttons are usable from tablet width upward. Below 768px, DataTable stacks the columns marked for stacking. The driver portal is not part of this pass.
