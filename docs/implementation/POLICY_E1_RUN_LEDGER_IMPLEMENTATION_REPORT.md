# POLICY-E1 — Application Scope Contract & Run Ledger Foundation — Implementation Report

**Date:** 2026-09-22 · **Status:** IMPLEMENTED (foundation only — POLICY-E is NOT complete) · **Authorization:** explicit user directive POLICY-E1 (2026-09-22)
**Precondition:** [POLICY_E_APPLICATION_SCOPE_AUDIT.md](POLICY_E_APPLICATION_SCOPE_AUDIT.md) (POLICY-E0, real worktree, VERIFIED)

## 1. Scope delivered (POLICY-E1 ONLY)

- Application-scope configuration contract finalized: exactly four modes (`new_only`, `all_existing_and_new`, `selected_existing_and_new`, `effective_from_date`); unknown modes/keys rejected.
- `application_scope.effective_from_date` validated as a canonical `YYYY-MM-DD` calendar date; required for mode `effective_from_date`, forbidden for all other modes.
- Run-parameter ownership enforced: selected existing beneficiary IDs are **run-level input only**, never stored in the published policy configuration (`beneficiary_ids`/`selected_ids`/… rejected in configuration).
- New additive ledger: `policy_application_runs` + `policy_application_run_items` (UUID PKs, JSONB parameters/snapshots, guarded state machines, unique `(run_id, beneficiary_id)` idempotency backstop).
- Deterministic fingerprint service (sha256 over `policy_version_id` + `scope_mode` + normalized parameters).
- Run/item state machines with legal-transition guards and lifecycle timestamps.
- POLICY-E permissions: `simulate`, `apply_scope`, `execute_reevaluation`, `view_application_runs` (nested `beneficiary_policy` model; admin full; no implicit escalation).
- Run-lifecycle audit action contract (`POLICY_APPLICATION_RUN_CREATED`, `POLICY_SCOPE_SIMULATED`, `POLICY_APPLICATION_RUN_STARTED`, `POLICY_APPLICATION_RUN_COMPLETED`, `POLICY_APPLICATION_RUN_COMPLETED_WITH_ERRORS`, `POLICY_APPLICATION_RUN_CANCELLED`) — fired only when the action really occurs.

**Explicitly NOT implemented:** POLICY-E2 simulation engine, POLICY-E3 execution/retry processing, POLICY-E4 registration hooks, POLICY-E5 UI/browser workflow, any bulk re-evaluation, any automatic mass processing. No observers/hooks on beneficiary registration. No financial/scoring/eligibility/decision calculation (POLICY-B/C/D services untouched).

## 2. Canonical date rule

Canonical beneficiary registration field: `beneficiaries.created_at` (server-set; no `registration_date` column created; `updated_at` never used).
Eligibility boundary for `effective_from_date` (enforced by POLICY-E2/E3, documented foundation here):
`date(beneficiaries.created_at) >= application_scope.effective_from_date` — **date-only comparison** in the application timezone, because the configuration datatype is a canonical calendar date (`YYYY-MM-DD` string). One canonical rule, consistent everywhere.

## 3. Files

| File | Change |
|---|---|
| `database/migrations/2026_09_22_040000_policy_e_application_run_ledger.php` | NEW — two ledger tables; UUID PKs (`gen_random_uuid()` on PG); enum-status CHECK constraints (compiled on SQLite+PG); PG-only non-negative counter CHECK constraints; FKs per §5; reversible `down()` |
| `app/Models/PolicyApplicationRun.php` | NEW — statuses, legal `TRANSITIONS`, guarded `transitionTo()` with lifecycle timestamp/actor stamps |
| `app/Models/PolicyApplicationRunItem.php` | NEW — item statuses/transitions, attempt counter on `processing`, `processed_at` on terminal work states |
| `app/Models/BeneficiaryPolicyVersion.php` | `applicationRuns()` HasMany added |
| `app/Services/BeneficiaryPolicy/PolicyApplicationScopeService.php` | NEW — mode resolution, run-parameter validation/normalization (dedupe+sort selected IDs), deterministic fingerprint; zero business calculation |
| `app/Services/BeneficiaryPolicy/PolicyApplicationRunService.php` | NEW — `create()` (published versions only), `addItem()` (draft-only + clean duplicate error), `transition()` (guard + audit events); audit action constants |
| `app/Services/BeneficiaryPolicy/PolicyConfigurationValidator.php` | `validateApplicationScope` extended (unknown keys rejected; canonical `effective_from_date` required/forbidden per mode); new public `isCanonicalDate()` |
| `app/Http/Middleware/ModulePermission.php` | POLICY-E path→permission contract: `POST versions/{id}/simulate` → `simulate`; `POST versions/{id}/application-runs` → `apply_scope`; `GET …/application-runs*` → `view_application_runs`; `POST application-runs/{id}/execute|retry` → `execute_reevaluation`; `…/cancel` → `apply_scope` |
| `app/Http/Controllers/BeneficiaryPolicy/BeneficiaryPolicyController.php` | `permissions()` map extended with the four POLICY-E abilities (admin: all true) |
| `frontend/src/pages/admin/Users.jsx` | Four new `beneficiary_policy` permission toggles (default false; merge + render lists) |
| `tests/Feature/PolicyE1RunLedgerTest.php` | NEW — 31 tests / 158 assertions (mandate items 1–41; regression items 42–45 via full suite) |
| `tests/Postgres/PolicyE1PostgresTest.php` | NEW — full E1 suite re-run on guarded PG QA + 6 PG-specific proofs (37 tests / 173 assertions) |

## 4. State machines

Run: `draft → simulated → approved_for_execution → running → completed | completed_with_errors | failed`; `cancelled` allowed from `draft | simulated | approved_for_execution` only. Terminal: `completed`, `completed_with_errors`, `failed`, `cancelled`. Arbitrary mutation impossible: `transitionTo()` rejects any status outside the legal map (and any unknown status) with `ValidationException`; the DB enum CHECK is the backstop.

Item: `pending → simulated → processing → completed | review_required | not_applicable | failed`; `failed → processing` (explicit retry); `pending | simulated → cancelled`.

## 5. FK / delete behavior (audit-history contract)

| FK | Behavior | Rationale |
|---|---|---|
| `runs.policy_version_id` → `beneficiary_policy_versions` | RESTRICT | A published version with runs is immutable history and must never be deleted |
| `runs.requested_by / simulation_created_by / execution_requested_by` → `users` | NULL on delete | Removing a human actor must not erase historical runs |
| `items.run_id` → `policy_application_runs` | CASCADE | Items are meaningless without their run (version-level RESTRICT protects the chain) |
| `items.beneficiary_id` → `beneficiaries` | RESTRICT | A beneficiary referenced by a run item is audit history and must not be deleted |
| `items.source_evaluation_id / new_evaluation_id` → `beneficiary_policy_evaluations` | NULL on delete | Evaluation snapshots are immutable; references soften, history preserved |

## 6. Fingerprint & staleness foundation

`PolicyApplicationScopeService::fingerprint()` = `sha256(json({parameters, policy_version_id, scope_mode}))` with normalized parameters (selected IDs deduplicated + `sort(SORT_STRING)`; canonical date string). Sensitive fields (passwords, tokens, IBAN, national IDs, medical contents, document binaries) can never enter: parameter validation rejects every key outside the per-mode whitelist before fingerprinting.

`policy_application_runs.candidate_set_hash` + `policy_application_run_items.simulation_result` / `source_state_marker` are the reserved staleness foundation: POLICY-E2 will populate them so POLICY-E3 execution can prove it acts on exactly the reviewed candidate set. Not populated in E1 (no simulation).

## 7. Default-scope safety

`application_scope.applies_to` still defaults to `all_existing_and_new` (unchanged), but a configuration default is NOT execution authorization: publishing a version creates zero runs, zero items, zero run-audit events, and no automatic processing exists anywhere in E1 (proven by test `default_scope_does_not_trigger_execution`). Existing beneficiaries will require simulation → explicit authorized execution in later POLICY-E stages.

## 8. Quality gates (exact results)

| Gate | Result |
|---|---|
| Targeted POLICY-E1 (SQLite) | **30 passed, 1 skipped (PG-only counter CHECK), 0 failed / 158 assertions** |
| POLICY-E1 PostgreSQL QA (`.env.phase2a.pgqa` → `pgsql @ 127.0.0.1:5432/ikram_phase2a_qa`, identity verified by bootstrap; password never printed) | **37 passed / 173 assertions** — UUID PKs, JSONB columns, FK restrict/null-on-delete (SQLSTATE 23503), unique backstop (23505), status enum CHECK (23514), counter CHECKs, migration rollback + re-migrate all proven on real PostgreSQL |
| Full default suite `php artisan test` (regression 42–45: POLICY-D HTTP, POLICY-C scoring, POLICY-B financials, POLICY-A lifecycle) | **385 passed, 2 skipped (1 pre-existing + 1 PG-only), 0 failed / 1701 assertions** |
| Pint (12 changed PHP files) | clean after auto-fix (line endings, operator spacing, FQCN); tests re-run post-Pint and still green |
| Frontend (Users.jsx touched) | **ESLint clean · vitest 56/56 passed · `vite build` clean (1.40s)** |
| `git diff --check` | clean (no whitespace errors) |

One legacy expectation was updated under the new contract: `BeneficiaryPolicyEngineTest::test_application_scope_values_validated` now passes `effective_from_date` with its required canonical date (POLICY-E1 makes the date mandatory for that mode). No other existing test changed behavior.

## 9. What remains (NOT implemented)

POLICY-E2 simulation engine (candidate selection, non-persisting compute, `candidate_set_hash`, item snapshots) → POLICY-E3 execution/retry (atomic per-item processing, counters) → POLICY-E4 future-registration integration → POLICY-E5 UI/browser workflow. Then POLICY-F → POLICY-G → Phase 2C Taqnyat → Notification Coverage Audit → PDF Finalization → Governance / Reports Finalization → Full System Acceptance → Azure Deployment Audit → Azure Production Deployment. Governance remains mandatory later and is not implemented.

**POLICY-E1 VERIFIED — READY FOR POLICY-E2.** POLICY-E as a whole is NOT complete (E2 simulation, E3 execution/retry, E4 registration integration, E5 UI remain). POLICY-E2 must not start without explicit user approval.
