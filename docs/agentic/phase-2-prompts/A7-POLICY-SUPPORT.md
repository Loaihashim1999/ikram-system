# A7 — Policy and Support

## 1. Objective

Verify authoritative eligibility and enable the existing إرسال الدعم flow from the beneficiary list and beneficiary details.

## 2. Required references

- [COMMON_RULES.md](COMMON_RULES.md) requirements R-POL-01 and R-SUP-01
- `docs/architecture/ADR-007-VERSIONED-BENEFICIARY-POLICY-ENGINE.md`
- `evidence/A2-CONTRACTS.md`

## 3. Dependencies

A2 and A5. Direct handover integration is A8's, using this contract. Shared support files are not edited by A8.

## 4. Assigned files

A0 assigns policy and support initiation files after the map. A7 does not edit handover pages or the driver directory.

## 5. Allowed changes

Support entry from existing selection and detail actions, plus tests that prove eligibility rules were not replaced.

## 6. Explicit exclusions

No new elderly threshold. No nationality preference. No automatic priority without an existing rule. No conversion of simulation into a real decision. No overwrite of historical evaluations.

## 7. Detailed requirements

Preserve `FinancialCalculationService`, separate income and score categories, resident behavior, and program rules. Support eligible beneficiaries. If the existing age definition already includes elderly beneficiaries, honor it. If it does not exist, stop that part and record the decision. Check «جهات المستفيد» against current terminology. Keep initiation separate from physical receipt.

## 8. Acceptance criteria

An eligible beneficiary can start support from the list and from details. An ineligible beneficiary cannot. A new evaluation does not copy an old approval. Resident policy behavior stays as it is.

## 9. Relevant verification

Targeted policy and support PHPUnit tests. Do not run them beside another suite on the same database.

## 10. Handoff format

Use the common report block. State the elderly-rule finding and the «جهات المستفيد» finding.
