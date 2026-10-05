# Phase 2C — Taqnyat integration audit

Date: 2026-09-23  
Scope: production-provider boundary only. Notification coverage, PDF, governance, full-system acceptance and deployment remain out of scope.

## Repository findings

The Phase 2B path is already the authoritative communication path:

`business service -> CommunicationService::enqueue -> communication_messages outbox -> SendCommunication job -> channel provider contract`

`NotificationService` remains the internal application notification centre. It is called after business/communication state commits and is not replaced. No controller or business service currently calls a vendor HTTP endpoint.

| Current channel | Current provider | Authoritative service | Required real provider | Configuration | Failure / retry | Existing coverage |
|---|---|---|---|---|---|---|
| beneficiary/staff/organization SMS | `FakeSmsProvider` | `ReceiptVerificationService` -> `CommunicationService` | `TaqnyatSmsProvider` | explicit provider mode, SMS bearer token, approved sender, base URL, connection/request timeouts | encrypted outbox survives failure; bounded attempts/backoff; business and inventory state remain committed | routing, receipt security, template separation, provider outage and retries |
| driver WhatsApp | `FakeWhatsAppProvider` | `DriverAccessService` -> `CommunicationService` | `TaqnyatWhatsAppProvider` | WhatsApp bearer token, approved template name/language, base URL, timeouts | assignment/reservation survives failure; bounded attempts; duplicate workers serialized by outbox row | scoped temporary link, secret hiding, expiry/revocation, failure isolation |
| password-reset email | `FakeEmailProvider` | Laravel password broker -> `FakeResetEmailChannel` -> `CommunicationService` | `TaqnyatEmailProvider` (the official contract explicitly supports mail and the roadmap names this adapter) | mail bearer token, approved from address, campaign name, base URL, timeouts | reset token/outbox survive provider failure; superseded/completed payloads are destroyed | generic recovery response, one-use/expiry, retry payload encryption, rate limits |

The outbox has a unique `idempotency_key`, encrypted temporary payload, masked destination, bounded attempts and sanitized operational status. The queue job contains only the message UUID. Provider payload is wiped after success/cancellation/supersession/expiry. Receipt codes are four numeric digits, HMAC-only at rest, operation-bound, expiring, one-use, attempt limited and atomically consumed. The plaintext exists only in the encrypted short-lived message payload until send. Templates are General-Admin controlled, use per-template placeholder allowlists, reject malformed/unknown/executable content, and preview synthetic data only.

Gaps to close in Phase 2C:

- provider selection is hard-bound to fakes rather than an explicit safe mode;
- phone validation is generic and duplicated at input boundaries; the provider-required Saudi representation is not centralized;
- all provider failures collapse to `provider_unavailable`, so permanent 4xx/configuration failures are retried;
- no real request/response adapters, explicit HTTP timeouts or provider message-ID parsing exist;
- the current transaction holds the outbox row lock while the provider runs; processing should be claimed transactionally and HTTP performed outside the transaction;
- no provider callback is wired.

No schema change is required: current status/error/provider-reference columns and unique idempotency constraint are sufficient. A `sending` status can use the existing bounded string column.

## Current official Taqnyat contract

Verified against the current official developer pages on 2026-09-23:

- SMS: <https://dev.taqnyat.sa/en/doc/sms/>
- WhatsApp Business: <https://dev.taqnyat.sa/en/doc/whatsapp/>
- Mail: <https://dev.taqnyat.sa/ar/doc/mail/>

### Shared contract

REST authentication is `Authorization: Bearer <token>`. Requests and responses are JSON over HTTPS. Phone destinations use international format without `00` or `+`. Tokens are service-scoped; SMS and WhatsApp must therefore support distinct credentials. IKRAM will use Laravel's HTTP client with explicit connect/request timeouts and no implicit HTTP retry that could duplicate an accepted message.

### SMS

- Base URL: `https://api.taqnyat.sa/`; send endpoint: `POST /v1/messages`.
- JSON: `recipients` array, UTF-8 `body`, and an active pre-approved `sender` name.
- Success: HTTP/status code 201 with `messageId`, accepted/rejected recipients, counts and cost metadata.
- Errors documented include 400 invalid input/recipient/sender/account restrictions, 401 invalid credentials and 405 invalid method. Account/IP/country/sender restrictions are permanent until configuration is corrected.
- The public SMS page does not document an idempotency header, delivery callback signature, or rate-limit response contract. HTTP 429 will still be treated as retryable when returned.

### WhatsApp Business

- Base URL/version: `https://api.taqnyat.sa/wa/v2/` (trailing slash required); send endpoint: `POST /messages/`.
- A business initiated conversation requires recipient opt-in and an approved template. The request contains `to`, `type=template`, template name/language and positional component parameters. The existing driver text can only be sent through an account-approved template whose parameter contract matches the configured mapping.
- Success returns a `statuses` object or array containing `message_id` and recipient.
- Documented permanent errors include invalid recipient/no opt-in, invalid template/parameter count and authentication failures. Temporary HTTP 429/5xx responses remain retryable.
- Delivery callbacks publish `queued`, `dispatched`, `sent`, `delivered`, `read`, `deleted`, `failed`, `no_opt_in` and `no_capability`, and Taqnyat retries callbacks up to three times. The official page inspected does not publish a callback signature, source-authentication token, or verification handshake. Phase 2C therefore defers callbacks instead of inventing security. Provider acceptance is stored as `sent`; it is not represented as end-user delivery.

### Email

- Endpoint: `POST https://api.taqnyat.sa/mailSend.php`.
- JSON: `campaignName`, `subject`, `from`, `to` array and `msg` (attachments unused).
- Success: HTTP 201, `ResponseStatus=success`, `Data.msgId`; failures can be returned in a JSON `Error` object even when a JSON response is otherwise well formed.
- A bearer token and approved/configured sender address are required. Password-reset email stays on its existing outbox path; only its provider adapter changes in explicit Taqnyat mode.

The public mail documentation does not describe delivery callbacks, idempotency, or a formal rate-limit body. HTTP 429/5xx are classified as retryable; authentication, sender, recipient and request errors are permanent.

## Implementation decisions

- `COMMUNICATION_PROVIDER=fake` is the safe default and the only automated-test mode. `taqnyat` must be selected explicitly; missing/unknown mode never falls through to real traffic.
- Credentials stay in environment-backed `services.taqnyat` configuration and never enter settings, APIs, frontend, AuditLog or logs.
- One `SaudiPhoneNumber` normalizer accepts local/international human formatting and emits the provider form `9665XXXXXXXX`; malformed/empty/non-mobile values are rejected before enqueue/send.
- Provider adapters return only a sanitized provider message ID and throw a typed failure with an internal category and retryability flag. They never expose response bodies or credentials.
- The outbox row is claimed as `sending` under a short transaction, the network call occurs outside the transaction, and final state is written under a second lock. Concurrent workers cannot both claim the same item. Queue/runtime failures recover `sending` items through the existing bounded retry path.
- Automatic attempts remain bounded. 429/5xx/transport timeout are retryable; missing configuration, authentication, invalid sender/recipient/request/template and malformed success responses are permanent. Error detail is not persisted.
- Templates, receipt verification, driver assignment, password broker, support state and inventory behavior are unchanged.
- No provider-status UI or admin test-send endpoint exists today, so none is added. Manual retry stays General-Admin only and continues to use the existing endpoint.
- No live send is authorized by this task. Contract tests use `Http::fake`; real credentials and recipients are neither read nor required.

## Acceptance plan

Add focused tests for safe configuration/mode, phone normalization, all three adapters, request/auth shapes, IDs, timeout/4xx/429/5xx/malformed responses, permanent versus retryable outbox states, concurrent duplicate claims, privacy, receipt delivery, driver failure isolation, admin authorization and existing Phase 2B regressions. Run local PostgreSQL only for the row-lock/idempotency behavior; no migration is introduced. Run no browser gate because no UI changes are planned.
