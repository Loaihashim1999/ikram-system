# POLICY-C0 — SCORING CONTRACT AUDIT (Income Categories, Point Scoring, Score Categories & Exceptions)

**Date:** 2026-09-21 · **Phase:** POLICY-C (authorized) · **Base:** POLICY-A VERIFIED — ACCEPTED, POLICY-B VERIFIED — ACCEPTED

This audit maps every POLICY-C source-policy rule to the actual structured repository data **before** any scoring code is written. Where the repository has no canonical structured field, POLICY-C must return `review_required` with a stable code — **missing data is never invented**.

---

## 1. Authoritative POLICY-B result contract (input to POLICY-C)

| Item | Source | Shape |
|---|---|---|
| Financial result | `FinancialCalculationService::calculatePolicyFinancials(Beneficiary, BeneficiaryPolicyVersion)` (the ONE authoritative calculator; legacy `calculate()` untouched) | `counted_gross_monthly_income`, `income_sources{available,counted,not_counted}`, `monthly_rent`, `rent_mode`, `family_size`, `dependents_count`, `per_family_member_deduction`, `family_member_deduction`, `adjusted_net_household_income`, **`net_income_per_capita`**, `precision` |
| Basic eligibility | `BeneficiaryPolicyEligibilityService::evaluate()` | `{decision: eligible|ineligible|review_required|not_applicable, reasons[]}` (stable codes) |
| Orchard gate | `PolicyFinancialEvaluationService::evaluate()` | requires **published** version (draft → 409); resident → `not_applicable`; creates ONE immutable snapshot per run |
| Snapshot persistence | `BeneficiaryPolicyEvaluationService::create()` | already persists `scoring_snapshot`, `income_category`, `policy_score`, `score_category`, `exception_code`, `exception_details` (columns exist since POLICY-A; POLICY-B stores them as `null`) |

**POLICY-C consumes `net_income_per_capita` — it never re-implements counted income, rent, family deduction, adjusted household income or per-capita.**

## 2. Data-quality matrix (`beneficiaries` / `dependents`)

| Rule | Structured data | Field / column | Data quality | POLICY-C plan | Review-required condition | Test |
|---|---|---|---|---|---|---|
| F. Age bands | DOB cast `date:Y-m-d`, `Carbon::age` | `beneficiaries.date_of_birth` | Good where populated (OCR/manual); nullable | Age derived from DOB **only** — no client-supplied age | No DOB → `AGE_REVIEW_REQUIRED`; under-30 with no documented rule → `AGE_REVIEW_REQUIRED` | 39–44 |
| C. Tenure | Enum `rent|own` | `beneficiaries.housing_type` | Canonical enum, default `rent` | `rent→rented→10`, `own→owned→0` (explicit allowlist) | Null/unknown value → `HOUSING_TENURE_REVIEW_REQUIRED` | 23–25 |
| B. Housing condition | **None** — no `poor/average/good` field exists (only `housing_type` + `owns_house` boolean, both tenure-related) | — | Missing | Mapping configured; engine consumes a canonical value | Value absent → `HOUSING_CONDITION_REVIEW_REQUIRED` (POLICY-D must collect it) | 19–22 |
| D. Head health / disability | **None numeric** — only `has_special_needs`, `is_special_needs` booleans (health *status*, not verified disability %) | `beneficiaries.*` | Boolean flags ≠ verified % | Bands on 0–100 %; boolean flags do NOT fabricate a percentage | Missing/non-authoritative % → `HEAD_HEALTH_REVIEW_REQUIRED`; input < 0 or > 100 rejected | 26–34 |
| E. Children health | **None** — `dependents` holds only `name`, `relationship`, `date_of_birth`, `is_active` | `dependents` | Missing | Count-based mapping (1→5, 2→7, 3→10); 0 → 0 (data present) | Count unavailable → `CHILDREN_HEALTH_REVIEW_REQUIRED`; > 3 unresolved → `CHILDREN_HEALTH_REVIEW_REQUIRED` (ambiguity, see §5) | 35–38 |
| A. Income | Authoritative `net_income_per_capita` (2-dp, ROUND_HALF_UP, ≥ 0) | from POLICY-B | High | Category bands + exclusion threshold, integer-cents comparisons | Always available for citizens (financials run first); gap in configured bands is a **configuration** error, rejected at save | 1–18 |
| Orphan-mother exception | Enum family statuses | `beneficiaries.family_status` (`poor, widow, widow_with_orphans, divorced, divorced_with_children, abandoned`) | Canonical enum; then POLICY-B flags widow/divorce statuses as document-review | Versioned rule `orphan_mother`, ceiling SAR, `requires_manual_review` default **true**; **default authoritative structured match = `widow_with_orphans` ONLY**; auto-applies only when structured data proves it and no manual review is required | Matched `widow_with_orphans` but evidence/manual review pending → `ORPHAN_MOTHER_EXCEPTION_REVIEW_REQUIRED`; **generic `widow` is NOT auto-matched (orphan status not provable from the enum) → `review_required` with the stable evidence reason until POLICY-D documentary proof**; no match (other statuses) → `not_applicable`; disabled → normal rule | 64–69 |
| Classification (legacy) | `priority` (degree string), `category_id` (FK), `need_level` (resident computed) | `beneficiaries.*` | Legacy, untouched | POLICY-C writes only `income_category`/`policy_score`/`score_category` into the **evaluation snapshot**; never touches degree/need/category | — | 60–63 |

## 3. Existing classification/consumers (must stay independent)

- `priority` values: `first_class` (درجة أولى) / `second_class` (درجة ثانية) / `special_needs` / `elderly` (FinancialCalculationService map); `category_id` points at `categories` rows.
- `need_level`/`need_level_label`: resident-only computed accessors.
- `AnalyticsController`, `PdfExportController` & weekly report consume legacy totals/priority/need — **no consumer reads `beneficiary_policy_evaluations` scoring fields yet** (verified by grep: zero references).
- No `Degree→A–D` mapping exists or is permitted; `degree_classification_snapshot`/`need_level_snapshot` stay `null` in POLICY-C citizen snapshots.

## 4. Boundary strategy (no floating-point dependence)

- Monetary/percent comparisons are converted to **integer cents** (`(int) round($value * 100)`) before band matching. Config band min/max are normalized the same way, so `400` → `40000`, `400.01` → `40001`; `per_capita 400.00 → A`, `400.01 → B` deterministically.
- Age bands use integer years; `Carbon::age` is integer.
- Disability percent bands use cents (`79.99%` → `7999` cents).
- **Disability % valid range is EXACTLY `0..100` inclusive** (cents `0..10000`): `-0.01` → `-1` cents and `100.01` → `10001` cents are rejected with `ValidationException`. There is **no tolerance window** such as `[-0.01, 100.01]`.

## 5. Documented source-policy ambiguities (resolved as `review_required` by default)

1. **>3 affected children:** Version-4 documents points only for 1, 2 and 3 affected children. No authoritative rule for >3 exists in the source — the engine returns `review_required` (`CHILDREN_HEALTH_REVIEW_REQUIRED`) until an explicit policy version defines it. The 3→10 rule remains.
2. **Under-30 age:** the documented table starts at 30–39. No documented score exists for under-30 → `review_required` (`AGE_REVIEW_REQUIRED`), unless a deterministic earlier rule (e.g. eligibility `not_applicable`/`ineligible`) already decides the case.
3. **Orphan-mother proof:** the exception ceiling (1200 SAR) is documented, but proving "orphan mother" needs documents/relationship evidence in the general workflow; default `requires_manual_review = true` → `ORPHAN_MOTHER_EXCEPTION_REVIEW_REQUIRED`. The **default authoritative structured match is `widow_with_orphans` ONLY**: a generic `widow` does not auto-match and, without authoritative structured orphan evidence, resolves to `review_required` (`ORPHAN_MOTHER_EXCEPTION_REVIEW_REQUIRED`) until POLICY-D documentary/legal proof is produced — the 1200 SAR ceiling is never silently applied to a bare widow. A published configuration that explicitly broadens the condition to include `widow` is honored verbatim (immutable; changed only via the draft/new-version mechanism).

## 6. Configuration surface (versioned, structured, validated — no expressions/eval)

| Section | Keys | Default |
|---|---|---|
| `income_categories` | `exclusion_threshold`; `bands[{key,label,min,max}]` (a–d, labels Arabic UI, `min ≤ max`, first `min=0`, contiguous, last `max == threshold`) | 1000; a 0–400, b 400.01–600, c 600.01–800, d 800.01–1000 |
| `scoring` | `max_score`; `dimensions{income,housing_condition,housing_tenure,head_health,children_health,age}` (bands/values + points; `enabled`); max-achievable-sum must be `≤ max_score` | 75; V4 points, `sum of max = 75` |
| `score_categories` | `bands[{key,label,min,max}]` (a–d); `min ≥ 0`, first `min=0`, contiguous, last `max == max_score` | a 51–75, b 26–50, c 5–25, d 0–4 |
| `exceptions` | `rules[{code,enabled,label,income_ceiling,requires_manual_review,condition{field,operator,values}}]`, codes allowlisted | `orphan_mother`, ceiling 1200, review default true, condition `family_status in [widow_with_orphans]` (**default match `widow_with_orphans` ONLY; published versions may explicitly broaden to `widow` — honored verbatim, immutable**) |

## 7. Test requirement mapping

Mandatory tests 1–83 (see authorization) map 1:1: income categories 1–13, income points 14–18, housing 19–22, tenure 23–25, health 26–34, children 35–38, age 39–44, total 45–48, score categories 49–59, separation 60–63, exceptions 64–69, snapshot 70–75, authorization 76–78, regression 79–83. PG QA reuses the guarded `ikram_phase2a_qa` target only.