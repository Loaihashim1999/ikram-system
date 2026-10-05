# POLICY-B0 — Financial Contract Audit

**Status:** COMPLETE (audit step of POLICY-B)
**Date:** 21 September 2026
**Repository:** IKRAM System (Beneficiary Policy Engine)
**Document purpose:** POLICY-B0 mandatory audit of the actual current financial
calculation implementation before any POLICY-B change is made. **No legacy
field or service was removed or altered during this audit.**

---

## 1. CURRENT INPUT (canonical data fields)

### 1.1 Beneficiary financial/family fields — `beneficiaries` table

| Field | Type / validation | Semantic |
|---|---|---|
| `beneficiary_type` | `required|in:citizen,resident` | Population: citizen vs resident |
| `status` | `nullable|in:active,suspended,under_review` | Workflow status |
| `family_status` | `required|string|max:50` | `poor / widow / widow_with_orphans / divorced / divorced_with_children / abandoned` |
| `family_members_count` | `required|integer|min:1` | **Client-supplied cached family count** |
| `wives_count`, `working_members_count`, `non_working_children_count` | nullable ints | Auxiliary family figures |
| `housing_type` | `required|in:rent,own,charitable_housing` | Housing mode |
| `annual_rent_amount` | `required_if:rent|nullable|numeric|min:0` | Annual rent (SAR) |
| `monthly_rent` | `nullable|numeric|min:0` | **Dual role: client input alias AND stored computed output** |
| `income_sources` | `nullable|array` (`in:salary,retirement,citizen_account,social_security,family_support`) | Legacy selected-source checkboxes |
| `monthly_salary` | nullable numeric min:0 | Salary |
| `social_security_amount` | nullable numeric min:0 | Social security |
| `citizen_account_amount` | nullable numeric min:0 | Citizen account |
| `retirement_pension` | nullable numeric min:0 | Retirement pension |
| `family_support` | nullable numeric min:0 | Family support |
| `date_of_birth` | `required|date|before_or_equal:today` | Birth date (age-side rules) |
| `national_id` | `required|string|max:20` | Saudi ID / Iqama. **No structured gender field exists.** |

No `social_insurance_amount` or `other` income column exists today — those two
canonical registry sources have **no storage field** (see §6.1).

### 1.2 Household/dependent records — `dependents` table

| Field | Type | Semantic |
|---|---|---|
| `beneficiary_id` | FK (cascade delete) | Head of household |
| `name`, `relationship`, `date_of_birth` | — | Registered household member |

**There is NO `is_active` column today.** Dependents are deleted and recreated
wholesale on beneficiary update (`BeneficiaryController::update`). Removal =
row deletion.

### 1.3 Legacy settings keys (`settings` table)

| Key | Default | Used by |
|---|---|---|
| `first_class_max_income` | 3000 | Legacy Degree classification (citizen) |
| `second_class_max_income` | 6000 | Legacy classification |
| `resident_need_threshold` | 3000 | Resident need level (authoritative key) |
| `resident_degree_threshold` | — | Legacy alias for resident threshold |
| `income_threshold_citizen` | 4000 | Deprecated `BeneficiaryClassificationService` only |
| `income_threshold_resident` | 4000 | Deprecated `BeneficiaryClassificationService` only |
| `elderly_min_age` | 60 | Priority helper |

No per-family deduction or counted-source settings exist as loose settings —
those belong to the versioned **policy configuration** (POLICY-A).

---

## 2. CURRENT CALCULATION (`App\Services\FinancialCalculationService`)

Single public method `calculate(array $data): array`.

1. **Allowed sources:** citizen → `{salary, retirement, citizen_account, social_security, family_support}`;
   resident → `{salary, family_support}`. Only amounts whose source is inside the
   legacy `income_sources[]` selection are summed.
2. **Amount sanitization:** `max(0, (float) value)` — legacy clamps negatives.
3. **Rent:** only when `housing_type === 'rent'`:
   - `annual_rent_amount > 0` → `round(annual / 12, 2)` (annual takes precedence);
   - else direct `monthly_rent` (`?? monthly_rent_amount` alias) → `round(direct, 2)`;
   - **never sums both.**
4. **Total income:** citizen → salary+pension+citizen_account+social_security+family_support
   (selected only); resident → salary+family_support. `round($total, 2)`.
5. **Net income:** `max(0, round(total − rent, 2))`.
6. **Priority / Degree:** citizen → `first_class` when `net <= first_class_max_income`
   else `second_class`; **resident → always `second_class`** (architecture decision).
7. **Resident need level:** separate output (`severe_need` ≤ `resident_need_threshold`
   else `normal_need`); citizen → null.
8. **Category id** resolved from priority map rows (auto-created).

**Side effects built into the model:** `Beneficiary::boot()` recomputes
`total_income / monthly_rent / net_income / priority / category_id` on every
create/update via the same service; resident `need_level`/`need_level_label`
accessors recompute on read.

---

## 3. CURRENT CALLERS (runtime map)

| # | Caller | Path | Behavior |
|---|---|---|---|
| 1 | `App\Models\Beneficiary` `boot()` | `creating` / `updating` | Auto-computes financial columns before save |
| 2 | `App\Models\Beneficiary` `getNeedLevelAttribute()` / `getNeedLevelLabelAttribute()` | read (resident) | Recomputes need level on serialization |
| 3 | `App\Http\Controllers\Beneficiaries\BeneficiaryController::store()` | beneficiary create (API) | Calculates then writes total/rent/net/priority/category |
| 4 | `....BeneficiaryController::update()` | beneficiary update (API) | Recalculates over merged attributes |
| 5 | `App\Services\BeneficiaryClassificationService` | **no active callers** | Fully deprecated (ADR-002), preserved only for legacy safety |
| 6 | `frontend/src/utils/financialCalculations.js` `calculateIncomeAndClassification()` | Add/EditBeneficiaryPage live preview | UX mirror of the server formula — **not authoritative** |
| 7 | `resources/views/pdf/*.blade.php` | reports/cards | Read stored columns (`net_income`, `total_income`) only |
| 8 | `App\Services\GovernanceReportService` | analytics/reports | **Does not recompute**; aggregates stored columns |

Legacy field names: `monthly_salary`, `social_security_amount`,
`citizen_account_amount`, `retirement_pension`, `family_support`,
`annual_rent_amount`, `monthly_rent`, `monthly_rent_amount` (frontend-only
legacy alias), `family_members_count`, `net_income`, `total_income`,
`first_class_max_income`, `resident_need_threshold`.

Resident paths are fully separate: residents are always Second Degree and carry
a resident Need Level; the citizen policy does not touch them today.

---

## 4. POLICY-B CONTRACT (target)

1. **One authoritative calculator.** `FinancialCalculationService` remains the
   single financial implementation. A policy-aware method
   `calculatePolicyFinancials(Beneficiary $beneficiary, BeneficiaryPolicyVersion $version)`
   is added inside it. **No second competing calculator.**
2. **Counted income sources come from the published policy configuration**
   (`financial.counted_income_sources`), not from the legacy `income_sources`
   selection. Default citizen counted set = `salary + social_security +
   citizen_account`; all other registry sources remain stored but contribute 0
   unless enabled by the published policy version.
3. **Income validation:** numeric, non-negative, bounded to the DECIMAL(14,2)
   monetary range; invalid strings rejected (never silently coerced).
4. **Rent:** canonical explicit safe mode (`financial.rent_mode`) with
   `annual_preference` (matches legacy precedence) or `direct_monthly_preference`;
   the applied mode is recorded in the snapshot; **both are never summed**;
   monthly rent ≥ 0.
5. **Family size (authoritative):** head **+ active registered dependents**
   (min 1). The client-supplied `family_members_count` cache is never trusted.
6. **Deduction:** `family_size × per_family_member_deduction` (policy value,
   default 100 SAR — not hardcoded in arithmetic).
7. **Adjusted net household income:** `MAX(0, counted_gross − monthly_rent −
   family_deduction)` — never negative.
8. **Net income per capita:** `adjusted / MAX(1, family_size)` with deterministic
   decimal rounding (documented in §6.5).
9. **Eligibility engine** consumes the result (never re-implements arithmetic):
   decisions `eligible / ineligible / review_required / not_applicable` with
   stable machine-readable reason codes; structured-data-only rules; everything
   else → `review_required`. **No guessing, no silent approve/reject.**
10. **Snapshots** through the POLICY-A `BeneficiaryPolicyEvaluation` service —
    immutable, privacy-sanitised, referencing a published version, recording
    `policy_version_id / version / calculated_at`. POLICY-C fields stay unset.

---

## 5. COMPATIBILITY RISK (found by this audit)

1. **`monthly_rent` is both input and computed output.** Stored value is normally
   the legacy computed result; a client may also submit it directly. Any new
   calculator must define an explicit mode and **must never add annual + monthly**.
2. **Two family-size representations coexist.** `family_members_count` (required,
   client-supplied) vs actual `dependents` rows (often absent on older/imported
   records). POLICY-B derives authoritative `family_size = 1 + active dependents`
   and records the cached figure only as a reference.
3. **No `is_active` on dependents** — "inactive dependent" semantics need an
   additive flag (default `true`), otherwise removed members = deleted rows.
4. **No structured gender field.** The only deterministic male signal is the
   Saudi national-ID first digit (10-digit ID: `1` = male, `2` = female). Used
   **only** to gate `MALE_UNDER_40_MEDICAL_REVIEW_REQUIRED`; when not derivable
   the rule is simply not flagged.
5. **`social_insurance` / `other` have no storage columns.** Enabling them in a
   policy would silently count zero. Additive nullable storage fields are needed
   so the registry stays honest.
6. **Legacy financial fields must not be overwritten by POLICY-B results.**
   POLICY-B writes to evaluation snapshots only; `net_income`, Degree, Need Level
   keep their historical meaning. `First Degree = A` style mapping is forbidden
   (that is POLICY-C).
7. **Boot-hook recomputation.** Model `creating/updating` automatically recomputes
   legacy figures — POLICY-B must not rely on those hooks or mutate them.
8. **Draft policies must never produce persisted evaluations** — snapshot storage
   already requires a published version; POLICY-B orchestrator enforces it again.
9. **No live registration/update wiring in POLICY-B** — legacy store/update flow
   stays untouched; application-scope control belongs to POLICY-E.
10. **Residents must never receive citizen-policy results** — a citizen-policy
    evaluation for a resident returns `POLICY_NOT_APPLICABLE_RESIDENT`
    (`not_applicable`), never a computed citizen figure.

---

## 6. CHANGE REQUIRED (additive only — no legacy removal)

### 6.1 Schema (one additive, reversible migration — `2026_09_21_020000_policy_b_financial_eligibility_extension`)
- `beneficiaries.social_insurance_amount` DECIMAL(14,2) NULL — registry storage.
- `beneficiaries.other_income_amount` DECIMAL(14,2) NULL — registry storage.
- `dependents.is_active` BOOLEAN NOT NULL DEFAULT TRUE — active-member semantics
  (inactive members excluded from family size).
- `beneficiary_policy_evaluations.eligibility_decision` VARCHAR(30) NULL and
  `eligibility_reasons` JSONB/JSON NULL — first-class intermediate eligibility
  result **without** touching `final_policy_decision` (which stays unset until
  POLICY-C/D).

### 6.2 FinancialCalculationService
Add `calculatePolicyFinancials(Beneficiary, BeneficiaryPolicyVersion)` +
registry constants + amount/rent validation. Legacy `calculate()` untouched.

### 6.3 New eligibility & orchestration services
`BeneficiaryPolicyEligibilityService` (verdict + stable reason codes, consumes
financials) and `PolicyFinancialEvaluationService` (population gate → calculate
→ eligibility → snapshot). `BeneficiaryPolicyEvaluationService::create()`
extended additively for the two eligibility columns.

### 6.4 Configuration extension
`financial.rent_mode` (allowlisted), `eligibility.review.*` structured boolean
toggles (allowlisted), defaults merged deterministically. No raw JSON editing.

### 6.5 Deterministic precision (documented decision)
Money and per-capita values are `round(…, 2)` (PHP_ROUND_HALF_UP on positives),
stored DECIMAL(14,2); per-capita = adjusted / MAX(1, family_size) rounded to 2
decimals. Determinism is guaranteed by computing from canonical stored inputs;
the frontend is never authoritative. Maximum accepted amount =
`999,999,999,999.99` (DECIMAL(14,2) capacity).

### 6.6 API / UI
Single permission-gated evaluation endpoint (`POST /beneficiary-policy/evaluate`)
for admin/internal use with a new explicit `evaluate` permission — never
executable by `view`. No bulk/simulation/recalculate endpoints. UI: Financial
Policy editor (counted sources, deduction, rent mode) + basic eligibility
review toggles on **draft** policies; published versions immutable.

---

## 7. TEST EVIDENCE (baseline at audit time — before POLICY-B changes)

- Full suite on SQLite: 174 tests / 173 passed / 1 skipped (POLICY-A baseline).
- POLICY-A feature class: 21 tests (20 passed / 1 skipped SQLite-only).
- POLICY-A PostgreSQL QA: 25/25 passed on `ikram_phase2a_qa` (guarded harness).
- `git diff --check`: clean (CRLF notices only).

POLICY-B will add: a financial-calculation feature suite (contract/rent/family/
formula/version/resident/legacy-regression), an evaluation+eligibility feature
suite (snapshots/authorization/lifecycle), and a guarded PostgreSQL QA suite.

---

## Audit declaration

Nothing in the legacy financial implementation was removed, renamed, or
recomputed during this audit. POLICY-B proceeds additively: one authoritative
calculator, policy-versioned inputs, and immutable snapshots.