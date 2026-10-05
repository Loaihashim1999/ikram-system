# PDF report and association branding audit

Audit date: 2026-10-05. No PDF template, controller, or asset was changed.

Official contact lines, the registration number, and the English wordmark are painted into the letterhead JPEGs. They are not stored as editable settings. This audit does not retype those strings. A later template must copy them from the approved artwork or from settings after the association confirms the text.

`docs/architecture/15_DOCUMENT_PDF_ARCHITECTURE.md` is older than the controller. Margins, governance orientation, the beneficiary-card barcode, and several endpoint paths in that document do not match `PdfExportController`. Use the controller and the Blade files below.

## 1. Current PDF technology

| Piece | What the code uses |
| --- | --- |
| Generator | mPDF 8 (`mpdf/mpdf` ^8.3) in `app/Http/Controllers/PdfExportController.php` |
| Templates | Blade under `resources/views/pdf/` |
| Excel sibling | PhpSpreadsheet on `GET /api/reports/comprehensive/excel` |
| Installed and unused | `barryvdh/laravel-dompdf` is in `composer.json`. No application PDF calls `Pdf::loadView` |
| Font | `default_font` `dejavusanscondensed`, `mode` utf-8, `autoScriptToLang` and `autoLangToFont` enabled |
| Page | A4. Portrait unless noted. Margins 12mm left and right. Top and bottom margins are the letterhead image height plus 2mm and 8mm |
| Temp | `storage/app/mpdf` |

Every PDF from this controller calls `createMpdf()`, which requires both letterhead images and stamps them on odd and even pages.

## 2. Current PDF templates

| Blade | Role |
| --- | --- |
| `letterhead_template.blade.php` | Shared HTML shell for six documents. CSS only. It does not draw the logo |
| `beneficiary_card.blade.php` | Extends the shell |
| `individual_receipt.blade.php` | Extends the shell |
| `total_delivery.blade.php` | Extends the shell |
| `representative_receipt.blade.php` | Extends the shell |
| `staff_receipt.blade.php` | Extends the shell |
| `daily_receiving_voucher.blade.php` | Extends the shell |
| `support_proof.blade.php` | Standalone HTML |
| `daily_report.blade.php` | Standalone HTML, landscape |
| `weekly_comprehensive_report.blade.php` | Standalone HTML, landscape, multi-page |
| `report_bar_chart.blade.php` | Partial included by the governance report |

Assets, required at runtime:

- `public/assets/pdf-letterhead-header.jpg`
- `public/assets/pdf-letterhead-footer.jpg`

The React logo (`frontend/src/assets/logo.png`) is not used in PDFs.

## 3. Reports producing PDFs

All routes are in `routes/api.php` and implemented on `PdfExportController`.

| Document | Route | Orientation | Range |
| --- | --- | --- | --- |
| Support proof / handover receipt | `GET /api/support/distributions/{id}/proof` | Portrait | One receipt |
| Beneficiary card | `GET /api/documents/beneficiary/{id}/pdf` | Portrait | One beneficiary, including last policy evaluation |
| Individual receipt | `GET /api/documents/individual-receipt/{id}/pdf` and `/documents/receipt/{id}/pdf` | Portrait | One distribution |
| Distribution history | `GET /api/documents/total-delivery/{id}/pdf` | Portrait | All distributions for one beneficiary |
| Representative receipt | `GET /api/documents/rep-receipt/{id}/pdf` | Portrait | One neighborhood representative |
| Staff receipt | `GET /api/documents/staff-receipt/{id}/pdf` | Portrait | One staff member |
| Daily receiving voucher | `GET /api/documents/daily-receiving/{id}/pdf` | Portrait | One daily transaction |
| Daily operations report | `GET /api/reports/daily/pdf` | Landscape | One Gregorian date, default today |
| Governance report | `GET /api/reports/comprehensive/pdf` | Landscape | Date range from `GovernanceReportService` |

There is no separate finance-only PDF. Finance totals are sections inside the governance report. The governance Excel file is the raw export and has no letterhead.

Charts exist only in the governance PDF: column, line, funnel, pie, and bar includes. The screen charts in `GovernanceCharts.jsx` are not exported.

## 4. Current association branding usage

The visual identity on every PDF is the header JPEG, full page width, plus the footer JPEG. `createMpdf()` scales each image to the page width and sets the height from the file’s aspect ratio, so the bitmap is not stretched by a mismatched height attribute.

The header artwork contains the logo, the Arabic legal name, the Latin word EKRAM, a national-center line, and a registration number. The footer artwork contains the headquarters line, postal information, email, and phone numbers.

Body copy does not read `settings.organization_name`, `settings.system_name`, or `communications.association_name`. Those settings exist. The PDF text is hardcoded, and it does not match one name:

| Wording in source | Where |
| --- | --- |
| جمعية إكرام الجود لخدمة ضيوف الرحمن | `support_proof`, governance report, staff receipt, individual receipt |
| جمعية إكرام لحفظ الطعام | `daily_report`, `daily_receiving_voucher` |
| جمعية إكرام | Default `<title>` in `letterhead_template`; SMS setting default in `MessageTemplates` |

English appears as the word EKRAM inside the header image, and as the Excel cover title `IKRAM Governance report`. There is no English association name in settings.

## 5. Association frame problems

There is no reusable Association Frame component. The frame is a pair of bitmaps applied in PHP, while each Blade file repeats its own title block.

- Six documents share `letterhead_template`. Three documents ignore it and ship a full HTML document.
- The photographic header and footer are not a border around the content. Side margins stay 12mm, and the images use a negative left margin so they bleed to the page edge.
- Identity is printed twice: once in the JPEG and again as a text line in several bodies.
- The daily report and the daily voucher use a different Arabic name from the letterhead.
- Registration, address, email, and phones exist only as pixels. A text footer cannot update them.
- No report classification, Hijri date, or QR area exists. Signature and stamp areas are empty labeled boxes on some receipts only.
- Beneficiary card has an issue date and no document number. Support proof uses the receipt id. The daily voucher uses `document_number`. The set is not one metadata pattern.

## 6. Header inconsistencies

mPDF repeats the same JPEG on every page. That part is consistent.

The in-body headers are not:

- Governance opens with an eyebrow, a 22pt title, a 17pt date line, and the author. That sits under the JPEG, so the top of page 1 is two headers.
- The daily report draws its own three-column header (name, title, print user) in addition to the JPEG.
- Receipts that extend `letterhead_template` use a gold `.doc-title` and do not repeat the logo. That is the closer pattern.
- Support proof is a centered `h1` plus one association paragraph.
- Logo size is “whatever the JPEG aspect ratio yields” at full page width. It is consistent across PDFs of the same orientation. Portrait and landscape scale the same file to 210mm or 297mm, so the header band is taller on landscape pages. The logo is not a fixed millimetre box.

## 7. Footer inconsistencies

Every PDF gets the footer JPEG and a line above it.

- Default line: `صفحة {PAGENO} من {nbpg}`.
- Governance replaces that line with a long note: report title, both dates, `generated_at`, and `{PAGENO} / {nbpg}`. On a landscape page this line sits in the gap above the footer image and can collide with it or wrap into the content margin.
- The JPEG already contains contact details. The HTML footer does not, and it should not invent a second copy.
- Page numbering is present. “Page X of Y” is Arabic in the default and mixed in the governance note.
- No footer states the document number.

## 8. Typography issues

- UI font is IBM Plex Sans Arabic. PDFs use DejaVu Sans Condensed.
- `autoLangToFont` can swap the font for Arabic runs even when the CSS names DejaVu. Latin and Arabic on one line can come from different faces.
- DejaVu Condensed is a fallback with Arabic glyphs. It is not a text face designed for long Arabic reports. Shaping works through mPDF’s Arabic support; it is not the same quality as the on-screen font.
- Title sizes disagree: governance `h1` is 22pt, `.doc-title` is 16px, support proof `h1` is 20pt, daily report titles are 12px.
- `font-family: monospace` on national IDs and phones in the staff receipt does not embed a monospace face in the mPDF config. Digits may fall back unpredictably.
- Numbers use `number_format` in some finance cells and raw values elsewhere. Dates are Gregorian `Y-m-d` or `translatedFormat`. No Hijri formatter is called.

## 9. RTL issues

- Templates that were checked set `dir="rtl"` and `direction: rtl`.
- Support proof sets `dir="ltr"` on the phone cell. That is the right isolation for a phone number.
- Other phone and ID cells rely on RTL bidi. Mixed Arabic labels and Latin ids can reorder.
- SVG `<text>` in the governance charts is the weak point. mPDF often paints SVG text without Arabic shaping, so axis labels can break or reverse.
- The line chart draws the y-axis on the physical left (`x=40`). In an RTL report the value axis is on the outer left of a landscape page. Labels are still readable if the SVG text renders.
- Funnel bars are centered HTML blocks. They do not depend on SVG text.
- Excel sheets for the governance export call `setRightToLeft(true)`. The cover sheet does not.

## 10. Table issues

`letterhead_template` and the daily report set `thead { display: table-header-group }` and `tr { page-break-inside: avoid }`. The governance report does the same on its global `table` rule. Support proof does too.

Remaining gaps:

- Column widths are inline percentages. Long Arabic names and decision reasons wrap only where `.wrap` is applied (`letterhead_template`). Many cells do not set `overflow-wrap`.
- Numeric columns are `text-align: right` with the labels. Totals and amounts do not sit in a dedicated numeric column with tabular figures.
- Alternating row fills are absent. Header fills differ: gold-tinted `#F5EDDA`, green `#EBF4EA`, and governance white-on-`#355B30`.
- Borders differ: full grid on receipt tables, bottom border only on governance tables.
- The daily report uses eight columns on landscape A4. Identity numbers and district names will wrap or collide.
- Subtotals are not a shared row style. The daily report adds a KPI that sums two different units (daily basket quantity plus general delivery count) into one “إجمالي السلال” figure. That is a content defect, not only a style defect.
- Governance neighborhood and nationality tables grow with the data and rely on repeating headers. There is no repeating caption.

## 11. Chart issues

Only `weekly_comprehensive_report.blade.php` and `report_bar_chart.blade.php`.

| Chart | How it is drawn | Data table beside it |
| --- | --- | --- |
| Columns | Inline SVG rects, 530×180 | No |
| Line | Inline SVG polyline, 530×235 | Yes, month / registrations / receipts |
| Funnel | Nested divs with percentage width | Status tables appear later, not as the chart legend |
| Pie | Two SVG circles and `stroke-dasharray` | No |
| Bars | SVG rects inside a table, via `report_bar_chart` | Yes |

Print risks:

- mPDF’s SVG subset often drops dash arrays, so the pie can render as a plain ring.
- SVG text is not a reliable Arabic shaper.
- Colors `#355B30` and `#C9A24A` are close to the app green and gold but are not the tokens `#1F4D3A` and `#A6843D`.
- Fixed SVG widths of 530px can clip or shrink on a landscape content box after 12mm margins and a tall letterhead.
- Charts are not rasterized at print resolution. They are vectors only where mPDF keeps them.
- No legend swatch list except the pie caption line.

## 12. Multi-page issues

The governance report inserts `<pagebreak />` before major parts and is the only document built to span many pages. Distribution history and the daily report can also span pages when the row count is high.

What already works:

- Header and footer images are set for both odd and even sides.
- Table header groups are requested.
- Row `page-break-inside: avoid` is requested on the shared table classes.
- Bottom margin includes the footer image height plus 8mm.

What does not:

- Signature blocks in the daily report, individual receipt, staff receipt, representative receipt, and daily voucher are not wrapped in `page-break-inside: avoid`. A heading can land on one page and the line on the next.
- The governance footer note is longer than the slot above the footer image.
- Landscape letterhead bands consume more vertical space, so the first content row starts lower and charts have less room.
- `.page { height: 3mm }` in the governance CSS is a spacer class, not a page break. Several sections use it where a real break might be expected.
- KPI cards and tinted indicator boxes are `page-break-inside: avoid`, which is good, but a tall indicator can be pushed entirely to the next page and leave a gap.

## 13. Print issues

- JPEG letterhead is full-bleed. Light leaf artwork still uses toner across the width of every page.
- Daily-report KPI cards use borders, radius, and tint. mPDF support for `border-radius` is partial, and the blocks look like screen cards.
- Gold title `#C9A24B` on white is decorative and lighter than the app gold. It is a poor grayscale heading.
- White text on `#355B30` table headers survives grayscale. Gold-on-cream labels in `.info-table th` (`#8C6C26` on `#F5EDDA`) are the pair to check on a mono printer.
- There is no `@page` CSS. Pagination is mPDF’s own header and footer.
- Duplicate identity and the daily-report in-body header waste the first centimetres of every print.
- No printer-specific stylesheet exists beyond the Blade `<style>` blocks.

## 14. Recommended Association Frame

Keep one frame for every official PDF, built from the current letterhead artwork until a vector replacement is approved. Do not draw a second logo or a second association name in the body.

Proposed regions, top to bottom:

1. Official header band: existing header artwork, same aspect ratio, same width on every page of that orientation. Logo not restretched.
2. Report title: one line, Arabic, under the band. Optional short classification such as «سند» or «تقرير» only when the document type already uses that word.
3. Metadata row: document or report number when the record has one, issue date (Gregorian, as stored), and generated-by when the controller already has the user. Hijri only after a real Hijri source is approved. Do not calculate one in the visual pass.
4. Body.
5. Notes.
6. Signature and stamp only on documents that already have those blocks: receipts, daily voucher, daily report. Keep each block with its label.
7. Footer band: existing footer artwork, unchanged, plus `صفحة {PAGENO} من {nbpg}` in the gap already reserved above it. Do not add a second address line in HTML.

QR stays absent until a verification URL exists. Do not reserve a fake QR box.

Contact, license, and the English wordmark stay inside the artwork. When settings later store those fields, the HTML footer may repeat only the values present in settings. Until then, the JPEG is the source.

A surrounding rule, if added later, should be a hairline in the brand green inside the 12mm margin, repeated by mPDF on each page, and kept clear of tables. No thick ornamental border.

## 15. Recommended PDF Design System

Name this set `PDF Design System`. It is print-only. It should match the app’s green `#1F4D3A`, gold `#A6843D`, ink `#1C1915`, and paper white. It should not copy screen cards, shadows, or gradients.

| Element | Rule |
| --- | --- |
| Association frame | One header JPEG, one footer JPEG, one optional hairline. Applied in `createMpdf()`, not copied into each Blade file |
| Header | Artwork only, plus the report title in the body. No second logo |
| Footer | Artwork plus Arabic page X of Y. No extra contact HTML |
| Logo | Only the logo inside the header artwork. Fixed aspect ratio. Do not swap in `logo.png` at a different ratio |
| Report title | One style, about 14–16pt, bold, ink color. Not 22pt |
| Section title | One style, about 12pt, brand green, with a 0.3mm gold underline |
| Body type | One embedded Arabic face, used for Arabic and for Arabic punctuation. Latin digits may stay in that face. Target the same family as the UI if the font license allows embedding. Until then, one mPDF Arabic font, not DejaVu Condensed plus `autoLangToFont` swaps |
| Colors | Ink, brand green, gold, a 10% green header fill, a light row fill. Status text must stay readable in grayscale |
| Borders | 0.2mm `#E4DDD0` grid on data tables. No drop shadows |
| Tables | Repeating header, avoid breaking rows, wrap long Arabic, right-align text, a numeric class for amounts |
| Charts | Vector only if a render test shows Arabic labels. Otherwise a table plus a simple bar. Every chart has a data table |
| Margins | Keep 12mm sides. Header and footer margins stay tied to image height so content never overlaps the artwork |
| Page numbers | `صفحة {PAGENO} من {nbpg}` on every PDF, including governance |
| Signatures | Two or three labeled lines, `page-break-inside: avoid`, only where a signature already exists |
| Stamps | Empty labeled box only where the voucher already says ختم. No clip-art stamp |
| Metadata | Number, Gregorian issue date, author when known. Hijri is out of scope until a source exists |
| Print | No full-page tint, no screen KPI cards, no large empty hero under the letterhead |

## 16. Recommended reusable PDF architecture

mPDF stays the engine. Dompdf stays unused; do not route new reports through it in the visual pass.

Conceptual Blade and PHP split, not to be built in this phase:

| Piece | Responsibility |
| --- | --- |
| `PdfLayout` | The mPDF options now inside `createMpdf()`: A4, margins from image aspect, font, header and footer HTML |
| `AssociationFrame` | Header image, footer image, page number. The only place that knows the asset paths |
| `PdfHeader` | Title and optional classification under the frame |
| `PdfFooter` | Page line only, unless settings later gain contact fields |
| `PdfReportTitle` | The single title style |
| `PdfMetadata` | Number, date, author |
| `PdfSection` | Section heading plus optional note |
| `PdfTable` | The table classes now split across `letterhead_template` and the standalone reports |
| `PdfChart` | Governance charts, each with a table fallback |
| `PdfSummary` | The governance KPI row, as a compact table rather than screen cards |
| `PdfSignatureBlock` | The existing signature and stamp rows |

`letterhead_template.blade.php` is the seed of `PdfLayout` plus `PdfTable`. The standalone reports should extend it instead of repeating `<html>`. Chart partial `report_bar_chart` is the seed of `PdfChart`.

Excel stays a separate exporter. Give its cover the same Arabic report title and the same period metadata. Do not paste the letterhead into worksheets.

## 17. PDF redesign priority list

### P0

1. Stop the second association name. Daily report and daily voucher must not say «جمعية إكرام لحفظ الطعام» while the letterhead says otherwise. Use the letterhead identity once.
2. Remove duplicate in-body name and logo lines so the JPEG is the only identity.
3. One Arabic font configuration. Turn off font swapping that fights the CSS font.
4. Shorten the governance footer to the standard page line so it cannot overlap the footer image.
5. Prove governance SVG (especially the pie and Arabic `<text>`) in a printed sample. Replace any chart that fails with the table that already carries the numbers.

### P1

6. Point `support_proof`, `daily_report`, and `weekly_comprehensive_report` at `letterhead_template` (or its successor).
7. One metadata row: number when the model has one, Gregorian issue date, author when the controller has the user.
8. Keep signature and stamp blocks intact across page breaks.
9. One table style: repeating header, wrapping Arabic, numeric alignment, no mixed green header colors.
10. Revisit the daily-report total that adds basket quantity to delivery count.

### P2

11. Map PDF colors to the app tokens, including grayscale checks for gold labels.
12. Give the governance Excel cover the Arabic title and period. Keep sheets RTL.
13. Optional hairline frame inside the margins, tested on page 2 of the governance report.
14. Fixed logo box only if a vector logo is supplied. Do not re-crop the JPEG in code.

### P3

15. Hijri date, QR, and an HTML contact footer after the association stores those values in settings. Do not invent them.
16. Retire the unused dompdf dependency in a later maintenance task, after confirming no package still boots it.

Screen redesign and PDF redesign can proceed in parallel after tokens exist. PDF work should not wait for every SPA page, and it should not restyle the letterhead artwork without an approved replacement file.
