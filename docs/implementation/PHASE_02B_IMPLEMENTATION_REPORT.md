# Phase 2B Implementation Report — Delivery, Driver Access, 4-Digit Verification & Communication Architecture

Date: 2026-09-21. Status: **PHASE 2B VERIFIED — ACCEPTED** (next controlled phase: Beneficiary Policy Engine — NOT STARTED; Phase 2C — TAQNYAT — NOT STARTED). (تحديث 2026-09-21 — HISTORICAL — SUPERSEDED: بدأت المرحلة الأولى من محرك سياسة المستفيدين — تدقيق الفجوات وتصميم التنفيذ فقط READ/ANALYZE/DOCUMENT ONLY — راجع [BENEFICIARY_POLICY_GAP_AUDIT.md](BENEFICIARY_POLICY_GAP_AUDIT.md) و[ADR-007](../architecture/ADR-007-VERSIONED-BENEFICIARY-POLICY-ENGINE.md).)
Authority: [TO-BE master design](../architecture/TO_BE_MASTER_DESIGN.md), [ADR-005](../architecture/ADR-005-COMMUNICATION-DELIVERY-DEPLOYMENT.md), [ADR-006](../architecture/ADR-006-DELIVERY-VERIFICATION-COMMUNICATION-ARCHITECTURE.md), [discovery map](PHASE_02B_DISCOVERY_MAP.md), [roadmap](IMPLEMENTATION_ROADMAP.md). Phase 2A remains verified.

All work is **uncommitted** by instruction (no commit/push/deploy). No real provider was contacted; no production policy values were adopted.

## 1. Codex handoff audit

Codex stopped at usage quota mid-Phase 2B. Audit of the working tree (classification; nothing was discarded, no clean/reset/restore performed):

- **DONE (implemented by Codex, re-verified by OpenCode):** discovery map incl. the 2026-09-21 retirement-outcome section; ADR-006; master-design/roadmap updates; all migrations, services, contracts, jobs, notifications, controllers, routes; driver temporary-access flow; Driver mobile UI; 4-digit verification; template renderer; fake providers; password-reset email channel; queue/retry/idempotency plumbing; communication settings UI incl. pickup locations and logs; legacy QR/communication retirement (route disabling, frontend replacements, dormant retention); the Phase 2B backend/PostgreSQL/browser test suites. Evidence files under `.tmp/phase2b-evidence/` (final Codex backend run 14:47: 151 tests / 812 assertions passed; browser gate PASS 14:40; frontend 14:27–14:44 green).
- **PARTIAL (Codex's last edits at 14:48, written AFTER its final test run — never executed by Codex):** two added `DeliveryCommunicationTest` tests (`test_reset_request_rate_limit_is_enforced`, `test_driver_access_remains_until_last_assigned_task_completes`) — re-run by OpenCode, **pass**; the added old-password assertion in `AdminPasswordRecoveryTest` — re-run by OpenCode, **failed** (see §3).
- **TODO (completed by OpenCode this session):** `PHASE_02B_IMPLEMENTATION_REPORT.md` (this file); independent full-regression re-run (backend, PostgreSQL, concurrency, frontend, lint, build, Pint, browser gate); the single test repair.
- **PRE-EXISTING / UNRELATED:** Phase 2A support engine (verified separately); account-security lockout feature (2026-09-15, pre-Phase-2B, policy values untouched); warehouse expiry work; deployment-era files (`wrangler.toml`, cloudflare env); `public/assets` build artifacts; Pint style failures in legacy files outside Phase 2B scope (`scratch/`, old seeders/tests, `server-router.php`) — intentionally not touched.

## 2. Implemented architecture

### 4-digit receipt verification
`app/Services/Delivery/ReceiptVerificationService.php`. Codes are `random_int(0,9999)` zero-padded (leading zeros preserved). The plaintext code is never stored: a per-challenge `generation` UUID plus HMAC-SHA256 verifier (keyed by `APP_KEY`, bound to operation id + generation + code) is stored in `receipt_challenges`. The challenge is operation-bound (pickup verify vs. driver delivery enforced server-side), single-use with atomic consumption inside the same transaction as the Phase 2A completion transition (one receipt, one movement), TTL, one-time reuse rejection (409), failed-attempt counter, temporary lockout (423), per-actor rate limiting (429), reissue cooldown that cancels superseded queued messages, and sanitized audit events (`RECEIPT_CODE_ISSUED/RECEIPT_REJECTED/RECEIPT_LOCKED/RECEIPT_VERIFIED` — code never logged). Audit failure rolls back the whole verification (test-proven).

### Driver temporary access
`app/Services/Delivery/DriverAccessService.php`. Admin selects driver + tasks + duration (bounded by policy). Assignment stores only `hash('sha256', token)` of a 64-hex random token delivered inside the encrypted WhatsApp payload as `…/driver-access#<token>`. Every request revalidates, under the assignment row lock plus driver-row lock: token, driver active, revocation, completion, expiry (expiry audited once); tasks are scoped to the assignment (`driver_assignment_tasks`); confirm delegates to the receipt service with the assignment id as actor-binding; access ends when the last task completes (410, audited). Driver users cannot log in normally (403 pointing to the temporary link) and existing driver-user sessions cannot reach task/admin APIs. Assigned tasks transition `ready → in_delivery` via the Phase 2A state machine — no completion bypass (HTTP direct-complete returns 409, test-proven).

### Driver UI (mobile-first Arabic RTL)
`frontend/src/pages/driver/DriverAccessPage.jsx` + `driver-access.css`, route `/driver-access` (public, outside the admin shell). Token read from URL hash and immediately stripped from history. Task cards show recipient name, phone (tel: link), city/district/address, optional validated `location_url` ("not available" state otherwise — no inferred coordinates), items with quantities/units, status. 4-digit numeric input (`inputMode="numeric"`, sanitized to 4 digits), 44px+ touch targets, terminal states for invalid/expired/revoked/completed links, explicit offline messaging, `dir="rtl"`, no sidebar, no financial/classification data (test-proven secret hiding).

### Communication architecture
- **Contracts:** `app/Contracts/Communications/{SmsProviderInterface,WhatsAppProviderInterface,EmailProviderInterface,MessageProviderInterface}` — no vendor HTTP in domain code.
- **Fakes only (Phase 2B):** `FakeSmsProvider`, `FakeWhatsAppProvider`, `FakeEmailProvider` (deterministic `fake-…` references, configurable failure via container rebinding in tests).
- **Routing:** beneficiary/staff/organization → SMS; driver → WhatsApp; account → Email (`CommunicationService::enqueue`).
- **Outbox:** `communication_messages` — `idempotency_key` (duplicate-send protection), destination masked (`***` + last 3) with the real destination inside an **encrypted payload** that expires and is wiped on send/cancel/supersede/final expiry; attempts + bounded backoff `[30,120,600]s`, max 3 automatic attempts then `failed` with visible state; manual retry capped at 6; `SendCommunication` job carries only the message id, dispatched `afterCommit`, with a scheduled drain (`routes/console.php`) so a failed dispatch never loses a message. Provider failure never touches support, reservations, inventory or history (test-proven).
- **Templates:** `MessageTemplates` — per-key placeholder allowlists and required placeholders (e.g. `{verification_code}`, `{reset_link}`, pickup name/URL in pickup templates; delivery templates reject pickup data); `{password}` and any unknown/malformed placeholder rejected; 4000-char bound; HTML/`{{`/`<?` rejected; newline rejected in the email subject; synthetic-data-only previews.

### Password reset (Email)
`PasswordRecoveryController` unchanged policy (admin-only, generic responses, expiry/single-use/throttle) now delivers through `ResetAccountPassword` → `FakeResetEmailChannel` → `EmailProviderInterface`. Reset success clears lock state/tokens, cancels pending reset messages, audits `PASSWORD_RESET_REQUESTED/COMPLETED` without token/password material. Request rate limit 3/min → 429 (test-proven). The reset link rides the template with required `{reset_link}`; temporary-password and first-admin flows retained.

### Settings (General Admin only)
`GET|PUT /api/settings/communications` + preview + message log + bounded retry. `CommunicationsSettings` (mounted in `SystemSettingsPage` for admins) edits: nine templates (6 SMS contexts, driver WhatsApp, reset subject/body), association display name, pickup locations with `location_url`. Allowlisted placeholders shown per field; per-field 422 errors; synthetic previews. No provider secrets anywhere in settings. Non-admin denied (test-proven).

### Migrations
`2026_09_20_010000_create_delivery_communication_architecture`: `driver_assignments`, `driver_assignment_tasks`, `receipt_challenges`, `support_receipts`, `communication_messages`; additive `pickup_locations.location_url`, `support_distributions.pickup_location_url` (snapshot); reversible `down()`. (Builds on the Phase 2A-era `2026_09_19_*` support/pickup tables.)

### Routes
New: public throttled `/api/driver-access{,/tasks/{id},/tasks/{id}/confirm}`; authed `/api/support/distributions/{id}/receipt-code`, `/api/settings/communications{,/preview,/messages,/messages/{id}/retry}`, pickup-location CRUD, `/api/support/assignments{,/{id}/revoke}`, `/api/support/drivers` (via `DeliveryCommunicationController`, `PickupLocationController`, `SupportDistributionController`). Retired legacy routes return **410**: `/api/receiver/scan/{code}`, `/api/receiver/confirm/{code}`, `/api/distributions/{id}/received`, `/api/distributions/{id}/whatsapp`, `/api/drivers/deliveries`; direct unified-support completion without the receipt challenge returns **409**.

## 3. Continued OpenCode work (this session)

1. Handoff audit (§1) — no destructive git operation; all pre-existing changes preserved.
2. Independent verification of Codex's evidence instead of trusting it; discovered the failure below.
3. **Repair of Codex's unverified 14:48 edit:** `AdminPasswordRecoveryTest` asserted a wrong-password login immediately followed by a correct login. The (pre-Phase-2B, deliberate) admin lockout policy locks an admin for 1 minute on the first failed attempt, so the second assertion could never pass. Fix: reorder — successful login with the new password first, then assert the old password is rejected. Both security properties remain asserted; the implemented lockout policy is unchanged (policy values require user approval per master design; flagged in §6).
4. Full regression re-runs (below). No other code changes.

## 4. Verification evidence (all re-run by OpenCode today)

| Gate | Result |
|---|---|
| `php artisan test` (SQLite) | **153 passed, 833 assertions** (incl. 23 `DeliveryCommunicationTest`, notification recipient policy, admin recovery, Phase 2A regressions) |
| PostgreSQL isolated QA (`ikram_phase2a_qa`, guarded 127.0.0.1:5432) | `DeliveryCommunicationPostgresTest` **23 tests / 145 assertions OK**; migration applied |
| Real two-process concurrency (PostgreSQL) | **PASS** — two workers lock simultaneously; concurrent confirmations: one 200 / one 409; exactly one receipt + one movement; `current=7.50 reserved=0.00` |
| Frontend `npm run test` | **52 passed** (13 files) |
| `npm run lint` | clean |
| `npm run build` | success |
| Pint (39 Phase 2B files) | PASS |
| `git diff --check` | no whitespace errors (CRLF notices only) |
| Browser/mobile gate (`tests/Browser/phase2b-gate.mjs`, isolated stack + synthetic fixture) | **PASS** — mobile 360/390/430 RTL, no overflow/sidebar, 44px targets, wrong-code error, leading-zero confirmation, completed/invalid/expired links, loading/offline feedback, admin API denial, settings preview/save; screenshots in `.tmp/phase2b-evidence/driver-*.png` |

Requirement coverage (user test plan §11): 4-digit code, leading zero, wrong/expired/reused codes, attempt limit, lockout, concurrent verification, driver links expiry/revoke/deactivation/completion, task isolation and secret hiding, driver-vs-admin API denial, mobile UI, SMS/WhatsApp/Email routing, template validation, provider failures, retry/idempotency, password reset (incl. rate limit, one-time token, sanitized audits), and "communication failure does not corrupt support/inventory/history" — each mapped to a named passing test listed in §4/§2 above.

## 5. QR & legacy retirement status (discovery map authoritative)

- **DISABLED:** legacy receiver scan/confirm, distributions received/WhatsApp, driver deliveries routes (410); direct HTTP completion (409); driver-user login (403). Legacy controller methods remain unreachable compatibility source.
- **REPLACED:** `/receiver`, `/delivery` render `SupportDeliveryPage`; old driver dashboard redirects to `/driver-access`; sidebar wording updated; manual WhatsApp builders, QR-image URLs and send buttons removed; `QrWhatsAppCard` renders a historical reference explicitly marked "not a verification code".
- **RETAINED HISTORICAL:** barcode fields on distributions/staff/rep records, PDF reference values and their authorization, timeline/audit references, drivers/users FKs, historical receipts. No history deleted.
- **RETAINED DORMANT:** `ReceiverPage`, `QrScannerModal`, old `DeliveryPage`/`DriverDashboard`, unmounted SendSupport/Distribution pages, `qrcode`/`html5-qrcode` packages and standalone scanner tests — not imported by any active App route.
- **MIGRATED:** password-broker notification to the fake email channel; recovery tests observe `ResetAccountPassword`.

## 6. Remaining risks / decisions for the user

1. **Policy values are TEST defaults** (`config/delivery.php` marked as such): receipt TTL 15 min, 5 attempts, 15-min lock, 5 verifications/min, reissue cooldown 60 s, driver links 480/1440 min. Production values require explicit approval (master-design mandate). Same for the pre-existing admin lockout ladder (see §3.3 — currently a first failed attempt locks an admin for 1 minute; confirm or relax).
2. Pre-existing Pint/style failures in legacy files (scratch/, old seeders/tests) were deliberately left untouched; housekeeping is out of Phase 2B scope.
3. QR packages and dormant components remain installed; package/source removal deferred (no new QR functionality).
4. `location_url` in driver task views is currently always "not available" until a real pickup-location URL is supplied (explicit missing-map state; no inferred coordinates).
5. Phase 2C (real Taqnyat) and any deployment require separate explicit approval; Microsoft Azure is the final deployment target and the Azure Deployment Audit requires separate future approval; nothing was connected, deployed, committed or pushed.

**PHASE 2B VERIFIED — ACCEPTED**

**FINAL STATUS — 2026-09-21:** PHASE 2A — VERIFIED · PHASE 2B — VERIFIED — ACCEPTED · NEXT CONTROLLED PHASE — BENEFICIARY POLICY ENGINE · PHASE 2C — TAQNYAT — NOT STARTED · FINAL DEPLOYMENT TARGET — MICROSOFT AZURE.
