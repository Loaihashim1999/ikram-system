# Nationality chart contract for A4

Source: A11, 2026-10-05. Read `nationality_analysis` from the governance analytics response. Do not invent counts.

- `domain`: `all`, `permanent`, or `daily`
- `period.start_date`, `period.end_date`
- `missing`: key `missing`, label `غير مسجلة`
- `populations.registered`, `populations.active`, `populations.served`
- Each population has `label`, `total`, `period_filtered`, `date_field`, and `buckets`
- `chart.categories` is `{ key, label }` with `غير مسجلة` last
- `chart.series` is `{ key, label, data }` for `registered`, `active`, and `served`
- Each `data` array lines up with `categories`, and its sum equals that population `total`

Labels: `مسجلون`, `نشطون`, `مخدومون`.
