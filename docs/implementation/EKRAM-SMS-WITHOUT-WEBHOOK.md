# SMS without a webhook — 2026-10-05

## Current decision and scope

The user confirmed on 2026-10-05 that outbound SMS does not depend on a delivery webhook. Taqnyat's sending API is independent of delivery-report reception: https://dev.taqnyat.sa/ar/doc/sms/. This supersedes every earlier activation plan that required the SMS delivery-report contract before outbound sending. The webhook is fully deferred. It is not a prerequisite for deployment, the worker, or a limited send.

Production deployment, a persistent worker, and the next limited send still require a separate explicit approval. This document does not grant that approval.

## Operating behavior

- Keep `TAQNYAT_SMS_WEBHOOK_ENABLED=false`. A confirmation phrase and callback URL are not required for outbound sending. Do not register the reserved, rejecting callback route in Taqnyat.
- The provider sends through the existing `CommunicationService` and `SendCommunication` queue job. New work uses `ekram-communications-v2`.
- Keep the existing database status `sent` for compatibility: it records provider acceptance, not handset delivery. Store Taqnyat's message reference in `provider_reference`. The diagnostics are `acceptance_state=provider_accepted`, `delivery_state=unconfirmed`; `delivered_at` remains empty.
- When that acceptance is stored, the communications log must show exactly: «قبلها المزوّد — التسليم غير مؤكد». The current label for `sent` is still «تم قبول الرسالة للإرسال» and does not include the unconfirmed-delivery clause. That label change is a required local fix before the next production deployment. Do not display an unverified delivered badge or enable manual marking as delivered.
- A provider reference prevents retry. Timeouts, server errors and malformed acceptance remain quarantined as `send_outcome_unknown` with `reconciliation_required`. A definite provider rejection, including HTTP 403 `provider_authentication`, is terminal and must not be retried by changing its idempotency key. Elapsed time is not permission to resend.
- Delivery follow-up is manual in Taqnyat's [sending reports](https://portal.taqnyat.sa/technical_explanations/en/technical_explanations/dispatch_reports/). Portal evidence stays outside EKRAM. No callback, polling, automatic import, or manual status-write API is added.
- Driver assignment and manual link access remain independent of SMS notification success. SMS acceptance does not complete a physical delivery or create a receipt.

## Activation sequence

The webhook is not a step in this sequence. Do not deploy or send the next message until deployment and sending are explicitly approved.

1. Account check, before another live submission. Confirm the existing token secret is accepted by Taqnyat, the active sender is exactly `EKRAM-SA`, the balance can cover one message, and API sending is permitted for the production egress address. Report only pass/fail and non-secret identifiers. Do not print the token, balance amount, or sender credential material.
2. Deploy only the reviewed queue-isolation image. New `SendCommunication` jobs use `ekram-communications-v2`. Leave the existing `default` jobs isolated: do not migrate, drain, retry, or delete them. Run one dedicated worker for the new queue only, with tries 1 and timeout 20. Do not listen on `default`. The scheduler is not required for this send path.
3. On Taqnyat acceptance, persist the provider message reference and show «قبلها المزوّد — التسليم غير مؤكد». Do not set `delivered_at`.
4. Confirm handset delivery manually from Taqnyat reports. Keep ambiguous results quarantined and do not resend them.

Runtime configuration for that deployment: `COMMUNICATION_PROVIDER=taqnyat`, `QUEUE_CONNECTION=database`, `COMMUNICATION_QUEUE=ekram-communications-v2`, the existing `TAQNYAT_SMS_TOKEN` secret reference, `TAQNYAT_SMS_SENDER=EKRAM-SA`, `TAQNYAT_API_BASE_URL=https://api.taqnyat.sa`, and `TAQNYAT_SMS_WEBHOOK_ENABLED=false`. Keep preview and tests on fake or mocked communications.

The first post-approval send is one harmless SMS on an otherwise empty validation queue and one bounded worker execution. Follow [the queue runbook](EKRAM-SAFE-QUEUE-RUNBOOK.md). Do not replay the 2026-10-05 idempotency key.

If a callback URL was already saved in the portal, do not assume it was removed: it must be reviewed by the account owner. No portal setting was inspected or changed here.

## Rollback and remaining gates

Stop the dedicated worker to halt new queue consumption. Keep queued intents and communication history; do not clear or replay them. Roll back only to a reviewed compatible image/configuration. An already accepted SMS cannot be recalled by application rollback. Never resolve an ambiguous outcome by sending a new copy.

Automatic delivery confirmation remains deferred with the webhook. E2E-006 outbound is FAIL until Taqnyat accepts a message and EKRAM stores its reference. The live portion of E2E-007 stays unsent. Local HTTP mocks prove application behavior only.

## Production evidence — 2026-10-05

Revision `ca-ikram-prod--taqnyat-live-20261004` resolved `COMMUNICATION_PROVIDER=taqnyat`, PostgreSQL database `ikram_prod` on the expected Azure host, queue backend `database`, and API base `https://api.taqnyat.sa`. The token secret reference was present and was not printed. The sender value was present and was not printed, so equality with `EKRAM-SA` is not yet proven. Balance and send-permission were not queried. `TAQNYAT_SMS_WEBHOOK_ENABLED` was absent and the effective webhook switch was false. The deployed job did not contain `ekram-communications-v2`.

Before the attempt the `default` queue held 16 `SendCommunication` jobs, all identifiable, none reserved. Unidentified jobs: 0. Those 16 were not processed. One new intent was placed on `ekram-outbound-verify-20261005` and a one-shot worker consumed only that queue. Taqnyat returned HTTP 403, stored as `provider_authentication`. Provider submissions: 1. Duplicate submissions: 0. No provider reference was stored. The communication status is `failed`. The worker was not left running. No driver-link SMS was sent.

That rejection is terminal. The next limited test waits for explicit approval of both deployment and sending, and it waits until step 1 above passes.
