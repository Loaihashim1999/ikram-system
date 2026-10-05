# Design system gaps

Tokens already live in `frontend/src/index.css` (`:root` and `.ikram-*`). The gap is drift away from those tokens, not a missing brand.

## Typography

- Body: IBM Plex Sans Arabic, 16px, line-height 1.6 (`body` in `index.css`).
- Page title: `.ikram-masthead h1` uses `clamp(1.45rem, 2vw, 2rem)`, weight 700.
- Section title: `.ikram-section-title` is `text-sm font-extrabold`. Global `main h2` is `1.05rem` weight 700.
- Tables: `.ikram-table th` is extrabold; a later rule sets `thead th` to 0.75rem weight 700.
- Labels: `.ikram-label` is `text-xs font-bold`. Record labels in `.ikram-record` are `text-sm`.
- Buttons: `.ikram-btn` is `text-sm font-bold`.

Inconsistencies: extrabold and 700 are both used for headings. Table header size is defined twice. Helper text is `text-xs` in some fields and absent in others.

## Colors

| Token | Value | Role |
| --- | --- | --- |
| `--color-brand-green` | `#1F4D3A` | primary, also `--color-success` and `--color-action-amber` |
| `--color-brand-green-hover` | `#14352C` | hover and `--color-nav` |
| `--color-brand-gold` | `#A6843D` | focus, active mark, scrollbar |
| `--color-bg-page` | `#F3EFE6` | page |
| `--color-bg-soft` | `#F7F3EA` | soft fill |
| `--color-surface` | `#FFFDF8` | panels |
| `--color-border` | `#E4DDD0` | borders |
| `--color-text-primary` | `#1C1915` | text |
| `--color-text-secondary` | `#3A342C` | secondary |
| `--color-text-muted` | `#5C564C` | muted |
| `--color-info` | `#1D4E89` | info |
| `--color-warning` | `#8A5A12` | warning |
| `--color-danger` | `#9B2C2C` | danger |

Findings:

- Success and primary are the same color (M1 / H3). A “success” badge looks like a primary button.
- `--color-action-amber` is green, so the token name lies.
- Table head uses `#EFE8D8` instead of `--color-bg-soft` (`index.css` thead rule).
- Nav hover and active use raw `rgb(255 253 248 / …)` instead of a token.

## Spacing

- Page: `--space-page: 1.25rem`, shell padding `px-3 py-4` up to `lg:px-8 lg:py-6`, content `space-y-5`.
- Panel header `px-4 py-3`. Controls `px-3 py-2`. Form grid `gap-4`.
- Auth card padding differs (`2rem 1.5rem`).

Values are mostly the Tailwind 4px scale. The drift is page-level `space-y-*` chosen ad hoc in large pages such as `BeneficiaryList.jsx` and `StaffListPage.jsx`.

## Borders and radius

- Token radii: `--radius-control: 0.75rem`, `--radius-panel: 1rem`.
- Dialogs, forced panels, and auth cards use `1.15rem` and `1.25rem`.
- Nav links use `border-radius: 10px`.
- Buttons and inputs share the control radius. Good.
- Borders are almost all `1px` `--color-border`. Danger outline uses the danger color. Good.

## Shadows

- `--shadow-panel: 0 8px 24px rgb(20 53 44 / 0.06)`.
- Auth card: `0 18px 40px rgb(20 53 44 / 0.07)`.
- Dialog: `0 24px 60px rgb(20 53 44 / 0.18)`.
- Forced panel rule later sets `0 1px 2px rgb(28 25 21 / 0.04)`, which overrides the panel token inside `main`.

Three elevations would be enough: rest, overlay, dialog. Today the panel token and the forced rule disagree.

## Icons

- Library: lucide-react.
- Sizes in use: 16, 20, and 24 (`w-4`, `w-6`, `w-7`, `size={20}`).
- `Truck` is reused for الاستلام المباشر and إدارة وتوصيل المنازل (`Sidebar.jsx`).
- `ArrowLeft` on the dashboard points physically left in an RTL interface (C6).
- Gold scrollbar (`index.css`) is decorative and not an icon issue, but it competes with the focus gold.

## UI / UX design debt

| Debt | Where |
| --- | --- |
| Hard-coded color | `#EFE8D8` thead; white/10 mixes in `Sidebar.jsx` |
| Hard-coded radius and shadow | dialog, auth card, forced panel rule in `index.css` |
| Duplicate list pages | `BeneficiaryList.jsx` vs `UnifiedBeneficiaryPage.jsx`; `StaffListPage.jsx` still raw `<table>` |
| Duplicate delivery pages | `DeliveryPage.jsx`, `DistributionPage.jsx`, `SendSupportPage.jsx` unmounted; live UI is `HomeDeliveryPage.jsx` |
| Duplicate statistics | `Statistics.jsx`, `StatisticsPage.jsx` unmounted; live UI is `GovernancePage.jsx` |
| Duplicate settings | `Settings.jsx` unmounted; live UI is `SystemSettingsPage.jsx` |
| Two toasts | `react-hot-toast` and `components/ui/Toast.jsx` |
| Inline table markup | `Users.jsx`, `Warehouse.jsx`, `DriversDirectoryPage.jsx`, `AddBeneficiaryPage.jsx`, `SmartExcelImport.jsx` |
| Second stylesheet | `driver-access.css` |
| Print system | `resources/views/pdf/*.blade.php` does not consume SPA tokens |
