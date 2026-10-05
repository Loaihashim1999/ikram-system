# EKRAM workflow states — remediation Wave 0

Discovery date: 2026-10-04. Current states derive from existing source; target concepts are mappings, not completed implementation claims.

## Registration and archive

| Concept | Current / target mapping |
|---|---|
| DRAFT | Form in progress; do not create operational beneficiary from an intermediate step. Persisted drafts require an explicit additive contract. |
| REVIEW | Stable final summary before submission; do not auto-dismiss on background refresh. |
| CONFIRMED | Explicit final action and backend validation, atomic save with confirmation time/employee. Currently backend confirmation enforcement is missing. |
| ACTIVE | Existing operational `active` status after successful confirmed registration. Existing `under_review` and `suspended` retain their meaning. |
| ARCHIVED | Additive archive metadata; operational queries exclude archived entries. Historical evaluations/support/receipts/documents and User attribution remain intact. |
| RESTORED | Authorized audited reversal of archive; do not erase archive audit history. |

Final action: validate → persist beneficiary/dependents/financial state → confirmation attribution → operational state → audit → justified post-confirmation events. Validation failure preserves form data. Early Enter must not bypass final review or backend confirmation.

## Policy and support

Policy: active version + prerequisites → financial/input snapshot → rule execution → immutable new evaluation → explicit decision according to existing contract. Errors are observable. Re-evaluation neither overwrites snapshots nor copies previous verdict automatically. Citizens and residents remain separate policy contracts; simulation writes no real evaluation/decision.

| Target support concept | Existing persisted mapping |
|---|---|
| REQUESTED | `draft` |
| EVALUATED | Policy evaluation relation/result; no invented support state |
| APPROVED | `approved` |
| REJECTED | No equivalent support state proven; eligibility rejection remains its existing policy decision. Add only if a justified support rejection workflow requires it. |
| STOCK_RESERVED | `reserved` |
| READY | `ready` |
| COMPLETED | `completed` |
| CANCELLED | `cancelled` |

Pickup: `draft → approved → reserved → ready → completed`.

Delivery: `draft → approved → reserved → ready → in_delivery → completed`.

Cancel currently permitted from draft/approved/reserved/ready, not from in_delivery. Reservation locks stock; completion consumes the whole reserved quantity once; cancellation releases reservation. Do not introduce partial fulfillment through a UI quantity override.

## Receipt and driver capability

Challenge: issued → valid until expiry → consumed on successful confirmation; wrong attempts increment persisted counter → temporary lock. Reissue supersedes old generation and cancels old queued payload. Invalid/expired codes never complete support or mutate stock/create receipts.

Assignment: created → active until expiry/revocation/all tasks completed. Every request revalidates driver active flag and assignment/task membership. Token hash is stored; capability remains outside application authentication. Existing completed assignment returns 410 and duplicate receipt returns 409 while preserving data integrity; target replay UX returns safe known completion evidence without further mutations.

Successful delivery: assignment lock → support lock → challenge lock → correct relationship/code → single support completion/inventory effect → consumed challenge + unique receipt → completion attribution → audit and supervisor notification → branded proof. Do not label staff `confirmed_by` as actual driver; use assignment driver.

Resend: eligible incomplete assignment → rotate capability/expiry → cancel obsolete queued link → queue one new communication. Old token fails. Expired/revoked state and historical assignment membership must remain auditable. Reassignment needs an explicit history-preserving contract because the current task pivot has a unique support ID.

## Communications

Conceptual chain: REQUESTED → QUEUED → PROVIDER_ACCEPTED → SENT → DELIVERED, with FAILED/CANCELLED and retry only where justified by known outcome. Current provider acceptance is labelled sent; remediation must distinguish acceptance from proven delivery. Never infer DELIVERED from a successful provider request. Ambiguous worker/provider timeout requires idempotency or reconciliation before another submission.

Notification: persisted exact event/target/action route → visible to authorized recipient → mark read → open target. Support events must resolve to an exact support target rather than null navigation. After-commit delivery notification must not announce rolled-back completion.

## Verification boundaries

Repeat valid confirmation must produce one support completion, one receipt and one movement per item; no second stock decrement. Invalid code produces no success event/document. Driver list exposes only assignments for its capability. Filters and export share the same complete query. E2E-006 and E2E-007 remain open/unproven pending required provider and clean-browser evidence under repository safety rules.

## Implemented recovery clarification (2026-10-04)
An authorized administrator can reopen the same revoked incomplete assignment with an active matching driver. Reopening rotates the token/expiry, clears revocation on the current row, preserves the prior revocation audit and task membership, cancels obsolete communications, and validates locked task ownership/status. The old token remains invalid. Completed assignments cannot be reopened. Reassignment to a different driver is not implemented; no historical membership is deleted.
