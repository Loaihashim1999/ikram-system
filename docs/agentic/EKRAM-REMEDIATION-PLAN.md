# EKRAM Remediation Plan

Date: 2026-10-04. Root: `C:/laragon/www/ikram-system`; branch: `main`. A0 coordinates this authorized local remediation. Preserve the reviewed working tree. No commit, push, production database access, deployment or traffic promotion.

## Wave 0 evidence

The existing versioned policy engine, canonical support/inventory service, dedicated Driver entity, scoped hashed-token access, receipt-code verifier, durable communication outbox and institutional mPDF renderer are retained. Reported gaps are verified against source; historical acceptance is not current proof. Latest prior full-system acceptance records 801 passed / 2 skipped / 2,935 assertions, with fake communications and no live SMS. Today's isolated pre-change targeted regression passed 33 tests / 200 assertions. Exact IKR-001–013 and E2E-001–005 per-ID closure evidence was not found; preserve code and rerun related regressions rather than invent closure status.

## Planned implementation ownership

| Module | Files / scope | Owner | Dependencies | Migration impact | Required tests |
|---|---|---|---|---|---|
| Registration / archive / workspace / policy / support creation | BeneficiaryController, Beneficiary model, beneficiary pages/API, new lifecycle migration/tests and SupportRequestPage | A6/A7 (A1 execution agent) | Wave 0; existing FinancialCalculationService and policy engine | Additive confirmation/archive metadata; preserve history and legacy records | Early-submit rejection, explicit confirmation, audit rollback, archive preservation, resident behavior, support CTA and permissions |
| Fulfillment backend / drivers / proof | DeliveryCommunicationController, SupportDistributionController, DriverAccessService, ReceiptVerificationService, PdfExportController, proof template, focused tests | A8/A9/A11 (A2 execution agent) | Wave 0; canonical support engine | Reuse Driver and existing assignment/receipt schema; additive only if required | Filters, preview without mutation, replay, driver scoping/token rotation, CRUD/metrics, proof authorization/branding |
| Communications / notifications / variable picker | CommunicationService, SendCommunication, NotificationService, NotificationContext/Center, CommunicationsSettings, display vocabulary and focused tests | A10 | Wave 0; coordinate any shared controller/route edits through A0 | Preserve historical states; additive metadata if necessary | Acceptance vs delivery, ambiguous send safety, duplicate queue/request, recipient/read/navigation, localized tokens |
| Separate fulfillment pages / routing / integration | DirectHandoverPage, HomeDeliveryPage, compatibility SupportDeliveryPage, DriverAccessPage, App, Sidebar, routes, account deprecation, frontend tests | A0 acting A4/A5 | Backend contracts handed off; support creation page | Preserve historical driver-user accounts and attribution | Separate pages, all-page exports, API grants, portal fields, safe proof access, legacy account compatibility |

No two agents write the same file. Assigned agents must request additions to shared-file scope. A12/A13 independently test/review after implementation; they return defects to owners.

## Order and acceptance

1. Complete the four Wave 0 architecture documents before application edits.
2. Registration/policy/support and fulfillment/communications use isolated file ownership; test targeted changes continuously. Shared route/controller integration is serialized by A0.
3. Verify unified branded proof and Arabic display vocabulary; avoid duplicating PDF, financial, policy or inventory logic.
4. Reconcile permissions and historical driver references without deleting historical accounts or rewriting historical foreign keys.
5. Run targeted guarded PostgreSQL verification for schema, locks and receipt idempotency. Run full backend and frontend regression once near completion, lint/build, Chrome and Edge synthetic journeys with local-only origins.
6. A12 independent QA and A13 independent review; resolve proven defects before release decision.
7. Report gate evidence and blockers honestly. E2E-006/007 remain open or require live validation until their actual provider/browser chains are proved. No deployment is authorized. Use only synthetic `EKRAM-E2E-TEST` records in isolated QA and exact-ID cleanup.

The master request numbers database safety as Wave 5 and independent QA as Wave 6; the canonical charter reserves Wave 5 for verification, Wave 6 for review, Wave 7 for release decision. Both sets of work are required; report using canonical Wave 0–7 labels with the master sub-workstreams named explicitly.

## Final gates

Waves 0–7 completed locally with implementation handoffs and owner repairs of independent findings. Backend 921 passed, 2 PostgreSQL-only skipped, 4238 assertions; frontend 141 passed; PostgreSQL 386 passed, 2610 assertions; lint/build/concurrency pass. A12 Chrome and Edge each passed 15 isolated gates and removed synthetic databases/uploads. A13 has no unresolved demonstrated finding in its inspected scope. Verdict: READY FOR CONTROLLED DEPLOYMENT VALIDATION; E2E-006/007 require live validation. No commit, push, production access, live SMS or deployment. Final evidence and qualifications are in reports/EKRAM-RELEASE-READINESS.md and the linked test/risk reports.
