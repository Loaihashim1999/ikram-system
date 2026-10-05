# BENEFICIARY POLICY ENGINE — CONTROLLED IMPLEMENTATION PLAN (PHASE 1 DESIGN ONLY)

**Date:** 2026-09-21
**Status:** **DESIGN ONLY — NOT IMPLEMENTED.** Phase 1 of the Beneficiary Policy Engine (gap audit + implementation design) is authorized. No implementation sub-phase below may begin without separate explicit approval.
**Inputs:** [BENEFICIARY_POLICY_GAP_AUDIT.md](BENEFICIARY_POLICY_GAP_AUDIT.md) (30-component matrix), source policy «سياسة صرف المساعدات للمستفيدين» Version 4 — 2026, [ADR-007 proposal](../architecture/ADR-007-VERSIONED-BENEFICIARY-POLICY-ENGINE.md), `TO_BE_MASTER_DESIGN.md` (decision 2/6, sections 14–17), `IMPLEMENTATION_ROADMAP.md` (§3).

## 0. Cross-cutting constraints (apply to every sub-phase)

1. **`FinancialCalculationService` remains the single authoritative financial calculator.** The policy engine consumes its authoritative results; it never duplicates core financial arithmetic (master-design decision 6, ADR-007).
2. **Current classification preserved.** First Degree / Second Degree / Resident Need Level (and special-needs/elderly/employee priority types) are **not deleted or overwritten**; new policy results are stored in parallel. Resident behavior unchanged until an explicit resident-policy decision is approved.
3. **No silent mass updates.** Every change that affects calculations, eligibility, classification, scores, documents or exceptions requires an explicit **application scope** (new-only / all+new / selected cohort / effective-from). Simulation first, apply only with explicit authorization.
4. **Policy values are never hardcoded permanently.** General Admin modifies values through a safe, structured, **versioned** configuration system (draft → published → retired; immutable published versions).
5. **Historical preservation.** Every re-evaluation writes a new immutable evaluation snapshot; historical evaluations remain linked to the policy version that produced them.
6. **No domain merge.** The unified beneficiary page is a read-only browsing/query experience; permanent and daily domains/inventory stay separate.
7. **No deployment, no Taqnyat, no commit/push** in any sub-phase without separate explicit authorization.

## Policy versioning model (foundation shared by all sub-phases)

`beneficiary_policy_versions`: `id`, `version_no`, `status (draft|published|retired)`, `effective_from`, `effective_to`, `approved_by`, `published_by`, `source_policy_reference`, `board_approval_reference`, `change_reason`, `created_by`, timestamps, `audit history` (events: `POLICY_DRAFT_CREATED`, `POLICY_PUBLISHED`, `POLICY_RETIRED`, `POLICY_VALUE_CHANGED`). A published version is immutable — change requires a new draft. Each policy evaluation references the version that produced it.

---

## POLICY-A — Data model + versioning + evaluation snapshots

**Objective:** versioned policy model, beneficiary evaluation snapshots, and the parallel-storage guarantee.

- `beneficiary_policy_versions` (as above) + `beneficiary_policy_version_values` (structured JSON or typed key-value rows for formula/brackets/points/scores/exceptions/documents bound to the version).
- `beneficiary_policy_evaluations`: snapshot of inputs (income sources + amounts, rent, housing, family data, health, documents status) + computed results (net, per-capita, income category, score components, total, score category, eligibility verdict + reasons, exceptions applied) + `policy_version_id` + `evaluated_by` + `evaluated_at`.
- Migration strategy: additive tables + new nullable columns only; existing columns untouched.
- No UI beyond General Admin versioning screen (minimal, in this sub-phase optional).

**Out of scope:** any change to classification fields or existing beneficiary data.

**Acceptance (tests):** version lifecycle (draft→published immutable→retired); re-edit of published version blocked (409); evaluation links to producing version; snapshot immutability.

## POLICY-B — Financial policy configuration + authoritative calculation + eligibility

**Objective:** policy-driven financial configuration (sources, formula components, per-capita) and eligibility verdicts.

- Configurable per version: counted income sources + enabled flags; rent strategy (annual/12 vs direct); `per_family_member_deduction` (default 100); per-capita divisor `MAX(1, family_size)`; income brackets A/B/C/D (defaults 400/600/800/1000); exclusion threshold (>1000, orphan-mother 1200).
- **Financial engine rule:** formula evolution expressed inside the authoritative `FinancialCalculationService` (single calculator) or consumed from it — decided in design review; no competing implementation.
- Eligibility verdict per version with reason codes; `income_category` (A–D) stored **parallel to** Degree/need level.

**Decision points for review:** resident counted-income source list; retirement/family_support inclusion; `family_members_count` semantics (head included?).

**Acceptance (tests):** source toggles change computation; formula boundaries (0 income, rent>income, deduction floor); per-capita edges; bracket/exclusion boundaries; eligibility reason codes; Degree fields unchanged.

## POLICY-C — Point scoring + income/score categories + exceptions

**Objective:** policy-engine scoring and score categories, plus the exceptions registry.

- Configurable score component tables per version: income-per-capita points; housing condition (poor/average/good); housing tenure (rented/owned); head-of-household health severity (80–100/50–79/<50/healthy); children health (1/2/3+); age bands (60+/50–59/40–49/30–39).
- `total_policy_score` with configurable cap (documented max 75); `score_category` (A 51–75 / B 26–50 / C 5–25 / D 0–4) stored **separately** from income category — never merged.
- Exceptions registry (orphan-mother up to 1200; medical exceptions; landlord-rule evidence; service-area flags) with approver + proof documents + effective window.

**Acceptance (tests):** each scoring mapping; boundary ages/severities; sum + cap; score vs income category independence; exception application and audit.

## POLICY-D — Required documents + social assessment + approvals

**Objective:** policy-driven document requirements and the evaluation approval workflow.

- Per-version document-requirement matrix (incl. widow and divorced requirement sets) evaluated per eligibility path; completion status on the evaluation snapshot.
- Social researcher assessment record (researcher, date, notes, recommendation) linked to the evaluation.
- Evaluation approval workflow: pending → approved / rejected / under_review with approver, decision, audit; existing status semantics preserved; legacy analytics branches referencing `approved/rejected/inactive` cleaned up in a controlled step with tests.

**Acceptance (tests):** required-doc matrix; widow/divorced proof paths; researcher workflow RBAC; approval transitions; legacy-branch cleanup regression.

## POLICY-E — Application scope + simulation + controlled bulk re-evaluation

**Objective:** controlled application of policy changes with read-only simulation.

- Application scopes on publish: NEW BENEFICIARIES ONLY · ALL EXISTING + NEW (controlled re-evaluation, history preserved) · SELECTED EXISTING + NEW (cohort: IDs or filtered cohort) · EFFECTIVE FROM DATE. No silent mass update — scope is mandatory and recorded.
- Read-only **impact simulation** before applying to existing beneficiaries: total affected, income-category changes, score-category changes, becoming eligible, becoming ineligible, financial-result changes, exception changes — modifies nothing.
- Bulk re-evaluation job: creates new snapshots, keeps historical evaluations, idempotent, only after simulation + explicit apply authorization.

**Acceptance (tests):** scope enforcement (silent update blocked); simulation writes nothing (DB assertion); re-evaluation preserves history and exactly-one-active evaluation; cohort selection correctness; scheduled effective-from.

## POLICY-F — Unified beneficiary list + system-wide server-side filtering + filtered exports

**Objective:** unified permanent/daily browsing and server-side column filtering across major admin tables.

- Unified **read-only** query facade: PERMANENT/DAILY row-type label + deep link to the correct source record; no physical merge of domains/inventory.
- Server-side filter framework per major table (beneficiaries, daily beneficiaries, staff, organizations, support, warehouse, delivery, accounts, notifications where applicable, governance/report lists): text filters, enum/multi-select, date ranges, numeric min/max, money ranges, relation searches, sorting, pagination, combined filters, **Clear All**, active-filter indicator. Large datasets server-side.
- Item-specific aid-history filtering UI (received item X / never received X / last received X / not received X for N days/weeks/months / custom period) on top of `SupportHistoryService` item-scoped semantics (item A never counts for item B).
- Exports: **EXPORT FILTERED RESULTS** and **EXPORT ALL AUTHORIZED RESULTS** — backend-controlled authorization.

**Acceptance (tests):** large-dataset filtering/perf; combined filters; item-specific history periods; unimodal export authorization (RBAC); row-type navigation.

## POLICY-G — Final regression + PostgreSQL acceptance + browser/mobile acceptance

**Objective:** full controlled acceptance for the Beneficiary Policy Engine.

- Full backend regression (SQLite + isolated PostgreSQL like the Phase 2A/2B gates), policy-engine unit/feature tests, concurrency where relevant (e.g., simultaneous re-evaluation), frontend tests, lint/build/Pint, and a browser/UI acceptance gate (unified listing, filters, versioning screen, exports).
- PostgreSQL schema/migration compatibility verified on an isolated QA database; no production data touched.
- Evidence recording per the phase conventions (implementation report + discovery map if a legacy-behavior retirement is involved — none is anticipated except the analytics dead branches cleaned under POLICY-D).

**Acceptance:** green run of all gates; evidence documented; exit verdict **BENEFICIARY POLICY ENGINE — VERIFIED — ACCEPTED** (after user review and approval of each prior sub-phase's authorization).

---

## Dependency order & gating

```
POLICY-A ──► POLICY-B ──► POLICY-C ──► POLICY-D ──► POLICY-E ──► POLICY-F ──► POLICY-G
```

Each sub-phase has its own entry authorization, scope, exit tests and acceptance record. No sub-phase may be skipped or reordered without a documented architecture decision. Policy values used during implementation are **configuration defaults** (source-policy Version-4 values) pending General Admin approval — never permanent hardcodes.

---

**This document is a design artifact only. No code, migration, schema, UI or data change is authorized by it. Phase 2C (Taqnyat) and Azure deployment are out of scope and require their own explicit approvals.**