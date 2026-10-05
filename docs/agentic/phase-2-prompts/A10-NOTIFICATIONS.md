# A10 — Notifications

## 1. Objective

Audit notification recipients, persistence, retrieval, unread counts, details, and deep links, and stop disclosure after permissions change.

## 2. Required references

- [COMMON_RULES.md](COMMON_RULES.md) requirement R-NOT-01
- `docs/architecture/EKRAM-NOTIFICATION-MATRIX.md`
- `NotificationService` and the notification UI named by A1

## 3. Dependencies

A5 permission keys. Communication queue safeguards stay as they are.

## 4. Assigned files

A0 assigns notification service, metadata, and tests after the map. Deep-link UI requests go to A4.

## 5. Allowed changes

Recipient filtering and retrieval checks on assigned files. No provider switch.

## 6. Explicit exclusions

Live SMS, delivery reconciliation, worker activation, and duplicate communication intents are out of scope.

## 7. Detailed requirements

A recipient can open only their notification, and only while they still hold the target permission. After permission removal, historical notifications must not reveal the restricted target. Unread counts follow the same rule. Deep links honor current authorization.

## 8. Acceptance criteria

An owner can read and navigate. Another user cannot. A user who lost the target permission no longer receives the restricted detail or a working deep link.

## 9. Relevant verification

Targeted notification PHPUnit tests with fake communications.

## 10. Handoff format

Use the common report block. Name any deep-link route A4 must keep.
