# UI / UX audit summary

Audit date: 2026-10-05. Source of truth is the repository, not a visual mock. No screen was redesigned in this phase.

The named design skills were not installed in this workspace. The audit still follows those disciplines: inventory, information architecture, forms, tables, visual composition, RTL, accessibility, workflow, and writing. Findings are listed once here and linked from the other files.

## Current frontend stack

| Layer | What the repo actually uses |
| --- | --- |
| Application UI | React 19 SPA (`frontend/`), Vite 8, React Router 7 |
| Server | Laravel 13 (`laravel/framework` ^13.8), PHP 8.3. It serves the SPA and PDF Blade views. It is not the screen layer. |
| Styling | Tailwind CSS 3.4, tokens in `frontend/src/index.css` |
| Font | IBM Plex Sans Arabic |
| Icons | lucide-react |
| Forms / data | react-hook-form, TanStack Query, axios |
| Feedback | react-hot-toast, plus `components/ui/Toast.jsx` |
| Other UI libs | html5-qrcode, qrcode, xlsx, Sentry |
| Charts | No chart package. Governance charts are custom markup in `GovernanceCharts.jsx`. Statistics uses CSS bars. |
| Not present | Livewire, Alpine, Vue, Bootstrap |

Blade is limited to `resources/views/app.blade.php`, `welcome.blade.php`, and 11 PDF templates under `resources/views/pdf/`.

## Number of pages audited

- 33 routed React screens (see `01` and `02`).
- 12 page files that are not mounted by `App.jsx` (legacy duplicates).
- 44 component files under `frontend/src/components`.
- 13 Blade views, of which 11 are print layouts.

## Main layouts

- `MainLayout`: fixed RTL sidebar (288px), top bar, `main` offset with `lg:mr-72`.
- Auth split: `.ikram-auth` on login, forgot-password, and first-admin setup.
- Driver access: `main.jsx` renders `DriverAccessPage` outside the router and outside `MainLayout`, with `driver-access.css`.

There is no application footer.

## Main shared components

Shell: `MainLayout`, `Sidebar`, `TopBar`, `NotificationCenter`.

Already reusable: `PageHeader`, `Button`, `Input`, `IconButton`, `FormField`, `FormSection`, `PageSection`, `DataTable`, `TablePagination`, `FilterBar`, `FilterableTableHeader`, `Tabs`, `KpiCard`, `SummaryCard`, `StatusBadge`, `EmptyState`, `LoadingState`, `ErrorState`, `ActionMenu`, `Dialog`, `Drawer`, `ConfirmDialog`, `Scrim`.

Domain: `SmartExcelImport`, `PagePermissionGuard`, `SupportOperations`, `CategoryBadge`, `FamilySummary`, `QrScannerModal`, `ChangePasswordModal`.

`DataTable` is used by the live beneficiary list (`UnifiedBeneficiaryPage`). Most other lists still render a raw `<table>`.

## Critical UI problems

- [C1](/04_NAVIGATION_IA_AUDIT.md) Sidebar label «إدارة الجهات المستفيدة» opens `/representatives` (`NeighborhoodRepsPage`). There is no separate organizations screen. The product name «جهات المستفيد» is still undefined; the menu currently teaches the wrong destination.
- [C2](/04_NAVIGATION_IA_AUDIT.md) `/governance` and `/statistics` both render `GovernancePage`, with different role guards.
- [C3](/08_UX_WORKFLOW_AUDIT.md) `assistant_admin` lands on `/receiver`, while the first sidebar item is «لوحة التحكم».
- [C4](/06_RTL_RESPONSIVE_AUDIT.md) `.ikram-table` forces `min-w-[680px]` (36rem under 768px). Tablet and phone lists scroll sideways. There is no stacked row pattern.

## Critical UX problems

C1 and C3 above. Also [C5](/08_UX_WORKFLOW_AUDIT.md): the dashboard counts beneficiaries and distributions by downloading the collections and counting them in the browser (`Dashboard.jsx`). The KPIs do not answer “what changed” or “what needs attention” beyond four totals.

## Critical RTL problems

C4. Also [C6](/06_RTL_RESPONSIVE_AUDIT.md): directional icons such as `ArrowLeft` on the dashboard are not mirrored. The sidebar active mark uses `inset -3px 0`, which sits on the outer edge of the right-hand sidebar.

## Critical accessibility problems

- [C7](/07_ACCESSIBILITY_AUDIT.md) Governance charts (`GovernanceCharts.jsx`) are decorative divs. They have no data table and no text alternative.
- [C8](/07_ACCESSIBILITY_AUDIT.md) Many row actions are icon-only. `aria-label` is not consistent outside the sidebar close button.

## Main design inconsistencies

- Success `--color-success` is the same hex as brand green (`#1F4D3A`). Status and brand cannot be told apart. See `03`.
- Table header background `#EFE8D8` is hardcoded beside `--color-bg-soft`.
- Radii mix `0.75rem`, `1rem`, `1.15rem`, `1.25rem`, and `10px`.
- Two toast systems.
- Twelve unrouted page files still contain full list, delivery, and statistics UIs.

## Recommended design direction

Calm operational Arabic UI. Keep the existing green `#1F4D3A`, gold `#A6843D`, and paper `#F3EFE6`. IBM Plex Sans Arabic stays the only UI font. Density stays comfortable for desk work: 16px body, 44px controls, panels not cards-as-decoration. No gradients, glass, or marketing hero. Status colors must leave the brand green. Details in `10`.

## Recommended component architecture

Do not add a second kit. Extend the files already in `frontend/src/components/ui` and the classes in `index.css`. One shell, one table, one form field, one dialog, one status badge. Map in `09`.

## Top 20 redesign priorities

| # | ID | Priority | Item |
| --- | --- | --- | --- |
| 1 | C1 | P0 | Fix the «جهات» label only after the product name is decided. Do not rename the route in the redesign. |
| 2 | C2 | P0 | One governance entry in the menu. Keep both routes until a later route task. |
| 3 | C3 | P0 | Make the first screen after login match the first allowed menu item. |
| 4 | C4 | P0 | One table pattern with a readable narrow layout. |
| 5 | C5 | P0 | Dashboard KPIs from summary fields, with an attention row. |
| 6 | C6 | P0 | RTL icon direction and sidebar active edge. |
| 7 | C7 | P0 | Chart fallback table. |
| 8 | C8 | P0 | Name every icon-only control. |
| 9 | H1 | P1 | Split beneficiary, family, financial, staff, and organization forms into `FormSection`s. |
| 10 | H2 | P1 | Point list pages at `DataTable`. Leave `BeneficiaryList.jsx` unmounted. |
| 11 | H3 | P1 | One status scale that is not the brand green. |
| 12 | H4 | P1 | Breadcrumb on record pages only. |
| 13 | H5 | P1 | `ConfirmDialog` for every destructive action. |
| 14 | H6 | P1 | Driver access uses the same tokens, and stays outside the admin shell. |
| 15 | H7 | P1 | Quarantine unrouted pages so they are not treated as the live UI. |
| 16 | H8 | P1 | Align menu permission checks with route guards. |
| 17 | M1 | P2 | Replace hardcoded colors and radii with tokens. |
| 18 | M2 | P2 | One toast. |
| 19 | M3 | P2 | Shared empty, loading, and error states on every list. |
| 20 | L1 | P3 | SPA polish only: gold scrollbar, hidden Sentry control, overflow clipping. PDF work is a separate track in `11_PDF_REPORT_DESIGN_AUDIT.md`. |

## Finding counts

Screen audit: 8 Critical (C1–C8), 8 High (H1–H8), 6 Medium, 4 Low. PDF findings are separate and ranked in `11_PDF_REPORT_DESIGN_AUDIT.md` (5 P0, 5 P1, 4 P2, 2 P3).

## PDF Reports

Official PDFs are mPDF 8 documents from `PdfExportController`. Dompdf is installed and unused. Eleven Blade files live in `resources/views/pdf/`. Nine routes emit PDFs: support proof, beneficiary card, individual receipt, distribution history, representative receipt, staff receipt, daily voucher, daily report, and the date-range governance report. Finance figures are a section of the governance PDF, not a separate report. Charts are inline SVG and HTML in that governance PDF only. The paired Excel export has no letterhead.

Every PDF is stamped with `public/assets/pdf-letterhead-header.jpg` and `public/assets/pdf-letterhead-footer.jpg`. Six documents also extend `letterhead_template.blade.php`. Three documents (`support_proof`, `daily_report`, `weekly_comprehensive_report`) are standalone HTML under the same images.

## Association Frame Status

A shared photographic header and footer already wrap every PDF. That is not yet an Association Frame. The body repeats the association name, sometimes a different name, and the governance and daily reports add a second header under the artwork. Registration, address, email, and phones exist only inside the JPEGs. They are not settings. There is no Hijri date, no QR, and no single document-number row. Signature and stamp areas are blank labeled blocks on receipts and the daily report.

## PDF Branding Problems

- Daily report and daily voucher say «جمعية إكرام لحفظ الطعام». The letterhead and other documents say «جمعية إكرام الجود لخدمة ضيوف الرحمن». Settings default to «جمعية إكرام». PDFs read none of those settings.
- The English word EKRAM is only in the header image. The Excel cover uses a different English title.
- PDF type is DejaVu Sans Condensed, not IBM Plex Sans Arabic, and `autoLangToFont` can swap faces mid-line.
- PDF greens and golds (`#355B30`, `#C9A24B`, `#2E5A27`) are not the app tokens.
- The governance footer line is long enough to collide with the footer image. SVG chart text and the pie dash array are unreliable in mPDF.

## Recommended Official PDF Design Direction

Formal, quiet, Arabic-first, and printable in grayscale. Keep the current letterhead artwork as the only logo and the only contact block. One title style under it, one metadata row, one table style, charts only when a print test shows they stay sharp, and signatures kept with their labels. No screen cards, gradients, or a second painted identity. Do not invent a Hijri date, QR, or HTML address line until those values exist outside the JPEG.

## PDF Redesign Priority

1. One association name, taken from the letterhead, with no second name in the body.
2. One Arabic font setup, without mid-line font swaps.
3. A short page footer on the governance report so it clears the footer artwork.
4. Replace any governance chart that fails Arabic or pie rendering; keep the data table.
5. Move the three standalone templates onto the shared Blade shell.
6. One metadata row and one table style.
7. Keep signature blocks from splitting.
8. Align PDF colors with the app tokens after the letterhead is stable.

Full inventory, frame spec, and component map: `11_PDF_REPORT_DESIGN_AUDIT.md`.

## Recommended implementation order

1. Design tokens (consolidate; do not invent a new palette).
2. Typography scale in `index.css`.
3. Global RTL rules and logical properties.
4. Application shell (`MainLayout`).
5. Sidebar labels and active state.
6. Header / `PageHeader`.
7. Core components already in `components/ui`.
8. Forms (`FormField`, `FormSection`).
9. Tables (`DataTable`).
10. Dashboard components (`KpiCard`).
11. Major workflows (beneficiary, users, reports).
12. Remaining pages.
13. Responsive table and dialog behavior.
14. Accessibility validation.
15. Visual regression review.

Adjustments: do not relabel «جهات المستفيد» until that product decision exists. Do not fold driver access into `MainLayout`. Do not delete unrouted files in the first implementation pass; stop importing them.
