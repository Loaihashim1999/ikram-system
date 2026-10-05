# POLICY-A IMPLEMENTATION REPORT — Beneficiary Policy Engine (Data Model, Versioning & Snapshots)

**Date:** 2026-09-21
**Status:** ✅ **POLICY-A VERIFIED — ACCEPTED — READY FOR POLICY-B** *(status recorded at POLICY-A completion; POLICY-B has since been **VERIFIED — ACCEPTED** — see [POLICY_B_IMPLEMENTATION_REPORT.md](POLICY_B_IMPLEMENTATION_REPORT.md))*
**ADR:** ADR-007 **APPROVED** ([ADR-007-VERSIONED-BENEFICIARY-POLICY-ENGINE.md](../architecture/ADR-007-VERSIONED-BENEFICIARY-POLICY-ENGINE.md))
**Scope:** POLICY-A only (data model + policy lifecycle + versioned configuration + evaluation snapshots + audit foundation + publish/retire invariants + granular permissions + minimal API/UI).

---

## 1. Scope boundaries (what this phase is and is not)

**Implemented (POLICY-A):**
- `beneficiary_policy_versions` and `beneficiary_policy_evaluations` tables (additive, reversible, PostgreSQL-compatible).
- Policy version lifecycle: `draft → approve → publish → retire`, with published/retired **immutability** and the **one-active-policy** publish invariant.
- Structured, strictly validated, versioned policy configuration (JSONB on PostgreSQL / `json` on SQLite) with approved defaults (never hardcoded in code).
- Immutable per-beneficiary evaluation snapshots (new record per evaluation; privacy-sanitized).
- Policy audit trail on the existing `audit_logs` architecture (actions `POLICY_DRAFT_CREATED`, `POLICY_DRAFT_UPDATED`, `POLICY_APPROVED`, `POLICY_PUBLISHED`, `POLICY_RETIRED`).
- Granular module permissions `beneficiary_policy: view / edit_draft / approve / publish / retire` (backend authoritative; admin full; others explicit-only).
- Minimal API (list/get/history/permissions, create/edit/clone draft, approve, publish, retire) + minimal UI (System Settings → Beneficiary Policy).

**Explicitly NOT implemented in POLICY-A (deferred to later phases):**
- Live beneficiary recalculation, evaluation simulation, or bulk evaluation (no HTTP exposure; evaluation snapshots are created via the service only).
- Server-side column filtering → **POLICY-F dependency, documented only** (ADR-007 decision 6).
- Degree→A–D taxonomy mapping (deliberately absent — taxonomies stored independently, ADR-007 decision 5).
- Scoring/eligibility/income-category *calculations* — POLICY-A stores the snapshot structure; the values must come from the authoritative `FinancialCalculationService` in later phases (ADR-007 decision 2).
- Application-scope *execution* — POLICY-A models `new_only | all_existing_and_new | selected_existing_and_new | effective_from_date` and stores selection metadata for **POLICY-E**, without executing it.
- Phase 2C (Taqnyat), Azure deployment, commit/push.

## 2. Approved design decisions implemented (ADR-007)

| # | Decision | How POLICY-A honours it |
|---|---|---|
| 1 | Residents stay separate | Resident degree/need/income behavior untouched; no beneficiary-table changes; `FinancialCalculationService` remains sole calculator. Verified by `test_resident_fields_remain_untouched`. |
| 2 | Citizen default counted income = salary + social_security + citizen_account | Defaults in `PolicyConfigurationValidator::DEFAULT_COUNTED_INCOME_SOURCES`; registry keeps retirement/family_support/social_insurance/other (available, not counted by default). |
| 3 | `family_size` = head + active dependents | Modelled as an evaluation field `family_size`; semantics enforced by callers in POLICY-B (head included is documented in the model + validator docblocks). |
| 4 | `per_family_member_deduction` = 100 SAR default | `PolicyConfigurationValidator::DEFAULT_FAMILY_MEMBER_DEDUCTION` (config default, **never hardcoded inside calculation logic**). |
| 5 | Degree/Need and A–D taxonomies stored independently | `degree_classification_snapshot` / `need_level_snapshot` JSONB columns are separate from `income_category` / `score_category`; no mapping code exists. |
| 6 | Server-side filtering → POLICY-F | Dependency documented in this report + ADR-007; no filtering implementation. |

## 3. Deliverables

### 3.1 Migration — `database/migrations/2026_09_21_010000_create_beneficiary_policy_architecture.php`

- `beneficiary_policy_versions`: uuid PK, `policy_name`, `policy_scope` (default `citizen_beneficiaries`), `version`, `status` enum(draft|published|retired), `effective_from`/`effective_to`, source-document reference/version, board-approval reference/date, `configuration` (JSONB/json), `parent_version_id` (self-FK, added in a second pass for PostgreSQL compatibility), `approved_by/at`, `published_by/at`, `retired_by/at`, `change_reason`, timestamps. Unique `(policy_name, version)`; index `(policy_scope, status)`.
- `beneficiary_policy_evaluations`: uuid PK, `beneficiary_id` (nullable, nullOnDelete — history survives beneficiary deletion), `policy_version_id` (restrictOnDelete — published versions referenced by evaluations cannot be destroyed), `evaluation_status` enum(completed|failed), `evaluated_at/by`, JSONB/json snapshots (`input_snapshot`, `financial_snapshot`, `scoring_snapshot`, `degree_classification_snapshot`, `need_level_snapshot`), the full numeric snapshot block (`gross_counted_income` … `net_income_per_capita`, `policy_score`), category/decision fields, exception fields, timestamps.
- **PostgreSQL-only backstops** (guarded by driver, dropped in `down()`):
  - CHECK `beneficiary_policy_versions_dates_ordered` (effective_to ≥ effective_from when both set).
  - Partial unique index `beneficiary_policy_versions_one_published_per_scope_start` (one published version per scope+effective_from).
- Reversible: `down()` drops both tables and the PG backstops. Verified by the rollback/re-migrate probe on PostgreSQL QA.

### 3.2 Models

- `app/Models/BeneficiaryPolicyVersion.php` — lifecycle helpers (`isDraft/isPublished/isRetired/isImmutable`), statuses/scopes constants, relations (approver/publisher/retirer/parentVersion/evaluations), `configuration` array cast, date/datetime casts.
- `app/Models/BeneficiaryPolicyEvaluation.php` — statuses constants, array casts for the five JSONB snapshots, decimal/int casts, relations (beneficiary/policyVersion/evaluator).

### 3.3 Services — `app/Services/BeneficiaryPolicy/`

- `PolicyConfigurationValidator.php` — strict allowlisted-section config validation:
  - top-level sections only from the approved list (financial, eligibility, income_categories, scoring, score_categories, documents, exceptions, application_scope);
  - every section must be an object (no raw JSON text); identifier-safe keys; bounded nesting; sequential list arrays allowed;
  - typed anchor checks: `financial.per_family_member_deduction` non-negative numeric; `financial.counted_income_sources` non-empty subset of the 7-source registry; `application_scope.applies_to` in the 4 approved scopes;
  - `withDefaults()` merges approved defaults deterministically (deduction 100 SAR, counted sources salary/social_security/citizen_account, applies_to all_existing_and_new).
- `BeneficiaryPolicyVersionService.php` — lifecycle authority:
  - `createDraft` / `updateDraft` (published/retired are immutable → 409) / `cloneDraft` (parent-version lineage, auto next version, config copied, previous version untouched) / `approve` (requires board ref+date) / `publish` (requires approved; enforces no-overlap one-active rule; defaults effective_from to today) / `retire` (published only, change_reason required);
  - `rangesOverlap` treats null bounds as unbounded;
  - audits every transition on `audit_logs`.
- `BeneficiaryPolicyEvaluationService.php` — snapshot storage only:
  - `create()` requires a published policy version (409 otherwise), validates status/family_size, sanitizes snapshots (national ID/IBAN/document URLs/tokens/secrets stripped recursively), always inserts a new record;
  - `createForBeneficiary()` convenience derives a safe input reference (beneficiary_type/status/housing_type/family_members_count only — no identity records).

### 3.4 API + permissions + middleware

- `app/Http/Controllers/BeneficiaryPolicy/BeneficiaryPolicyController.php` under the `beneficiary-policy` route prefix:
  - `GET /beneficiary-policy/versions`, `GET /beneficiary-policy/versions/{id}`, `GET /beneficiary-policy/versions/{id}/history`, `GET /beneficiary-policy/permissions`;
  - `POST /beneficiary-policy/versions`, `PATCH /beneficiary-policy/versions/{id}`, `POST .../clone`, `POST .../approve`, `POST .../publish`, `POST .../retire`.
  - No simulate / bulk / recalculate endpoints.
- `app/Http/Middleware/ModulePermission.php` — new `beneficiary-policy` segment branch mapping GET→`view`, PATCH→`edit_draft`, POST (clone|create)→`edit_draft`, POST (approve|publish|retire)→the matching action; missing permission → 403; admin role bypass unchanged.

### 3.5 Minimal UI

- `frontend/src/pages/admin/BeneficiaryPolicySettings.jsx` mounted in `SystemSettingsPage` (admin or explicit `beneficiary_policy.view`): policy version list with status badges/effective dates, create/edit draft modal (metadata + structured financial & application-scope editors — no raw JSON), approve (board ref/date), publish, retire (reason), clone, history drawer. Lives behind per-action permission flags from the `/permissions` endpoint. No scoring builder or simulation UI.
- `frontend/src/pages/admin/Users.jsx` — `beneficiary_policy` module added to the permission matrix (view/edit_draft/approve/publish/retire), defaults explicit-only, consistent with the existing `support` module treatment.

## 4. Test evidence

### 4.1 SQLite (default suite, `php artisan test`)

Full suite result: **174 tests — 173 passed / 1 skipped, 924+ assertions, 0 failures** (regression-clean vs. the pre-POLICY-A baseline of 153 tests).

`tests/Feature/BeneficiaryPolicyEngineTest.php` — **21 tests / 91 assertions**:

| Test | Covers |
|---|---|
| `test_create_draft_via_api` | draft creation via HTTP, config defaults, POLICY_DRAFT_CREATED audit |
| `test_edit_draft_updates_metadata_and_config` | draft editing, POLICY_DRAFT_UPDATED audit |
| `test_full_lifecycle_publish_via_api` | approve → publish flow, approved/published fields + audits |
| `test_published_policy_is_immutable` | PATCH on published/retired → 409; values unchanged |
| `test_clone_preserves_previous_version` | clone lineage (parent_version_id), auto version bump, config copy, original intact |
| `test_retire_published_policy` | retire + retiree fields + POLICY_RETIRED audit |
| `test_invalid_status_transitions_rejected` | publish-unapproved 409, duplicate version 422, approve-published 409, retire-draft 409, publish-retired 409 |
| `test_overlapping_published_policies_rejected` | one-active rule: overlap → 409; sequential future → published |
| `test_historical_policy_preserved_after_supercession` | retired policy + its evaluations preserved after v2 publishes |
| `test_create_evaluation_snapshot` | full snapshot persistence |
| `test_second_evaluation_does_not_overwrite_first` | snapshot immutability (2 records, independent) |
| `test_beneficiary_update_does_not_mutate_prior_evaluation` | beneficiary income change leaves prior snapshot byte-identical |
| `test_policy_change_does_not_mutate_prior_evaluation` | v2 publish leaves v1 evaluations untouched |
| `test_classification_snapshots_preserved_separately` | income/score categories vs degree/need snapshots independent |
| `test_resident_fields_remain_untouched` | resident keeps second_class degree + need level + income behavior; zero implicit evaluations |
| `test_application_scope_values_validated` | invalid scope → 422; all four approved scopes accepted |
| `test_policy_audit_recorded` | full lifecycle audit sequence asserted |
| `test_unauthorized_user_denied` | viewer: GET ok / POST 403; zero-permission user: GET 403 |
| `test_approve_permission_independent_from_edit` | edit allowed, approve denied → 403 |
| `test_publish_permission_independent` | approve allowed, publish denied → 403 |
| `test_rollback_drops_and_recreates_policy_tables` | rollback probe — **skipped on SQLite; runs on PostgreSQL QA** |

### 4.2 Isolated PostgreSQL QA (`ikram_phase2a_qa` @ 127.0.0.1:5432, guarded by `verifyPhase2aTarget()`)

`tests/Postgres/BeneficiaryPolicyEnginePostgresTest.php` — **25 tests / 106 assertions, 0 failures** (inherits the 21-dataset + runs the rollback probe + 4 PG-specific tests):

- `test_postgres_jsonb_config_storage_and_backstops` — `configuration` column is native **jsonb**; partial unique index and date-order CHECK constraint exist.
- `test_postgres_backstop_rejects_duplicate_published_start` — DB-level rejection of two published versions with same scope+effective_from.
- `test_postgres_backstop_rejects_reversed_effective_dates` — DB-level rejection of effective_to < effective_from.
- `test_postgres_fk_behavior_preserves_evaluations` — deleted beneficiary nulls the FK (history retained, no cascade); deleting a policy version referenced by evaluations is restricted.
- `test_rollback_drops_and_recreates_policy_tables` — `migrate:rollback --step=1` drops both tables + PG backstops, `migrate` recreates them.

The QA target guard refuses to run against any database other than `ikram_phase2a_qa` on `127.0.0.1:5432`. No operational/Aiven database was touched.

## 5. Quality gates

| Gate | Result |
|---|---|
| `php artisan test` (SQLite) | ✅ 173 passed / 1 skipped, 0 failures |
| PostgreSQL isolated QA (`ikram_phase2a_qa`) | ✅ 25/25 passed |
| `vendor/bin/pint` (new/changed files) | ✅ clean |
| `npm run lint` (frontend) | ✅ clean |
| `npm run build` (frontend) | ✅ built |
| `git diff --check` | ✅ no whitespace errors (pre-existing CRLF notices only) |
| Pre-existing file protection | ✅ restored `2026_09_09_000002_add_email_to_users_table.php` byte-for-byte after Pint touched it; no `git clean/reset --hard/broad restore`, no commit/push/deploy |

## 6. Conventions honoured

- Additive, reversible migrations; driver-aware JSONB; PG-only backstop constraints; `enum()` columns as in existing migrations.
- Existing audit architecture (`AuditLog::create` with user_id/action/target_table/target_id/details) — no new audit table.
- `ModulePermission` segment-based 403 gating; admin bypass untouched; `SupportDistributionService`-style `abort(409)` + `ValidationException::withMessages` for errors.
- Frontend: existing System Settings UX, axios wrapper, RTL styling, no raw-JSON admin editor.

## 7. Known deferrals / dependencies

- **POLICY-B**: authority contract with `FinancialCalculationService`; counted-income/family/per-capita calculators driven by policy config; resident counted sources (registr-kept keys salary/social_security/citizen_account default).
- **POLICY-C**: scoring engine (documented max 75) + score categories.
- **POLICY-D**: eligibility, exceptions, document matrices, legacy analytics reconciliation.
- **POLICY-E**: application-scope execution (new_only / all_existing_and_new / selected_existing_and_new / effective_from_date) + read-only impact simulation.
- **POLICY-F**: unified beneficiary list + system-wide server-side filtering + filtered exports (ADR-007 decision 6 — **dependency documented, not implemented**).
- **POLICY-G**: final regression + PostgreSQL acceptance + browser/mobile acceptance.

## 8. Final verdict

> **POLICY-A VERIFIED — ACCEPTED — READY FOR POLICY-B** *(as recorded on 2026-09-21 at POLICY-A completion; POLICY-B was subsequently implemented and **VERIFIED — ACCEPTED** — see [POLICY_B_IMPLEMENTATION_REPORT.md](POLICY_B_IMPLEMENTATION_REPORT.md))*
>
> The approved POLICY-A scope is implemented and verified on both the default SQLite suite and the isolated PostgreSQL QA database. Policy versioning (draft→approve→publish→retire with immutability and the one-active rule), structured JSONB configuration with strict validation, immutable privacy-sanitized evaluation snapshots, audit foundation, granular permissions, minimal API/UI are all in place. Residents, the authoritative `FinancialCalculationService`, and existing classification columns were not modified. No recalculation/simulation/bulk evaluation was introduced. POLICY-B … POLICY-G and Phase 2C remain NOT STARTED; no commit/push/deploy was performed.