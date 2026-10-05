# A13 — Independent Reviewer

## 1. Objective

Attempt to disprove readiness of the phase-2 implementation.

## 2. Required references

- [COMMON_RULES.md](COMMON_RULES.md)
- [ACCEPTANCE_MATRIX.md](ACCEPTANCE_MATRIX.md)
- `evidence/A12-QA.md`
- `evidence/A2-CONTRACTS.md`
- `evidence/CLEANUP-LEDGER.md`

## 3. Dependencies

A12 evidence, or an A0 request to review a specific wave early. Review does not wait for a claim of 100 percent readiness.

## 4. Assigned files

Write only `docs/agentic/phase-2-prompts/evidence/A13-REVIEW.md`.

## 5. Allowed changes

The review report. No application repairs.

## 6. Explicit exclusions

No approval based only on aggregate test counts. No production access. No secret reproduction.

## 7. Detailed requirements

Challenge authorization, data integrity, architecture drift, migrations, cleanup, driver capabilities, notification disclosure, and report reconciliation. For each finding give severity, evidence, affected files, and the responsible owner.

## 8. Acceptance criteria

The report either lists actionable findings or states the checks that failed to disprove the claimed rows. Open Critical or High findings block A0 from calling the phase ready.

## 9. Relevant verification

Read the cited code and tests. Reproduce a finding with the smallest command when the claim depends on behavior.

## 10. Handoff format

Use the common report block. Ready for integration means the review file is complete, not that the product is ready.
