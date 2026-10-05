# ADR-004 — Unified Support Engine

Date: 2026-09-20. Architecture approved by the Phase 2A handoff; Phase 2A implementation is VERIFIED following the completed isolated PostgreSQL gate; see the implementation report.

PostgreSQL is authoritative. SQLite is limited to fast regression tests. The installed stack is Laravel 13 / PHP 8.3 and React 19 / Vite 8 (composer.json and frontend/package.json); older version statements in the baseline are historical.

## Domain and history

The canonical recipients are beneficiary, staff and organization. Each operation has exactly one matching recipient FK, enforced by request validation, the service and a PostgreSQL CHECK. Recipient FKs use RESTRICT so deletion cannot invalidate the CHECK or remove identity linkage. Staff uses the existing bigint staff.id; other recipient keys are UUIDs. Snapshots contain the recipient name plus beneficiary UUID, staff business ID or organization code, without duplicating national ID.

Pickup locations use PATCH for activation/deactivation. DELETE physically removes only unused locations. RESTRICT prevents removal of referenced locations; the operation retains a name snapshot. Permanent driver UUID references are reused. Driver login/UI and temporary links remain outside Phase 2A.

## Quantities and state

General warehouse and support line quantities use DECIMAL(12,2). SupportQuantity uses the installed Brick Math library for exact arithmetic. The daily warehouse remains independent. Availability is current minus reserved and raises an error for corrupt inventory; it never clamps to zero.

Flow: draft → approved → reserved → ready. Pickup completes from ready. Delivery dispatches from ready to in_delivery and then completes. Cancellation is allowed only from draft, approved, reserved or ready. Terminal records cannot transition again; repeat completion is HTTP 409 and illegal transitions are Arabic HTTP 422 validation errors.

Reservation, completion and cancellation run inside database transactions. They lock the support record, then inventory records in sorted ID order. Reservation is all-or-nothing. Completion consumes the full requested/reserved amount, clears the active reservation and writes an OUT movement with quantity, balance, support reference, actor and timestamp. Partial completion inputs are rejected. Business audit writes are inside the same transaction and their failure rolls everything back. Support notifications and their stock notifications dispatch after commit via the existing NotificationService.

## Integration and authorization

All new endpoints are under /api/support. Only admin bypasses explicit support permissions. Actions are view, create, edit, approve, reserve, fulfill, cancel and notifications. Ready/dispatch/complete require fulfill; approval and cancellation never fall back to edit. The Users permission matrix exposes the independent actions and treats missing saved support flags as denied.

Settings writes accept the seven keys exposed by the settings form: first_class_max_income, second_class_max_income, resident_need_threshold, elderly_min_age, warehouse_alert_threshold_days, system_name and organization_name. Unknown/legacy write keys are HTTP 422. Financial values are numeric and non-negative; resident_degree_threshold remains a read fallback only. The form does not echo unknown read keys back on save.

Legacy warehouse writers receive transaction/row-lock reservation guards without replacing their workflows. Historical FK hardening changes the five approved legacy CASCADE constraints to RESTRICT on PostgreSQL. No legacy data migration or deletion is performed. Decimal rollback rejects fractions and values outside signed 32-bit integer range before conversion.

## Verification limit

SQLite regression does not prove PostgreSQL CHECK behavior, row locks or process concurrency. Production readiness requires the isolated ikram_phase2a_qa gate, including migration/rollback/re-migration, deletion protection and a two-process contention test. No Phase 2B work is authorized by this ADR.


## Subsequent approved architecture — 2026-09-20

[ADR-005](ADR-005-COMMUNICATION-DELIVERY-DEPLOYMENT.md) and the [implementation roadmap](../implementation/IMPLEMENTATION_ROADMAP.md) govern future delivery verification and communication templates/providers. Deployment per ADR-005 targets **Microsoft Azure** (Hostinger direction **HISTORICAL — SUPERSEDED**, corrected 2026-09-21). QR is removed from TO-BE, recipient verification is exactly four numeric digits, and Phase 2B uses fake providers before real Taqnyat integration in Phase 2C. These future decisions do not change Phase 2A behavior or authorize starting Phase 2B. The PostgreSQL acceptance condition above is now satisfied; the report contains the actual evidence.
