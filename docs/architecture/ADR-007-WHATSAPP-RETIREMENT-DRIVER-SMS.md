# ADR-007 — WhatsApp retirement and driver assignment over SMS

Date: 2026-09-24. Status: IMPLEMENTED. This decision supersedes the active WhatsApp portions of ADR-005, ADR-006, and the master design.

## Decision

**WHATSAPP BUSINESS CHANNEL — RETIRED.** IKRAM has no active WhatsApp provider, template, consent, environment, API, or UI dependency. Taqnyat SMS is the authoritative external provider for beneficiary, staff, organization, driver assignment, and password-recovery OTP messages.

The communication matrix is:

- beneficiary → SMS
- staff → SMS
- organization → SMS
- driver → SMS
- password recovery → SMS OTP

Driver assignment keeps the existing secure temporary access service. The workflow creates the scoped, expiring, revocable link, renders the editable `driver_assignment_sms` System Settings template, and queues it through `NotificationService → CommunicationService → communication outbox → SmsProviderInterface`. The authoritative driver phone is normalized by `SaudiPhoneNumber`. Provider retry reuses the same outbox message and secure link.

The driver SMS template requires only `{temporary_driver_link}` and permits `{driver_name}`, `{temporary_driver_link}`, `{link_expiry}`, and `{association_name}`. Unknown or sensitive placeholders are rejected.

WhatsApp provider bindings, implementation classes, template management services/controllers/routes, operational UI, live-test controls, and environment keys were removed. `TAQNYAT_WHATSAPP_TOKEN` and `TAQNYAT_WHATSAPP_BASE_URL` are ignored and are not part of the application contract.

Historical integrity is preserved: the already-run driver consent and provider-template migrations, their database columns/tables, existing records, and historical audit events remain. They are not consulted by active communication routing. The legacy `POST /api/distributions/{id}/whatsapp` endpoint remains a deliberately disabled HTTP 410 compatibility marker; it performs no provider action. Historical implementation reports remain immutable.

Communication failure is separate from assignment, support, reservation, inventory, receipt, and access-link state. Retry remains bounded and idempotent through the existing outbox.
