# Data tables

`DataTable` is the canonical list. Raw `<table>` pages stay until Phase 3 (audit H2).

## Behavior

- RTL, right-aligned text.
- `col.numeric` isolates amounts with `.ikram-numeric`.
- Sortable headers set `aria-sort`.
- Loading, empty, and error states are inside the component.
- Pagination stays in `TablePagination`.
- `col.stack === false` hides that column in the narrow layout.

## Narrow screens

Below 768px the table is not shown. The same rows render as stacked label/value pairs. This replaces the old minimum-width scroll for `DataTable` only. Legacy `.ikram-table` still has a minimum width until those pages move over.

Do not add another horizontal-scroll wrapper as the only mobile treatment for a new list.
