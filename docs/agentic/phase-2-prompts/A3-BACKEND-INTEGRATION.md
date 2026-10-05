# A3 — Backend Integration

## 1. Objective

Integrate approved backend contracts, sequence additive migrations, and perform only the refactors and unused-code removals that owners have handed over.

## 2. Required references

- [COMMON_RULES.md](COMMON_RULES.md)
- [FILE_OWNERSHIP.md](FILE_OWNERSHIP.md)
- `evidence/A2-CONTRACTS.md`
- `evidence/CLEANUP-LEDGER.md`

## 3. Dependencies

Wave 0 contracts. Domain handoffs for every shared file. A3 may take one shared file earlier when A0 records that a later role is blocked.

## 4. Assigned files

Assigned by A0 at handoff time. Expected shared candidates, not granted yet: `routes/api.php`, additive migrations, and services that more than one domain role must change.

## 5. Allowed changes

Additive schema, shared integration, and ledger-backed cleanup of files whose static and dynamic references were checked.

## 6. Explicit exclusions

No destructive migration, no historical data rewrite, no removal of an uncertain file, no live SMS, no production database.

## 7. Detailed requirements

Preserve API compatibility. Keep receipt aggregates free of per-row queries. Apply R-ARCH-01. The cleanup ledger records each candidate, the references checked, the decision, and the reason uncertain files remain.

## 8. Acceptance criteria

Shared endpoints match A2 contracts. Migrations are additive. The ledger explains every removal and every file left in place.

## 9. Relevant verification

Targeted PHPUnit for the integrated behavior. Guarded PostgreSQL QA only when the SQL behavior is database-specific. Do not run that beside another heavy suite.

## 10. Handoff format

Use the common report block and update the cleanup ledger.
