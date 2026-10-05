# POLICY-E0 — APPLICATION-SCOPE AUDIT (AUTHORITATIVE — REAL MAIN WORKTREE)

> **Addendum 2026-09-22 — POLICY-E1 foundation IMPLEMENTED.** The E1 sub-phase authorized by the user built exactly the foundation this audit recommended: validator extension for `effective_from_date` (canonical `YYYY-MM-DD`, required only for the `effective_from_date` mode; unknown `application_scope` keys rejected), the two additive ledger tables `policy_application_runs` / `policy_application_run_items` (unique `(run_id, beneficiary_id)`; zero changes to existing tables), guarded run/item state machines, the deterministic fingerprint service, POLICY-E permissions (`simulate`, `apply_scope`, `execute_reevaluation`, `view_application_runs`) and the run-lifecycle audit action contract. **No simulation, execution, registration hooks or bulk re-evaluation were implemented** — those remain POLICY-E2/E3/E4/E5. Full evidence: [POLICY_E1_RUN_LEDGER_IMPLEMENTATION_REPORT.md](POLICY_E1_RUN_LEDGER_IMPLEMENTATION_REPORT.md). All audit findings below remain the authoritative baseline.

Date: 2026-09-22
Audited tree: `C:\laragon\www\ikram-system` (branch `main`, HEAD `f7147a8`)
Workspace identity verified: `git rev-parse --show-toplevel` → `C:/laragon/www/ikram-system`,
branch `main`, working tree intentionally dirty (66 modified tracked files, 443 untracked
paths — the verified, uncommitted Phase 2A/2B and POLICY-A–D work).

> **Supersedes and discards** the audit produced earlier in the wrong Cline-managed
> linked worktree (`C:\Users\loaih\.cline\worktrees\e1a84\ikram-system`), which
> contained only committed history and therefore none of the uncommitted POLICY work.
> That file remains in the wrong worktree only; it is not project evidence.

## 1. ACTUAL EXISTING POLICY ARCHITECTURE (VERIFIED PRESENT)

### POLICY-A — versioned policy lifecycle
- `App\Models\BeneficiaryPolicyVersion` — UUID PK; lifecycle `draft → published → retired`
  (approve step gates publish); published/retired are immutable (`isImmutable()`), changes
  only via clone/new draft; `parent_version_id` lineage; `effective_from`/`effective_to`
  dates; `policy_scope` currently allowlisted to `citizen_beneficiaries`.
- `App\Services\BeneficiaryPolicy\BeneficiaryPolicyVersionService` — createDraft / updateDraft /
  clone / approve / publish / retire. Publish defaults `effective_from` to today, enforces
  non-overlapping published ranges per scope (`rangesOverlap`), audits every transition to
  `AuditLog` (`POLICY_DRAFT_CREATED`, `POLICY_PUBLISHED`, `POLICY_RETIRED`, …).
- Migration `2026_09_21_010000_create_beneficiary_policy_architecture.php` — UUID PKs,
  JSONB on pgsql / JSON on sqlite, unique `(policy_name, version)`, PostgreSQL partial
  unique index `one_published_per_scope_start` and CHECK on date ordering (service layer
  enforces the same on SQLite).
- `BeneficiaryPolicyEvaluation` — permanent immutable snapshot: `input_snapshot`,
  `financial_snapshot`, `scoring_snapshot`, `degree_classification_snapshot`,
  `need_level_snapshot`, `eligibility_decision` (`eligible|ineligible|review_required|
  not_applicable`), `eligibility_reasons`, POLICY-C outputs (`income_category`,
  `policy_score`, `score_category`, `exception_code`), `evaluation_status`
  (`completed|failed`). New evaluation = new row; old rows never overwritten.
- `BeneficiaryPolicyEvaluationService` — snapshot writer with privacy sanitizer
  (strips IBAN, national ID, document URLs, secrets recursively); refuses non-published
  versions (409).

### POLICY-B/C — authoritative evaluation orchestrator
- `PolicyFinancialEvaluationService::evaluate(beneficiaryId, policyVersionId, actorId)`
  — population gate → `FinancialCalculationService::calculatePolicyFinancials()` (the ONE
  authoritative calculator) → `BeneficiaryPolicyEligibilityService` → POLICY-C income
  categorization / scoring / exceptions / outcome → immutable snapshot via
  `BeneficiaryPolicyEvaluationService`. Requires a PUBLISHED version (409 otherwise).
  **Currently always persists** — no non-persisting/simulation mode exists yet.
- **Resident isolation is already contractual**: `beneficiary_type !== 'citizen'` produces
  a completed evaluation with `input_snapshot.population_excluded =
  'citizen_policy_not_applicable_to_residents'` and `not_applicable` eligibility. Citizen
  rules are never applied to residents. Resident Degree/need_level behavior untouched.
- POLICY-C deterministic rules: integer-cents money comparison (`toCents`), allowlisted
  config keys, stable machine reason codes (`*_REVIEW_REQUIRED`), exceptions allowlist
  (`orphan_mother`), no expression engine anywhere (shape guard rejects non-scalars).

### POLICY-D — review & decision workflow
- `PolicyReviewService` — read-only overlay; never rewrites the producing evaluation;
  resolves review reasons against persisted evidence; unknown/unresolved policy
  ambiguities NEVER auto-clear (`default => false`); >3 affected children, under-40 male
  medical, widow/orphan evidence stay `review_required` until documentary proof.

### Configuration
- `PolicyConfigurationValidator` — section allowlist includes `application_scope`;
  `APPLICATION_SCOPES = ['new_only', 'all_existing_and_new', 'selected_existing_and_new',
  'effective_from_date']` — **exactly the four POLICY-E modes, already modelled and
  validated** ("modelled only; executed in POLICY-E"); `DEFAULT_APPLIES_TO =
  'all_existing_and_new'` merged by `withDefaults()`. Scope *parameters* (effective date
  value, selection) are NOT yet modelled.

### Routes / UI / permissions
- Routes: `GET/POST/PATCH /api/beneficiary-policy/versions…`, `…/{id}/approve|publish|
  retire|clone|history`, `POST /api/beneficiary-policy/evaluate` (single-record),
  `GET /api/beneficiary-policy/beneficiaries/{b}/evaluations`, evaluation-scoped review
  routes under `/api/beneficiary-policy/evaluations/{evaluation}/…`.
- Permissions: nested `users.permissions['beneficiary_policy'][action]` JSON enforced by
  `app/Http/Middleware/ModulePermission.php` (segment `beneficiary-policy`, per-action
  gates, admin bypass). Existing actions: `view, edit_draft, approve, publish, retire,
  evaluate, view_documents, verify_documents, social_assessment, review, decide`.
- UI: `frontend/src/pages/admin/BeneficiaryPolicySettings.jsx` (POLICY-A/B/C),
  `PolicyDReviewPage.jsx` (POLICY-D), routed under `/admin/beneficiary-policy/…`.
- Tests: Feature (`BeneficiaryPolicyEngineTest`, POLICY-B/C/D suites), Acceptance
  (`PolicyDControllerAuthorizationTest`, wired into the default `php artisan test` gate
  via phpunit.xml), Postgres guarded suite (`tests/Postgres/Policy*PostgresTest.php`,
  loads only `.env.phase2a.pgqa` → `pgsql / 127.0.0.1 / 5432 / ikram_phase2a_qa`),
  Browser gates (`tests/Browser/policy*-gate.mjs` with loopback-only harness,
  `UNEXPECTED_REMOTE_REQUESTS = 0`, isolated fixtures).

## 2. CANONICAL BENEFICIARY DATE FIELD

**`beneficiaries.created_at` is the canonical registration/enrollment timestamp.**
Evidence: all 13 beneficiary migrations define no registration/enrollment/intake/
application date column; the registration flow (`BeneficiaryController::store`) accepts no
client-supplied date; `created_at` is server-set at record creation. The architecture doc
(`04_BENEFICIARY_ARCHITECTURE.md`) lists only the timestamps. No field is invented;
`updated_at` is never a substitute. Boundary semantics for `effective_from_date` must be
`date(created_at) >= effective_from_date` using the app timezone (`config/app.php`),
deterministic per documented rule.

## 3. QUEUE / BATCH / CONCURRENCY INFRASTRUCTURE

- `QUEUE_CONNECTION=database` (`.env.example`); `jobs` table exists; one job class
  (`App\Jobs\SendCommunication`, `ShouldQueue`, tries=1, explicit `failed()` handler).
- Scheduler: `routes/console.php` — hourly `notifications:inventory` and every-minute
  `communications:drain`, both `->withoutOverlapping()`; the communications drain is a
  **bounded outbox pattern** (status machine `pending|retrying|failed`, `attempts`,

## 4. EXISTING EVALUATION TRIGGERS

There is **no automatic evaluation on registration or edit**. The only entry point is the
manual, permission-gated single-record `POST /api/beneficiary-policy/evaluate`
(`evaluate` permission). No listener/observer evaluates beneficiaries. Therefore POLICY-E
must explicitly define how "future/new" beneficiaries receive evaluations under each
scope mode (recommendation: keep registration untouched; "new" beneficiaries are
evaluated through the same explicit, permission-gated evaluation path; POLICY-E scope
application covers existing beneficiaries, and lifecycle application to future
beneficiaries follows the published version's effective window).

## 5. POLICY PUBLISH BEHAVIOR (AS-IS)

Publish sets `status=published`, `published_by/at`, defaults `effective_from` to today,
refuses overlapping published ranges per scope, audits `POLICY_PUBLISHED`. **Publishing
performs NO beneficiary recalculation** (confirmed in code and controller docblock:
"Simulation, bulk evaluation and beneficiary recalculation are intentionally NOT
exposed"). Published versions are immutable; scope change ⇒ clone/new draft ⇒ approve ⇒
publish. This already satisfies the POLICY-E requirement that publish must not silently
rewrite existing records.

## 6. SCOPE-MODE MAP (REQUIRED BY POLICY-E0)

| Scope mode (`configuration.application_scope.applies_to`) | Canonical eligibility condition | Authoritative date/field | Read-only simulation behavior | Execution behavior | History effect | Concurrency risk | Test requirement |
|---|---|---|---|---|---|---|---|

## 7. APPLICATION-SCOPE DESIGN RECOMMENDATION

1. Reuse the existing `configuration.application_scope` section; extend the validator to
   accept mode parameters: `effective_from_date` (required date when
   `applies_to = effective_from_date`, forbidden otherwise) — selection is a RUN
   parameter, not policy config.
2. Additive run ledger: `policy_application_runs` (id, policy_version_id, scope_mode,
   scope_parameters JSONB, simulation_fingerprint, status state machine
   `draft→simulated→approved_for_execution→running→completed|completed_with_errors|
   failed|cancelled`, counters, requested_by, timestamps) and
   `policy_application_run_items` (run_id, beneficiary_id, status, evaluation_id ref,
   stable failure reason, sanitized error, attempts; unique `(run_id, beneficiary_id)`).
3. Simulation: extract a non-persisting compute path from
   `PolicyFinancialEvaluationService` (shared computation, optional persistence) — never
   duplicate financial/scoring arithmetic. Summary counts + deltas vs. latest prior
   evaluation per beneficiary; residents reported separately as not_applicable.
4. Execution: chunked (`chunkById`, bounded size), per-item transactions, per-item
   failure capture, retry endpoint limited to failed/unprocessed items, idempotent on
   `(run_id, beneficiary_id)`.
5. Permissions: add nested `beneficiary_policy` actions `simulate`, `apply_scope`,
   `execute_reevaluation` to `ModulePermission` + Users admin UI; backend-authoritative.
6. AuditLog: run lifecycle events only (simulated/created/started/completed/
   completed_with_errors/cancelled); no per-SQL noise; no sensitive payloads.
7. API shape consistent with existing convention:
   `POST /api/beneficiary-policy/versions/{id}/simulate`,
   `POST /api/beneficiary-policy/versions/{id}/application-runs`,
   `GET /api/beneficiary-policy/application-runs/{run}`,
   `POST /api/beneficiary-policy/application-runs/{run}/execute`,
   `POST /api/beneficiary-policy/application-runs/{run}/retry`.

## 8. SCHEMA CHANGES REQUIRED

- **New tables (2)**: `policy_application_runs`, `policy_application_run_items`
  (UUID PKs, JSONB on pgsql, FKs, unique idempotency index) — no equivalent exists.
- **No changes** to `beneficiaries`, `beneficiary_policy_versions`,
  `beneficiary_policy_evaluations`, `policy_decisions` or POLICY-B/C/D tables.
- Permissions need no schema change (JSON permission matrix on `users`).

## 9. UNRESOLVED BLOCKERS

None blocking POLICY-E start. Notes:
- `policy_scope` allowlist currently only `citizen_beneficiaries` — sufficient for
  POLICY-E (resident isolation preserved via the population gate).
- Scope *parameters* validation (`effective_from_date` value) must be added to
  `PolicyConfigurationValidator::validateApplicationScope` during POLICY-E.
- The "future beneficiaries" half of each scope has no automatic trigger today (see §4);
  POLICY-E implements the explicit/controlled paths only, per its own specification.
- Preserved ambiguities (under-40 male medical, >3 affected children, generic
  widow/orphan evidence) continue to produce `review_required`; POLICY-E must not resolve
  them.

POLICY-E0 audit complete. POLICY-E implementation NOT started — awaiting explicit go.

| `new_only` | `beneficiaries.created_at >= version.published_at` (registered after the version's effective lifecycle start) — no retroactive population | `beneficiaries.created_at` (server-set) | Report zero retroactive candidates; preview future-applicability only | No run over existing beneficiaries; run ledger records mode with empty candidate set | None — historical evaluations/decisions untouched | None (no items) | Existing beneficiary excluded; historical snapshot byte-identical |
| `all_existing_and_new` | All citizen beneficiaries in scope `citizen_beneficiaries`; residents computed and reported as `not_applicable` | n/a (population-wide) | Mandatory pre-execution; computes predicted results in non-persisting mode; zero writes | Controlled re-evaluation creating NEW evaluation rows via the authoritative orchestrator | New snapshots appended; old snapshots/decisions immutable; no auto-carry of decisions | Two executors on same run/item → unique `(run_id, beneficiary_id)` + row lock ⇒ one wins, one safe no-op | Simulation writes 0 rows; execution appends; history preserved |
| `selected_existing_and_new` | Explicit server-validated ID list: exists, in-domain (citizen scope), permitted, deduplicated | n/a | Same read-only computation restricted to the validated selection | Only selected beneficiaries evaluated; exact selection persisted in run `scope_parameters` | Same as above | Same + selection tamper between simulation and execution → fingerprint mismatch | Unknown/inaccessible/duplicate IDs rejected; unselected untouched |
| `effective_from_date` | `date(beneficiaries.created_at) >= application_scope.effective_from_date` parameter + future | `beneficiaries.created_at` vs config date param | Same read-only computation over the deterministic boundary set | Same controlled re-evaluation | Same as above | Same | Before/exact/after boundary cases; timezone determinism |

Fingerprint (all modes): deterministic hash over `policy_version_id + applies_to +
normalized scope_parameters` (sorted selection, ISO date) — no secrets/documents.

  `next_attempt_at`, `limit(100)` chunk, idempotent re-dispatch of message IDs only).
- Concurrency precedent: `DB::transaction` + `lockForUpdate()` per row (POLICY-D
  `mutate()`, `SendCommunication::failed()`); guarded PostgreSQL concurrency harnesses
  exist (`tests/Postgres/phase2a-concurrency.php`, `phase2b-concurrency.php`).
- **No run-ledger / batch-evaluation infrastructure exists** → POLICY-E requires the
  minimum additive tables (see §8).

- `PolicyReviewController` — evaluation-scoped endpoints; `mutate()` wraps every write in
  `DB::transaction` + `lockForUpdate()` on the evaluation row; finalized evaluations
  (any `PolicyDecision` exists) reject further mutation with 409 (concurrency precedent).
- `PolicyApprovalService` — approve/reject with server-derived blockers; writes
  `PolicyDecision` (permanent decision history; `current_state` derived from it;
  `final_policy_decision` column is NOT a mutable approval cache).
