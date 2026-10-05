# EKRAM target architecture — remediation Wave 0

Discovery date: 2026-10-04. This is a current-to-target design, not evidence that implementation or release gates passed. Source: the canonical agentic charter and master remediation request. No production/database access is authorized by this document.

## Existing authoritative boundaries

| Domain | Reuse | Compatible extension |
|---|---|---|
| Beneficiary registry/registration | BeneficiaryController, Beneficiary, existing dependent/document flows and FinancialCalculationService | Explicit final confirmation validated on backend, atomic beneficiary/dependent/financial persistence; additive confirmation attribution. Stable review screen and Enter handling. Archive with timestamp/actor/reason instead of destructive deletion. |
| Policy/eligibility | Versioned policy services, immutable BeneficiaryPolicyEvaluation and PolicyDecision | Diagnose active-version/prerequisite/trigger failures; show persisted outcomes and errors. New evaluation creates new snapshot; resident behavior and historical verdicts preserved. |
| Support | SupportDistributionService, SupportDistribution, support items and SupportHistoryService | Add canonical creation from beneficiary workspace, explicit pickup/delivery, operational filters and history. No second support engine. |
| Inventory | Existing stock reservation/completion logic and SupportQuantity | Keep ordered row locks and exact quantities. Daily Beneficiary Inventory stays independent of General Warehouse. |
| Direct handover | ReceiptVerificationService and pickup distributions | Separate page, context-safe code lookup/preview/confirmation, receipt table, filters and complete export. No driver operations. |
| Home delivery | Driver, DriverAssignment, DriverAccessService and delivery distributions | Separate management page, driver edit/deactivate/counts, assignment inspection, secure link resend and completed supervisor view. |
| Communications | NotificationService, communication records, provider service and existing jobs | Exact target metadata/deep links. Distinguish provider acceptance from delivery. Ambiguous in-flight timeout must not blindly resubmit without provider idempotency/reconciliation. |
| Accounts/permissions | ModulePermission and existing guards | Deprecate new ordinary driver accounts after compatibility mapping; preserve historical users and attribution. Backend permission remains authoritative. |
| Documents/reporting | PdfExportController association letterhead, existing PDF assets and spreadsheet utilities | Shared renderer for unified receipt/delivery proof; Arabic labels and filtered complete dataset export. |

## Fulfillment architecture

Both workflows retain one support aggregate. `pickup` maps to DIRECT_HANDOVER; `delivery` maps to HOME_DELIVERY. Separate UI pages and queries do not imply separate inventory/state engines.

Completion chain: scoped authorization → assignment/task/code checks → ReceiptVerificationService → SupportDistributionService completion → inventory movement exactly once → consumed challenge and unique SupportReceipt → audit → after-commit notifications. Delivery proof uses receipt, support items, driver assignment and completion attribution.

Existing driver access is an expiring unguessable bearer capability: 256-bit token, database hash, assignment scope, active-driver/revocation checks and no application login. Keep this security model. Public driver output exposes only assigned task contact/address/item details. Display task reference and support explicitly. Preserve useful completed confirmation state without revealing expired/revoked unrelated data.

Four-digit receipt codes are operation-bound, not globally unique. A global code lookup must also use a support reference/recipient context or reject ambiguous matches; never choose the first matching code. Store no plaintext verification code for receipt-table display or exports.

## Migration and history preservation

- Prefer additive `confirmed_at`, `confirmed_by`, `archived_at`, `archived_by`, `archive_reason` where schema lacks equivalent fields. Existing beneficiaries must not be silently labelled newly confirmed; preserve legacy provenance. Exclude archived records explicitly in operational queries and allow authorized restore.
- Existing statuses are `active`, `suspended`, `under_review`; registration review is a pre-submit state, not a duplicate operational status system. Persist drafts only if explicitly introduced with a compatible draft contract.
- Dedicated drivers already exist. Legacy distribution driver references semantically identify User, while unified support driver references identify Driver. Do not bulk rewrite or delete historical identities. If identity bridging is needed, add a nullable unique legacy User mapping and require unambiguous mapping evidence.
- `SupportReceipt.confirmed_by` references the assigning employee User for driver confirmation; actual driver attribution is `driver_assignment_id → driver_id`. Documents must not mislabel assigning staff as the driver.
- Existing assignment-task unique support reference prevents reassignment after revocation. Link resend should rotate token on the existing eligible assignment, invalidate old messages/capability, and retain assignment history. Any reassignment design must preserve prior membership rather than delete business history.
- Proof metadata should be an immutable completion snapshot if required to prevent later recipient/driver edits changing historical proof. No new delivery engine/table is necessary merely to render a PDF.
- Guarded PostgreSQL verification is required for additive migration/FK behavior and concurrent completion. No operational, production or Aiven database access.

## Implementation ownership proposal

A0 records and serializes shared-file ownership before changes. A8/A9: DeliveryCommunicationController, DriverAccessService, ReceiptVerificationService, Driver model, fulfillment tests. A3: SupportDistributionController and operational query contract. A4: distinct direct/home pages, DriverAccessPage and focused component tests. A5: ModulePermission and UserController driver creation deprecation. A11: shared PDF renderer, proof template/endpoint and exports. A0: routes, App.jsx and Sidebar integration after handoffs. A12/A13 return defects without hidden repairs.

## Evidence required

Preserve existing receipt/inventory/IDOR tests. Add confirmation bypass and atomic rollback, archive/history retention, separate workflow route/API visibility, full filtered export, driver CRUD/metrics, old-token invalidation, wrong-driver/task denial, invalid-code no-effects, replay one receipt/movement, proof authorization/content and provider ambiguity tests. E2E-006/E2E-007 remain unproven until their full permitted external/browser chains are evidenced; mock acceptance cannot close them.

## Implemented recovery clarification (2026-10-04)
An authorized administrator can reopen the same revoked incomplete assignment with an active matching driver. Reopening rotates the token/expiry, clears revocation on the current row, preserves the prior revocation audit and task membership, cancels obsolete communications, and validates locked task ownership/status. The old token remains invalid. Completed assignments cannot be reopened. Reassignment to a different driver is not implemented; no historical membership is deleted.
