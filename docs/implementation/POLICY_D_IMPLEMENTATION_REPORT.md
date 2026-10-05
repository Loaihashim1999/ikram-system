# POLICY-D — Application integration acceptance

Date: 2026-09-22. Scope: POLICY-D only. **POLICY-D VERIFIED — READY FOR POLICY-E.** POLICY-E remains unstarted.

## Problem and implementation

The recovered 10/10 browser gate exercised System Settings only. The review page was not routed, displayed hardcoded evidence, and called nonexistent approve/reject endpoints. The earlier permission tests asserted constants. Inspection also found that the approval service wrote decisions without enforcing evidence completeness.

The application now routes `/admin/beneficiary-policy/review/:evaluationId`. Beneficiary details provide links to the beneficiary's saved evaluations. The review page loads authoritative data from `GET /api/beneficiary-policy/evaluations/{evaluation}/review`: historical financial/input/scoring results, the producing policy version, required document rules, evaluation-scoped verification and medical evidence, social assessment, unresolved reasons, capabilities and decision history. Beneficiary identity is minimized to ID/name; document binaries and unrelated beneficiary records are not returned.

Evaluation-scoped endpoints delegate to the existing services:

- `POST documents/{code}`: verify, reject or retain under review; document IDs must belong to the evaluated beneficiary and satisfy the configured document type.
- `POST medical-evidence`: structured verification and exact 0–100 disability percentage validation.
- `PUT social-assessment`: create/update draft; `POST social-assessment/submit`; `POST social-assessment/review`.
- `POST approve` / `POST reject`: stable uppercase reason code and explanation are mandatory. Caller-supplied evidence summaries cannot authorize approval.

All suffixes above are under `/api/beneficiary-policy/evaluations/{evaluation}`. The old `/assessment/approve` and `/assessment/reject` paths are not retained.

## Authorization and workflow safety

`ModulePermission` enforces nested `beneficiary_policy` permissions consistently with POLICY-A/B/C: `view_documents`, `verify_documents`, `social_assessment`, `review`, `decide`. Each assigned workflow role may read its required review context; write actions remain independently gated. Admin has all actions. The flat legacy `User::hasPermission()` helper is not used to reinterpret nested permissions. User administration exposes all five grants.

Mutation transactions lock the evaluation row. Finalized evaluations reject further evidence/assessment changes and duplicate decisions. Services own AuditLog events; controllers do not duplicate them. Draft editing, submission and review enforce their source states.

`PolicyApprovalService` checks server-derived blockers: required document verification, reviewed social recommendation, confirmed housing/service-area/landlord findings, children evidence, completed applicable evaluation, usable snapshots, policy outcome and unresolved reason codes. A high score or income category never implies approval. Unknown reasons, unresolved age/orphan exceptions and more than three affected children stay blocked. Evidence from another evaluation cannot satisfy these guards. The read-only `PolicyReviewService` assembles this overlay; it does not rerun financial or scoring calculations.

## Historical immutability

`PolicyDecision` is the permanent final-decision history. `current_state` is derived from it. This integration does **not** write `final_policy_decision` on the evaluation row and does not rewrite any input, financial, scoring, degree or need snapshot. Earlier statements claiming that this column was updated are superseded. Tests compare the complete raw evaluation before/after review and decision. No schema/migration change was made.

## Acceptance evidence

Fresh final results (all failures/errors zero):

- Real review browser: **44/44 passed**, **FAILED = 0**, **UNEXPECTED_REMOTE_REQUESTS = 0**; 37 actual local API requests proxied. Evidence: `browser-review-final.txt`, `browser.json`, `review-approved.png`.
- Default backend: **356 total, 355 passed, 1 pre-existing skip, 1543 assertions**. The skip is `BeneficiaryPolicyEngineTest::test_rollback_drops_and_recreates_policy_tables`; no new skips. Evidence: `backend-final-integration.txt` / `.xml`.
- Targeted POLICY-D: **36/36, 146 assertions** (`targeted-final.txt` / `.xml`). Workflow **9/9, 15 assertions**; permissions **1/1, 9 assertions**; AuditLog **3/3, 9 assertions**; controller/API acceptance **23/23, 113 assertions**. The API suite additionally proves exactly one logical audit event through the actual document, social and decision endpoints, including approve and reject.
- Fresh guarded PostgreSQL: **51/51, 268 assertions**: existing POLICY-D PG group **28/28, 155 assertions**, plus the same new HTTP integration group **23/23, 113 assertions**. Evidence: `postgres-final-integration.txt` / `.xml`. All on `pgsql / 127.0.0.1 / 5432 / ikram_phase2a_qa`.
- Frontend: **56 tests across 14 files passed**, including four new review-page tests; lint passed; production build passed with `/api` and a disposable output directory. Evidence: `frontend-final-test.txt`, `frontend-final-lint.txt`, `frontend-final-build.txt`.
- Pint: all changed PHP files passed (`pint-final-integration.txt`).
- `git diff --check`: passed (`diff-final-integration.txt`; Git's existing CRLF-normalization notices are not whitespace errors).

Evidence directory: `.tmp/policyd-recovery/`. No production/Aiven access, schema changes, commits, pushes or deployments.

The critical HTTP acceptance suite is now included in the normal `php artisan test` gate through `phpunit.xml` (`tests/Acceptance` is part of Feature). `PolicyDPermissionsTest` contains actual HTTP/capability assertions; the placeholder assertions are removed. The acceptance suite covers guest 401, no-grant 403, all five independent roles, successful evidence/social/decision operations, stable reasons, audit counts, duplicate/invalid transitions, record isolation and immutable snapshots.

The PostgreSQL integration suite inherits the same HTTP acceptance cases. It loads only `.env.phase2a.pgqa`, verifies/displays `pgsql / 127.0.0.1 / 5432 / ikram_phase2a_qa`, and validates the server identity before any refresh/migration. Credentials are not printed. Previous 28/28 /155 assertions are historical evidence; the fresh 51/51 PG run above supersedes reliance on those historical counts because approval transaction behavior changed.

## Historical versus current browser coverage

- HISTORICAL: `tests/Browser/policyd-settings-smoke.mjs` preserves the recovered settings-only 10/10 gate. It is not evidence of documentary review acceptance.
- CURRENT: `tests/Browser/policyd-review-gate.mjs` uses `policyd-fixture.php` to create real financial evaluations, navigates the actual routed review UI, verifies/rejects documents, records medical evidence, saves/submits/reviews assessment, proves incomplete approval fails, approves completed evidence, rejects with a stable reason, displays history, and tests a view-only user against a still-pending evaluation.
- No business outcomes are mocked. The browser uses an isolated local frontend build, `VITE_API_URL=/api`, unique SQLite fixture, loopback API fulfill/proxying, blocked service workers, strict outbound blocking and owned-process cleanup. The disposable build omits remote font imports using a quoted-URL-aware expression. Screenshot inspection exposed the old regex truncating at semicolons inside the font URL; it was fixed in the harness, and a computed-style assertion now proves the stylesheet loaded. Any unexpected external request fails the gate.

## Deferred scope and roadmap

POLICY-E/F/G, bulk evaluation, simulation, Taqnyat and Governance implementation remain unstarted. No commit, push or deployment.

The latest approved ordering remains: Beneficiary Policy Engine → Phase 2C Taqnyat → Notification Coverage Audit → PDF Finalization → Governance / Reports Finalization → Full System Acceptance → Azure Deployment Audit → Azure Production Deployment. Governance remains mandatory before system acceptance/deployment. POLICY-E requires explicit new approval after the POLICY-D verdict.

## Final verdict

POLICY-D VERIFIED — READY FOR POLICY-E

STOP. POLICY-E requires explicit user approval.
