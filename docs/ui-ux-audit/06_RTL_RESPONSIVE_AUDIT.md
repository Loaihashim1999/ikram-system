# RTL, Arabic, and responsive audit

The SPA sets `dir="rtl"` on `body`, `MainLayout`, and the sidebar. IBM Plex Sans Arabic is the UI font. Logical CSS is only partly adopted: the shell still uses physical `lg:mr-72` and `right-0` for the sidebar, which is correct for a right sidebar and will break if `dir` is ever flipped on an ancestor.

## RTL

| Surface | State |
| --- | --- |
| Sidebar | Fixed `right-0`, drawer uses `translate-x-full` when closed. Works in RTL |
| Top bar | In the document flow under the RTL root |
| Forms | Labels and inputs inherit RTL. Mixed English IDs and Arabic names in one field need `dir` on the value, which is inconsistent |
| Tables | `text-right`. Horizontal scroll is the failure mode, not column order |
| Pagination | Component exists; chevrons must be checked for physical left/right during implementation |
| Breadcrumbs | None (H4) |
| Icons | `ArrowLeft` and similar are not auto-mirrored (C6) |
| Active nav | Gold bar on the outer edge via `inset -3px 0` (C6) |
| Charts | Custom div bars in `GovernanceCharts.jsx`. Axis direction is physical and not documented |
| Numbers and dates | No shared `tabular-nums` or Arabic-Indic digit policy. Latin digits are acceptable if consistent |
| Mixed text | National IDs, IBANs, and phone numbers inside Arabic sentences need isolation so they do not reorder |
| Truncation | `whitespace-nowrap` on table cells clips Arabic phrases |
| Driver access | Separate CSS file. Must be checked against the same tokens (H6) without joining the admin shell |

Do not fix RTL with per-page CSS. Use logical properties and the shared components.

## Breakpoints

`index.css` has a single custom breakpoint at 767px. Tailwind `sm` / `md` / `lg` are used in the shell (`lg` shows the sidebar). There is no tablet-specific table layout.

| Viewport | Risk |
| --- | --- |
| Large desktop | `max-w-7xl` leaves empty margin. Acceptable |
| Desktop | Primary target. Shell is usable |
| Tablet | Sidebar becomes a drawer under `lg`. Tables still `min-width: 36rem` to `680px`, so the content pane scrolls horizontally (C4) |
| Mobile | Auth brand panel stacks. Dialogs use large radius and padding; long forms can exceed the viewport. Touch targets on `.ikram-btn` are 44px; legacy `text-xs` row buttons are smaller |

Charts on governance are the first block to overflow on a narrow pane. Modals (`Dialog.jsx`, receipt and QR modals) need a max-height and internal scroll in the implementation phase. This audit did not resize a browser; the findings come from the CSS min-widths and fixed sidebar.
