# BENEFICIARY POLICY GAP AUDIT — PHASE 1 (READ / ANALYZE / DOCUMENT ONLY)

**Date:** 2026-09-21
**Status:** **BENEFICIARY POLICY AUDIT COMPLETE — READY FOR DESIGN REVIEW**
**Mode:** READ / ANALYZE / DOCUMENT ONLY — no code, no migrations, no schema change, no UI change, no data mutation, no commit, no push, no deployment.
**Scope:** Audit the current IKRAM system against the approved beneficiary assistance policy **«سياسة صرف المساعدات للمستفيدين» Version 4 — 2026** and produce the gap matrix, classification compatibility map, and the controlled implementation design.
**Authority:** Explicit user authorization (2026-09-21) to begin the **Beneficiary Policy Engine** controlled phase as **Phase 1 — Policy Gap Audit & Implementation Design only**. No implementation of the policy engine is authorized by this document.

## 1. Source policy reference

The Version-4 policy content used in this audit is supplied **in the explicit authorization message** (beneficiary registration conditions, required documents, income-based classification, point scoring, score categories, widow/divorced requirements, social assessment concepts). **No copy of the policy file exists in the repository** — it is treated as the authoritative external source for the audit values listed below:

- **Counted monthly income:** salary + social_security (if enabled) + citizen_account (if enabled).
- **Monthly rent:** annual_rent / 12, or direct monthly rent where configured.
- **Family deduction:** family_size × per_family_member_deduction — requested default **100 SAR per member**.
- **Adjusted net household income:** `MAX(0, counted_income − monthly_rent − family_deduction)`.
- **Net income per capita:** `adjusted_net_household_income / MAX(1, family_size)`.
- **Income categories (per capita):** A 0–400 · B 401–600 · C 601–800 · D 801–1000 · **above 1000 → policy exclusion**. Orphan-mother exception up to **1200**.
- **Point scoring (defaults):** income-per-capita 0–400→15 · 401–600→11 · 601–800→7 · 801–1000→5 · >1000→0; housing condition poor→10 · average→5 · good→0; housing tenure rented→10 · owned→0; head-of-household health 80–100%→15 · 50–79%→10 · <50%→5 · healthy→0; children health 1→5 · 2→7 · 3→10; age 60+→15 · 50–59→10 · 40–49→5 · 30–39→0. **Documented maximum: 75.**
- **Score categories:** A 51–75 · B 26–50 · C 5–25 · D 0–4.
- **IMPORTANT:** income category and points (score) category are **TWO DIFFERENT results** — never silently merged.
- **Policy application scopes:** new beneficiaries only · all existing + new (new version + controlled re-evaluation) · selected existing + new (cohort) · effective-from date. **No mass update may happen silently.**
- **Impact simulation:** read-only, shows affected totals, income/score category changes, eligibility gains/losses, financial-result changes, exception changes — modifies nothing.

## 2. Audit method and evidence

Reviewed (source of truth = repository working tree):

- `app/Services/FinancialCalculationService.php` — the authoritative financial calculator (ADR-002/003, master-design decision 6).
- `app/Services/BeneficiaryClassificationService.php` — deprecated / non-authoritative / no runtime use (Phase 1, ADR-002).
- `app/Models/Beneficiary.php`, `app/Models/Dependent.php`, `app/Models/BeneficiaryDocument.php`, `app/Models/DailyBeneficiary.php`, `app/Models/Category.php`, `app/Models/Setting.php`.
- `app/Http/Controllers/Beneficiaries/BeneficiaryController.php`, `app/Http/Controllers/DailyBeneficiaryController.php`, `app/Http/Controllers/SettingsController.php`, `app/Http/Controllers/AnalyticsController.php`, `app/Http/Controllers/SupportDistributionController.php`.
- `app/Services/SupportHistoryService.php` (item-specific population history).
- `routes/api.php` (endpoint inventory), `database/seeders/SettingSeeder.php`, beneficiary/settings migrations.
- Frontend: `frontend/src/components/common/FilterableTableHeader.jsx`, `frontend/src/pages/beneficiaries/BeneficiaryList.jsx`, `frontend/src/pages/daily-beneficiaries/*`, `frontend/src/pages/staff/StaffListPage.jsx`, `frontend/src/pages/delivery/DeliveryPage.jsx`, `frontend/src/pages/representatives/NeighborhoodRepsPage.jsx`, `frontend/src/pages/audit/AuditPage.jsx`.
- Docs: `TO_BE_MASTER_DESIGN.md`, `IMPLEMENTATION_ROADMAP.md`, `PHASE_02B_IMPLEMENTATION_REPORT.md`, `04_BENEFICIARY_ARCHITECTURE.md`, `05_FINANCIAL_LOGIC.md`, `08_DAILY_BENEFICIARY_ARCHITECTURE.md`.

## 3. The 30-component gap matrix

Columns: SOURCE POLICY · CURRENT SYSTEM · STATUS · GAP · CONFLICT · PROPOSED DESIGN · MIGRATION RISK · TEST REQUIREMENT.
Status legend: ✅ SUPPORTED · ◐ PARTIAL · ❌ NOT SUPPORTED.

| # | SOURCE POLICY | CURRENT SYSTEM | STATUS | GAP | CONFLICT | PROPOSED DESIGN | MIGRATION RISK | TEST REQUIREMENT |
|---|---|---|---|---|---|---|---|---|
| 1 | Eligibility conditions (per-capita income category + exclusion + exceptions) | No eligibility engine; creation auto-assigns Degree (first/second_class) for citizens and need level (severe/normal) for residents via `FinancialCalculationService::calculate()`; no per-capita test | ◐ PARTIAL | No rule-based versioned eligibility decision; no exclusion; no eligibility reason codes | None direct — current "Degree" is a priority classification, policy eligibility is a separate verdict | `BeneficiaryPolicyEngine` consumes authoritative calculations and produces a per-version eligibility verdict + reason codes | Eligibility changes affect existing active beneficiaries → must be scope-gated; historical evaluations preserved | Boundary per-capita 400/600/800/1000/1200; reason-code assertions; no silent change |
| 2 | Income source configuration (salary + social_security + citizen_account if enabled; Admin-configurable) | Allowlists hardcoded: citizen = salary, retirement, citizen_account, social_security, family_support; resident = salary, family_support (`FinancialCalculationService` + controller `sanitizeFinancialSources`) | ◐ PARTIAL | Sources not configurable; no enabled/disabled flag; resident list conflicts with counted-income list | Resident currently salary+family_support vs policy counted income salary+social_security+citizen_account → source-list decision required | Per-policy-version income-source catalog with `enabled` flags; General Admin edits through structured configuration only | Adding/removing resident sources changes computed income → scope-gated; boot() recompute must route through policy version | Toggle source changes result per version; unknown source rejected; resident source-list decision test |
| 3 | Financial formula (counted income − rent − family deduction; per-capita) | Gross = Σ selected sources; rent = annual/12 or direct (rent only); net = MAX(0, gross − rent); **no family deduction, no per-capita** | ◐ PARTIAL | Missing family deduction and per-capita; counted-income variant | Current calculator includes retirement & family_support; new counted income lists only salary+social_security+citizen_account → include/exclude decision | Extend the **single authoritative** `FinancialCalculationService` (master-design decision 6) with policy-driven components; engine consumes results, never duplicates arithmetic | `Beneficiary::boot()` recomputes on every save → formula change must be versioned and snapshotted | Formula unit tests: zero income, rent>income, deduction floor at 0, per-capita divisor MAX(1,size) |
| 4 | Family-member deduction (family_size × per_family_member_deduction, default 100) | `family_members_count` stored on beneficiaries; **not used in any financial calculation** | ❌ NOT SUPPORTED | No deduction anywhere in the calc path | None | Configurable `per_family_member_deduction` per policy version; applied in adjusted net income; stored in evaluation snapshot | `family_members_count` semantics (does it include the head?) must be confirmed — affects deduction and per-capita | Deduction math; MAX(0) floor; family_size=0/1; snapshot consistency |
| 5 | Income per capita (adjusted / MAX(1, family_size)) | Not computed; no column | ❌ NOT SUPPORTED | — | None | Derived per-capita value in each evaluation snapshot; used by income category + exclusion | Per-capita changes category/exclusion → scope-gated | Division edge cases; consistency between snapshot and live computation |
| 6 | Income categories A/B/C/D (per capita) | Categories = Degree names (first_class/second_class/special_needs/elderly/employee) via `categories` table driving basket entitlement | ❌ NOT SUPPORTED (different taxonomy) | No A–D per-capita categories | Degree taxonomy is the current authoritative classification (ADR-002/003) and drives `basket_entitlement_per_period` — must NOT be overwritten | Store per-version `income_category` (A–D) as an evaluation result **parallel to** Degree/need level; explicit mapping + entitlement decision | Basket entitlement tied to Degree; mapping and reporting impact need explicit decision | Boundaries at 400/600/800/1000; entitlement mapping; report counts distinguish Degree vs A–D |
| 7 | Policy exclusion threshold (>1000 per capita; orphan-mother up to 1200) | No exclusion: citizen second_class has no upper bound; resident gets `normal_need` | ❌ NOT SUPPORTED | No exclusion concept | None | Configurable exclusion rule in policy version, with exception interplay | Excluded existing beneficiaries → re-evaluation scope gated; historical evidence preserved | >1000 excluded; exactly 1000 not; 1200 with orphan-mother exception admitted |
| 8 | Orphan-mother exception (up to 1200) | `family_status`, `father_status`, `mother_status` captured but **not used in any calculation** | ❌ NOT SUPPORTED (data available) | No exception logic | None | Exception registry (type, proof documents, approver) linked to evaluation; eligibility override + category/score handling | Exception changes eligibility → scope-gated | Exception triggers eligibility change; snapshot + audit trail written |
| 9 | Housing-condition score (poor 10 / average 5 / good 0) | No housing-condition field or score | ❌ NOT SUPPORTED | — | None | Condition select in evaluation input data + configurable score mapping per version | Missing condition must default safely | Mapping test; missing-condition default |
| 10 | Home-tenure score (rented 10 / owned 0) | `housing_type` (rent/own/charitable_housing) recorded and used only for rent deduction | ◐ PARTIAL | Data exists; no tenure score | None | Score mapping from `housing_type`; charitable_housing → explicit decision | None significant | rent→10, own→0; charitable_housing decision test |
| 11 | Head-of-household health score (80–100%→15, 50–79%→10, <50%→5, healthy→0) | `has_special_needs` / `is_special_needs` booleans only; no severity percentage | ◐ PARTIAL | Flag exists; no severity scale | None | Health severity degree on beneficiary profile; mapping table per version | Severity data is new — migration backfill optional | Severity band boundaries |
| 12 | Children health score (1→5, 2→7, 3→10) | `dependents` table has **no health field** (architecture doc mentions `health_status`; the model does not have it) | ❌ NOT SUPPORTED | No per-child health data | None | Dependent health indicator; count-affected scoring with cap | New data on dependents; optional backfill | Counts 1/2/3; cap above 3 |
| 13 | Age score (60+→15, 50–59→10, 40–49→5, 30–39→0) | `is_elderly` boolean + `elderly_min_age` setting (default 60) influence priority classification only | ◐ PARTIAL | No age-band scoring | None | Derive age from `date_of_birth` at evaluation time; configurable band table | None significant | Exact-boundary ages 30/39/40/49/50/59/60+ |
| 14 | Total policy score (documented max 75) | No scoring anywhere | ❌ NOT SUPPORTED | — | None | Policy-engine total with configurable cap, itemized components, stored in snapshot | None significant | Sum + cap assertions; itemized breakdown |
| 15 | Score categories A/B/C/D (51–75 A, 26–50 B, 5–25 C, 0–4 D) | No score categories | ❌ NOT SUPPORTED | — | **Income category and score category are TWO results — never merge** | `score_category` stored separately from `income_category` on every evaluation | Reporting/UI must show both distinctly | Band boundaries; independence assertion (different A/B/C/D than income category) |
| 16 | Required documents (per path) | `BeneficiaryDocument` free-form `document_type`; form has optional upload fields; **no requirement matrix or enforcement** | ◐ PARTIAL | No policy-driven required-document check | None | Per-version document-requirement matrix with completion status evaluated per eligibility path | Existing beneficiaries may lack new required docs → flag, not silently block | Missing-doc flag/block; admin override; matrix version changes |
| 17 | Widow documents | `family_status` stores marital status; no widow document logic | ❌ NOT SUPPORTED | — | None | Widow requirement set (e.g., husband death certificate) + evaluation proof check | Widow heads may become newly qualified → scope-gated | Widow path requires proof; audit evidence |
| 18 | Divorced documents | Same as #17 — no divorced document logic | ❌ NOT SUPPORTED | — | None | Divorced requirement set (e.g., divorce certificate) + evaluation proof check | Same as #17 | Divorced path requires proof |
| 19 | Medical exceptions | `has_special_needs` boolean only; no exceptions registry | ❌ NOT SUPPORTED | — | None | Exceptions registry (type, beneficiary ref, document ref, approver, effective window) affecting eligibility/score | None significant | Exception applied; audit trail; approval required |
| 20 | Service-area enforcement | `city`/`district` recorded; recipient/neighborhood-rep/org linkage for distribution; **no eligibility-area enforcement** | ◐ PARTIAL | Coverage rules not evaluated | None | Policy area-coverage configuration; evaluation flags out-of-area; enforcement decision separate | Out-of-area beneficiaries already active → decision needed | Out-of-area flag; coverage config |
| 21 | Landlord relationship rule | `owns_house` + `rental_contract_image` only | ❌ NOT SUPPORTED | — | None | Landlord-relationship verification condition with document evidence | None significant | Rule evaluation; evidence required |
| 22 | Social researcher assessment | **Absent** | ❌ NOT SUPPORTED | — | None | Assessment record (researcher, date, notes, recommendation) linked to evaluation; controlled write permissions | New workflow; RBAC | Workflow + RBAC tests |
| 23 | Approval/rejection workflow | Statuses `active|suspended|under_review`; evaluation has no dedicated approve/reject step; `AnalyticsController` still queries legacy statuses `approved/rejected/inactive` (dead with current enum) | ◐ PARTIAL | No evaluation approval lifecycle | Status semantics in use by list filters/analytics | Evaluation lifecycle pending → approved/rejected/under_review with approver, decision, audit; keep existing status compatibility | Transition changes visibility/entitlement → scope-gated; dead analytics branches flagged for cleanup | Transition rules; RBAC; legacy-status branch cleanup |
| 24 | Evaluation snapshots | No per-beneficiary evaluation snapshot (governance report snapshot is a report artifact, not a policy evaluation) | ❌ NOT SUPPORTED | — | None | `beneficiary_policy_evaluations` storing inputs + computed results + `policy_version_id` + `evaluated_at`; immutable history | Governance/reports later consume snapshots instead of live state | Snapshot immutability; version linkage; exactly-one-active evaluation |
| 25 | Policy simulation (read-only) | **Absent** | ❌ NOT SUPPORTED | — | None | Read-only simulation endpoint: affected totals, income/score category shifts, eligibility gains/losses, financial-result and exception deltas — writes nothing | Simulation must never mutate | DB unchanged after simulation (assert); diff statistics correctness |
| 26 | Policy application scope (new-only / all+new / cohort / effective date) | Settings apply globally and instantly (`Setting::set`); **no scope concept** | ❌ NOT SUPPORTED | No controlled application | Current settings flat-change behavior conflicts with required scope discipline | Activation scopes on policy publish: new-only / all+new re-evaluation / selected cohort / effective_from; immutable draft→published→retired; approval chain | Scope mistakes could silently change existing beneficiaries — enforce no-silent-mass-update rule | Scope enforcement; silent bulk update blocked; effective-from scheduling |
| 27 | Bulk re-evaluation | Import mass-creates new records only; **no re-evaluation engine** | ❌ NOT SUPPORTED | — | None | Re-evaluation job creating new snapshots (history preserved) — runs only after simulation + explicit apply authorization | Partial/batch failures must not corrupt history | Historical snapshots untouched; exactly-one-active evaluation; idempotent run |
| 28 | Unified permanent/daily listing (label PERMANENT/DAILY, navigate to source record) | Separate models/tables/pages (`BeneficiariesPage`, `DailyBeneficiariesPage`); **no unified query** | ❌ NOT SUPPORTED | — | None (explicitly: do NOT merge domains/inventory) | Unified **read-only** query facade: row-type label PERMANENT/DAILY + deep link to the correct source record; no physical merge | Navigation correctness; row-type clarity | Row typing; navigation; cross-domain filters |
| 29 | System-wide server-side column filtering (+ EXPORT FILTERED / EXPORT ALL AUTHORIZED) | `FilterableTableHeader` = single-select dropdowns applied **client-side** over the fetched dataset (Beneficiaries loads `all:true`; Staff/Delivery/Reps/Audit similar); backend index supports partial filters (beneficiaries: type/city/district/priority/status/search + pagination; daily: search/district/category/status). **No** date/numeric/money ranges, multi-select, relation search, generic sorting, Clear All, active-filter indicator | ◐ PARTIAL | Client-side filtering over load-all does not scale; no rich filter types; no authorized-export variants | Load-all approach must be replaced by server-side filtering without changing column semantics | Spec per major table (beneficiaries, daily, staff, orgs, support, warehouse, delivery, accounts, notifications, governance) with server-side filter builder, combined filters, Clear All, active-filter indicator; exports EXPORT FILTERED vs EXPORT ALL AUTHORIZED with backend authorization | Large-dataset behavior change; keep existing filters working during migration | Large-set filtering perf; combined filters; export authorization (RBAC) tests |
| 30 | Item-specific aid-history filtering (received X / never X / last X / not for N days-weeks-months / custom period) | `SupportHistoryService` (`GET /support/history`) is **item-specific** (`inventory_item_id` required; `never_received`; `not_received_days`; from/to; `last_received_at`) — backend exists but **no frontend usage found** | ◐ PARTIAL | Weeks/months not expressible (days only); no UI | None — item specificity already guaranteed by `support_distribution_items.inventory_item_id` join (item A never counts for item B) | Item-specific filter UI in the unified list + N days/weeks/months + custom period; keep item-level join semantics | None significant | Receiving item A never counts as receiving item B; period boundaries (days/weeks/months/custom) |

## 4. Policy versioning — required concepts vs current system

| Required concept | Current system | Proposed design |
|---|---|---|
| draft / published / retired | — | Lifecycle on `beneficiary_policy_versions`; published versions immutable |
| effective_from / effective_to | — | Applied on activation; governs scoped application and scheduling |
| approved_by / published_by | — | Approval chain recorded with user refs; audit events |
| source policy reference | — | Link to policy document/reference (Version 4 — 2026) |
| board approval reference | — | Optional external board decision reference field |
| change reason | — | Required on every new version and on every policy-value edit |
| audit history | `audit_logs` table is generic (AuditController) | Policy-specific events; generic audit reused for security-critical transitions |
| Immutability | Settings are mutable key-values applied instantly | Published versions frozen; changes always create a new Draft |

## 5. Current classification compatibility mapping

**Constraint honored:** the current IKRAM classification (First Degree / Second Degree / Resident Need Level, plus special_needs/elderly/employee priority types) is **not deleted or overwritten** during this audit. Resident behavior remains unchanged until an explicit resident-policy decision is approved.

| CURRENT CLASSIFICATION | POLICY CLASSIFICATION | HISTORICAL COMPATIBILITY | REPORTING IMPACT |
|---|---|---|---|
| First Degree (`priority=first_class`, citizen net ≤ `first_class_max_income` default 3000) | Mapped concept: per-capita income category A–D + score category A–D + eligibility verdict | Existing rows keep `priority`/`category_id`; new policy results stored **alongside** (new columns/evaluation table), current fields untouched | Degree reports remain valid; new policy reports introduced separately; report totals must distinguish Degree vs policy classification |
| Second Degree (`priority=second_class`; citizens over threshold; **all residents**) | Per-capita handling varies by family size; residents' counted-income source list is a **decision point** | Resident `need_level` (severe/normal, threshold default 3000) unchanged; policy classification stored separately | Resident degree-splits (A/B sub-tiers are frontend-only today) reconciled with policy categories |
| Resident Need Level (severe_need / normal_need) | Per-capita income category + score category | Preserved; policy evaluation adds parallel results | Reports show both need level and policy category — no silent merge |
| Special needs / elderly / employee priority types | Exceptions + age health score feed the policy score where applicable | Preserved as profile attributes and Degree-priority values | Scored components may align or diverge from Degree priority — display separately |

## 6. Financial engine rule (authoritative calculator)

- `App\Services\FinancialCalculationService` **remains the single authoritative financial calculator** (master-design decision 2 & 6, ADR-002/003). The future `BeneficiaryPolicyEngine` may **consume** authoritative calculation results for eligibility, policy categorization, scoring, exceptions and policy evaluation — it **must not duplicate core financial arithmetic**.
- The policy formula (family deduction, per-capita) is designed to be expressed **inside the single calculator** as policy-driven components, or fed to the engine as pre-computed authoritative values — decided in the design review; no competing implementation is created by this audit.
- `Beneficiary::boot()` recomputes `total_income`/`monthly_rent`/`net_income`/`priority`/`category_id` on every save — any formula evolution must remain versioned and routed through evaluation snapshots so history never silently changes.

## 7. Key findings and decisions for the design review

1. **Resident income sources conflict:** current calculator counts `salary + family_support` for residents; the policy counted income is `salary + social_security + citizen_account`. Explicit source-list decision required.
2. **Retirement / family_support:** included by the current calculator but absent from the policy's counted-income list — decide inclusion policy.
3. **`family_members_count` semantics:** must confirm whether it includes the head of household (affects family deduction and per-capita divisor).
4. **Degree vs A–D taxonomy:** income categories would be a **new parallel classification**; basket entitlement mapping and reporting separation need an explicit decision. Resident Degree behavior unchanged until a resident-policy decision is approved.
5. **Filtering must move server-side:** current load-all + client-side filtering does not scale (component 29); migrate table-by-table with existing filters preserved.
6. **Evaluation approval workflow:** reconcile with the existing status enum and clean the dead `approved/rejected/inactive` analytics branches under its own controlled step.
7. **Values stay non-hardcoded:** all policy values (deduction, brackets, points, scores, caps, exceptions) are presented as **configurable defaults** for General Admin via the versioned configuration — no permanent hardcoded policy values introduced by this design.

## 8. Safety commitments (Phase 1)

- `FinancialCalculationService` **not modified**. No beneficiary classification change. No schema change, no migrations, no UI change, no recalculation, no production/test data mutation. Phase 2C (Taqnyat) not started. Nothing deployed (Azure or otherwise). Nothing committed or pushed.

## Appendix A — Evidence index

| Evidence | Location |
|---|---|
| Authoritative financial calculator | `app/Services/FinancialCalculationService.php` |
| Deprecated classification service | `app/Services/BeneficiaryClassificationService.php` (ADR-002) |
| Beneficiary model (fields, boot() recompute, need_level accessors) | `app/Models/Beneficiary.php` |
| Dependents (no health field) | `app/Models/Dependent.php` |
| Documents (free-form type) | `app/Models/BeneficiaryDocument.php` |
| Daily beneficiaries (separate domain) | `app/Models/DailyBeneficiary.php` |
| Beneficiary API (index filters, store, rules, uploads, Excel import) | `app/Http/Controllers/Beneficiaries/BeneficiaryController.php` |
| Daily API (index filters, search) | `app/Http/Controllers/DailyBeneficiaryController.php` |
| Settings whitelist (financial keys editable now) | `app/Http/Controllers/SettingsController.php`, `database/seeders/SettingSeeder.php` |
| Item-specific population history | `app/Services/SupportHistoryService.php`, route `GET /support/history` |
| Governance snapshot (not policy evaluation) | `app/Services/GovernanceReportService.php` |
| Legacy status queries (dead with enum) | `app/Http/Controllers/AnalyticsController.php` (lines ~113–114, 419–437) |
| Status enum | `database/migrations/2026_08_03_180439_create_beneficiaries_table.php` |
| Financial columns | `database/migrations/2026_09_09_000003_fix_beneficiaries_foreign_keys_and_financials.php` |
| Frontend filtering (client-side single-select) | `frontend/src/components/common/FilterableTableHeader.jsx`; `frontend/src/pages/beneficiaries/BeneficiaryList.jsx` (load-all + `.filter()`); `StaffListPage.jsx`, `DeliveryPage.jsx`, `NeighborhoodRepsPage.jsx`, `AuditPage.jsx` |
| Architecture references | `docs/architecture/04_BENEFICIARY_ARCHITECTURE.md`, `05_FINANCIAL_LOGIC.md`, `08_DAILY_BENEFICIARY_ARCHITECTURE.md`, `TO_BE_MASTER_DESIGN.md` (decisions 2/3/4/5/6, sections 14–17) |

---

**VERDICT: BENEFICIARY POLICY AUDIT COMPLETE — READY FOR DESIGN REVIEW**

Next step (not authorized by this document): design review, then the controlled implementation sub-phases defined in [BENEFICIARY_POLICY_IMPLEMENTATION_PLAN.md](BENEFICIARY_POLICY_IMPLEMENTATION_PLAN.md) and recorded in [ADR-007](../architecture/ADR-007-VERSIONED-BENEFICIARY-POLICY-ENGINE.md) — each requiring explicit approval before implementation.