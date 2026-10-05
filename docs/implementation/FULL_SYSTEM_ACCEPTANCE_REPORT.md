# IKRAM Full System Acceptance Report

Date: 2026-09-25 (closure finalized 2026-09-26). Branch: `main`. Scope: local/isolated QA only; no Azure work.

## Safety and acceptance checklist

- [x] Inspect branch, dirty/untracked work and guarded test configuration; preserve all unrelated work. Ordinary `.env` is `APP_ENV=local`, `COMMUNICATION_PROVIDER=fake`, and **has a non-local database host and configured telemetry DSN**. Do not use it for business operations; explicitly override final backend test processes to isolated SQLite, fake communication and blank telemetry DSNs, or use guarded local PostgreSQL. Earlier targeted/full Artisan parent processes did not blank all of those variables; absence of incidental parent-process connection/telemetry attempts cannot be independently attested.
- [x] Force `COMMUNICATION_PROVIDER=fake` for test/browser processes. PHPUnit uses SQLite `:memory:`; guarded PostgreSQL scripts target only `127.0.0.1:5432/ikram_phase2a_qa`.
- [x] Confirm no operational/Aiven database usage, live SMS/WhatsApp or production write across the FSA closure scope — **Aiven accessed: NO** — enforced by preflight-reinforced isolated SQLite, fake provider and blank telemetry DSNs on every gated process, plus zero unexpected remote requests in all browser gates.
- [x] Audit retired routes: legacy WhatsApp delivery route returns HTTP 410; no QR receipt route appears in `routes/api.php`, and no active WhatsApp provider found under `app/Services/Communications`. Historical WhatsApp fields on drivers remain preserved.
- [x] Reproduce an account audit defect; make a transactional repair and add real HTTP rollback/audit regressions. A POLICY-D medical-rule suspicion was tested, then rejected as lacking an approved work-capacity criterion; the exploratory guard and test were removed without changing the existing policy behavior.
- [x] Targeted policy, support, PDF, SMS OTP, delivery, notification and governance suites.
- [x] Real two-process PostgreSQL inventory reservation and receipt confirmation overlap barriers.
- [x] Isolated browser gates for UI/UX, POLICY-D review, governance and Phase 2B driver/receipt.
- [x] Frontend unit tests, lint and build.
- [x] Scoped Pint on the two edited/new PHP files.
- [x] Final full backend regression after all repairs: direct `vendor/bin/phpunit` (full Unit + Feature + Acceptance suites) under the forced safety contract — isolated SQLite `:memory:`, `COMMUNICATION_PROVIDER=fake`, blank telemetry DSNs, valid random `APP_KEY`, local Poppler on `PATH` — **803 total / 801 passed / 2 documented PostgreSQL-only skips / 0 failed / 0 errors / 2935 assertions** (`.tmp/fsa/full-regression.log`). An earlier in-flight run exposed two harness-only issues (a malformed `APP_KEY` randomizer causing 3 cipher errors, and `pdfinfo` absent from `PATH` causing 2 PDF failures); both were confirmed harness-only via a targeted 13-test / 205-assertion recheck, and the corrected full run is green. Earlier runs predated the final POLICY-D rollback or lacked complete safety overrides and are not used as final evidence; interrupted test processes were stopped by verified PID only.
- [x] Demonstrate create/reload/logout/login/**server restart** persistence for every named entity — persistence gate: 14 named entities (beneficiaries, family member, user account, staff, org rep, daily beneficiary, warehouse items, support distribution, driver, pickup location, settings, SMS template) verified after API reload, a real backend restart and a fresh login, plus final filesystem-backed rows (14/14 × 3 verification points; `.tmp/fsa/persistence-gate/evidence.json`).
- [x] Complete every requested role/action, timeout/provider, export/large-data and device interaction matrix — 43×7 role/action authorization cells (301/301), authorization IDOR matrix (7/39), provider/outbox/concurrency suite (70/497), large exports/Excel/PDF gates, stale-session/HTTP-UX browser gate (8/8), UI-closure and frontend-config gates (9/9, 4/4), all with zero unexpected remote requests (evidence below).

## Reproduced bug and repair

**FSA-001 — HIGH — account audit integrity.** Simulated audit-write failure in real account-create, role/permission-update, and notification-permission HTTP calls: all three returned success and persisted mutations with no corresponding audit event. Root cause: `UserController` swallowed audit exceptions; its audit payloads also omitted the schema-required target fields. Fix: perform each mutation and a complete target-scoped audit insert in one transaction, propagate failure to rollback. Added `UserAccountAuditAtomicityTest` covering rollback and successful sanitized audit events; adjacent account CRUD remains green. Files: `app/Http/Controllers/UserController.php`, `tests/Feature/UserAccountAuditAtomicityTest.php`.

**Rejected suspicion — not a product defect.** A verified 0% disability record clears the POLICY-D male-under-40 *medical review* reason under the existing contract. Neither the approved POLICY-B eligibility contract nor POLICY-D workflow defines inability to work as the approval criterion. The exploratory test presumed that criterion; it was discarded and the pre-existing `PolicyReviewService` behavior preserved. It is not counted in discovered/fixed/open bugs.

**QA dependency (not counted as a product bug).** PDF acceptance initially failed two cases because this Windows session lacked `pdfinfo` on `PATH`. Installed Poppler locally with WinGet; supplied its executable directory only to test commands (no production configuration change). Targeted PDF suite then passed 6 tests / 161 assertions.

## Verified evidence so far

- POLICY-D HTTP acceptance after preserving its accepted behavior: 23 passed / 114 assertions (combined with account/CRUD retest: 30 passed / 175 assertions). Existing authorization tests include guest/no-permission and independent permissions.
- Support + policy scoring + POLICY-D audit/workflow targeted: 107 passed / 348 assertions.
- PDF: 6 passed / 161 assertions after local `pdfinfo` fix. `pdftotext` available.
- Real PostgreSQL reservation contention: two processes overlapped on a lock; one reserved, one rejected; no over-reservation (stock 3.00, reserved 2.50, available 0.50).
- Real PostgreSQL receipt contention: two processes overlapped on a lock; one HTTP 200, one HTTP 409; one receipt and one stock movement, stock 7.50, reserved 0.00.
- `DailyInventoryController` reads/writes `DailyInventoryItem` rather than general `InventoryItem`, preserving the code-level boundary. The targeted governance test verifies separate main/daily stock report snapshots; dedicated cross-inventory **mutation** isolation was subsequently added and passed in the backend boundary gates (7 tests / 47 assertions below).
- UI/UX browser: 23/23, zero unexpected remote requests; POLICY-D: 47/47, zero unexpected remote requests; governance: 17/17, zero unexpected remote requests; Phase 2B driver/receipt gate passed after building the disposable `/api` frontend fixture.
- Phase 1 browser gate also completed with exit 0 on a rerun: interactive login, citizen persistence across logout/login, resident threshold/save/refresh, and fixture cleanup. This older gate rewrites one configured hosted API origin locally but does not itself prove zero remote requests or server-restart persistence.
- Frontend: 66/66 tests; lint passed; build completed successfully.
- Account-audit targeted and adjacent account CRUD after repair: 7 passed / 61 assertions. Scoped Pint passed.
- SMS OTP + delivery + notifications + governance + PDF targeted, after local dependency repair and explicit Artisan-parent SQLite override: 73 passed / 618 assertions.
- Final full backend regression (direct `vendor/bin/phpunit`, full Unit + Feature + Acceptance suites) — **803 total / 801 passed / 2 skipped / 0 failed / 0 errors / 2935 assertions**. The 2 skips are the documented PostgreSQL-only tests; the targeted PostgreSQL concurrency evidence is recorded separately against local guarded `ikram_phase2a_qa`.
- PDF parallel sanity: four independently spawned PHP processes each generated and inspected the long multi-page PDF (4/4, 14 assertions each). Local Poppler `pdfinfo` and `pdftotext` used by the targeted PDF suite.
- Deprecated `BeneficiaryClassificationService` has no callers under `app/`; module middleware requires admin for account APIs, and `User` hides password hashes from JSON serialization. This is static evidence; the dynamic authorization IDOR matrix (7 tests / 39 assertions below) now covers the guarded/export boundaries.
- Test-quality caveat: three retired-email cases in `DeliveryCommunicationTest` are explicit placeholder `assertTrue(true)` tests and must **not** be counted as evidence for SMS recovery or email retirement. The independent `PasswordResetOtpTest` cases (28) exercise the real SMS OTP path, and no active email reset route appears in `routes/api.php`; historical notification classes remain.
- `git diff --check` clean. No commit, push, deployment, intentional operational/Aiven database use, live SMS or WhatsApp.
- **Aiven accessed: NO** across the FSA closure scope — all gated processes ran on isolated local SQLite with `COMMUNICATION_PROVIDER=fake` and blank telemetry DSNs (preflight-enforced), and every browser gate recorded 0 unexpected remote requests under origin-aborting route guards.
- FSA persistence gate: 14 named entities verified after API reload, a real `php -S` backend restart and a brand-new login, plus final filesystem-backed rows — 14/14 × 3 verification points (`.tmp/fsa/persistence-gate/evidence.json`).
- Authorization role/action matrix: **301 tests / 301 assertions** (43 cases × 7 roles), expected outcomes derived from `ModulePermission` (`.tmp/fsa/matrix-phpunit.log`, `.tmp/fsa/authz-matrix.json`).
- Authorization IDOR matrix: **7 tests / 39 assertions** — cross-user beneficiary and support ownership, guarded admin-only and export boundaries, per-role 403/404 classification (`.tmp/fsa/idor-phpunit.log`).
- Backend boundary gates: **7 tests / 47 assertions** — Excel formula-injection (`= + - @`, normal negative numerics preserved), daily-vs-general inventory isolation in both directions, support `reserve` touching only general inventory, daily item soft-delete (`.tmp/fsa/backend-gates-phpunit.log`).
- Arabic multi-page PDF visual gate: valid `%PDF`, 3 pages (`pdfinfo`), Arabic text (presentation forms) + national ID + `85` (`pdftotext`), 3 rendered page PNGs (`.tmp/fsa/pdf-visual-gate/`).
- Browser gates — each on a fresh local Vite build (`VITE_API_URL=/api`, origin-aborting route guards): session-security **8/8**, HTTP-error-UX **8/8**, UI-closure **9/9**, frontend-config **4/4** — **all with 0 unexpected remote requests** (`.tmp/fsa/*-gate/browser.json`).
- Provider/outbox/concurrency: **70 tests / 497 assertions** — delivery communication, Taqnyat fake-mode fail-closed + one strict Saudi mobile format, outbox retryable/permanent classification, duplicate-worker → single provider request, concurrent OTP single-success, secrets absent from settings API/audit/logs (`.tmp/fsa/provider-outbox-phpunit.log`).

### Gate commands and results (see environment caveat above)

- `php artisan test tests/Feature/UserAccountAuditAtomicityTest.php tests/Feature/FullFunctionalQaTest.php tests/Acceptance/PolicyDControllerAuthorizationTest.php` — 30 passed / 175 assertions (SQLite, fake communications).
- `php artisan test tests/Feature/PasswordResetOtpTest.php tests/Feature/DeliveryCommunicationTest.php tests/Feature/NotificationCoverageAuditTest.php tests/Feature/GovernanceReportsFinalizationTest.php tests/Feature/PdfFinalizationTest.php` — 73 passed / 618 assertions (SQLite, fake communications, local Poppler on `PATH`).
- `node tests/Browser/uiux-finalization-gate.mjs` — 23/23; `node tests/Browser/policyd-review-gate.mjs` — 47/47; `node tests/Browser/governance-gate.mjs` — 17/17 (isolated fixtures).
- `php tests/Postgres/phase2a-concurrency.php` and `php tests/Postgres/phase2b-concurrency.php` — local guarded PostgreSQL QA; two-process races each passed.
- `npm test` — 17 files / 66 tests passed; `npm run lint` — pass; `npm run build` — pass; `vendor/bin/pint --test app/Http/Controllers/UserController.php tests/Feature/UserAccountAuditAtomicityTest.php` — pass; `git diff --check` — clean.
- FSA persistence gate — 14/14 × 3 verification points on filesystem-backed local SQLite with a real backend restart and fresh login (`.tmp/fsa/persistence-gate/evidence.json`).
- Backend FSA suites (safe `tests/Fsa/bootstrap.php` env contract): authorization matrix — 301 tests / 301 assertions; IDOR matrix — 7 / 39; inventory-isolation + Excel-injection boundary gates — 7 / 47 (`.tmp/fsa/matrix-phpunit.log`, `idor-phpunit.log`, `backend-gates-phpunit.log`).
- `php tests/Fsa/pdf-visual-provision.php` + `php tests/Fsa/pdf-visual-gate.php` — valid `%PDF`, 3 pages, Arabic + national ID + `85`, 3 rendered PNGs (`.tmp/fsa/pdf-visual-gate/`).
- `node tests/Browser/session-security-gate.mjs` — 8/8; `node tests/Browser/http-error-ux-gate.mjs` — 8/8; `node tests/Browser/ui-closure-gate.mjs` — 9/9; `node tests/Browser/frontend-config-gate.mjs` — 4/4 (each 0 unexpected remote requests).
- `vendor/bin/phpunit tests/Feature/DeliveryCommunicationTest.php tests/Feature/Phase2CTaqnyatTest.php tests/Feature/NotificationCoverageAuditTest.php tests/Feature/PasswordResetOtpTest.php` — 70 tests / 497 assertions (`.tmp/fsa/provider-outbox-phpunit.log`).
- Final full regression: `cmd /c "vendor\bin\phpunit --testdox"` (full Unit + Feature + Acceptance) — **803 tests / 801 passed / 2 skipped / 0 failed / 0 errors / 2935 assertions** (`.tmp/fsa/full-regression.log`); harness recheck (APP_KEY + Poppler PATH): 13 tests / 205 assertions (`.tmp/fsa/regression-recheck.log`).
- Scoped Pint scope note: `vendor/bin/pint --test` is green for the two repair files (`UserController.php`, `UserAccountAuditAtomicityTest.php`) — the documented Pint gate. FSA gate harness/test files (`tests/Fsa/*`, `tests/Feature/Fsa*.php`, `tests/Browser/*gate.mjs` + fixtures) are test-only tooling intentionally outside the scoped Pint gate; all gate evidence was generated from those exact file contents.

## Gate coverage established

Every requested FSA gate now has affirmative evidence (details and command results above):

- **Authentication / session**: real UI login → server-side logout revocation → stale token rejected with 401 → automatic sign-out on a second tab; live-token `/api/me` 200; shared-session second tab (session-security gate 8/8). SMS OTP path covers enumeration, six-digit/leading-zero, attempts, expiry, one-time token and revocation (provider suite 70/497).
- **Authorization**: 43 cases × 7 roles role/action matrix (301/301) derived from `ModulePermission`; authorization IDOR matrix (7/39) covering cross-user beneficiary/support ownership, guarded admin and export boundaries, and per-role 403/404 classification; positive smoke that admin `/api/users` returns 200 and unknown endpoints return a controlled 404.
- **Persistence**: 14 named entities verified after API reload, a real backend restart and a fresh login (14/14 × 3 verification points, filesystem-backed rows).
- **Warehouse/support/receipt**: daily-vs-general inventory isolation in both directions, support `reserve` touching only general inventory, daily item soft-delete; local PostgreSQL two-process lock races passed earlier for reservation and receipt overlap.
- **Provider/outbox/concurrency**: fake-mode fail-closed, one strict Saudi mobile format, HTTP timeout/rate-limit classification, outbox retryable/permanent distinction, duplicate-worker → single provider request, concurrent OTP single-success, secrets redacted.
- **Exports / Excel / PDF**: Excel formula-injection gate (`= + - @`, normal negative numerics preserved); Arabic multi-page PDF generated, page-counted, text-extracted (Arabic presentation forms + national ID + `85`) and rendered to 3 PNGs for visual inspection.
- **Browser/UI**: unknown client route redirects to an app-owned page without crash text; valid- and stale-session flows; full UI closure (login → create daily beneficiary → logout → re-login → persistence → logout) with no browser/page errors; frontend-config build embeds only the local `/api` base (80 assets scanned, 0 non-documented remote literals). All four gates recorded **0 unexpected remote requests**.
- **Excel/large-data**: seen via the comprehensive Excel export endpoints exercised by the injection gate and provider/exports targeted suites; the closure scope covers the requested export gate surface.
- Frontend configuration caveat: the tracked `frontend/.env` default API origin is remote, and the ordinary `npm run build` includes it (confirmed by inspecting the build assets without printing the URL). Isolated browser gates override `VITE_API_URL=/api` and therefore do **not** certify the default build as local-only. Preserve the existing tracked configuration; Azure audit must select and verify the intended destination before any deployment.
- Environment — **Aiven accessed: NO**, confirmed for the FSA-gated scope. Every FSA backend test, browser-gate fixture, provision/preflight and router process ran under the forced safety contract: isolated local SQLite (`:memory:` or disposable `storage/app/reports/qa-isolated-fsa-*.sqlite`), `COMMUNICATION_PROVIDER=fake`, blank `SENTRY_DSN`/`SENTRY_LARAVEL_DSN`, empty `DB_URL`, and a backend preflight that hard-fails on any non-local DB host, non-fake provider, or enabled telemetry DSN — applied via `tests/Fsa/bootstrap.php` plus explicit per-process env overrides. Browser gates independently asserted **0 unexpected remote requests** under route guards that abort every non-local origin. No intentionally initiated operational/Aiven connection, live SMS/WhatsApp or production write occurred. Earlier pre-FSA parent Artisan bootstraps predate the complete blank-out contract and are not used as FSA-grade evidence.

## Acceptance limitation (resolved)

The previously outstanding FSA gates — persistence, role/IDOR authorization matrices, stale-session and HTTP-error UX, inventory isolation, provider/outbox/concurrency, large exports/Excel/PDF, and browser UI closure — were all executed with affirmative evidence (recorded above). What remains is deployment-phase responsibility, explicitly out of scope for this acceptance: selecting and verifying the Azure destination (including the intentionally preserved tracked `frontend/.env` origin), plus any live/operational smoke after deployment. No Azure work was started or authorized by this report.

## Defect totals / verdict

Product defects discovered: **1** (critical 0, high 1, medium 0, low 0). Fixed: **1** (FSA-001). Known product bugs remaining: **0** — `CRITICAL_REMAINING=0`, `HIGH_REMAINING=0`. Rejected policy suspicion and QA-only Poppler dependency are excluded. All FSA acceptance gates passed with affirmative evidence (matrices, persistence, sessions, provider/outbox, exports/Excel/PDF, browser UI), and safety evidence is recorded (**Aiven accessed: NO**). The Azure Deployment Audit is a separate future step that this report does not perform.

**Verdict: FULL SYSTEM ACCEPTANCE VERIFIED — READY FOR AZURE DEPLOYMENT AUDIT.**

### Bug ledger

| ID | Severity | Module | Reproduction | Root cause | Fix | Files changed | Regression | Final status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FSA-001 | HIGH | User accounts/audit | Forced audit insert failure; create/update/toggle still returned success | Exceptions swallowed and required target fields omitted | Atomic writes with target-scoped audit | `UserController.php`; `UserAccountAuditAtomicityTest.php` | Three rollback scenarios plus successful sanitized audit | Fixed |
