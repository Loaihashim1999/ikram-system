# A12 — Independent QA

## 1. Objective

Verify the integrated local implementation and reproduce defects without repairing application code.

## 2. Required references

- [COMMON_RULES.md](COMMON_RULES.md)
- [ACCEPTANCE_MATRIX.md](ACCEPTANCE_MATRIX.md)
- `docs/agentic/EKRAM-QUALITY-GATES.md`

## 3. Dependencies

Waves 0–4 handed back to A0. Do not start against half-integrated contracts.

## 4. Assigned files

Write only `docs/agentic/phase-2-prompts/evidence/A12-QA.md` and, if needed, a new test file that A0 assigns. Do not edit application source to make a check pass.

## 5. Allowed changes

Evidence and assigned tests. Defects return to the owner.

## 6. Explicit exclusions

No silent repair. No production database. No live SMS. No concurrent heavy suite on a database another role is using.

## 7. Detailed requirements

Cover registration nationality, list aggregates, import confirmation, support initiation, handover replay, driver reveal, notification permission loss, dashboard routes, and PDF samples. Use synthetic data marked `EKRAM-E2E-TEST` when creating records. Coordinate final regression, browser, guarded PostgreSQL, and PDF checks. Record commands and counts.

## 8. Acceptance criteria

Each exercised matrix row has a command, a count, and PASS or FAIL. Unrun rows stay `NOT_RUN`.

## 9. Relevant verification

Targeted tests first. Full frontend and backend suites only after targeted checks pass and no other suite is using the same database.

## 10. Handoff format

Use the common report block. Ready for integration is YES only as "evidence delivered", not as production readiness.
