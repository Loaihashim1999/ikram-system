# IKRAM PDF finalization audit

Date: 2026-09-23  
Scope: existing production PDF generators, routes, templates, download controls and tests. Governance feature expansion is excluded.

## Runtime and shared foundation

All server PDFs use mPDF through `PdfExportController::createMpdf()`, UTF-8, A4, automatic Arabic script/font selection and a private `storage/app/mpdf` cache directory. Templates use local `public/assets/11.jpeg`, `33.jpeg` or `ekram-letterhead.jpeg`; no PDF template references a remote font or image. Blade escaped output is used for user text. Existing templates request `xbriyaz`, `tajawal` and `cairo` without shipping those fonts; mPDF falls back through automatic language fonts and DejaVu Sans. The final implementation must make the selected local Arabic font explicit and deployment-independent.

All routed outputs are inside `auth:sanctum` plus `ModulePermission`. The middleware maps each document domain independently and requires `issue_document`; report routes require governance view access. Daily documents map only to `daily_beneficiaries`; permanent-beneficiary documents map to beneficiary/delivery permissions.

## Inventory

| PDF name | Domain | Route/API | Controller / template | Authoritative data source | Permission | Arabic / RTL | Pagination | Sensitive data | Test status | Current defects | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Beneficiary card | Permanent beneficiary / policy | No route at audit start | `exportBeneficiaryCard` / `pdf.beneficiary_card` | Beneficiary current row | No reachable endpoint | Shared RTL letterhead | Shared layout | National ID, phone and mutable financial fields | None | Orphaned generator; mutable current finance instead of immutable evaluation; no policy version/decision; no endpoint permission | MISSING |
| Individual receipt | Legacy permanent distribution | `GET /api/documents/individual-receipt/{id}/pdf` and compatibility alias `/receipt/{id}/pdf` | `exportIndividualReceipt` / `pdf.individual_receipt` | Historical `Distribution`, beneficiary and basket | delivery `issue_document`; admin allowed | Shared RTL letterhead | Table header available; no footer | National ID/phone; legacy barcode printed | Signature-only test | Prints active-looking legacy receipt secret; unsafe data-derived filename; no explicit no-store/header tests | DEFECT |
| Beneficiary distribution history | Permanent beneficiary | `GET /api/documents/total-delivery/{id}/pdf` | `exportTotalDelivery` / `pdf.total_delivery` | Historical `Distribution` rows and basket relation | beneficiaries `issue_document`; admin allowed | Shared RTL letterhead | Repeatable table header; no footer | National ID; legacy barcodes printed | None | Legacy codes printed; filename contains national ID; no multi-page test | DEFECT |
| Neighborhood representative receipt | Representative | `GET /api/documents/rep-receipt/{id}/pdf` | `exportRepresentativeReceipt` / `pdf.representative_receipt` | Representative plus beneficiaries selected by district/city | representatives `issue_document`; admin allowed | Shared RTL letterhead | Repeatable table header; no footer | Representative and beneficiary identity/contact/address | None | Broad `LIKE` association can include false matches; raw district in filename; no multi-page/authorization tests | DEFECT |
| Staff receipt/history | Staff | `GET /api/documents/staff-receipt/{id}/pdf` | `exportStaffReceipt` / `pdf.staff_receipt` | Staff, dependents, staff distributions and baskets | staff `issue_document`; admin allowed | Shared RTL letterhead | Repeatable table header; no footer | Staff identity/contact; legacy barcode printed | None | Legacy codes printed; filename contains national ID; no multi-page/authorization tests | DEFECT |
| Daily receiving voucher | Daily beneficiary | `GET /api/documents/daily-receiving/{id}/pdf` | `exportDailyReceivingVoucher` / `pdf.daily_receiving_voucher` | Immutable receiving transaction, daily beneficiary, daily inventory item and actor | daily beneficiaries `issue_document`; admin allowed | Shared RTL letterhead | Single voucher | National ID/phone and escaped notes | UI links exist; no structural test | Unsafe document number in filename; missing no-store/footer; no IDOR/HTML test | DEFECT |
| Daily operations report | Daily inventory/report | `GET /api/reports/daily/pdf` | `exportDailyReport` / `pdf.daily_report` | Daily receiving transactions and daily movements; separate general-delivery count | governance view; admin allowed | Standalone RTL landscape | Table headers; no configured page footer | National IDs appear in detailed daily table | UI link exists; no structural test | Unvalidated date; missing page footer/no-store; insufficient multi-page validation | DEFECT |
| Comprehensive governance report | Governance / reports | `GET /api/reports/comprehensive/pdf` | `exportWeeklyComprehensiveReport` / `pdf.weekly_comprehensive_report` | `GovernanceReportService` | governance view; admin allowed | RTL, local frame | Multi-page with numbered footer | Export dataset excludes credentials/banking/document paths | Signature test and stored inspection artifact | Existing report belongs to later governance finalization; only shared PDF safety/headers and compatibility may be repaired here | COVERED / GOVERNANCE DEFERRED |

## Download and UI paths

Daily and governance pages use `getDocumentPdfUrl`; audit, representative, staff and receipt modal links still construct environment URLs directly. The global document-download interceptor converts same-origin API document/report links into authenticated blob downloads and rejects other origins. No PDF-related UI behavior needs redesign for this phase; endpoint acceptance is more reliable than browser PDF rendering.

## Confirmed defects to repair

1. Centralize PDF response creation with safe ASCII filenames, `application/pdf`, private/no-store caching, and no user-controlled header fragments.
2. Configure an explicit bundled local Arabic font and collision-safe private mPDF temp directory; never fetch fonts or images remotely.
3. Add stable header/footer/page numbering to operational documents and repeat table headers across pages.
4. Remove legacy barcode/receipt codes from newly generated active documents while retaining historical distribution status and dates.
5. Make the existing beneficiary-card generator reachable under beneficiary document authorization and source policy fields from the latest immutable completed evaluation, its historical version and its own decision record. Do not recompute policy history.
6. Validate daily-report dates and keep daily/general inventory datasets separate.
7. Replace representative substring matching with exact district/city matching to prevent unrelated beneficiary disclosure.
8. Add structural, authorization, privacy, long-content, multi-page, empty-data, concurrency and PostgreSQL persistence tests.

## Deferred / not required

- No new support-distribution voucher exists in the current product. Creating one would be a new product contract, so it is not introduced here. Existing legacy distribution and daily receiving vouchers remain the applicable support documents.
- No driver-facing PDF exists or is required by the current temporary-link workflow.
- Governance report content and metrics remain for Governance / Reports Finalization. This phase only preserves its existing route and applies shared PDF safety fixes.
- No live Taqnyat resource is required or contacted.
