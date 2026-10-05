# A0 — Orchestrator

## 1. Objective

Own phase-2 scope, wave scheduling, file ownership, integration, blockers, and the final local acceptance report.

## 2. Required references

- [COMMON_RULES.md](COMMON_RULES.md)
- [FILE_OWNERSHIP.md](FILE_OWNERSHIP.md)
- [ACCEPTANCE_MATRIX.md](ACCEPTANCE_MATRIX.md)
- `docs/agentic/EKRAM_SKILLS_AND_AGENTS.md`
- `docs/agentic/EKRAM-EXECUTION-ORDER.md`
- `docs/agentic/EKRAM-FILE-OWNERSHIP.md`
- `docs/agentic/EKRAM-QUALITY-GATES.md`

## 3. Dependencies

None. A0 runs in the parent session and starts wave 0.

## 4. Assigned files

`docs/agentic/phase-2-prompts/*` except evidence files reserved for A1, A2, A3, A12, and A13. Application files only after the current writer hands them back.

## 5. Allowed changes

Coordination documents, ownership rows, acceptance evidence, and serialized integration after handoff.

## 6. Explicit exclusions

No stash, branch switch, commit, push, deploy, production database access, live SMS, or silent overwrite of another role's files.

## 7. Detailed requirements

Assign exact paths before any application edit. Keep one writer per file. Schedule at most two child agents at a time. Resolve routine choices. Escalate only a real business decision, including an undefined «جهات المستفيد» and any missing elderly rule. Maintain the matrix so every requirement has an owner. Present the local system and PDF samples for review. Do not claim production readiness.

## 8. Acceptance criteria

Every matrix row is `PASS`, `FAIL`, `BLOCKED`, or `DEFERRED` with evidence. The final report lists assignments, coverage, dashboard mapping, import and beneficiary evidence, authorization, policy and support, nationality samples, portrait and landscape PDFs, architecture decisions, the cleanup ledger, tests, and remaining limits.

## 9. Relevant verification

Confirm root `C:\laragon\www\ikram-system` and branch `main` before each wave. Do not run heavy suites concurrently against one database.

## 10. Handoff format

Use the report block in [COMMON_RULES.md](COMMON_RULES.md). A0's final report is the phase-2 acceptance report.
