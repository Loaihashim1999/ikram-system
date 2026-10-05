# A8 — Direct Handover

## 1. Objective

Confirm that beneficiary support entry points still complete direct pickup safely.

## 2. Required references

- [COMMON_RULES.md](COMMON_RULES.md) requirement R-HO-01
- A7 support contract
- Existing handover and receipt services named by A1

## 3. Dependencies

A7 initiation contract. Proof-template needs go to A11 as a contract. Do not edit A7's shared support files.

## 4. Assigned files

A0 assigns handover controllers, receipt verification, and focused tests after the map.

## 5. Allowed changes

Integration fixes on assigned handover files when a new support entry breaks code verification, counting, inventory, or replay safety.

## 6. Explicit exclusions

No edit to home-delivery driver assignment. No change to receipt snapshots. No independent edit of A7-owned support files.

## 7. Detailed requirements

Preserve code verification, permissions, completed-receipt counting, inventory effects, receipts, and replay safety. Coordinate the proof template with A11. Direct handover stays a separate experience from home delivery.

## 8. Acceptance criteria

A completed handover increments the authoritative completed-receipt count once. Replaying the same confirmation does not double-count or drive inventory negative.

## 9. Relevant verification

Targeted handover PHPUnit tests on isolated SQLite.

## 10. Handoff format

Use the common report block. List proof fields A11 must preserve.
