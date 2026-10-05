# IKRAM PDF finalization report

Date: 2026-09-24  
Scope: PDF Finalization only. Governance content, live Taqnyat, full-system acceptance and deployment were not started.

## Implemented

- Audited all nine existing PDF routes/generators and recorded the pre-change inventory in `PDF_FINALIZATION_AUDIT.md`.
- Added the authorized beneficiary-card endpoint and retained independent permanent, daily, staff, representative, delivery and governance permissions through `ModulePermission`.
- Centralized streamed PDF responses with fixed ASCII filenames, `application/pdf`, `private, no-store`, `nosniff`, and no user-controlled `Content-Disposition` fragments.
- Configured mPDF for A4, a private `storage/app/mpdf` cache, bundled `dejavusanscondensed`, local-only assets, and direct odd/even-safe repeated organization headers, footers and page numbers. No runtime font/image download or developer absolute path is used.
- Added local bounded header/footer crops derived from the existing approved association letterhead. Large tables repeat headings, preserve readable row sizes and wrap long content.
- Changed the beneficiary policy document to read the latest completed immutable `BeneficiaryPolicyEvaluation`, its historical policy version and its own `PolicyDecision`; current mutable salary cannot replace the stored financial snapshot. Income and score categories remain distinct.
- Removed operational legacy receipt/barcode secrets from generated receipts while preserving historical support dates, basket names and delivery statuses.
- Replaced representative substring matching with exact district/city matching, validated daily report dates, sanitized daily user text, and preserved Daily Inventory versus General Warehouse separation.
- PDF failures now return a sanitized error response instead of falling back to printable raw HTML.

## Privacy and historical rules

National ID and phone remain only in the existing authorized operational documents that require recipient identification. Passwords, tokens, provider credentials, receipt verification secrets, internal storage paths and legacy barcodes are absent from acceptance outputs. All images/fonts are local; source templates contain no remote resource URL. Historical policy values are loaded from persisted evaluation and decision records and are never recomputed.

## Acceptance evidence

Representative PDFs:

- `output/pdf/beneficiary-policy.pdf`
- `output/pdf/support-voucher.pdf`
- `output/pdf/daily-pickup.pdf`
- `output/pdf/multi-page-history.pdf`

Rendered visual evidence is under `tmp/pdf-finalization-render/`. The final inspection covered the beneficiary policy card, support voucher, daily pickup voucher and every page of the three-page 86-row history. Arabic is connected and RTL, mixed Arabic/English is readable, table headings repeat, first/final rows are present, headers/footers repeat, page numbers are correct, and no content overlaps or clips.

No PDF-related frontend control changed, so no new browser automation gate was necessary. Existing authenticated blob-download routing and permission coverage were reused. PDF generation referenced local assets only, sanitized the injected remote-image fixture, and produced `UNEXPECTED_REMOTE_REQUESTS = 0`.

## Verification

- Targeted PDF suite: **6 passed / 161 assertions**.
- Guarded local PostgreSQL QA (`pgsql`, `127.0.0.1:5432`, `ikram_phase2a_qa`): **6 passed / 161 assertions**; immutable policy history, authorization, structural output and inventory separation passed on real PostgreSQL.
- Phase 2A / Phase 2B / POLICY-G / Notification Coverage targeted regression: **103 tests; 102 passed, 1 skipped / 561 assertions**.
- Frontend: **16 test files, 64 tests passed**; ESLint passed; Vite production build passed.
- Full backend regression, run once: **448 tests; 446 passed, 2 skipped / 2240 assertions**. The subsequent visual-only mPDF header placement correction was revalidated by both targeted PDF suites above.
- Pint: passed on changed PHP files.
- Structural validation: all four evidence files are valid A4 PDFs, exceed 5 KB, extract expected text, and contain none of the tested forbidden secret/path markers. The long history is three pages.
- `git diff --check`: passed (line-ending notices only).

## Remaining risks and blockers

No PDF-finalization blocker remains. Governance report content and metrics remain intentionally deferred to Governance / Reports Finalization. Live Taqnyat readiness remains deferred and was not required. No commit, push or deployment occurred.

**PDF FINALIZATION VERIFIED — READY FOR GOVERNANCE FINALIZATION**
