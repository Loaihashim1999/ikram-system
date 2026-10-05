# Component standards

| Component | File | Contract |
| --- | --- | --- |
| Button | `ui/Button.jsx` | `primary`, `secondary`, `outline`, `ghost`, `danger`, `dangerOutline`. Loading sets `aria-disabled` and a spinner. |
| IconButton | `ui/IconButton.jsx` | Requires `title` or `aria-label`. Minimum target 44px. |
| StatusBadge | `ui/StatusBadge.jsx` | Tones: success, warning, danger, info, neutral. |
| PageHeader | `ui/PageHeader.jsx` | Title, description, breadcrumbs, actions, optional `filters`. |
| KpiCard | `ui/KpiCard.jsx` | One metric. Compact panel, not a hero card. |
| ChartFrame | `ui/ChartFrame.jsx` | Title plus a visible table. Use this for any new chart. |
| Dialog | `overlays/Dialog.jsx` | Label, Escape, focus return. |
| ConfirmDialog | `overlays/ConfirmDialog.jsx` | Destructive actions. |
| DataTable | `ui/DataTable.jsx` | See `06_DATA_TABLES.md`. |

Buttons use `.ikram-btn-*` in `index.css`. Do not invent a parallel button class on a page.

Cards use `.ikram-panel`. KPI, summary, and form sections are the same panel with different content, not different radii.
