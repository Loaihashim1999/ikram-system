# Accessibility baseline

Target: WCAG 2.2 AA for shared components. Page-level gaps remain until Phase 3.

- Focus: `:focus-visible` outline in brand gold, plus `--focus-ring` on controls.
- Contrast: ink `#1C1915` on paper `#F3EFE6`, white on `#1F4D3A`, success `#146C43` on `#E7F5EE`.
- Icon-only actions use `IconButton` with an accessible name (audit C8).
- Form errors use `role="alert"` and `aria-describedby` via `FormField`.
- Dialogs use `role="dialog"`, `aria-modal`, a labelled title, Escape, and return focus to the previously focused element.
- Tables use `scope="col"` on `DataTable` headers.
- Charts must include a data table through `ChartFrame`. Do not rely on color alone.
- Status is text plus a tone, not color alone.
