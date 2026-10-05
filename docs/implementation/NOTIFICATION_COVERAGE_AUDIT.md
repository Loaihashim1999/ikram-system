# IKRAM notification coverage audit

Date: 2026-09-23  
Scope: system-wide application notification triggers and the existing communication outbox. No live provider traffic or later roadmap phase.

## Architecture and channel policy

The system has two related notification paths:

1. Staff-facing application notifications: `business event -> NotificationService::notifyAll -> notifications`.
2. Recipient communication: `business event -> NotificationService::queueCommunication -> CommunicationService -> communication_messages -> SendCommunication -> channel interface -> fake/Taqnyat adapter`.

The second path was incomplete at audit start because receipt, driver and password-reset callers invoked `CommunicationService` directly. This audit routes those application callers through `NotificationService` without changing the durable outbox or provider contracts.

Approved external channels remain beneficiary/staff/organization SMS, driver WhatsApp Business, and account recovery email. Support lifecycle events without an approved recipient template remain staff-facing application notifications. Policy calculations do not generate notifications. Phase 2C live activation remains deferred.

## Coverage matrix

| DOMAIN | EVENT | RECIPIENT TYPE | EXPECTED CHANNEL | EXISTING TRIGGER? / TEMPLATE | OUTBOX CREATED? / QUEUE PATH / IDEMPOTENCY | FAILURE ISOLATION | STATUS |
|---|---|---|---|---|---|---|---|
| Authentication | password-reset requested for active Admin | account | Email | `ResetAccountPassword`; `password_reset_subject/body` | reset-token hash key -> outbox -> job; supersedes prior pending reset | broker token and account remain valid on provider failure | COVERED (entry point fixed) |
| Authentication | unknown/inactive/non-Admin reset request | none | none | generic response; no outbox | none | no account disclosure | COVERED |
| Authentication | reset completed | staff/admin audit | AuditLog only | `PASSWORD_RESET_COMPLETED` | pending reset payloads cancelled/wiped | one-use/expiry preserved | COVERED |
| Authentication | login failure/lockout/security state | staff/admin audit | AuditLog/application response | existing account-security workflow | none | notification not explicitly designed | NOT REQUIRED |
| Beneficiary | registration or data update | authorized staff | in-app | `BeneficiaryChanged` -> listener | `Notification.event_key` deduplicates | notification row shares the business transaction and rolls back with it | COVERED |
| Beneficiary policy | automatic registration evaluation | none | none | evaluation/audit only | none | calculation is intentionally quiet | NOT REQUIRED |
| Beneficiary policy | review/approval/rejection | authorized reviewer | AuditLog/UI workflow | policy decision audit | none | no approved recipient template/channel | NOT REQUIRED |
| Beneficiary policy | publish/retire/application-run lifecycle | authorized admin | AuditLog/UI workflow | policy lifecycle/run audit | none | no high-volume policy notifications | NOT REQUIRED |
| Support | draft created | permitted support users | in-app | `support_created` | notification event key | after outer transaction commit | COVERED |
| Support | approved | permitted support users | in-app | `support_approved` | notification event key | after commit | COVERED |
| Support | reserved | permitted support users | in-app | `support_reserved` | notification event key | after stock transaction commits | COVERED |
| Support | ready | permitted support users | in-app | `support_ready` | notification event key | after commit | COVERED |
| Pickup | receipt code issued for ready pickup | beneficiary/staff/organization | SMS | `{type}_pickup`; name/location/URL/date/code | generation UUID idempotency key -> outbox/job | issue rolls back if template/destination invalid; provider failure occurs after commit | COVERED (entry point fixed) |
| Delivery | receipt code issued for ready/in-delivery task | beneficiary/staff/organization | SMS | `{type}_delivery`; name/date/code | generation UUID idempotency key -> outbox/job | same as pickup | COVERED (entry point fixed) |
| Support | cancelled before dispatch | permitted support users | in-app | `support_cancelled` | notification event key | after reservation release commits | COVERED; recipient SMS NOT REQUIRED (no approved template) |
| Support | completed | permitted support users | in-app | `support_completed` | notification event key | after stock movement/support commit | COVERED; recipient SMS NOT REQUIRED (no approved template) |
| Receipt | successfully verified | permitted support users | in-app | `support_receipt_verified` | distinct event key | after receipt and completion commit | COVERED |
| Receipt | wrong/expired/locked/reused code | none | response + AuditLog | receipt audit events | no communication | code never enters notification/audit | COVERED |
| Driver | assignment/tasks dispatched | driver | WhatsApp Business | `driver_assignment` | assignment UUID key -> outbox/job | assignment/reservation persists on provider failure | COVERED (entry point fixed); live channel DEFERRED TO PHASE 2C FINALIZATION |
| Driver | application assignment notice | permitted support users | in-app | `support_delivery_assigned` plus per-task `support_dispatched` | distinct logical event keys | after assignment transaction commits | COVERED, not duplicated |
| Driver | reissue/retry | driver | existing WhatsApp outbox | no new assignment intent on worker retry | same outbox ID/key; row-lock claim | encrypted payload reused until expiry | COVERED; live channel DEFERRED TO PHASE 2C FINALIZATION |
| Staff recipient | receipt-code delivery | staff | SMS | `staff_pickup` / `staff_delivery` | receipt generation key | same receipt isolation | COVERED |
| Organization recipient | receipt-code delivery | organization | SMS | `organization_pickup` / `organization_delivery` | receipt generation key | same receipt isolation | COVERED |
| Communications | retryable/permanent provider failure | authorized support admins | in-app + outbox state | `support_communication_failed` | bounded attempts; admin retry on same row | support/inventory/receipt state unchanged | COVERED |
| Communications | manual retry/template administration | General Admin | existing API | template allowlists; retry endpoint | same outbox record | ordinary users denied | COVERED |
| Warehouse | low/expiring/expired stock scan | permitted warehouse users | in-app | InventoryAlertService | deterministic notification event key | scan failure does not alter stock | COVERED |
| Warehouse | inventory movement | permitted warehouse users | in-app | `stock_changed` | event key | notification row shares the movement transaction | COVERED |
| Legacy distribution | created/receipt confirmed | permitted operations users | in-app | legacy model/controller trigger | event key | notification row shares the business transaction; disabled QR routes remain retired | COVERED |

## Confirmed defects and resolution

1. **Outbound entry-point bypass:** `ReceiptVerificationService`, `DriverAccessService`, and the reset email channel called `CommunicationService` directly. They now call `NotificationService::queueCommunication`; provider/outbox internals remain unchanged.
2. **Sensitive logging:** beneficiary create/update logs included full name, national ID, net income, raw request fields, trace and exception text; notification/listener failures logged exception messages. These logs are reduced to stable internal IDs/type and exception class only.
3. **Direct provider bypass:** none found. Taqnyat/Laravel HTTP calls exist only inside `app/Services/Communications/Taqnyat*Provider`; provider contracts are resolved only by `CommunicationService`.

Transaction review confirmed that beneficiary, legacy distribution and ordinary inventory notifications are database rows inserted on the same connection as their triggering state change. A surrounding rollback removes both the business row and notification, so no after-commit refactor is needed. Support notifications intentionally use `DB::afterCommit` because their service already centralizes lifecycle events that way.

## Templates, privacy, and retry findings

- All nine editable templates have stable identifiers, Arabic defaults, explicit allowed/required placeholders, a 4000-character bound, and rejection of HTML/PHP/double-brace/malformed content. No executable template engine is used.
- Receipt plaintext is generated with `random_int`, padded to exactly four digits, HMAC-bound to operation and generation, and present only in the encrypted expiring outbox payload until send/cancel/expiry. It is absent from the challenge row, AuditLog, notification table and logs.
- Driver tokens are stored only as hashes; the plaintext link is confined to the encrypted expiring WhatsApp payload and is wiped after send/cancel/expiry. It is absent from logs and AuditLog.
- Outbox uniqueness prevents a second intent for the same stable key. A worker claims `pending/retrying -> sending` under a row lock, performs HTTP outside the transaction, and finalizes under a row lock. Retry uses the same row/payload and never regenerates receipt or driver secrets.
- Provider failures are communication state only. Retryable failures retain bounded backoff; permanent failures remain actionable for authorized manual retry after correction. Provider credentials and response bodies are never stored or logged.

## Scope decisions

No new cancellation, completion, beneficiary-policy-decision, registration SMS or security-event template was added because existing approved product design does not define those recipient communications. Their meaningful operator-facing lifecycle events remain covered through in-app notifications or AuditLog. Adding recipient messages would require a separate product/template decision rather than a coverage repair.

No browser gate is required because this audit changes no UI. Live SMS, WhatsApp and email verification remains deferred to Phase 2C finalization.
