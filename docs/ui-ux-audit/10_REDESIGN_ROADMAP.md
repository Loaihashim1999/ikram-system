# Redesign roadmap

No implementation in this phase. Order matches the audit brief, with two constraints from the current architecture: tokens already exist, and «جهات المستفيد» must not be relabeled until the product term is decided.

## Visual direction

Professional, calm, Arabic-first, RTL-first, dense enough for daily desk work.

Keep:

- Green `#1F4D3A`, gold `#A6843D`, paper `#F3EFE6`, surface `#FFFDF8`, ink `#1C1915`.
- IBM Plex Sans Arabic.
- 44px controls, 16px body, one panel elevation.
- Existing information architecture and routes.

Avoid:

- Landing-page heroes, gradients, glass, extra motion, oversized titles, pill-shaped controls, decorative charts.

Status colors (success, warning, danger, info) must be distinguishable from the brand green. Proposed direction, not a new palette: keep danger and info as they are, darken or shift success so it is not `#1F4D3A`, and keep warning brown only if contrast on `text-xs` passes AA.

## Priority matrix

### P0 — Critical

C1 menu label versus representatives (blocked on the product term). C2 duplicate governance entry. C3 login landing. C4 table min-width. C5 dashboard counts and hierarchy. C6 RTL icons and active edge. C7 chart text alternative. C8 icon-only names.

### P1 — High

H1 section long forms. H2 one table implementation. H3 status color scale. H4 breadcrumbs on records. H5 confirm destructive actions. H6 driver-access tokens only. H7 stop treating unrouted pages as the design source. H8 one permission map for menu and routes.

### P2 — Medium

M1 replace hardcoded `#EFE8D8`, extra radii, and the conflicting panel shadow. M2 one toast. M3 empty, loading, and error on every list. Also: doubled focus ring, table captions, drawer focus, muted-text contrast check.

### P3 — Low

L1 PDF Blade visual alignment. Gold scrollbar. Sentry test button. Physical overflow-x on `html`.

Counts: 8 P0, 8 P1, 6 P2 themes, 4 P3 themes. The summary’s top 20 is the implementation queue; this matrix is the severity queue. C1–C8 are the critical set used for the completion count.

## Implementation sequence

1. Tokens in `index.css` only. Fix success, thead color, radius, shadow. No page edits yet.
2. Typography. One heading scale. Remove the second `thead th` size if it fights `.ikram-table`.
3. RTL. Logical properties, icon direction, numeric isolation.
4. `MainLayout` spacing and sidebar offset.
5. `Sidebar` active state and labels that are already decided. Leave the الجهات label if the product term is still open.
6. `TopBar` and `PageHeader`.
7. `Button`, `StatusBadge`, `Dialog`, `ConfirmDialog`, `EmptyState`, `LoadingState`, `ErrorState`.
8. `FormField` and `FormSection` on beneficiary, staff, user, and representative forms.
9. `DataTable` on staff, users, drivers, warehouse, audit.
10. `KpiCard` dashboard hierarchy. Stop counting full collections in the browser only when a summary API already exists; otherwise show the limitation and do not invent an endpoint in the visual pass.
11. Beneficiary and user workflows.
12. Remaining routed pages. Do not restyle unrouted files except to ignore them (H7).
13. Narrow table layout and dialog max-height.
14. Accessibility pass: names, chart table, focus order, contrast.
15. Visual regression against the current screens before any release.

## Out of scope for the visual phase

Route renames, API changes, schema changes, permission rule changes, deleting legacy files, and folding driver access into the admin shell.
