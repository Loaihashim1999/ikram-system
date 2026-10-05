# Phase 2C — Taqnyat implementation report

Date: 2026-09-23  
Verdict: **PHASE 2C PARTIAL — DECISIONS REQUIRED**

## Implementation

- Added `TaqnyatSmsProvider`, `TaqnyatWhatsAppProvider` and `TaqnyatEmailProvider` behind the existing channel interfaces. Business services still use `CommunicationService`; no vendor HTTP exists in controllers, support, delivery or policy services. `NotificationService` remains the internal notification authority.
- Added explicit `COMMUNICATION_PROVIDER=fake|taqnyat`. `fake` is the safe default and automated tests never fall through to a real provider. Environment-backed `services.taqnyat` holds separate service-scoped tokens, approved senders/template metadata, official base URLs and bounded timeouts. Secrets are absent from settings, APIs, frontend, AuditLog and application logs.
- Added one Saudi mobile normalizer. Local, country-code and formatted mobile inputs emit the official `9665XXXXXXXX` form; empty, landline and malformed destinations fail before dispatch.
- Implemented the verified official request/response contracts: SMS `POST /v1/messages`, WhatsApp Business v2 approved-template sends, and mail `POST /mailSend.php`. Only sanitized provider message IDs are persisted.
- Added typed provider failures: 429/5xx/connection timeout are bounded retryable failures; authentication, configuration, recipient/sender/template/request errors and malformed success responses are permanent. No provider response body or credential is persisted.
- Strengthened the outbox: a worker transactionally claims an item as `sending`, releases the database transaction before network I/O, and finalizes under a second row lock. The unique business idempotency key and claim status prevent concurrent duplicate workers from sending the same completed intent. Provider failure remains isolated from support, inventory, receipt and beneficiary state.
- Preserved Phase 2B templates, four-digit receipt security, driver temporary-link secrecy, password-broker behavior, encrypted retry payloads, manual General-Admin retry and payload destruction after success/cancellation/expiry.
- No schema or UI change was needed. Delivery callbacks are deferred because the official WhatsApp documentation lists callback payloads/states but does not publish a signature, verification token or other source-authentication scheme.

## Verification

- Phase 2C + directly related Phase 2B/NotificationService targeted suites: **35 passed, 209 assertions**.
- Phase 2C focused suite alone: **11 passed, 58 assertions**.
- Guarded local PostgreSQL QA (`pgsql`, `127.0.0.1:5432`, `ikram_phase2a_qa`): **11 passed, 58 assertions**; no credential was printed. Unique outbox intent, row-lock claim, provider state transitions and authorization passed. No migration was introduced.
- Full backend regression: **435 passed, 2 skipped, 2052 assertions** (437 discovered tests). The two skips are pre-existing environment-dependent skips.
- Frontend: **64 passed**; ESLint clean; Vite production build clean (2275 modules).
- Pint on changed PHP files: clean. `git diff --check`: clean.
- Browser: not run because Phase 2C changed no UI. Automated tests used Laravel HTTP fakes; no live Taqnyat traffic occurred.

## External decisions and evidence still required

Production/account acceptance cannot be claimed without the user-controlled Taqnyat inputs that were not supplied:

1. SMS service token and approved sender name, email service token and approved from address/campaign, and WhatsApp service token/number.
2. The approved WhatsApp driver template name, language and confirmation that it has exactly one body text parameter matching the implemented mapping.
3. Evidence/decision for driver WhatsApp opt-in. The official contract requires opt-in before every business initiated template conversation; IKRAM currently has no authoritative driver consent record and Phase 2C must not invent one.
4. Explicitly authorized sandbox recipients for separate controlled SMS, WhatsApp and email smoke sends. This implementation task explicitly prohibited live traffic.
5. A provider-supported callback authentication contract if delivery-status callbacks are to be enabled. The inspected official documentation defines payload/states but no verifiable source-authentication mechanism.

Until those inputs and the opt-in decision are supplied, keep `COMMUNICATION_PROVIDER=fake`. Notification Coverage Audit has not started.

**PHASE 2C PARTIAL — DECISIONS REQUIRED**
