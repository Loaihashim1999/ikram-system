# IKRAM SYSTEM — Approved Implementation Roadmap


> **Current status — 2026-09-24:** **GOVERNANCE / REPORTS FINALIZATION VERIFIED**. Phase 2A, Phase 2B, POLICY-A through POLICY-G, Notification Coverage, and PDF Finalization remain accepted. UI/UX Finalization is the next separately authorized product phase; Phase 2C live-provider evidence remains deferred.

Updated: 2026-09-22. Authority: [TO-BE master design](../architecture/TO_BE_MASTER_DESIGN.md) and [ADR-005](../architecture/ADR-005-COMMUNICATION-DELIVERY-DEPLOYMENT.md).

Phase 2A and Phase 2B are verified and accepted. POLICY-A through POLICY-G are verified and the Beneficiary Policy Engine is accepted. Phase 2C is **PARTIAL — DECISIONS REQUIRED**: the real-provider adapters and safe outbox integration are implemented, while credentials, approved sender/template data, driver opt-in and separately authorized live-sandbox sends remain outstanding. The final deployment target is Microsoft Azure; no deployment is authorized.

## 1. Phase 2A — Unified Support Engine — VERIFIED

Scope: canonical beneficiary/staff/organization recipients, decimal general-warehouse quantities, reservation/full fulfillment, reliable transactional audit, item-specific population history and granular permissions; daily inventory remains independent.

The isolated PostgreSQL gate is complete: 54 tests / 239 assertions, UUIDs, CHECK/FK/delete protection, fractional quantities, transactional invariants, in-delivery cancellation protection, real two-process locking/over-reservation prevention and safe rollback/re-migrate. See [actual evidence](PHASE_02A_IMPLEMENTATION_REPORT.md). No database verification rerun is required for this documentation-only update.

Exit verdict: **PHASE 2A VERIFIED — READY FOR PHASE 2B**. Readiness does not start Phase 2B.

## 2. Phase 2B — Delivery & Communication Architecture — VERIFIED — ACCEPTED

Entry: Phase 2A verified **and explicit user approval to begin Phase 2B**. No real Taqnyat API, credentials or availability is required.

### Mandatory Phase 2B Discovery/Audit Gate — FIRST STEP (COMPLETED 2026-09-21)

Before modifying or removing legacy delivery/verification/communication behavior, Phase 2B MUST begin with a read-only discovery and dependency audit. The completed gate and retirement outcome are recorded in [PHASE_02B_DISCOVERY_MAP.md](PHASE_02B_DISCOVERY_MAP.md).

Audit at minimum:

- current QR routes, controllers, services, models, UI components, PDF/printing usage, tests, stored fields and historical dependencies;
- current Driver authentication/login/account model, permissions, routes, UI, `drivers` ↔ `users` coupling and delivery access behavior;
- current password-reset/recovery implementation, tokens, mail path/provider, frontend flow, throttling and security audit events;
- current/legacy communication code: manual WhatsApp, WhatsApp links, SMS/email stubs, notification hooks, queues/jobs and configuration;
- every route, PDF, report, test and integration that depends on those legacy mechanisms.

Required output before destructive migration work:

`CURRENT → REPLACEMENT → MIGRATION/RETIREMENT → TEST EVIDENCE`

Safety rule:

- Do NOT delete or disable legacy QR merely because the four-digit replacement has been designed.
- Do NOT remove the legacy Driver login/access path merely because temporary links are planned.
- Do NOT remove or replace the current password-reset path merely because Taqnyat Email is planned.
- Do NOT remove legacy communication code until its replacement path is implemented, tested and shown to cover the affected workflows.
- Preserve historical delivery/receipt/audit data throughout the transition.
- Any unknown or untested dependency blocks retirement until it is resolved.

Only after this Discovery/Audit Gate is documented may implementation proceed to the replacement features and controlled retirement steps below.

Implementation scope:

- Exactly four numeric receipt digits; secure generation, operation binding, expiry, one-time atomic verification/consumption, attempt limits/rate limiting, temporary lock and sanitized audit. Use validated test-default policy from ADR-006; final numeric production policy requires user approval, as explicitly allowed in the Phase 2B execution instruction.
- After the mandatory Discovery/Audit Gate, safely retire legacy QR and conflicting receipt methods only through a controlled verification transition. Preserve history and prove the four-digit replacement path works across affected routes, UI, printing/PDFs, tests and integrations before disabling legacy functionality. No new QR development.
- Permanent registered drivers with scoped temporary access links; Admin selects driver/tasks/duration. Links expire at deadline or completion of every assigned task. No permanent login required for delivery tasks and no deletion of business history on expiry.
- Dedicated Arabic RTL Mobile-First Driver UI, responsive app-like phone layout, large touch targets, one-hand navigation, task/status list, maps, items/quantities and four-digit input. Enforce task scoping on the backend; expose no financial data, classification documents, unrelated files or Admin modules.
- Pickup location_url, official URL supplied later, active-location selection and historical snapshots. Pickup SMS contains location name/URL, date/time and code; delivery SMS contains delivery date/time and code without pickup information.
- Communications section in System Settings: SMS recipient/method templates, driver WhatsApp template, password-reset OTP SMS template (`password_reset_otp`), location fields and previews. Only General Admin edits content. Secret provider configuration is not exposed through settings. (reset-email subject/body retained as retired historical templates — see decision 2026-09-24 below.)
- Controlled template renderer: per-channel/context placeholder allowlists, clear rejection of unknown placeholders such as {password}, required {verification_code}/{reset_link}, safe defaults and synthetic-data previews. Review whether shared SMS templates suffice before creating six duplicated templates.
- CommunicationService/channel services/provider interfaces and routing: beneficiary/staff/organization → SMS; driver → WhatsApp Business; password recovery → SMS via Taqnyat (6-digit OTP). No vendor HTTP details in domain controllers.
- Fake/mock/local SMS, WhatsApp and Email providers with configurable success/failure/timeout responses. Driver WhatsApp contains only necessary assignment summary and temporary link; secure task details remain inside Driver UI. Model provider-template mapping without assuming unrestricted free-form WhatsApp.
- Secure SMS-OTP recovery workflow and expiry/single use/attempt limits/resend cooldown/rate limiting/request and success audits. Never transmit existing or permanent plaintext passwords. (Email-link recovery superseded — decision 2026-09-24 below.)
- Laravel queue/jobs, bounded retries/backoff, timeouts, idempotency/duplicate-send protection, provider outages and final failures with controlled retry. Use the same receipt code on retries unless explicit business reissue occurs. Keep secrets out of queued/failed-job diagnostics and communication logs.
- Communication state/audit structures with sanitized destination/provider references and status/timestamps/retry evidence. Provider failure cannot delete or undo support, inventory, reservations or history. Reuse the internal NotificationService; do not replace the notification center.

Acceptance must prove security boundaries and deterministic offline workflows: leading-zero four-digit codes, wrong/expired/reused codes, failed-attempt limits and lockout, racing confirmations, scoped/expired/completed driver links, recipient-channel routing, pickup/delivery content separation, forbidden/required template placeholders, safe previews/defaults, Admin-only edits, provider secret exclusion, queue duplicate/retry/failure behavior, and stable stock/history despite send failures. All tests use fake/mock/local providers; no external availability dependency.

Exit: reviewed implementation/tests, bounded and documented test policies with production approval still required, and safe legacy verification transition. See ADR-006, PHASE_02B_DISCOVERY_MAP.md and PHASE_02B_IMPLEMENTATION_REPORT.md for actual changes/evidence. Phase 2B is VERIFIED — ACCEPTED.

## 3. Beneficiary Policy Engine — VERIFIED — ACCEPTED (POLICY-A through POLICY-G)

Entry: Phase 2B accepted (2026-09-21) and explicit user approval for the governed sub-phase execution. Scope (per master-design section 15): policy versions, the financial formula, family-member deduction, income sources, eligibility, income classification, points calculation, document rules, exceptions, application scope, policy simulation, the unified beneficiary list, and server-side column filtering across the whole system — delivered through the controlled sub-phases POLICY-A → POLICY-G, each requiring separate explicit approval.

Phase 1 deliverables (2026-09-21): [gap audit](BENEFICIARY_POLICY_GAP_AUDIT.md) (30-component matrix + classification compatibility map), [implementation plan](BENEFICIARY_POLICY_IMPLEMENTATION_PLAN.md) (controlled sub-phases POLICY-A…POLICY-G), and [ADR-007](../architecture/ADR-007-VERSIONED-BENEFICIARY-POLICY-ENGINE.md) — **APPROVED** with six closing decisions (residents separate; counted-income default salary+social_security+citizen_account; family_size includes head; 100 SAR default deduction; Degree/Need and A–D stored independently; server-side filtering → POLICY-F). Source policy: «سياسة صرف المساعدات للمستفيدين» Version 4 — 2026.

**✅ POLICY-A — VERIFIED — ACCEPTED — READY FOR POLICY-B (2026-09-21)** — Data model (`beneficiary_policy_versions`, `beneficiary_policy_evaluations`; additive, reversible, PG-compatible, JSONB), policy lifecycle (draft→approve→publish→retire, immutability, one-active overlap rule with PG backstops), structured versioned configuration with strict validation and approved defaults, immutable privacy-sanitized evaluation snapshots, audit foundation (POLICY_DRAFT_CREATED/UPDATED, POLICY_APPROVED, POLICY_PUBLISHED, POLICY_RETIRED), granular permissions (`beneficiary_policy: view/edit_draft/approve/publish/retire`), minimal API/UI. Evidence: [POLICY_A_IMPLEMENTATION_REPORT.md](POLICY_A_IMPLEMENTATION_REPORT.md) — SQLite full suite clean (173 passed / 1 skipped), isolated PostgreSQL QA (`ikram_phase2a_qa`) 25/25, Pint + ESLint + frontend build clean. No recalculation/simulation/bulk evaluation; legacy `FinancialCalculationService::calculate()` untouched (POLICY-B later added the single authoritative policy calculator as a separate method); no commit/push/deploy.

**✅ POLICY-B — VERIFIED — ACCEPTED (2026-09-21)** — authoritative financial contract through `FinancialCalculationService::calculatePolicyFinancials(Beneficiary, BeneficiaryPolicyVersion)` (legacy `calculate()` untouched): policy-versioned counted-income, rent safe modes (annual ÷ 12 default; direct monthly via new raw-input column `monthly_rent_direct_input`), authoritative family size = 1 + active dependents, versioned per-member deduction (100 SAR default), adjusted net household income, deterministic per-capita; eligibility verdicts + stable reason codes through `BeneficiaryPolicyEligibilityService`; immutable POLICY-A snapshot extension via `PolicyFinancialEvaluationService`; `POST /beneficiary-policy/evaluate` with granular `evaluate` permission; General Admin financial-policy UI (rent mode, counted sources, review gates) + Users `تقييم مالي`. Evidence: [POLICY_B_IMPLEMENTATION_REPORT.md](POLICY_B_IMPLEMENTATION_REPORT.md) — full SQLite suite clean (229 passed / 1 skipped / 0 failed), POLICY-B suites 56/56, isolated PostgreSQL QA 26/26, Pint + ESLint + vitest + build clean, headless-browser acceptance 8/8. No scoring/categories (POLICY-C), documents (POLICY-D), scope/simulation/bulk (POLICY-E), lists/filtering (POLICY-F), no mass recalculation, no commit/push/deploy.

**✅ POLICY-C — VERIFIED — ACCEPTED (2026-09-21)** — income categories + A–D classification + point scoring + score categories + versioned exceptions on top of the authoritative POLICY-B `net_income_per_capita`. Delivered: `PolicyIncomeCategoriesService` (A 0–400, B 400.01–600, C 600.01–800, D 800.01–1000; `> exclusion_threshold` (default 1000) → `financially_excluded`); `PolicyScoringService` (+ `PolicyScoringInputs`/`PolicyScoringInputProvider`) with six dimensions and `scoring.max_score` default 75, deterministic integer-cents boundaries and missing-data → review-required codes (never silent zero; invalid disability % rejected); `score_categories` A 51–75 / B 26–50 / C 5–25 / D 0–4 stored separately (no Degree→A–D mapping); `PolicyExceptionService` (allowlisted `orphan_mother`, ceiling default 1200 > threshold, review-by-default); `PolicyOutcomeService::resolve` precedence with `final_policy_decision` staying null; `PolicyFinancialEvaluationService::evaluate()` pipeline persisting `income_category`, `policy_score` (decimal:4), `score_category`, `scoring_snapshot`, `exception_code`, `exception_details`; draft-policy UI with four POLICY-C sections, read-only max-score summary and visible errors that block saving. Evidence: [POLICY_C_IMPLEMENTATION_REPORT.md](POLICY_C_IMPLEMENTATION_REPORT.md) — full SQLite suite clean (314 passed / 1 skipped / 0 failed), POLICY-C suites 85/85, isolated PostgreSQL QA 25/25, Pint + ESLint + vitest + build clean, headless-browser acceptance 25/25 (all `/api/` proxied to the isolated server — no hosted-API round-trips). No documents (POLICY-D), scope/simulation/bulk (POLICY-E), lists/filtering (POLICY-F), no mass recalculation, no commit/push/deploy.

**✅ POLICY-D — VERIFIED — ACCEPTED (2026-09-22)** — versioned document rules (`documents` config section), structured document verification (`verified`/`rejected`/`under_review`/`missing` — binary files never copied into snapshots), medical evidence verification (verified disability % 0..100 inclusive — deterministic; boolean fields never invent percentage), housing condition structured assessment (`poor`/`average`/`good`), service area verification (`verified_inside`/`verified_outside`/`review_required`), landlord relationship verification (`no_prohibited_relationship`/`prohibited_relationship`/`review_required`), social assessment workflow (`draft`/`submitted`/`reviewed`), approval/rejection workflow (`PolicyApprovalService` → `PolicyDecision` with stable reason code, evidence reference structured, actor, timestamp; evaluation snapshots unchanged; current decision derived from `PolicyDecision` history), generic widow remains `review_required` until documentary evidence verified; no bulk evaluation; no mass recalculation; no scope/simulation; separate assessment/review/decision tables (`social_assessments`, `document_verifications`, `medical_evidence`, `policy_decisions`) linked by evaluation; historical evaluation immutability preserved. Evidence: `POLICY_D_IMPLEMENTATION_REPORT.md`, actual review browser 44/44 (zero remote), default backend 355 passed +1 existing skip /1543 assertions, targeted POLICY-D 36/36 /146 assertions, fresh PostgreSQL 51/51 /268 assertions, frontend 56 passed and lint/build, `git diff --check` and Pint clean, no commit/push/deploy.

**✅ POLICY-E — VERIFIED — READY FOR POLICY-F (2026-09-23)** — E1 scope/run ledger, E2 read-only simulation, E3 controlled execution/retry, E4 future-registration integration, and E5 Arabic admin UI plus isolated real-API browser acceptance. Evidence: [POLICY_E_IMPLEMENTATION_REPORT.md](POLICY_E_IMPLEMENTATION_REPORT.md). POLICY-F remains separately authorized work.

**✅ POLICY-F — VERIFIED — ACCEPTED (2026-09-23)** — query-level ALL/PERMANENT/DAILY beneficiary page, backend filtering and pagination, independent domain authorization, complete filtered XLSX export and preserved daily/general inventory separation.

**✅ POLICY-G — VERIFIED — BENEFICIARY POLICY ENGINE ACCEPTED (2026-09-23)** — final cross-policy acceptance, guarded PostgreSQL constraints and persistence, real Phase 2A/POLICY-E concurrency, consolidated authorization and immutability, D/E/F browser gates at desktop and 360/390/430 widths, workbook inspection and full Phase 2A/2B regression. Evidence: [POLICY_G_FINAL_ACCEPTANCE_REPORT.md](POLICY_G_FINAL_ACCEPTANCE_REPORT.md).

## 4. System-wide Notification Coverage Audit — VERIFIED

The system-wide event, recipient, channel, template, outbox, queue, idempotency, transaction, failure-isolation and privacy audit is complete. Confirmed application callers now enter outbound communication through `NotificationService`; direct provider access remains confined to the communication adapters. Evidence: [audit](NOTIFICATION_COVERAGE_AUDIT.md) and [report](NOTIFICATION_COVERAGE_REPORT.md).

## 5. PDF / Official Document Finalization — VERIFIED

All existing production PDF paths were inventoried and finalized with safe response headers, local Arabic fonts and assets, repeatable headers/footers, page numbering, structural PDF validation, visual acceptance, immutable policy history, QR-free operational receipts, domain authorization and PostgreSQL QA. Evidence: [audit](PDF_FINALIZATION_AUDIT.md) and [report](PDF_FINALIZATION_REPORT.md). Governance report content remains deferred to section 6.

## 6. Governance / Report Finalization — VERIFIED — ACCEPTED (2026-09-24)

The Governance dashboard, paginated report queries, complete filtered Excel workbook, and comprehensive Arabic PDF now share one validated authoritative read model. Reporting uses immutable policy evaluation/decision history, current `SupportDistribution` workflow data, isolated legacy compatibility metrics, and separately labelled inventory snapshots/activity. Permanent/daily beneficiary domains and General Warehouse/Daily Inventory remain independent. Independent `view`, `export_excel`, and `export_pdf` permissions are enforced. Evidence: [audit](GOVERNANCE_REPORTS_AUDIT.md) and [final report](GOVERNANCE_REPORTS_FINALIZATION_REPORT.md).

## 7. Phase 2C — Taqnyat Communication Finalization — PARTIAL — DECISIONS REQUIRED

Provider adapters, mocked transport and PostgreSQL acceptance are implemented. Completion still requires user-supplied account credentials and approved senders, an approved WhatsApp template, a driver opt-in decision, and separately authorized sandbox recipients/sends. Retain fake providers until those decisions are closed. Evidence: [audit](PHASE_2C_TAQNYAT_INTEGRATION_AUDIT.md) and [implementation report](PHASE_2C_TAQNYAT_IMPLEMENTATION_REPORT.md).

## 8. Full System Acceptance Test — PLANNED

End-to-end acceptance across support/reservations, pickup/delivery, driver temporary access, receipt verification, all communication channels/templates, account recovery, internal notifications, PDFs, governance and permissions. Include concurrency, failures/outages, security and historical preservation. This is distinct from the completed Phase 2A gate.

## 9. AZURE DEPLOYMENT AUDIT — PLANNED

Microsoft Azure is the final production deployment target (per master-design sections 14–17 and ADR-005); the earlier Hostinger direction is HISTORICAL — SUPERSEDED. No deployment in Phase 2A/2B and no assumption that basic hosting is sufficient. Audit the proposed actual Azure offering before selecting the final topology:

- Laravel/PHP version support and every required PHP extension.
- React/Vite build/static serving and API/SPA routing.
- PostgreSQL topology/connectivity, security and migration compatibility.
- Long-running queue workers, restart/process supervision and scheduler/cron.
- Persistent storage, permissions, PDF generation/fonts and runtime requirements.
- Outbound HTTPS to Taqnyat, SSL/TLS and environment secret management.
- Sanitized logging, backups, restore verification and operational recovery.

Produce evidence, identified gaps and a supported deployment design. Do not assume the existing operational database, Aiven, local QA or a particular Azure plan is the chosen topology. No resource purchase, credential creation, production connection or deployment follows automatically from this roadmap.

## 10. Azure Production Deployment — PLANNED, SEPARATE AUTHORIZATION

Entry: full system acceptance and Azure deployment audit pass, user-provided production configuration, and explicit deployment approval. Use the audited plan and controlled migration/backup/recovery procedures. Hostinger and other legacy deployment files do not authorize alternative hosting.

## Password recovery channel decision — 2026-09-24

- Password recovery channel: **SMS via Taqnyat** — a 6-digit numeric OTP sent to the account's registered mobile through NotificationService → CommunicationService outbox. Email password recovery: **RETIRED FROM ACTIVE TO-BE**. WhatsApp password recovery: **NOT USED**.
- The 6-digit password-reset OTP is fully separate from the 4-digit receipt verification code: dedicated `password_reset_challenges` table, dedicated HMAC namespace (`password_reset:`), dedicated attempts/lock/cooldown state. Receipt verification remains the unchanged 4-digit mechanism.
- Retired from the active flow: `PasswordRecoveryController` broker calls, the `password.reset` named web route, and the `/reset-password/:token` frontend page. Preserved as inactive historical infrastructure (not deleted): `ResetAccountPassword` notification, `FakeResetEmailChannel`, `password_reset_tokens` table, `password_reset_subject`/`password_reset_body` templates, and the Email provider stack used elsewhere.
- Taqnyat Email is no longer a blocker for Phase 2C password-recovery acceptance.
- Evidence: `tests/Feature/PasswordResetOtpTest.php` (28 cases) and `tests/Postgres/PasswordResetOtpPostgresTest.php` (same suite on the local PostgreSQL QA target). No commit, push or deployment occurred.

## Current stop point

Accepted roadmap state: Phase 2A → Phase 2B → Beneficiary Policy Engine POLICY-A…POLICY-G → Notification Coverage Audit → PDF Finalization → Governance / Reports Finalization → UI/UX Finalization are VERIFIED and ACCEPTED. UI/UX Finalization standardized the Arabic institutional design system, responsive behavior, accessibility, and representative browser acceptance without changing backend contracts or domain separation. Evidence: [UI/UX audit](UI_UX_FINALIZATION_AUDIT.md) and [final report](UI_UX_FINALIZATION_REPORT.md). Phase 2C remains **PARTIAL — DECISIONS REQUIRED** at the external account/live-sandbox gate and is the next separately authorized phase. Microsoft Azure remains the final deployment target; no commit, push or deployment occurred.

## POLICY-D application integration acceptance — 2026-09-22

- Review route: `/admin/beneficiary-policy/review/:evaluationId`, linked from beneficiary details. UI business data and action results come from authenticated evaluation-scoped APIs, not local demonstration state.
- Five independently enforced permissions: `view_documents`, `verify_documents`, `social_assessment`, `review`, `decide`; users administration supports those grants.
- Existing document/social/approval services own transitions and audits. `PolicyDecision` retains the permanent decision; financial/input/scoring snapshots and the evaluation's `final_policy_decision` field remain unchanged.
- The 10/10 System Settings browser smoke is HISTORICAL. Current acceptance executes actual verification, social transitions and decisions through local APIs with zero unexpected remote requests. Required HTTP acceptance tests are included in `php artisan test` automatically.
- Unknown policy ambiguities, under-age exceptions, unresolved orphan proof and more than three affected children remain blocked. No mass recalculation, alternate scoring, simulation or bulk evaluation was introduced.
- Exact current results and verdict: `POLICY_D_IMPLEMENTATION_REPORT.md`. The current amendment supersedes conflicting earlier POLICY-D status/counts and claims that `final_policy_decision` was rewritten.

Required order is: Notification Coverage Audit (**VERIFIED**) → PDF Finalization (**VERIFIED**) → Governance / Reports Finalization (**VERIFIED**) → UI/UX Finalization → Phase 2C Taqnyat Finalization → Full System Acceptance → Azure Deployment Audit → Azure Production Deployment. No commit, push or deployment occurred in Governance Finalization.
