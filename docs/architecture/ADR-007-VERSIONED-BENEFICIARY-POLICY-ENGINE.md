# ADR-007 — Versioned Beneficiary Policy Engine

**Date:** 2026-09-21. **Status:** ✅ APPROVED — design review accepted the six closing decisions; POLICY-A (data model, policy versioning & evaluation snapshots) **VERIFIED — ACCEPTED**; POLICY-B (authoritative financial policy + eligibility) **VERIFIED — ACCEPTED**; and POLICY-C (income categories, point scoring, score categories & versioned exceptions) **VERIFIED — ACCEPTED** (2026-09-21), each as explicit user-authorized code phases. Authority: explicit user authorization (2026-09-21) to execute POLICY-A, POLICY-B and POLICY-C as code after the reviewed design. Evidence: [BENEFICIARY_POLICY_GAP_AUDIT.md](../implementation/BENEFICIARY_POLICY_GAP_AUDIT.md), [BENEFICIARY_POLICY_IMPLEMENTATION_PLAN.md](../implementation/BENEFICIARY_POLICY_IMPLEMENTATION_PLAN.md), [POLICY_A_IMPLEMENTATION_REPORT.md](../implementation/POLICY_A_IMPLEMENTATION_REPORT.md), [POLICY_B_IMPLEMENTATION_REPORT.md](../implementation/POLICY_B_IMPLEMENTATION_REPORT.md), and [POLICY_C_IMPLEMENTATION_REPORT.md](../implementation/POLICY_C_IMPLEMENTATION_REPORT.md).

> **Approved closing decisions (design review, 2026-09-21):**
> 1. The resident policy stays separate — resident degree/need/income behavior is **not** modified by POLICY-A (no Degree→A–D migration, no recalculation).
> 2. Citizen default **counted income** = salary + social_security + citizen_account; the registry keeps retirement, family_support, social_insurance, other — not counted by default.
> 3. `family_size` = head + active dependents (head included).
> 4. `per_family_member_deduction` = **100 SAR** default, stored in versioned configuration (never hardcoded in code).
> 5. Degree/Need and A–D taxonomies are stored **independently**, with no mapping between them.
> 6. Server-side column filtering is **deliberately deferred to POLICY-F** — it is documented as a dependency, not implemented in POLICY-A.

> Current acceptance (2026-09-23): **POLICY-G VERIFIED — BENEFICIARY POLICY ENGINE ACCEPTED**. POLICY-A through POLICY-F operate together; final evidence is recorded in `POLICY_G_FINAL_ACCEPTANCE_REPORT.md`. Phase 2C remains unstarted.

## Context

- The approved source policy «سياسة صرف المساعدات للمستفيدين» Version 4 — 2026 introduces per-capita income classification (A–D, exclusion >1000, orphan-mother up to 1200), a family deduction, point scoring (documented max 75), separate score categories (A–D), document requirements, exceptions, application scopes, impact simulation, a unified permanent/daily beneficiary listing, and system-wide server-side column filtering.
- The current IKRAM system classifies by Degree (first/second_class) and Resident Need Level through the authoritative `FinancialCalculationService`; it has no policy versioning, no evaluation snapshots, no scoring, no exceptions, no application scopes, no simulation, no unified listing, and only partial client-side filtering. `FinancialCalculationService` is the sole authoritative financial calculator (master-design decisions 2/6, ADR-002/003).

## Decision (approved)

1. Adopt a **versioned Beneficiary Policy Engine**: policy versions (draft → approved → published → retired, immutable when published, with effective_from/effective_to, approved_by/published_by, source-policy reference, board-approval reference, change reason, parent-version lineage, and audit history).
2. **Preserve the single, authoritative financial calculator.** The engine consumes `FinancialCalculationService` results for eligibility, policy categorization, scoring, exceptions and policy evaluation. It **never duplicates core financial arithmetic**. Formula extensions (family deduction, per-capita) are expressed as policy-driven components inside the authoritative calculator or consumed from it as pre-computed authoritative values.
3. **Preserve current classification.** First Degree / Second Degree / Resident Need Level and priority types remain untouched; per-capita income categories (A–D), score categories (A–D), eligibility verdicts and exception results are stored **in parallel** in immutable per-beneficiary evaluation snapshots linked to the producing policy version.
4. **Mandatory application scope.** Every change affecting calculations, eligibility, classification, scores, documents or exceptions requires an explicit scope (new-only / all+new re-evaluation / selected cohort / effective-from). No silent mass update. **Read-only impact simulation precedes any application to existing beneficiaries.**
5. **No permanent hardcoded policy values.** All values (deduction, brackets, points, scores, caps, exception limits, document rules) are configuration defaults under General Admin control via the versioned configuration; source-policy Version-4 values are the initial defaults pending approval.
6. **Unified listing and filtering are query-only conveniences:** a read-only unified beneficiary page labels PERMANENT/DAILY and deep-links to the source record; it does not merge domains or inventory. Filtering across major admin tables becomes server-side with combined filters, Clear All, active-filter indicator, and authorized exports (EXPORT FILTERED vs EXPORT ALL AUTHORIZED). **Server-side filtering itself is POLICY-F work.**
7. Implementation proceeds only through the controlled sub-phases POLICY-A → POLICY-G defined in the implementation plan, each requiring explicit approval.

## Implemented in POLICY-A (verified scope)

| Area | Delivered |
|---|---|
| Data model | `beneficiary_policy_versions` + `beneficiary_policy_evaluations` (additive, reversible, PostgreSQL-compatible; JSONB on PostgreSQL, `json` on SQLite; no changes to beneficiary classification columns) |
| Policy lifecycle | draft → approve → publish → retire; published/retired immutable; one-active-policy overlap rule (service-level, plus PostgreSQL partial-unique + date-order backstops) |
| Versioned config | structured JSONB (sections: financial, eligibility, income_categories, scoring, score_categories, documents, exceptions, application_scope), strict validation, defaults (100 SAR deduction; salary+social_security+citizen_account counted); no raw-JSON admin UX |
| Evaluation snapshots | immutable per-beneficiary records; new evaluation = new record; privacy sanitization (national ID/IBAN/images/tokens stripped); degree/need snapshots stored independently |
| Audit | POLICY_DRAFT_CREATED / POLICY_DRAFT_UPDATED / POLICY_APPROVED / POLICY_PUBLISHED / POLICY_RETIRED on the existing `audit_logs` architecture |
| Permissions | `beneficiary_policy: view / edit_draft / approve / publish / retire`; admin full; others explicit-only via `ModulePermission` |
| API | GET versions list/single/history/permissions, POST draft, PATCH draft, POST clone/approve/publish/retire |
| UI (minimal) | System Settings → Beneficiary Policy (list/status/version/effective dates, create/view/edit draft, approve, publish, retire, history) |
| Not in scope | live beneficiary recalculation, simulation, bulk evaluation, server-side filtering, Degree→A–D migration, UI scoring builder (all deferred to POLICY-B … POLICY-G) |

## Implemented in POLICY-B (verified scope)

| Area | Delivered |
|---|---|
| Authoritative financial contract | `FinancialCalculationService::calculatePolicyFinancials(Beneficiary, BeneficiaryPolicyVersion)` — the ONE policy financial implementation (legacy `calculate()` untouched). Counted-income (registry sources, never the legacy `income_sources` array), validated numeric/non-negative/≤DECIMAL(14,2) amounts, rent safe modes (`financial.rent_mode`: `annual_preference` default / `direct_monthly_preference`), authoritative family size = 1 + active dependents, `per_family_member_deduction` from versioned config (100 SAR default), adjusted net household income (clamped ≥ 0), net income per capita, deterministic `ROUND_HALF_UP` 2-dp. |
| Rent input integrity | **New decision:** `beneficiaries.monthly_rent_direct_input` (additive nullable decimal(14,2)) — the legacy `monthly_rent` column doubles as the computed preview (annual/12 XOR direct), so the raw direct monthly input is captured at the input boundary (BeneficiaryController store/update) and consumed by direct mode; never summed with annual (never double-counted). |
| Eligibility contract | `BeneficiaryPolicyEligibilityService` — authoritative verdicts `eligible | ineligible | review_required | not_applicable` with stable reason-code constants; review gates allowlisted in config (`eligibility.review.*`, default true); decisions: resident citizen-policy → `not_applicable` (never silently applied), suspended → `ineligible`, under-review → `BENEFICIARY_UNDER_REVIEW_REQUIRED`, else review flags (`FAMILY_SUPPORT_STATUS_REVIEW_REQUIRED`, `MALE_UNDER_40_MEDICAL_REVIEW_REQUIRED`, `SERVICE_AREA_REVIEW_REQUIRED`, `LANDLORD_RELATION_REVIEW_REQUIRED`, `POLICY_DOCUMENT_REVIEW_REQUIRED`) or `eligible`. |
| Orchestration & snapshots | `PolicyFinancialEvaluationService` — requires an explicit **published** version (409 otherwise), creates a NEW immutable snapshot via the extended `BeneficiaryPolicyEvaluationService::create()` (input + financial snapshots incl. `rent_mode`/`policy_version`/`precision`; POLICY-C fields stay null; snapshot privacy-sanitized). |
| API / permission | `POST /api/beneficiary-policy/evaluate` (single record, granular `evaluate` permission — never via `view`; admin full; ModulePermission enforces). |
| Schema (additive) | beneficiaries += `social_insurance_amount`, `other_income_amount`, `monthly_rent_direct_input` (nullable decimals); dependents += `is_active` default true (+`scopeActive`); beneficiary_policy_evaluations += `eligibility_decision` string(30) + `eligibility_reasons` (JSONB/json). Reversible via `down()`. |
| UI (minimal) | System Settings → Beneficiary Policy draft form: rent-mode select, counted-income checkboxes, eligibility review-gate toggles, draft-only warning; Users → `beneficiary_policy` matrix gains `evaluate: تقييم مالي`. |
| Not in scope | scoring/categories/A–D (POLICY-C), documents/social/approvals (POLICY-D), scope/simulation/bulk (POLICY-E), lists/filtering (POLICY-F), Taqnyat (2C); no mass recalculation; `final_policy_decision` / `income_category` / `policy_score` / `score_category` remain null; no legacy field/service removal. |

## Implemented in POLICY-C (verified scope)

| Area | Delivered |
|---|---|
| Income categories | `PolicyIncomeCategoriesService` — authoritative per-capita categories **A (0–400), B (400.01–600), C (600.01–800), D (800.01–1000)** driven by `income_categories.exclusion_threshold` (default 1000); per-capita `> threshold` → **`financially_excluded`** (`included`/`excluded` verdict inside the snapshot). Bands ascend strictly by 0.01 with the top band exactly at the threshold. Input is **always the authoritative `net_income_per_capita`** produced by POLICY-B — never recomputed, never the legacy degree mapping. |
| Point scoring | `PolicyScoringService` + `PolicyScoringInputs`/`PolicyScoringInputProvider` — six dimensions (income, housing condition, housing tenure, head health, children health, age) with versioned bands/values, reviewed configs, `max_score` (default **75**), deterministic integer-cents boundary comparison, and stable review reason codes (`HOUSING_CONDITION_REVIEW_REQUIRED`, `HEAD_HEALTH_REVIEW_REQUIRED`, `CHILDREN_HEALTH_REVIEW_REQUIRED`, `HEAD_AGE_UNRESOLVED`). Missing/structurally-unavailable data → **review_required** (never silent zero, never invented); a verified disability % is accepted **only in the EXACT range 0–100 inclusive** (`-0.01` and `100.01` rejected with `ValidationException` — deterministic integer-cents guard, no tolerance window). |
| Score categories | `score_categories` bands **A (51–75), B (26–50), C (5–25), D (0–4)** stored separately from income categories (`income_category` ≠ `score_category`, both persisted on the evaluation). No Degree→A–D conversion exists anywhere. |
| Versioned exceptions | `PolicyExceptionService` — allowlisted `orphan_mother` exception (condition values **`[widow_with_orphans]` by default — the ONLY authoritative structured match**; a generic `widow` is **never auto-matched** and resolves to `ORPHAN_MOTHER_EXCEPTION_REVIEW_REQUIRED` until POLICY-D proves orphan status from documentary/legal evidence; a published configuration that explicitly broadens the condition to include `widow` is honored verbatim as immutable policy — never silently rewritten), `income_ceiling` default **1200** > exclusion threshold, `requires_manual_review` default **true**. Above-threshold-within-ceiling → `EXCEPTION_REVIEW_REQUIRED` (default) or auto-applied when the config is authoritative; missing family-status evidence → review required; disabled rule → normal exclusion stands. |
| Orchestration | `PolicyFinancialEvaluationService::evaluate()` now runs the full POLICY-C pipeline (config `withDefaults` → classify → score → exceptions → merge scoring reviews with eligibility reviews → `PolicyOutcomeService::resolve()`). **`final_policy_decision` stays null.** New outcome precedence: `not_applicable` → `ineligible` → `financially_excluded` → `exception_review_required` → `policy_review_required` → `financially_qualified`; POLICY-B outcomes preserved. Persists `income_category`, `policy_score` (decimal(12,4)), `score_category`, `scoring_snapshot`, `exception_code`, `exception_details`. |
| Validation & privacy | `PolicyConfigurationValidator` extended with strict per-section validators (income bands, scoring dims incl. coverage 0–100 for health %, score bands, exceptions) using integer cents, `withDefaults`, SECTIONS allowlist and confirmable missing-data policy (`INCOME_DATA_REVIEW_REQUIRED`); server keeps deterministic integer-cents boundaries, no raw JSON/JS/eval; snapshots remain privacy-sanitized (no national ID/IBAN/phone). |
| API / permission | unchanged surface; `POST /api/beneficiary-policy/evaluate` persists all POLICY-C fields; granular `evaluate` permission enforced (view-only cannot persist), draft editors cannot publish/evaluate. |
| UI | System Settings → Beneficiary Policy draft editor gains four POLICY-C sections (income categories, point scoring, score categories, exceptions) with a read-only max-score summary, live client-side overlap/gap/ceiling errors that block saving, auto-sync of top bands (threshold ↔ top income band, `max_score` ↔ top score band); payloads keep ascending band order for the backend. |
| Tests | 85 POLICY-C feature tests (mandate 1–83 + API visibility) in `PolicyCIncomeCategoriesTest`, `PolicyCScoringAndCategoriesTest`, `PolicyCExceptionsSnapshotAuthTest`; PostgreSQL QA in `tests/Postgres/PolicyCPostgresTest` (JSONB scoring/exception storage, decimal(12,4), rollback/re-migrate); browser acceptance `tests/Browser/policyc-settings-gate.mjs` (isolated SQLite, all `/api/` proxied to the local server — the hosted API is never contacted). |
## POLICY-D application integration — 2026-09-22
- Separate assessment/review tables (`social_assessments`, `document_verifications`, `medical_evidence`, `policy_decisions`) linked to beneficiary and evaluation; binary files stay in existing storage; snapshots store structured verification results only.
- Versioned `documents` config section (`defaultDocuments`, `validateDocuments`) with structured rules (no executable conditions) for family_record, national_id, electricity_bill, rental_contract, death_certificate, divorce_deed, dependency_deed, medical_evidence, income_evidence.
- Medical evidence: verified disability % only from authoritative structured evidence (`0..100` inclusive, deterministic); boolean `has_special_needs` never invents percentage.
- Social assessment: structured recommendation (`pending_review`/etc.), housing_condition (`poor`/`average`/`good`), service_area verification (`verified_inside`/`verified_outside`/`review_required`), landlord_relationship (`no_prohibited_relationship`/`prohibited_relationship`/`review_required`).
- Approval/rejection: `PolicyApprovalService` writes `PolicyDecision` with stable reason code, evidence summary reference (structured, no binaries), actor, timestamp; `PolicyDecision` is the permanent decision history; the evaluation row, including `final_policy_decision`, is not rewritten.
- Generic `widow` (not `widow_with_orphans`) remains `review_required` for orphan-mother exception until documentary/legal evidence is verified through `DocumentVerification`; the 1200 SAR ceiling never silently applies.
- No bulk evaluation; no mass recalculation; no scope/simulation; evaluation history preserved immutably.

Not in scope | scope/simulation/bulk (POLICY-E); lists/filtering (POLICY-F); Taqnyat (2C); Governance / Reports Finalization (before Full System Acceptance); no mass recalculation; `final_policy_decision` remains unchanged; current final state is derived from the controlled `PolicyDecision` history. |

### Corrections (2026-09-21, post-verification normalization)

- **Disability % valid range is EXACTLY `0..100` inclusive** (deterministic cent guard `0..10000`); `-0.01` and `100.01` are rejected with `ValidationException` — there is no tolerance window.
- **Orphan-mother default structured match is `widow_with_orphans` ONLY.** A generic `widow` is not auto-matched; without authoritative structured orphan evidence it resolves to `ORPHAN_MOTHER_EXCEPTION_REVIEW_REQUIRED` until POLICY-D documentary/legal proof. The 1200 SAR ceiling is never silently applied to a bare widow. An immutable **published** version that deliberately broadened the condition to include `widow` remains honored verbatim (changed only via the draft/new-version mechanism).
- **Historical safety:** no prior evaluation snapshot and no published configuration is ever mutated; corrections apply only to future evaluations under the corrected path.

## Consequences

- Additive data model (policy versions, evaluation snapshots, exceptions registry, document matrices, assessment records); existing tables/columns untouched. Residents are untouched by design decision 1.
- Resident counted-income source list and the retirement/family_support inclusion are explicit decisions recorded before POLICY-B implementation.
- Degree/Need and A–D taxonomies stay independent (approved decision 5); mapping is explicitly not implemented.
- Legacy analytics branches querying statuses `approved/rejected/inactive` (dead with the current enum) are reconciled in a controlled step under POLICY-D.
- No Phase 2C (Taqnyat), Azure deployment, commit or push authorization is implied.
- POLICY-E … POLICY-G are **NOT STARTED**; the engine as a whole is not fully implemented.

## References

- `docs/implementation/BENEFICIARY_POLICY_GAP_AUDIT.md`
- `docs/implementation/BENEFICIARY_POLICY_IMPLEMENTATION_PLAN.md`
- `docs/implementation/POLICY_A_IMPLEMENTATION_REPORT.md`
- `docs/implementation/POLICY_B_IMPLEMENTATION_REPORT.md`
- `docs/implementation/POLICY_C_IMPLEMENTATION_REPORT.md`
- `docs/architecture/TO_BE_MASTER_DESIGN.md` (decisions 2/6, sections 14–17)
- `docs/implementation/IMPLEMENTATION_ROADMAP.md` (§3)

## POLICY-D integration amendment (authoritative over earlier status summaries)

The earlier settings-only browser smoke (10/10) did not establish application integration. POLICY-D now has an evaluation-scoped routed review page, beneficiary-detail navigation, authenticated read/evidence/social/decision endpoints, independent nested permissions and real API acceptance tests included in the default Feature suite. The services remain authoritative; `PolicyReviewService` provides a read-only evidence overlay and no alternative financial/scoring engine.

All review mutations serialize on the evaluation row; finalized evaluations refuse subsequent writes. Approval requires scoped verified documents, reviewed social findings and no unresolved blockers. Stable reason code/explanation and server-derived evidence references are retained in `PolicyDecision`. Unknown policy ambiguities are not overridden by a high score, an income category or client-supplied evidence claims. The assessment reason-resolution helper also reads persisted evidence instead of trusting its legacy input argument.

Historical input, financial and scoring snapshots remain byte-for-byte unchanged. `final_policy_decision` is not a mutable approval cache. `current_state` in the review response derives from permanent decision history. This clarification supersedes all earlier wording suggesting an update to that evaluation column.

Fresh browser, API, audit, regression and guarded PostgreSQL evidence and the final verdict are recorded in [POLICY_D_IMPLEMENTATION_REPORT.md](../implementation/POLICY_D_IMPLEMENTATION_REPORT.md). No schema change is required for this integration. POLICY-E remains unstarted pending explicit authorization.

## POLICY-E1 foundation amendment (authoritative over earlier "POLICY-E unstarted" notes) — 2026-09-22

POLICY-E1 (application-scope contract & run ledger foundation) was explicitly authorized and implemented:

- **Scope contract finalized** in `PolicyConfigurationValidator`: exactly four modes (`new_only`, `all_existing_and_new`, `selected_existing_and_new`, `effective_from_date`); unknown modes/keys rejected; `effective_from_date` is a canonical `YYYY-MM-DD` date owned by the immutable published configuration, required for its mode and forbidden otherwise. Selected existing beneficiary IDs are **run-level parameters, never policy configuration**.
- **Run ledger** (additive, reversible, PG-safe): `policy_application_runs` + `policy_application_run_items` with UUID PKs, JSONB scope parameters / simulation snapshots, unique `(run_id, beneficiary_id)` idempotency backstop, enum-status CHECK constraints and PG non-negative counter CHECKs.
- **Guarded state machines** (`PolicyApplicationRun`, `PolicyApplicationRunItem`): `draft → simulated → approved_for_execution → running → completed | completed_with_errors | failed`, cancellation only from pre-running states; item states `pending → simulated → processing → completed | review_required | not_applicable | failed` with explicit retry from `failed`.
- **Deterministic fingerprint** (`PolicyApplicationScopeService`): sha256 over `policy_version_id` + `scope_mode` + normalized parameters; sensitive fields structurally excluded. `candidate_set_hash` / item snapshots reserved for POLICY-E2 staleness proof.
- **Permissions**: `beneficiary_policy:simulate | apply_scope | execute_reevaluation | view_application_runs` in the nested ModulePermission model; admin full; no implicit escalation; contract-proven via HTTP middleware tests.
- **Audit contract**: `POLICY_APPLICATION_RUN_CREATED`, `POLICY_SCOPE_SIMULATED`, `POLICY_APPLICATION_RUN_STARTED`, `POLICY_APPLICATION_RUN_COMPLETED`, `POLICY_APPLICATION_RUN_COMPLETED_WITH_ERRORS`, `POLICY_APPLICATION_RUN_CANCELLED` — fired only on real service actions.
- The `all_existing_and_new` default is **not** execution authorization; no automatic processing, no observers, no registration hooks, no business calculation (POLICY-B/C/D services untouched).

**NOT implemented:** POLICY-E2 simulation, POLICY-E3 execution/retry, POLICY-E4 registration integration, POLICY-E5 UI. POLICY-E as a whole is **NOT complete**. Evidence: [POLICY_E1_RUN_LEDGER_IMPLEMENTATION_REPORT.md](../implementation/POLICY_E1_RUN_LEDGER_IMPLEMENTATION_REPORT.md). POLICY-E2 requires fresh explicit approval.

Future ordering: Beneficiary Policy Engine → Phase 2C Taqnyat → Notification Coverage Audit → PDF Finalization → Governance / Reports Finalization → Full System Acceptance → Azure Deployment Audit → Azure Production Deployment. No deployment is authorized here.

## POLICY-E5 final acceptance amendment — 2026-09-23

POLICY-E1–E4 are integrated with the production admin area through the Arabic application-run page and real run APIs. The UI keeps simulation visibly read-only, gates controls from nested `beneficiary_policy` permissions, exposes bounded impact details and run history, and leaves backend authorization authoritative. The isolated local browser gate passed 31/31 with zero unexpected remote requests. POLICY-E is **VERIFIED — READY FOR POLICY-F**; no POLICY-F work is included.


### Final integration acceptance

**POLICY-D VERIFIED — READY FOR POLICY-E** (2026-09-22). Actual routed review browser 44/44, zero failures and zero unexpected remote requests; default backend 355 passed +1 existing skip /1543 assertions; targeted POLICY-D 36/36 /146 assertions; fresh local PostgreSQL 51/51 /268 assertions; frontend 56 passed with lint/build; Pint and diff check passed. POLICY-E is not started and requires explicit user approval.

## POLICY-G final acceptance amendment — 2026-09-23

POLICY-A through POLICY-F are integrated and accepted. The final gate covered lifecycle/versioning, authoritative financial and scoring pipelines, documentary/social decisions, application simulation/execution/future registration, immutable history, unified query/export, independent permissions and inventories, PostgreSQL constraints, real two-process locking, desktop/mobile browser behavior and Phase 2A/2B regressions. The authoritative counts, defects fixed and remaining operational risk are in [POLICY_G_FINAL_ACCEPTANCE_REPORT.md](../implementation/POLICY_G_FINAL_ACCEPTANCE_REPORT.md). This amendment supersedes earlier current-status statements; Phase 2C is the next separately authorized roadmap phase and was not started.
