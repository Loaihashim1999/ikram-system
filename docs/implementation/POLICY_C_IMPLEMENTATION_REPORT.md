# POLICY-C IMPLEMENTATION REPORT — Beneficiary Policy Engine (Income Categories, Point Scoring, Score Categories & Versioned Exceptions)

**Date:** 2026-09-21
**Status:** ✅ **POLICY-C VERIFIED — ACCEPTED**
**ADR:** ADR-007 **APPROVED** ([ADR-007-VERSIONED-BENEFICIARY-POLICY-ENGINE.md](../architecture/ADR-007-VERSIONED-BENEFICIARY-POLICY-ENGINE.md))
**Scope:** POLICY-C only — per-capita income categories (A–D + exclusion), point scoring (6 dimensions, max 75), score categories (A–D), versioned exceptions (orphan-mother ceiling, review-by-default), scoring breakdown snapshots, draft-policy UI sections, tests + isolated PostgreSQL QA + headless-browser acceptance.
**Predecessor contract audit:** [POLICY_C_SCORING_CONTRACT_AUDIT.md](POLICY_C_SCORING_CONTRACT_AUDIT.md)

---

## 1. Scope boundaries (what this phase is and is not)

**Implemented (POLICY-C):**

- **Single authoritative input:** every category, score and exception outcome is driven by the **authoritative `net_income_per_capita`** produced by POLICY-B (`FinancialCalculationService::calculatePolicyFinancials`). POLICY-C **never recomputes income and never maps the legacy Degree/Need taxonomy** to A–D (`income_category`, `score_category`, `degree_classification_snapshot`, `need_level_snapshot` are four independent fields).
- **Income categories** (`PolicyIncomeCategoriesService`): per-capita bands **A 0–400, B 400.01–600, C 600.01–800, D 800.01–1000** against the versioned `income_categories.exclusion_threshold` (default **1000**); per-capita **> threshold → `financially_excluded`**. Bands are stored **ascending**, validated for exact 0.01 contiguity, first band min = 0, top band max = threshold exactly.
- **Point scoring** (`PolicyScoringService` + `PolicyScoringInputs`/`PolicyScoringInputProvider`): six dimensions — **income, housing condition, housing tenure, head health (verified disability %), children health (affected count), head age** — with versioned `scoring.max_score` (default **75**). Boundaries compared in **integer cents** (deterministic, no float drift). Missing/structurally-unavailable data → **review_required** with stable codes (`HOUSING_CONDITION_REVIEW_REQUIRED`, `HOUSING_TENURE_REVIEW_REQUIRED`, `HEAD_HEALTH_REVIEW_REQUIRED`, `CHILDREN_HEALTH_REVIEW_REQUIRED`, `AGE_REVIEW_REQUIRED`, `INCOME_DATA_REVIEW_REQUIRED`) — **never invented, never silent zero**. A verified disability % is accepted **only in the EXACT range `0 ≤ disability_percentage ≤ 100`** (deterministic integer-cents guard against `0`…`10000` cents; `-0.01` → `-1` cents and `100.01` → `10001` cents are rejected with `ValidationException` — **no tolerance window**); `null` disability → head-health review. Under-30 head age and more than 3 affected children resolve to **review_required** in the snapshot (reserved for POLICY-D/E manual review).
- **Score categories**: `score_categories` bands **A 51–75, B 26–50, C 5–25, D 0–4** (ascending, integer-contiguous, top band == `max_score`). The frontend displays bands descending; the persisted config and snapshot keep ascending order.
- **Versioned exceptions** (`PolicyExceptionService`): allowlisted rule code **`orphan_mother`** with a structured condition — **the default authoritative match is `family_status ∈ [widow_with_orphans]` ONLY** (a generic `widow` is **never auto-matched**: orphan status is not provable from the enum alone, so it resolves to **`review_required`** with the stable evidence reason `ORPHAN_MOTHER_EXCEPTION_REVIEW_REQUIRED` until POLICY-D proves it from documentary/legal evidence — the 1200 SAR ceiling is never silently applied to a bare widow) — and a configurable ceiling (`exceptions.rules[].income_ceiling`, default **1200**) that must exceed the exclusion threshold. Above-threshold-within-ceiling → **`EXCEPTION_REVIEW_REQUIRED`** by default (`requires_manual_review: true`), or auto-applied when the config declares the rule authoritative (`requires_manual_review: false`). Missing family-status evidence (`null`) → review required (proof impossible — never a guess); **a published configuration that explicitly broadens the condition to include `widow` is honored verbatim as immutable policy — never silently rewritten**; unmatched-but-present family status → `not_applicable`; disabled rule → the normal exclusion stands.
- **Outcome resolution** (`PolicyOutcomeService::resolve`): fixed precedence `not_applicable → ineligible → excluded && not_applicable → financially_excluded → excluded && exception-review → exception_review_required → scoring/eligibility reviews → policy_review_required → financially_qualified`. **`final_policy_decision` stays null** in every case; intermediate outcomes are stored on the snapshot (`policy_not_applicable`, `policy_ineligible`, `financially_qualified`, `financially_excluded`, `exception_review_required`, `policy_review_required`).
- **Orchestration:** `PolicyFinancialEvaluationService::evaluate()` runs the full pipeline (config `withDefaults` → classify → score → exceptions → merge scoring + eligibility reviews → outcome) and persists `income_category`, `policy_score` (decimal:4), `score_category`, `scoring_snapshot` (components, reviews, reasons, config metadata), `exception_code`, `exception_details`. Evaluation still requires a **published** version; snapshots stay immutable and privacy-sanitized (no national ID/IBAN/phone).
- **Validation:** `PolicyConfigurationValidator` extended with strict per-section validators (income categories, scoring dims incl. coverage 0–100 for health %, score categories, exceptions — conditions only on allowlisted fields/operators/values, no raw JSON/JS/eval), `withDefaults`, SECTIONS allowlist, `MAX_DEPTH` bound, integer-cents comparisons throughout.
- **API / permission:** `POST /api/beneficiary-policy/evaluate` persists all POLICY-C fields; granular `evaluate` (never via `view`; 403 for view-only), draft editors can edit drafts but not approve/publish/evaluate.
- **UI:** System Settings → Beneficiary Policy draft editor adds four POLICY-C sections (income categories, point scoring, score categories, exceptions), a **read-only max-score summary** ("أقصى نقاط قابلة للتحقيق: X من Y"), and **visible client-side overlap/gap/ceiling errors** (mirroring the backend invariants) that block saving until fixed. Threshold ↔ top income band and `max_score` ↔ top score band auto-sync; payloads persist in ascending band order.

**Explicitly NOT implemented in POLICY-C (deferred):**

- Documents / social verification / approvals → POLICY-D.
- Application scope / simulation / bulk evaluation → POLICY-E.
- Unified lists / server-side filtering → POLICY-F.
- Taqnyat (Phase 2C), Azure deployment, commit/push — none authorized and none performed.
- No mass recalculation; no legacy field/service removal; `final_policy_decision` / `degree_classification_snapshot` / `need_level_snapshot` remain null.

## 2. Contract decisions implemented

| Area | Decision |
|---|---|
| Input | `net_income_per_capita` from POLICY-B is the only income input; no recomputation, no Degree→A–D mapping anywhere. |
| Income bands | A 0–400, B 400.01–600, C 600.01–800, D 800.01–1000 (ascending stored, 0.01-contiguous, top == threshold). |
| Exclusion | per-capita > `exclusion_threshold` (default 1000) → `financially_excluded` (stored `included`/`excluded` verdict + category `excluded`). |
| Scoring | 6 dimensions; config max `75`; integer-cents boundaries; missing data → review_required (stable codes); invalid disability % rejected; unresolved (>3 children / under-30) → review. |
| Score categories | A 51–75, B 26–50, C 5–25, D 0–4; stored **separately** from income categories. |
| Exceptions | `orphan_mother`; ceiling default 1200 > threshold; `requires_manual_review` default true; condition on `family_status` only; disabled → exclusion stands. |
| Outcome | Fixed precedence; `final_policy_decision` null; intermediate outcomes stored on snapshot. |
| Config | Strict structured config; defaults via `withDefaults`; snapshots/config immutable after publish. |
| UI | Draft editor sections + read-only max-score summary + saving blocked on visible errors. |

## 3. Deliverables

### 3.1 Services — `app/Services/BeneficiaryPolicy/`

- `PolicyConfigurationValidator` (rewritten) — SECTIONS allowlist, `withDefaults` (+`defaultIncomeCategories`, `defaultScoring`, `defaultScoreCategories`, `defaultExceptions`), per-section strict validators, `toCents()`, `MAX_DEPTH=5`.
- `PolicyIncomeCategoriesService` (new) — authoritative A–D classification + exclusion per threshold.
- `PolicyScoringInputs` (new VO) / `PolicyScoringInputProvider` (new) — structured input extraction (tenure map, age from `date_of_birth`, nulls for condition/disability/children), `fromStructured`/`toArray`.
- `PolicyScoringService` (new) — components, reviews, `scoreCategory()`, cent-based band matching, ValidationException for out-of-range disability %.
- `PolicyExceptionService` (new) — rule matching, `STATUS_APPLICABLE`/`STATUS_REVIEW_REQUIRED`/`STATUS_NOT_APPLICABLE`, reason constants.
- `PolicyOutcomeService` (new) — `resolve()` precedence + `OUTCOME_*` constants (incl. `policy_not_applicable`, `policy_ineligible`).
- `PolicyFinancialEvaluationService` — `evaluate()` wired to the full POLICY-C pipeline; persists all POLICY-C columns.

### 3.2 Model

- `BeneficiaryPolicyEvaluation` — `policy_score` `decimal:4` cast (raw `'26.0000'` strings, asserted as-is).

### 3.3 Frontend

- `BeneficiaryPolicySettings.jsx` — four POLICY-C draft sections + live error panel + read-only max-score summary + auto-sync of thresholds/top bands; payloads in ascending band order for the validator.

## 4. Verification evidence

| Gate | Result |
|---|---|
| `php artisan test` full suite (SQLite) | **314 passed / 1 skipped / 0 failed** (1,371 assertions) |
| POLICY-C feature suites (`PolicyCIncomeCategoriesTest` 14, `PolicyCScoringAndCategoriesTest` 50, `PolicyCExceptionsSnapshotAuthTest` 21) | **85/85 passed** (313 assertions) — covers mandate items 1–83 (+ API visibility): band boundaries & exact-contiguity validation, threshold cases (400/400.01/600/800/1000/1400), burden-of-proof missing-data behavior, score-category boundaries (75/51/50/26/25/5/4/0), income-vs-score independence, no Degree→A–D mapping, exception ceiling/disable/auto-apply/evidence-missing, snapshot persistence & immutability, privacy sanitization, 401/403 authorization matrix, and POLICY-A/B/2A/2B regressions |
| Isolated PostgreSQL QA (`tests/Postgres/PolicyCPostgresTest.php`, guarded `ikram_phase2a_qa` bootstrap) | **25/25 passed** (155 assertions) — scoring_snapshot JSONB, `policy_score` numeric(12,4), varchar(50) category columns, versioned scoring/exception config round-trip, exception persistence, `down()/up()` rollback re-creates all POLICY-C columns |
| Pint (`vendor/bin/pint` on touched files, then `--test`) | clean (12/12 files fixed + verified) |
| `git diff --check` | clean |
| Frontend `npm test` | 52 vitest tests passed |
| Frontend `npm run lint` (eslint) | clean |
| Frontend `npm run build` (vite) | clean |
| Browser acceptance (`tests/Browser/policyc-settings-gate.mjs`, isolated SQLite + `php -S` + headless Chromium) | **25/25 PASS** — four POLICY-C sections render, read-only max-score summary (75 من 75) shown, overlap error blocks save & fix unlocks, exception-ceiling error blocks save & fix unlocks, full POLICY-C draft saved through the UI (row listed), `/api/` all proxied to the isolated server — **no remote/hosted-API round-trips (0)** |

Regression guarantees re-verified: POLICY-B financial outputs unchanged (4200/1500/2200/440), resident `not_applicable` with empty snapshots, POLICY-A lifecycle via service + API, Phase 2B support-delivery flow, published-version authority, snapshot immutability after a policy change, permission matrix (401/403), and privacy sanitization.

## 5. Post-verification corrections (2026-09-21, final normalization)

Two narrow corrections were applied after the initial verdict; both are covered by the re-run gates below (§6 evidence and the updated test suites):

1. **Disability percentage boundary — EXACT `0 ≤ disability_percentage ≤ 100`.** Accepted only within `[0, 100]` inclusive; `-0.01` and `100.01` are rejected with `ValidationException` (deterministic cent guard `0`…`10000`). No tolerance window such as `[-0.01, 100.01]` exists. Pinned by `test_disability_valid_range_is_exactly_0_to_100_inclusive` plus the existing `-0.01` / `100.01` rejection tests.
2. **Orphan-mother default match — `widow_with_orphans` ONLY.** The default authoritative structured match is `widow_with_orphans`; a generic `widow` does **not** auto-match and — without authoritative structured orphan evidence — returns `review_required` with the stable reason `ORPHAN_MOTHER_EXCEPTION_REVIEW_REQUIRED` until POLICY-D supplies documentary/legal proof. The 1200 SAR ceiling is never silently applied to a bare widow. Where a **published** version explicitly broadens the condition to include `widow`, that immutable configuration is honored verbatim (draft/new-version mechanism is required to change it, per ADR-007); the default correction only affects future evaluations.
3. **Historical safety.** No prior evaluation snapshot and no published configuration is ever mutated; the correction applies only to future evaluations under the corrected default path (`test_historical_snapshot_unchanged_after_correction`, `test_published_broad_widow_condition_honored_as_immutable`).

## 6. Verdict

✅ **POLICY-C VERIFIED — ACCEPTED.** Income categories, point scoring (max 75), score categories and versioned exceptions are implemented through the authoritative POLICY-B per-capita input, persisted in immutable versioned snapshots with strict deterministic integer-cents validation, and verified on SQLite (full suite + dedicated suites), isolated PostgreSQL QA, Pint, frontend gates, and headless-browser acceptance — without ever mapping the legacy Degree/Need taxonomy or setting `final_policy_decision`. POLICY-C completes here; **POLICY-D … POLICY-G and Phase 2C are NOT started**, no commit/push/deploy was made, and the next phase requires separate explicit approval.