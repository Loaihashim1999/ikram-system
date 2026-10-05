# A6 — Beneficiaries and Import

## 1. Objective

Implement nationality-driven registration, list data, filters, and in-page import for permanent and daily beneficiaries.

## 2. Required references

- [COMMON_RULES.md](COMMON_RULES.md) requirements R-BEN-01, R-BEN-02, R-BEN-03, R-IMP-01
- `evidence/A2-CONTRACTS.md`
- Existing importer and registration services named by A1

## 3. Dependencies

A2 contract and A5 permission keys. UI presentation is handed to A4. Shared routes and migrations go through A3.

## 4. Assigned files

A0 assigns beneficiary services, requests, and focused tests after the map. A6 does not edit dashboard or shared support pages.

## 5. Allowed changes

Registration validation, classification derivation, list query contracts, and import confirmation behavior on assigned files.

## 6. Explicit exclusions

No silent Saudi default. No silent overwrite. No eligibility, support, or communication side effect during import. No change to historical evaluations or receipts.

## 7. Detailed requirements

Follow R-BEN-01 through R-IMP-01. Reuse the existing importer. Preview, validate, handle duplicates, require explicit confirmation, and report accurate results. Completed-receipt counts and latest receipt data come from authoritative completed receipts.

## 8. Acceptance criteria

Saudi and non-Saudi fixtures derive the correct classification. A missing nationality fails validation. Import without confirmation writes nothing. List aggregates are not per-row queries.

## 9. Relevant verification

Targeted PHPUnit on isolated SQLite. Guarded PostgreSQL only if A3 schedules a database-specific aggregate check.

## 10. Handoff format

Use the common report block. Give A4 the field list, filter parameters, and import response shape.
