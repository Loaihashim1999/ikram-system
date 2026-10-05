# Accessibility QA

Target remains WCAG 2.2 AA for shared controls.

## Fixed in shared components

- Visible focus stays on the gold focus ring from Phase 2.
- Required fields in `FormField` expose the word «مطلوب» to assistive technology. The asterisk is hidden from it.
- Form and page errors use `role="alert"`.
- Confirmation dialogs name their title and message.
- The login password control has an accessible name and is in the tab order.
- Password recovery fields have visible labels.
- Dashboard sections are buttons.
- The beneficiary dependent delete control has an accessible name.
- Each governance chart has a data table with the same numbers.

## Exceptions

- Raw operational tables are still tables, not stacked cards, so a small screen wraps text rather than offering a separate mobile summary.
- On-screen chart color is reinforced by the table, not by a pattern fill.
- Role-by-role keyboard passes were not executed in the browser for every route.
