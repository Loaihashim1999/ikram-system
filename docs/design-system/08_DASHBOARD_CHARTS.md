# Dashboard and charts

The dashboard page is not redesigned here. `KpiCard` is the metric pattern: title, value, short subtitle. No 3rem numerals and no extra shadow on hover.

## Web charts

There is no chart library. Governance still uses custom markup in `GovernanceCharts.jsx`. New charts use `ChartFrame`: a title, the graphic, and a visible table of the same numbers. That is the accessible alternative the audit required (C7).

Do not add a chart dependency until a print and screen proof shows the custom markup cannot carry labels. Column, line, funnel, and pie can all be a table plus a bar. A library is not required for that.

## PDF charts

Governance PDF charts no longer use SVG text or a dash-array pie. They are tables, with a proportional bar only where the label is HTML text. See `09_PDF_DESIGN_SYSTEM.md`.
