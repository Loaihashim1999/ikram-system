# A11 — PDFs and Reporting

## 1. Objective

Redesign the PDF templates with the official frame and add the authorized nationality analysis without changing existing values.

## 2. Required references

- [COMMON_RULES.md](COMMON_RULES.md) requirements R-PDF-01 and R-RPT-01
- `evidence/A1-MAP.md` PDF inventory
- `evidence/A2-CONTRACTS.md` report populations
- The best available local PDF design/rendering skill. If none is installed, say so and use the existing mPDF/dompdf project pattern.

## 3. Dependencies

A1 inventory and A2 populations. A8 proof fields. Frontend charts are a contract for A4, not a parallel page edit.

## 4. Assigned files

A0 assigns PDF views, generators, and report queries after the inventory. Issued historical PDF files are not overwritten.

## 5. Allowed changes

Template layout, embedded local fonts, page frames, and the new nationality section. Values, wording, order, filters, totals, units, signatures, notes, stamps, snapshots, and QR payloads stay.

## 6. Explicit exclusions

No browser-print substitute. No runtime CDN font. No overwrite of an already issued PDF. No invented totals.

## 7. Detailed requirements

Put the official association frame on every page, including continuation pages. Governance PDFs use a landscape frame and readable analytical layout. Nationality analysis counts the defined unique population, separates registered, active, and served, shows missing nationality, and reconciles with tables and exports. Render empty, short, long, wide, and multi-page samples.

## 8. Acceptance criteria

Representative samples exist for portrait and landscape. A multi-page sample keeps the frame, Arabic shaping, headers, page numbers, and margins. Chart, table, total, and PDF counts match on one fixture.

## 9. Relevant verification

Targeted PDF generation test on synthetic data. Inspect the sample files. Do not use production records.

## 10. Handoff format

Use the common report block. Give A4 the report API fields and sample paths.
