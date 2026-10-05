# Accessibility audit

Target: WCAG 2.2 AA where the source shows a clear gap. This is a code audit, not a screen-reader session.

Severity in this file uses Critical, High, Medium, Low. IDs match the summary.

## Critical

### C7 — charts

`GovernanceCharts.jsx` draws columns, a line, a funnel, and a pie with divs and lucide icons. There is no `<table>` alternative, no `aria-label` on the graphic, and no visually hidden data summary. Color is the only encoding for several series.

### C8 — icon-only actions

The sidebar close button has `aria-label="إغلاق القائمة"`. Row actions, QR, and export icons on list pages often pass a lucide icon with no accessible name. Screen-reader users get an unlabeled button.

## High

- Permission grids in `Users.jsx` are dense checkbox tables. Headers must stay associated with cells when that screen is restyled. Do not flatten the matrix into unlabeled switches.
- Error text from 422 responses is not always tied to the input with `aria-describedby` (`FormField` is the place to do that once).
- `ConfirmDialog` exists. Destructive buttons that skip it (H5) also skip a clear accessible name for the consequence.
- Dashboard `ArrowLeft` is a link-shaped control whose direction is wrong in RTL (C6), so the affordance is misleading.

## Medium

- Heading levels: `.ikram-masthead h1` and `main h2` are styled globally. Pages that skip `h1` or jump to styled `div`s break the outline. `PageHeader` should be the only `h1`.
- Contrast: body text `#1C1915` on `#F3EFE6` and white on `#1F4D3A` are strong. Muted `#5C564C` on the page background is the pair to re-check for `text-xs`. Gold `#A6843D` as text on cream is weaker than gold as a thick focus ring. The focus ring is `outline: 2px solid` gold plus a second box-shadow on controls; visible, slightly doubled.
- `:focus-visible` uses `!important`, which fights component focus styles.
- Tables that are layout tables inside forms (`AddBeneficiaryPage.jsx` family rows) lack captions.
- `Scrim` closes the drawer. Focus should move to the drawer and return to the menu button. Verify in implementation; the component does not document a focus trap.
- Live regions: toasts may not use `aria-live` consistently across the two toast systems (M2).

## Low

- `html` hides overflow-x, which can clip a focused control at the edge instead of scrolling it into view.
- Reduced motion is respected globally. Good.
- `#sentry-test-error-btn { display: none !important; }` hides a test control. Leave it hidden.

## Classification rollup

| Level | IDs in this audit |
| --- | --- |
| Critical | C7, C8 (C1–C6 are product and layout; they are P0 in the roadmap and not all accessibility defects) |
| High | unlabeled form errors, permission table semantics, destructive actions without a named dialog |
| Medium | heading skips, muted/gold contrast check, focus ring doubled, missing captions, drawer focus |
| Low | overflow clipping, sentry button |

Buttons versus links: navigation uses `NavLink`. Actions use `<button>` in the shared `Button`. Legacy pages sometimes use clickable `div`s; treat that as High when those files are brought back, and ignore it while they stay unmounted.
