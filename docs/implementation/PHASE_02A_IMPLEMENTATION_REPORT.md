# Phase 2A implementation report — 2026-09-20

**Verdict: PHASE 2A VERIFIED — READY FOR PHASE 2B**

Implementation continued from the existing ZCode working tree. The backend engine and integration passed the SQLite/frontend gates. The resumed isolated PostgreSQL acceptance gate has now also passed, including real two-process contention and rollback/re-migration. This verdict does not authorize deployment or starting Phase 2B.

## Handoff audit and preservation

The initial tree contained 46 modified tracked files and many untracked files. Six Phase 2A migrations and this phase's pre-implementation map already existed. InventoryItem had decimal casts and an availability append; InventoryMovement had decimal casts and new fillable fields. PickupLocation, SupportDistribution, SupportDistributionItem, services, endpoints and support tests were absent.

The initial diff and status were captured before edits in `.tmp/phase2a-evidence/initial.diff` and `initial-status.txt`. No reset, clean, broad restore/checkout, commit, push or deployment was performed. No historical records were deleted. The initial public asset files and public/index.html were preserved: frontend validation built into `.tmp/phase2a-evidence/frontend-build`, not public.

Pre-existing work preserved includes authentication/account security, Phase 1 financial classification, warehouse expiry, daily inventory, PDF/QR, governance, browser QA scripts, Cloudflare configuration and generated assets. Shared files with additional Phase 2A changes are InventoryItem, InventoryMovement, InventoryController, DistributionController, SettingsController, ModulePermission, NotificationService, SystemSettingsPage and architecture documents. New changes to NeighborhoodRepController are limited to the transaction and reservation guard (plus Pint formatting). Users.jsx, routes/api.php and .gitignore have Phase 2A additions. The new models/services/controllers/tests below belong to Phase 2A. Six migrations were inherited and corrected; they were not rewritten from scratch.

## Actual schema and migrations

All six filenames have the prefix `database/migrations/2026_09_19_`:

1. `010000_create_pickup_locations_table.php`: UUID id, name, address, city, district, is_active, timestamps.
2. `020000_create_support_distributions_table.php`: UUID id; recipient_type and nullable beneficiary UUID/staff bigint/organization UUID FKs; recipient_name/reference; creator/approver UUIDs; fulfillment_method; pickup UUID/name snapshot; status; permanent driver UUID; support/completed/cancelled dates; cancellation_reason/notes; timestamps. PostgreSQL CHECK enforces exactly one matching recipient. Recipient and pickup FKs RESTRICT deletion. Staff now uses foreignId rather than an unsignedBigInteger chain that did not create a real FK.
3. `030000_create_support_distribution_items_table.php`: UUID id, support UUID, inventory UUID with RESTRICT, requested/reserved/fulfilled DECIMAL(12,2), unit snapshot and timestamps. Unique support+inventory pair. PostgreSQL CHECK requires requested > 0, other quantities >= 0 and each <= requested.
4. `040000_widen_general_warehouse_quantities_to_decimal.php`: current_quantity, min_threshold and movement quantity widened to DECIMAL(12,2). Rollback detects fractions and signed-integer overflow before conversion; BIGINT comparison is compatible with PostgreSQL and SQLite without SQLite's optional FLOOR extension.
5. `050000_add_reservation_tracking_to_inventory.php`: inventory reserved_quantity DECIMAL(12,2); movements balance_after DECIMAL(12,2), support UUID FK/index. PostgreSQL CHECK: current >= 0, reserved >= 0, reserved <= current.
6. `060000_harden_distribution_history_foreign_keys.php`: on PostgreSQL, five legacy beneficiary/basket/rep references change CASCADE to RESTRICT. It aborts on missing constraints or orphan records without deleting them. Constraint discovery now resolves the current search path using to_regclass, rather than hardcoding public. SQLite intentionally does not alter these five legacy FKs.

PostgreSQL UUID defaults use gen_random_uuid; Eloquent generates UUIDs for new records. No new driver entity or daily inventory coupling was introduced. Rollback must be preflighted before a whole migration batch: reversing newer reservation migrations before reaching the decimal guard can remove reservation metadata. The decimal migration itself refuses lossy conversion. No operational rollback was attempted; the isolated PostgreSQL rollback cycle is verified in the acceptance evidence below.

## Models and services

- New models: PickupLocation, SupportDistribution, SupportDistributionItem, with relations and decimal/date/boolean casts.
- InventoryItem retains the existing expiry behavior. available_quantity uses exact subtraction and throws on negative/inconsistent state. InventoryMovement relates to its support record and retains decimal quantity/balance.
- SupportQuantity uses existing Brick Math for exact addition/subtraction/comparison without an additional PHP extension dependency.
- SupportDistributionService validates recipients even when called directly, snapshots safe references, creates/edits drafts, and implements all transitions in transactions. It locks the support row and warehouse rows in sorted inventory ID order. A failure on any item rolls the entire operation back.
- SupportHistoryService builds item-specific queries within the selected beneficiaries/staff/organizations population. It returns last_received_at, days_since_received and total_received_in_period, including people/entities with no matching receipt. Filters include never_received, not_received_since, not_received_days and optional from/to dates. Only completed support counts. No monthly interval is hardcoded. Legacy distribution history is not silently merged into this new ledger.

## API and authorization

All endpoints require the existing authenticated ModulePermission middleware:

- GET/POST `/api/support/distributions`: view/create.
- GET `/api/support/distributions/{id}`: view.
- PATCH `/api/support/distributions/{id}`: draft edit only, permission edit.
- PATCH `/api/support/distributions/{id}/{approve|reserve|ready|dispatch|complete|cancel}`: approve, reserve, fulfill (ready/dispatch/complete), cancel respectively.
- GET `/api/support/history?population=organizations&inventory_item_id=<uuid>`: view; population may also be beneficiaries or staff.
- GET/POST `/api/support/pickup-locations`: view/create.
- PATCH `/api/support/pickup-locations/{id}`: edit, including is_active.
- DELETE `/api/support/pickup-locations/{id}`: edit; only unused locations can be physically removed. Referenced locations produce 422.

Admin has full access. All other accounts require the exact explicitly assigned support flag. Missing flags deny access. approve/cancel do not depend on edit. Users.jsx shows all eight independent support flags; missing support permissions in saved accounts remain denied. The new engine has no frontend Support screen in this phase.

## State, stock, audit and notifications

Legal flow is draft → approved → reserved → ready. Pickup completes from ready. Delivery dispatches to in_delivery with an assigned permanent driver, then completes. Cancellation is limited to draft/approved/reserved/ready. Completed and cancelled are terminal. Illegal transitions return Arabic validation errors with 422; duplicate completion returns 409.

Reserve holds the full requested amount without reducing current stock. Complete requires the whole line reservation, subtracts both warehouse current and reserved stock, clears line reserved quantity, sets line fulfilled quantity, and creates one OUT InventoryMovement per line with balance_after, support reference, actor, timestamps and business reason. Partial completion payloads are rejected. Cancellation releases only that support's active reservation without creating an OUT movement.

CREATED/UPDATED/APPROVED/RESERVED/READY/DISPATCHED/COMPLETED/CANCELLED audit records are mandatory inside the business transaction. Tests prove audit failure rolls back status, stock and movement creation. Audit details contain state changes, not tokens, passwords or sensitive identity snapshots.

The existing NotificationService handles support_* events and filters non-admin recipients on explicit support:notifications plus existing global notification opt-in. action_url is null until a Support UI exists. Support and associated stock notifications dispatch after commit and retain the existing non-blocking notification policy.

InventoryController update locks inventory and rejects the 100 current / 60 reserved → 40 current case with 422, leaving both balances unchanged. Stock adjustment respects availability and accepts decimals. Legacy DistributionController and NeighborhoodRepController now lock/check general warehouse availability inside transactions before legacy distribution writes; their legacy allocation formulas are unchanged. Support-referenced inventory cannot be deleted through InventoryController.

## Settings

The write whitelist is first_class_max_income, second_class_max_income, resident_need_threshold, elderly_min_age, warehouse_alert_threshold_days, system_name, organization_name. Unknown keys and resident_degree_threshold writes are 422. Financial values must be numeric and non-negative; changes are applied atomically after all validation succeeds. The settings UI sends only its supported form keys and correctly loads the legacy threshold only when the canonical server key is absent.

## Executed verification

All PHP tests used explicit process environment DB_CONNECTION=sqlite, DB_DATABASE=:memory:, DB_URL empty, APP_ENV=testing. No operational database connection was used.

- Initial Phase 2A suite: 41 tests, 191 assertions, all passed after fixing issues identified by the first run.
- Final suite after Pint and three additional integrity tests: **130 tests passed, 690 assertions**, zero failures. This includes **44 Phase 2A cases** and the existing 86 tests. Command: `php artisan test`.
- Coverage includes three recipient types, mixed/missing recipients, duplicate/multiple items, fractions and quantity 300, insufficient/competing reservations, safe cancellation states, blocked in-delivery cancellation, legal/illegal transitions, driver requirement, full completion and exact balance, duplicate completion, audit rollback, history filters, inventory/recipient/pickup delete protection, independent permissions, notification filtering, settings validation, legacy writer guards and fractional rollback refusal.
- The competing-reservation test is sequential SQLite coverage; **it is not PostgreSQL concurrency evidence**.
- `npm run test` in frontend: **13 files, 52 tests passed**.
- `npm run lint` in frontend: **passed**.
- `npm run build -- --outDir ../.tmp/phase2a-evidence/frontend-build`: **passed**, preserving pre-existing public artifacts.
- Pint scoped to the 24 Phase 2A/shared PHP files: applied, then `--test` **passed**. A transient initial write failure was resolved by retry; the full PHP suite passed afterward.
- `git diff --check`: final result recorded in the local evidence folder; line-ending warnings from existing files are separate from whitespace errors.

Evidence files are local under `.tmp/phase2a-evidence`: full-tests-final.txt, frontend-tests.txt, frontend-lint.txt, frontend-build.txt, pint-final.txt, initial-status.txt, final-status.txt, final-diff-stat.txt, git-diff-check.txt.

## PostgreSQL acceptance gate — PASSED (2026-09-20)

This section supersedes the initial credential-blocked verdict. Only the previously blocked PostgreSQL gate was resumed. Application/domain/frontend code was not changed during this acceptance run; additions are the isolated QA harness under `tests/Postgres/` and this evidence update.

### Isolation and target verification

The user supplied `.env.phase2a.pgqa` with the existing local QA credentials. It is Git-ignored, and no password was displayed, written to evidence, or added to source control. A local test APP_KEY was added to that file. The ordinary `.env` connection was not modified. All connections were confined to the local QA database; no operational/Aiven connection, deployment, commit, push or Phase 2B work was performed.

Before destructive-capable commands, the harness verifies and prints only these target fields:

```text
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=ikram_phase2a_qa
```

It rejects any mismatch or DB_URL override before connecting, then verifies current_database() and current_user internally. The expected QA role is ikram_qa_user. Each independent concurrency worker also performs this guard. PHPUnit creates each application using `.env.phase2a.pgqa` explicitly, validates the resolved target before RefreshDatabase, and disables external telemetry. Normal project configuration is not a fallback.

### Actual acceptance results

1. Initial migrations: **PASS**. All prerequisite migrations and the six Phase 2A migrations applied successfully on PostgreSQL. Evidence: `.tmp/phase2a-evidence/pg-migrate.txt`.
2. UUID generation: **PASS**. `gen_random_uuid()` returned a valid UUID; a direct pickup_locations insert omitting id also exercised the database UUID default.
3. Recipient CHECK: **PASS**. Direct SQL bypassing service validation rejected missing recipients, mismatched/unknown types and mixed organization/staff recipients with SQLSTATE 23514.
4. Support-item CHECK: **PASS**. Direct writes rejected requested=0, negative reserved/fulfilled values and reserved/fulfilled values above requested (23514).
5. Inventory invariants: **PASS**. Negative current/reserved stock and reserved above current were rejected by PostgreSQL (23514); the original balance was unchanged.
6. Decimal quantities: **PASS**. The inherited full-completion cases exercised 1, 25, 2.5, 0.75 and 300 with exact decimal reservation, stock deduction, balance_after and OUT movements. Schema checks confirmed NUMERIC(12,2).
7. Legacy FK hardening: **PASS**. All five constraints were inspected as ON DELETE RESTRICT (`confdeltype=r`), then actual parent DELETE attempts were rejected with 23503 while distribution history remained. Covered distributions.beneficiary_id/basket_id, rep_distributions.rep_id/basket_id and staff_distributions.basket_id.
8. Delete protection: **PASS**. Database-level inventory, organization-recipient and pickup-location deletion was rejected while support references existed. Duplicate support/inventory lines were rejected with 23505. API history-protection tests also passed.
9. Reservation transactions: **PASS**. Insufficient multi-item reservation rolled back every line; cancellation released only its own reservation; audit failure rolled back stock/status/movements; legacy inventory and distribution reservation guards passed.
10. Real two-process concurrency: **PASS**, with PostgreSQL lock waiting observed. See the evidence below.
11. Over-reservation prevention: **PASS**. Two requests of 2.50 each competed for 3.00; exactly one reserved, and the other returned the service validation outcome corresponding to HTTP 422. Combined reservations remained 2.50, available 0.50, and current stock 3.00.
12. In-delivery cancellation: **PASS**. Cancellation was rejected after dispatch; full completion remained valid. Duplicate completion returned 409, and partial fulfillment was rejected.
13. Fractional rollback refusal: **PASS** for every widened warehouse column. The probe attempted down() with current_quantity=2.50, min_threshold=0.75 and movement quantity=0.75 separately. Each attempt raised the explicit fractional-value diagnostic before conversion. The value remained unchanged and the column remained numeric. Probe records were transactionally rolled back. Evidence: `pg-fractional-rollback-final.txt`.
14. Safe rollback cycle: **PASS**. The command preflight confirmed no fractional/out-of-range warehouse values, no active reservations, and that the latest six migrations were exactly Phase 2A. It rolled back only those six migrations. Schema inspection confirmed the three new tables and reservation column were absent, the three warehouse quantities were integer, and zero Phase 2A migration records remained. Evidence: `pg-rollback.txt`, `pg-rollback-schema.txt`.
15. Re-migration: **PASS**. All six Phase 2A migrations re-applied successfully. Schema inspection confirmed all three support tables, reservation tracking, six migration records, and DECIMAL(12,2) warehouse columns. Evidence: `pg-remigrate.txt`, `pg-remigrate-schema.txt`, `pg-final-schema.txt`.
16. PostgreSQL support/integration suite: **PASS — 54 tests, 239 assertions**, zero failures/errors/skips/risky tests. The runner uses `--fail-on-risky`. This includes the existing 44 Phase 2A cases plus 10 PostgreSQL-specific cases. Final duration: 32.940 seconds. Evidence: `pg-integration-final.txt`, `pg-junit.xml`.
17. Documentation: this report records the actual PostgreSQL results and supersedes the prior blocked status.

### Concurrency evidence

`tests/Postgres/phase2a-concurrency.php` starts two independent PHP processes with separate PostgreSQL connections. Worker A holds the inventory row lock behind a filesystem barrier. Worker B tries to reserve via the real SupportDistributionService. The parent observes B's `wait_event_type=Lock` in pg_stat_activity before releasing A; this is not a sequential test or an assumption based on elapsed time.

Final run (`pg-concurrency-final.txt`):

- Worker A PID 32332: reserved 2.50.
- Worker B PID 13348: rejected_422 after waiting for the lock.
- PostgreSQL lock wait observed: true.
- Current stock: 3.00; combined line reservations: 2.50; warehouse reserved: 2.50; availability: 0.50.

The harness checks different process IDs, both successful process exits, the two expected outcomes, summed line reservations and exact warehouse balances. It passed twice, including after final harness formatting and the final integration run. The QA database is left migrated, with only synthetic concurrency fixtures from the final test; one deliberately retains its verified reservation. A later rollback attempt correctly requires resolving that reservation first.

### Reproduction and harness findings

The commands below load only the ignored local QA file and enforce the exact target guard. Passwords are not command arguments.

```text
php tests/Postgres/phase2a-command.php identity
php tests/Postgres/phase2a-command.php migrate
php tests/Postgres/phase2a-rollback-probe.php
php tests/Postgres/phase2a-command.php rollback
php tests/Postgres/phase2a-schema.php rolled-back
php tests/Postgres/phase2a-command.php migrate
php tests/Postgres/phase2a-schema.php migrated
php tests/Postgres/phase2a-command.php test
php tests/Postgres/phase2a-concurrency.php
```

The integration suite uses RefreshDatabase and may rebuild this isolated QA database. Rollback is intentionally refused when active reservations, fractions or integer overflow are present; do not bypass its preflight. No operational rollback safety claim is inferred from disposable QA data.

Two harness issues were corrected before the final accepted run: application recreation initially did not select the QA environment file explicitly, and booting a Laravel app inside PHPUnit's bootstrap created risky error-handler warnings. Each test application now explicitly selects QA; PHPUnit's bootstrap only loads the isolated environment and lets each test own the application lifecycle. The final 54-test run has no risky tests. These were QA harness changes, not fixes to the support engine.

Pint on `tests/Postgres` passed after formatting; `git diff --check` is clean. Previously recorded SQLite and frontend results remain the implementation regression baseline; the PostgreSQL-only acceptance continuation did not change application/frontend behavior.

## Architecture-only update after acceptance — 2026-09-20

The user's master communication, delivery and deployment decisions are now recorded in [TO_BE_MASTER_DESIGN.md](../architecture/TO_BE_MASTER_DESIGN.md), [ADR-005](../architecture/ADR-005-COMMUNICATION-DELIVERY-DEPLOYMENT.md) and the [approved implementation roadmap](IMPLEMENTATION_ROADMAP.md). AS-IS driver, notification and authentication documents now explicitly distinguish existing behavior from the approved target.

The update establishes SMS for beneficiaries/staff/organizations, WhatsApp Business for drivers, Email for account recovery, future Taqnyat integration for all three, Admin-editable safe templates separated from secrets, exactly four numeric receipt digits and no QR in TO-BE, fake-provider development in Phase 2B, real integration in Phase 2C, and Hostinger after the required deployment audit (**HISTORICAL — SUPERSEDED**: the final deployment target is Microsoft Azure, corrected 2026-09-21). Azure and the earlier complete-removal-of-WhatsApp direction are superseded.

Only documentation changed in this follow-up. No application behavior, migrations, credentials, communication calls or deployment configuration were changed, and Phase 2B was not started. The already-passed PostgreSQL gate was confirmed from its recorded evidence rather than rerun for a documentation-only edit. Phase 2A remains VERIFIED; separate explicit approval is required to begin Phase 2B.

## Final verdict and boundaries

All requested PostgreSQL acceptance gates passed. The remaining architecture boundaries are intentional: the new engine is API-only, legacy history is not automatically migrated, and driver/mobile/temporary-link work belongs to separately authorized Phase 2B. Readiness does not authorize deployment or starting Phase 2B.

**PHASE 2A VERIFIED — READY FOR PHASE 2B**
