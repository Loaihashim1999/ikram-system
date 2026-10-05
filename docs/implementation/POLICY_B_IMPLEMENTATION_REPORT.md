# POLICY-B IMPLEMENTATION REPORT — Beneficiary Policy Engine (Authoritative Financial Policy + Eligibility)

**Date:** 2026-09-21
**Status:** ✅ **POLICY-B VERIFIED — ACCEPTED**
**ADR:** ADR-007 **APPROVED** ([ADR-007-VERSIONED-BENEFICIARY-POLICY-ENGINE.md](../architecture/ADR-007-VERSIONED-BENEFICIARY-POLICY-ENGINE.md))
**Scope:** POLICY-B only (authoritative financial contract via `FinancialCalculationService`, counted-income, rent normalization, family size, per-member deduction, adjusted net household income, per-capita, basic eligibility with stable reason codes, POLICY-A-consistent immutable snapshots, General Admin financial-policy UI, tests + isolated PostgreSQL QA).

---

## 1. Scope boundaries (what this phase is and is not)

**Implemented (POLICY-B):**

- **Single authoritative calculator:** `FinancialCalculationService::calculatePolicyFinancials(Beneficiary, BeneficiaryPolicyVersion)` — the ONE policy financial implementation. Legacy `calculate()` (Degree / priority / resident need-level) is **untouched**.
- **Counted-income sources** from the income registry (salary → `monthly_salary`, social_security → `social_security_amount`, citizen_account → `citizen_account_amount`, retirement → `retirement_pension`, family_support → `family_support`, social_insurance → `social_insurance_amount`, other → `other_income_amount`). Counted set is versioned config (default: salary + social_security + citizen_account). An "available" source means recorded amount > 0 (0 is the canonical "no income"; legacy NOT NULL columns default to 0). The legacy `income_sources` array does **not** gate policy counting.
- **Amount validation:** numeric, non-negative, ≤ DECIMAL(14,2) bound — enforced by the calculator on RAW (uncast) values so junk can never reach arithmetic silently; deterministic `round(…, 2)` with `PHP_ROUND_HALF_UP`.
- **Rent normalization:** versioned `financial.rent_mode` = `annual_preference` (default; annual ÷ 12, matches legacy) or `direct_monthly_preference`. The two modes are never summed. **New decision:** raw direct monthly rent is captured at the input boundary into `beneficiaries.monthly_rent_direct_input` (the legacy `monthly_rent` column doubles as the computed preview and would otherwise clobber the direct input). Records captured before the column fall back to the stored preview.
- **Family size:** authoritative = 1 + active dependents (`dependents.is_active`, default true; min 1). `family_members_count` is cached/reference only.
- **Per-member deduction:** versioned `financial.per_family_member_deduction` (default 100 SAR), applied × family size — policy config, **never hardcoded**.
- **Formula:** `adjusted_net_household_income = max(0, counted_gross − monthly_rent − family_member_deduction)`; `net_income_per_capita = adjusted / family_size` (2-dp).
- **Eligibility contract:** `BeneficiaryPolicyEligibilityService` verdicts `eligible | ineligible | review_required | not_applicable` + stable reason-code constants; allowlisted review gates in `eligibility.review.*` (documents, service_area, landlord_relation, family_status, male_under_40; default true).
- **Orchestration & immutable snapshots:** `PolicyFinancialEvaluationService` — requires an explicit **published** version (draft → 409), creates a NEW snapshot per evaluation via the extended `BeneficiaryPolicyEvaluationService::create()`; POLICY-C fields stay null; privacy sanitization unchanged.
- **API:** `POST /api/beneficiary-policy/evaluate` (single record; granular `evaluate` permission — never via `view`). No bulk/simulation.
- **UI:** System Settings → Beneficiary Policy draft form (rent-mode select, counted-income checkboxes, eligibility review-gate toggles, "affects this draft only" warning); Users → `beneficiary_policy` matrix gains `evaluate: تقييم مالي`.

**Explicitly NOT implemented in POLICY-B (deferred):**

- Scoring / categories / A–D classification → POLICY-C. `income_category`, `policy_score`, `score_category`, `final_policy_decision` all stay **null**.
- Documents / social verification / approvals → POLICY-D.
- Application scope / simulation / bulk evaluation → POLICY-E.
- Unified lists / server-side filtering → POLICY-F.
- Taqnyat (Phase 2C), Azure deployment, commit/push — none authorized and none performed.
- No mass recalculation; no legacy field/service removal.

## 2. Contract decisions implemented

| Area | Decision |
|---|---|
| Calculator | `calculatePolicyFinancials(Beneficiary, BeneficiaryPolicyVersion)` is the single authoritative policy calculator; eligibility is a separate consumer service. |
| Rent | Safe modes `annual_preference` (default) / `direct_monthly_preference`; recorded as `rent_mode` in the snapshot; never sums both; negative/non-numeric rejected. |
| Rent input | `monthly_rent_direct_input` column captures the raw direct input at the controller boundary (additive; legacy preview behavior unchanged). |
| Family size | 1 + active dependents (min 1); `family_members_count` cached reference only. |
| Deduction | Policy config `financial.per_family_member_deduction` (default 100); never hardcoded in arithmetic. |
| Money | `round(…, 2)` PHP_ROUND_HALF_UP; max 999999999999.99. |
| Eligibility | Enumerated verdicts + reason codes; configuration-driven review gates; resident citizen-policy evaluation → `not_applicable` (never silently applied). |
| Snapshot | Immutable; includes policy version id/version, calculated_at, rent_mode, precision metadata, income breakdown (available/counted/not_counted + amounts). |
| Authority | Draft versions can never drive evaluation (409). One-active-policy publish rule unchanged (POLICY-A). |

## 3. Deliverables

### 3.1 Migration — `database/migrations/2026_09_21_020000_policy_b_financial_eligibility_extension.php`

- `beneficiaries` += `social_insurance_amount`, `other_income_amount` (nullable decimal(14,2)), `monthly_rent_direct_input` (nullable decimal(14,2)).
- `dependents` += `is_active` (boolean, default true).
- `beneficiary_policy_evaluations` += `eligibility_decision` string(30) nullable, `eligibility_reasons` JSONB (PostgreSQL) / `json` (SQLite) nullable.
- Reversible `down()` drops only the added columns (verified on PostgreSQL QA with a rollback/re-migrate probe).

### 3.2 Models

- `Beneficiary` — fillable/casts for `social_insurance_amount`, `other_income_amount`, `monthly_rent_direct_input`.
- `Dependent` — `is_active` + `scopeActive`.
- `BeneficiaryPolicyEvaluation` — `ELIGIBILITY_*` constants + `eligibility_reasons` array cast. Immutability remains **flow-level** (no model update/delete guard added — no such routes exist).

### 3.3 Services — `app/Services/BeneficiaryPolicy/`

- `PolicyConfigurationValidator` — added `RENT_MODES`, `DEFAULT_RENT_MODE`, `ELIGIBILITY_REVIEW_KEYS`; `validate()`/`withDefaults()` cover rent_mode + eligibility.review (allowlisted).
- `FinancialCalculationService` — `POLICY_*` constants; `calculatePolicyFinancials()` + helpers (`policySourceAmounts` → source=>float over raw values, `policyIncomeBreakdown` → available = amount > 0, `policyMonthlyRent` → mode-safe rent, validatedPolicyAmount). Legacy `calculate()` untouched.
- `BeneficiaryPolicyEligibilityService` (new) — verdict + 10 reason-code constants.
- `PolicyFinancialEvaluationService` (new) — orchestrator; resident → `not_applicable` empty-financial snapshot; POLICY-C fields null.
- `BeneficiaryPolicyEvaluationService` — extended `create()` to persist `eligibility_decision` + `eligibility_reasons`.

### 3.4 Controller / routes / permission

- `BeneficiaryPolicyController` — new `evaluate()` (single record; published-version 409; resident `not_applicable`) and `permissions()` incl. `evaluate`.
- `routes/api.php` — `POST /api/beneficiary-policy/evaluate`.
- `ModulePermission` — `POST …/evaluate` → action `evaluate` (admin bypass unaffected).

### 3.5 Frontend

- `BeneficiaryPolicySettings.jsx` — draft form gains rent-mode select, counted-income checkboxes, eligibility review-gate toggles, draft-only warning.
- `Users.jsx` — `beneficiary_policy` permission matrix gains `evaluate: تقييم مالي`.

## 4. Verification evidence

| Gate | Result |
|---|---|
| `php artisan test` full suite (SQLite) | **229 passed / 1 skipped / 0 failed** (1,106 assertions) |
| POLICY-B feature suites (`PolicyBFinancialCalculationTest` + `PolicyBEvaluationAndEligibilityTest`) | **56/56 passed** (182 assertions) |
| Isolated PostgreSQL QA (`tests/Postgres/PolicyBPostgresTest.php` against `ikram_phase2a_qa`, guarded bootstrap) | **26/26 passed** (144 assertions) — jsonb reasons, numeric(14,2) columns, is_active default, registry amount round-trip, down()/up() rollback |
| Pint (`vendor/bin/pint` on touched files) | clean |
| `git diff --check` | clean (only benign CRLF warnings) |
| Frontend `npm test` | 52 vitest tests passed |
| Frontend `npm run lint` (eslint) | clean |
| Frontend `npm run build` (vite) | clean |
| Browser acceptance (`tests/Browser/policyb-settings-gate.mjs`, isolated SQLite + `php -S` + headless Chromium) | **8/8 PASS** — settings page renders; create-draft opens; rent-mode select switches to `direct_monthly_preference`; review gates render + toggle; draft-only warning shown; Users edit dialog exposes `تقييم مالي` |

Regression guarantees re-verified: legacy Degree/need/resident behavior unchanged (`test_resident_need_level_unchanged`), POLICY-A lifecycle via API, Phase 2B support-engine flow, no mutating evaluation routes, published-version authority, snapshot immutability after a policy change, and privacy sanitization.

## 5. Verdict

✅ **POLICY-B VERIFIED — ACCEPTED.** The financial policy + eligibility contract is implemented through the single authoritative calculator, persisted in immutable POLICY-A-consistent snapshots, verified on SQLite (full suite + dedicated suites), isolated PostgreSQL QA, Pint, frontend gates, and headless-browser acceptance. POLICY-B completes here; **POLICY-C … POLICY-G and Phase 2C are NOT started**, no commit/push/deploy was made, and the next phase requires separate explicit approval.