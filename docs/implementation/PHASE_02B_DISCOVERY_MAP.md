# Phase 2B discovery map

Status: discovery completed; replacement implemented and verified; controlled retirement outcome recorded. Phase 2A remains verified. User-supplied master design and roadmap remain authoritative. (Retirement evidence and the controlled retirement outcome are recorded below in "Phase 2B retirement outcome — 2026-09-21"; the earlier "no retirement until replacement test evidence passes" condition is satisfied.)

## Receipt / QR

- CURRENT: `routes/api.php` receiver scan/confirm routes, `ReceiverController`, `DistributionController::markReceived`, eight-character legacy `barcode_code` on distributions/staff/rep records. DEPENDENCIES: recipient lookup, status mutation, stock/history, `SystemAuditTest`, `AuthorizationDriverQrDataIntegrityTest`. REPLACEMENT: operation-bound four-digit challenge and atomic support completion. RETIREMENT: disable active legacy confirmation only after replacement tests; preserve tables and reference values. REQUIRED EVIDENCE: wrong/expired/locked/reused codes, leading zero, transactional rollback, real PostgreSQL simultaneous confirmation, historical reads.
- CURRENT: `ReceiverPage`, `QrScannerModal`, `QrWhatsAppCard`; active callers DeliveryPage and NeighborhoodRepsPage, manual QR URLs in BeneficiaryList and StaffListPage. DEPENDENCIES: qrcode/html5-qrcode, receiver scanner tests, manual recipient WhatsApp. REPLACEMENT: receipt input, recipient SMS and driver assignment UI. RETIREMENT: remove active actions after browser/backend acceptance; unmounted SendSupportPage/DistributionPage and scanner components may be retained explicitly as historical unused code. REQUIRED EVIDENCE: active route/import audit, no QR fallback, phone browser verification.
- CURRENT: PDF individual/staff/total-delivery templates, PdfExportController filename, ReceiptCounterModal/ReceiptHistoryTimeline/AuditPage expose historical barcode reference. REPLACEMENT: no destructive replacement. RETAIN historical references and PDF authorization. REQUIRED EVIDENCE: historical records and PDF regression tests.

## Drivers

- CURRENT: permanent `drivers` / Driver model and separate role=driver `users`, UserController::drivers, legacy Distribution.driver_id points to users. DEPENDENCIES: driver login, fixed permissions, ModulePermission, DriverDashboard, `/driver/deliveries`, `/drivers/deliveries`, receiver authorization, historical PDF scope. REPLACEMENT: permanent Driver UUID, hashed temporary assignment access, dedicated public mobile shell with scoped backend token middleware. RETIREMENT: remove conflicting task/login entry only after new assignment/task authorization passes; preserve users and foreign keys/history. REQUIRED EVIDENCE: other-driver/task rejection, expiry/revoke/deactivation/completion, no admin access or financial fields.
- CURRENT: unified SupportDistribution.driver_id already references drivers and supports dispatch/completion. REPLACEMENT: additive assignment association and receipt service invoking existing transactional completion. RETAIN Phase 2A reservations, decimals, inventory/history/permissions. REQUIRED EVIDENCE: no completion bypass, single stock movement, cancellation protection, engine regressions.
- CURRENT: beneficiary city/district/street; staff national_address; organization contact; no canonical recipient map coordinates/URL found in model/migration search. REPLACEMENT: explicit missing-map state, use only stored addresses; no inferred coordinates. PickupLocation needs additive location_url plus support snapshot.

## Account recovery

- CURRENT: PasswordRecoveryController, Laravel PasswordBroker and password_reset_tokens; admin-only recovery, generic response, expiry60min/throttle60sec, public route limits3/min and5/min. Frontend ForgotPasswordPage/ResetPasswordPage; FirstAdminSetup controls initial recovery availability. DEPENDENCIES: User Notifiable, auth passwords configuration, temporary-password/login policy, token revocation. REPLACEMENT: fake EmailProvider dispatch with validated settings and sanitized request/success audit; retain broker token generation/hash/expiry and authorized admin policy. RETIREMENT: replace mail notification only after recovery tests; retain first-admin/change-password security. REQUIRED EVIDENCE: generic unknown email, authorized active account only, reset expiry/one-use/concurrency, no token/password logs, failed email retriable.

## Communication / settings / queues

- CURRENT: DistributionController WhatsApp builder/provider code, frontend wa.me/api.whatsapp.com and qrserver URLs, sms_status legacy evidence. DEPENDENCIES: distribution creation, delivery/staff/beneficiary/representative actions and tests. REPLACEMENT: recipient SMS, driver WhatsApp and reset Email via interfaces/fakes only. RETIREMENT: disable manual/outbound legacy paths after replacements pass. Never execute legacy external send during verification. Preserve historical sms_status.
- CURRENT: NotificationService persistent internal notifications and module-specific opt-in permissions. REPLACEMENT: reuse support-prefixed events; no second notification center. REQUIRED EVIDENCE: notification recipient policy and event deduplication regression.
- CURRENT: SettingsController whitelist and Setting key/value; SystemSettingsPage. REPLACEMENT: General Admin-only safe templates, allowlisted renderer, synthetic preview; no secret configuration. REQUIRED EVIDENCE: non-admin denial, field-specific422 unknown/malformed/missing-required placeholder, HTML-safe frontend preview.
- CURRENT: Laravel database/sync queue configuration and jobs/failed_jobs framework tables, no domain communication outbox. REPLACEMENT: encrypted temporary payload separate from sanitized evidence, message-ID-only jobs, bounded backoff/retry/idempotency and expiry cleanup. REQUIRED EVIDENCE: duplicate job, timeout/final failure, same secret across retry, business transaction remains intact, plaintext absent from logs/API/job payloads.

## Security policy checkpoint

Master design/ADR005 explicitly defer exact receipt and driver policy values; account_security.php values govern login and are not receipt approval. New numeric values must be bounded configuration with clearly marked TEST defaults requiring user production approval. No production acceptance inferred from passing tests.

## Verification boundary

Use SQLite tests and only guarded local PostgreSQL `127.0.0.1:5432/ikram_phase2a_qa`. Before any destructive-capable PostgreSQL command display and validate the four approved DB fields. Never print/copy password. No Aiven, operational DB, real provider, deployment, commit or push. Legacy retirement status remains RETAINED pending replacement evidence.

## Phase 2B retirement outcome — 2026-09-21

Replacement evidence was established before retirement: backend14tests/76assertions, PostgreSQL11tests/65assertions, actual overlapping two-process confirmation (one200/one409; one receipt/movement), mobile360/390/430 gate. Expanded/final results are recorded in the Phase 2B report.

- DISABLED: legacy receiver scan/confirm, distributions received/WhatsApp, driver deliveries API routes (410); direct unified-support complete HTTP action (409). Existing driver-user sessions cannot use task/admin APIs; normal driver login is rejected. ReceiverController/legacy controller methods remain unreachable compatibility source, not a new verification path.
- REPLACED: App receiver/delivery routes render SupportDeliveryPage; old DriverDashboard route directs to temporary access. Sidebar uses support delivery wording. QrWhatsAppCard now renders a historical reference only. Beneficiary/staff manual WhatsApp builders, QR-image URLs and manual-send buttons removed. DistributionController's embedded legacy external WhatsApp implementation removed; legacy creation no longer marks unsent messages as sent.
- RETAINED HISTORICAL: distributions/staff/rep barcode fields, PDF reference values and authorization, timeline/audit references, user/driver foreign keys, permanent drivers and historical receipts. No history deleted.
- RETAINED DORMANT: ReceiverPage/QrScannerModal, old DeliveryPage/DriverDashboard, unmounted SendSupportPage/DistributionPage, qrcode/html5-qrcode packages and standalone scanner regression tests. These are not imported by active App routes. Removing package/source archaeology is deferred; no new QR functionality added.
- RETAINED COMPATIBILITY: legacy basket creation/history UI and old reset URL route. Barcode output is a historical reference, never accepted by the new verification API. Legacy organization/representative data is not silently remapped to canonical Organization records.
- MIGRATED: PasswordBroker notification to FakeResetEmailChannel; old account recovery security tests now observe ResetAccountPassword. First-admin setup/change-password behavior retained. Phase2A completion regression tests exercise the internal state machine; new tests explicitly prove HTTP completion cannot bypass the receipt challenge.
