# POLICY-G Final Beneficiary Policy Engine Acceptance Report

Date: 2026-09-23  
Verdict: **POLICY-G VERIFIED — BENEFICIARY POLICY ENGINE ACCEPTED**

## Acceptance evidence

- Backend: 426 total; 424 passed; 2 expected PostgreSQL-only checks skipped on SQLite; 0 failed; 1,994 assertions. The default suite now includes `tests/Acceptance`.
- PostgreSQL: 287/287 passed; 1,560 assertions; 0 failures on the guarded local `ikram_phase2a_qa` target. Coverage includes A–F lifecycle, JSONB/numeric persistence, FKs, CHECK/unique constraints, D workflow, E execution and F query/export.
- Concurrency: Phase 2A two-process reservation PASS with a real lock wait and no over-reservation. POLICY-E two-process execution PASS with a real lock wait, one stable conflict, one run-item evaluation and exactly one new evaluation.
- Frontend: 16/16 test files; 64/64 tests; ESLint clean; Vite production build successful.
- Browser: POLICY-D 47/47, POLICY-E 34/34, POLICY-F 15/15. Every gate used the isolated real local API and reported `UNEXPECTED_REMOTE_REQUESTS = 0`.
- Responsive: POLICY-D, POLICY-E and POLICY-F passed at 360, 390 and 430 pixels with RTL, reachable controls, usable filters/tables/pagination and no page-level horizontal overflow.
- Excel: valid XLSX workbooks inspected programmatically for ALL, PERMANENT and DAILY; active filters and complete row counts verified beyond the visible page; Arabic headers/content retained; registration dates are numeric Excel dates; passwords, tokens, hashes, receipt/driver secrets, binaries, medical content, IBAN and identity/contact columns are absent.
- Authorization/history: guest/no-permission denial, independent narrow permissions, admin access, evaluation-scoped evidence, run permissions and tab/export permissions are covered. Existing input, financial and scoring snapshots, categories, scores, outcomes and `PolicyDecision` history remain unchanged across later actions.
- Resident/inventory regression: citizen policy remains isolated; resident `not_applicable`, Second Degree and `need_level` behavior are preserved. Daily Beneficiary Inventory and General Warehouse remain independent; Phase 2A reservation behavior remains intact.

## Defects found and fixes applied

1. User-controlled XLSX text beginning with `=` was emitted as a formula. Export now writes every user-controlled value with explicit string typing and writes registration dates as numeric date cells. Regression coverage includes formula-prefixed input.
2. POLICY-E run history caused page-level horizontal overflow on mobile. The table now uses its own horizontal overflow container; real 360/390/430 browser checks pass.
3. POLICY-A/C PostgreSQL rollback probes assumed no later dependent migrations. They now roll back and reapply the complete seven-migration A–E chain in dependency order.
4. High-value controller authorization/IDOR acceptance tests were outside the default PHPUnit suite. `tests/Acceptance` is now included automatically.

## Remaining risk

The complete XLSX export is intentionally materialized through PhpSpreadsheet to satisfy full-dataset export. Very large authorized result sets may require a future streaming-writer threshold; current query execution is one server-side filtered union without per-row database queries, and no failure was demonstrated in this acceptance scope.

Phase 2C, notification coverage, PDF finalization, Governance, full-system acceptance and Azure work were not started. No commit, push or deployment was performed.
