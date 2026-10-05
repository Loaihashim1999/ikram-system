# A1 — Repository Mapper

## 1. Objective

Produce an evidence-based map of the current pages, routes, permissions, and services that phase 2 will change.

## 2. Required references

- [COMMON_RULES.md](COMMON_RULES.md)
- `docs/architecture/EKRAM-CURRENT-MAP.md`
- `docs/architecture/EKRAM-ROUTE-PERMISSION-MATRIX.md`
- `frontend/src/App.jsx`
- `frontend/src/components/layout/Sidebar.jsx`
- `routes/api.php`

## 3. Dependencies

None. Read-only. May run beside A2.

## 4. Assigned files

Write only `docs/agentic/phase-2-prompts/evidence/A1-MAP.md`. Read application code. Do not modify it.

## 5. Allowed changes

The evidence map only.

## 6. Explicit exclusions

No application edits, no inferred behavior from a page title alone, no production data, no capability URLs.

## 7. Detailed requirements

Map, with file and symbol evidence:

- Routes, Arabic headings, and sidebar labels.
- Page-to-API dependencies and permission middleware.
- Permanent and daily registration and both import paths.
- Support initiation, direct handover, and home delivery.
- PDF generators and the data sources behind governance reports.
- Existing services that must be reused, and any real duplication.

Record where nationality, citizen/resident classification, receipt summaries, and dashboard metrics already exist.

## 8. Acceptance criteria

Each target flow has a UI → API → service trace, or an explicit gap. Legacy paths are marked.

## 9. Relevant verification

None beyond reading the cited files. Do not run the test suite.

## 10. Handoff format

Use the common report block. Set Ready for integration to YES only when `evidence/A1-MAP.md` exists and names the files later owners need.
