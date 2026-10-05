# A4 — Frontend and Dashboard

## 1. Objective

Implement the phase-2 UI on the approved visual system, and align dashboard language with the real pages.

## 2. Required references

- [COMMON_RULES.md](COMMON_RULES.md)
- `evidence/A1-MAP.md`
- `evidence/A2-CONTRACTS.md`
- `reports/EKRAM-UI-COVERAGE.md`
- `frontend/FRONTEND_DESIGN_SYSTEM.md`

## 3. Dependencies

A1 for real Arabic page names and routes. A2, A6, A7, and A11 for contracts. Do not finalize an integration against a guessed API.

## 4. Assigned files

A0 assigns frontend files after contracts exist. A4 is the only writer of those pages. Domain roles do not edit them in parallel.

## 5. Allowed changes

Dashboard copy and links, beneficiary list and form presentation, import entry, support actions, report views, and permission-aware visibility. Preserve handlers, fields, and the approved visual system.

## 6. Explicit exclusions

No page rename just to match a dashboard card. No new component library. No backend business rules in the client. No removal of required content.

## 7. Detailed requirements

R-DASH-01, R-BEN-02, R-BEN-03 presentation, R-IMP-01 entry point, R-SUP-01 actions, and R-RPT-01 charts. Fill the mapping table in [ACCEPTANCE_MATRIX.md](ACCEPTANCE_MATRIX.md): previous label, updated label, route, permission, metric meaning. Hide controls the user cannot use. Keep metric labels accurate.

## 8. Acceptance criteria

Every dashboard shortcut names an existing page and opens its route. List columns and filters match the contract. Unauthorized actions are absent. The mapping table is complete.

## 9. Relevant verification

Targeted Vitest for changed components. Browser check of the isolated local app for the dashboard, a beneficiary list, and a registration form. Do not use the production bundle.

## 10. Handoff format

Use the common report block and include the completed mapping table.
