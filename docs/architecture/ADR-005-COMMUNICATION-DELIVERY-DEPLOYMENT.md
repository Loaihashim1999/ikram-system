# ADR-005 — Communication, Delivery Verification and Deployment

> **SUPERSEDED FOR ACTIVE COMMUNICATIONS (2026-09-24):** Driver delivery now uses SMS and WhatsApp is retired. See [ADR-007](ADR-007-WHATSAPP-RETIREMENT-DRIVER-SMS.md). Historical text below is retained as decision history.

Date: 2026-09-20. Status: APPROVED TO-BE DECISION; future implementation requires explicit phase authorization.

## Authority and execution status

This ADR records the user's master communication, delivery and deployment update. The normative requirements are in [TO_BE_MASTER_DESIGN.md, sections 4–14](TO_BE_MASTER_DESIGN.md#4-اعتماد-تحديث-الاتصالات-والتسليم-والنشر--2026-09-20). The [implementation roadmap](../implementation/IMPLEMENTATION_ROADMAP.md) controls sequencing. Any conflicting earlier architecture or session decision is superseded by this approval.

Phase 2A is VERIFIED, including the completed local PostgreSQL acceptance gate documented in [its report](../implementation/PHASE_02A_IMPLEMENTATION_REPORT.md). This documentation update does not reopen that gate, alter Phase 2A behavior, authorize deployment, or authorize starting Phase 2B.

## Decisions

- Permanent beneficiary, employee and organization support communications use SMS. Driver assignments use WhatsApp Business. Password reset/approved account recovery uses Email. Taqnyat is the planned provider for all three; another provider requires a new explicit architecture decision.
- QR is permanently removed from the TO-BE verification architecture. Exactly four numeric digits are the only target receipt verification method. Existing QR code/routes/documents are AS-IS legacy and require controlled audit/removal in Phase 2B, preserving history; they are not removed by this ADR.
- Receipt codes are secure random, operation-specific, temporary and single-use, with server verification, expiry, attempt limits, rate limiting, temporary lockout and audit without plaintext secrets. Exact policy values are decided in Phase 2B. Codes must not be derived from recipient, phone or operation identifiers.
- Driver master data remains permanent. Delivery access uses scoped secure temporary links rather than a normal permanent account, expiring at the configured deadline or immediately when all assigned tasks complete. Expiry never deletes business or audit history.
- Driver UI is phone-first, Arabic RTL, touch-friendly and separate from Admin navigation. It exposes only assigned delivery information and four-digit confirmation, excluding financial/classification/private unrelated records.
- General Admin controls SMS, driver WhatsApp and reset-email content in System Settings. Safe content and provider secrets are separate. Templates use channel/context allowlists, required security placeholders, server-side rendering and preview, validation and safe defaults. No arbitrary code execution. Provider-approved WhatsApp template mapping is supported; unrestricted free-form sending is not assumed.
- Pickup SMS contains configured active location name/URL, appointment and code; delivery SMS excludes pickup-location information. Pickup locations gain location_url and necessary historical snapshots in Phase 2B; the official URL is supplied later.
- Recovery Email contains a secure random expiring single-use reset link to the registered authorized address, with rate limiting and request/success audit. Existing or permanent plaintext passwords are never sent. The email body must contain {reset_link}; verification SMS must contain {verification_code} unless explicitly redesigned.
- Communication/channel services and provider interfaces isolate domain code from Taqnyat HTTP details. Queues provide bounded retries/backoff, timeouts, idempotency, duplicate prevention and final failure handling. Retrying does not regenerate receipt codes by default. External failure never undoes support reservations, inventory or history.
- Communication evidence records channel, operation/recipient references, destination with controlled access, provider reference, state/timestamps, sanitized failure and retry count. Logs must not contain plaintext codes, reset tokens, driver-link tokens or passwords.
- Phase 2B builds the workflows, templates, contracts, mobile UI, jobs and audits with fake/mock/local providers. Real credentials and Taqnyat availability are not test prerequisites. Phase 2C performs real Taqnyat integration after official documentation and user-provided credentials/senders/template/account information are available. No endpoints, credentials or sender values are invented.
- Microsoft Azure is the final production deployment target. A separate Azure deployment audit must prove the chosen topology supports Laravel/PHP/extensions, React/Vite, PostgreSQL, workers, cron, storage/PDF, HTTPS/SSL, secrets/logs/backups and process supervision. (2026-09-21 correction: the earlier "Hostinger supersedes Azure" direction is itself SUPERSEDED; historical Hostinger notes are retained as superseded history.)

## Explicit supersessions

1. QR as a future verification method: REMOVED. Legacy AS-IS descriptions remain historical evidence only.
2. Earlier “remove WhatsApp completely” direction: SUPERSEDED. WhatsApp Business is required for drivers; support recipients use SMS.
3. Deployment target history: Azure was superseded by Hostinger on 2026-09-20; that supersession is itself SUPERSEDED on 2026-09-21 — **Microsoft Azure is the final production deployment target**. Other existing provider configuration files are not rewritten or activated by this decision.
4. Prior 5/8-digit or alphanumeric receipt verification designs: SUPERSEDED for TO-BE by exactly four numeric digits.

## Deferred details and acceptance boundaries

Phase 2B must finalize code expiry/retry/lockout values, secure verification and transient resend-material handling, template reuse versus recipient variants, and the controlled legacy verification transition. Phase 2C verifies official Taqnyat capabilities, required environment variable names, sender approvals, provider template constraints and callback support. These are pending design/integration details, not permission to change provider silently.

The approved sequence (corrected 2026-09-21) is 2A → 2B (VERIFIED — ACCEPTED) → Beneficiary Policy Engine → 2C → notification coverage audit → official PDF/document finalization → governance/report finalization → full system acceptance → Azure deployment audit → Azure production deployment. Each phase requires its applicable explicit authorization. Current stop point: post-Phase-2B documentation correction only; the Beneficiary Policy Engine has not started.
