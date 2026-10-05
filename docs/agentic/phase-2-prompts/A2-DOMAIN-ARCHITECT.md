# A2 — Domain Architect

## 1. Objective

Define the phase-2 contracts and the smallest structural changes that have a demonstrated benefit.

## 2. Required references

- [COMMON_RULES.md](COMMON_RULES.md)
- A1 map when it exists
- `docs/architecture/ADR-007-VERSIONED-BENEFICIARY-POLICY-ENGINE.md`
- `docs/architecture/EKRAM-TARGET-ARCHITECTURE.md`
- `docs/architecture/EKRAM-WORKFLOW-STATES.md`

## 3. Dependencies

May start from the existing architecture docs. Incorporate A1 evidence before the contract is marked ready.

## 4. Assigned files

Write only `docs/agentic/phase-2-prompts/evidence/A2-CONTRACTS.md`.

## 5. Allowed changes

That contract document. No application code.

## 6. Explicit exclusions

No wholesale rewrite, no new layer that only satisfies a pattern, no change to financial, policy, inventory, support, delivery, notification, or receipt authority.

## 7. Detailed requirements

Specify:

- Nationality input, citizen/resident derivation, and the backend validation rule for R-BEN-01.
- List fields, filters, and the completed-receipt aggregate query for R-BEN-02 and R-BEN-03.
- Import target, preview, confirmation, and the prohibition in R-IMP-01.
- Support initiation versus receipt confirmation for R-SUP-01.
- The existing elderly rule, or an explicit statement that none exists.
- Whether «جهات المستفيد» matches an existing recipient entity.
- Nationality report populations and the anti-duplication rule for R-RPT-01.
- Which existing services stay authoritative.
- Any incremental refactor worth doing, with the benefit and the files involved.

## 8. Acceptance criteria

A later implementer can build without guessing an API field, a classification rule, or a report population. Direct handover and home delivery remain separate.

## 9. Relevant verification

Contract review against ADR-007 and the current services named by A1. No test run.

## 10. Handoff format

Use the common report block. List each contract the next owner must follow.
