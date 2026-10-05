# IKRAM design system

Phase 2 foundation. Screen-by-screen redesign is Phase 3. Audit findings C6, H3, and the PDF P0 list are the trace for this pass.

## Layers

1. Tokens in `frontend/src/index.css` (`:root`) and the matching Tailwind theme.
2. Primitives: `Button`, `IconButton`, `StatusBadge`, `FormField`, `formControls.jsx`, `FormSection`, `DataTable`, `PageHeader`, `KpiCard`, `ChartFrame`, `Dialog`, `ConfirmDialog`.
3. Shell: `MainLayout`, `Sidebar`, `TopBar`.
4. Documents: `App\Support\Pdf\AssociationFrame` and `resources/views/pdf/letterhead_template.blade.php`.

## Rules

- New UI uses tokens. Do not add a one-off hex for color, radius, or shadow.
- One status scale. Success is not the brand green.
- Arabic and RTL are the default. Do not add a left-to-right page.
- Do not rename «إدارة الجهات المستفيدة». That label is an open product decision (audit C1).
- Official PDFs share one frame. Do not hardcode an association name in a template.

## Out of scope here

Rewriting all 33 screens, every raw `<table>`, and every long form. Those pages should adopt the primitives in Phase 3.
