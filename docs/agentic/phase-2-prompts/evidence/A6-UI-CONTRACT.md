# A4 beneficiary contract

Source: A6 on 2026-10-05. Backend tests passed. Do not guess extra fields.

## Writes

Send `nationality` (required, trimmed, max 100). Exact `سعودي` stores `beneficiary_type=citizen`. Any other non-empty value stores `resident`. Do not send a disagreeing `beneficiary_type` or `type`.

`reviewed_confirmation` must be accepted on permanent create, daily create, smart-import confirm, and any update that changes nationality. Daily has no `confirmed_at`.

## Unified list

`GET /api/beneficiaries/unified` filters combine with AND: `beneficiary_type` (`citizen` or `resident`), `district`, `family_status`, `nationality`, `nationality_missing=1`, `search`, `tab` (`all`, `permanent`, `daily`), `sort` (`full_name`, `created_at`, `district`, `beneficiary_type`, `completed_receipt_count`, `latest_completed_at`), `direction`, `page`, `per_page`.

Each row includes `id`, `source`, `full_name`, `beneficiary_type`, `phone`, `address`, `district`, `family_status`, `nationality`, `created_at`, `completed_receipt_count`, and `latest_completed_receipt` (`id`, `completed_at`, `summary`) or null. `source` is `permanent` or `daily`. Daily `address` and `family_status` are null.

## Import

Preview: `POST /api/smart-import/beneficiaries/preview` with `target` (`permanent` or `daily`) and `file`. Writes nothing.

Confirm: `POST /api/smart-import/beneficiaries` with `target`, `reviewed_confirmation`, `file`, `mapping`, and optional `sheet`. Returns `created`, `skipped`, `failed`, `total`, `errors`, and `message`.

Place the entry on the beneficiary management page. Do not run support or communications from that action.
