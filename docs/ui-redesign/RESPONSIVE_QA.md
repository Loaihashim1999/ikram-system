# Responsive QA

Desktop-first. Checked by CSS and one rendered login viewport of 1366×768.

| Width | Result |
| --- | --- |
| Desktop, 1024px and up | Shell, page header, and full tables stay in the normal table layout. Login shows the form and the green brand panel together. |
| Tablet and below, under 1024px | `.ikram-table` minimum width is removed. Header cells wrap instead of staying on one line. |
| Mobile, under 768px | Unified beneficiary rows stack in `DataTable`. The login brand panel is hidden so the form uses the width. Auth pages use one column. |

Not every one of the 33 routes was opened at 1440, 1280, 1024, 768, 430, and 390. The rules above are global, so they apply to every screen inside `.ikram-app`. Lists that are still raw tables wrap; they do not yet become stacked cards except the unified beneficiary list.
