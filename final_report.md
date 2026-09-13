# IKRAM SYSTEM — Final QA and implementation report

Report date: 2026-09-13  
Test target: local Laravel application with an isolated SQLite database  
Production target: https://ikram-system.onrender.com  
Production credentials/data: not supplied and not used

## Executive summary

The governance report was rebuilt as a multi-page Arabic RTL executive report using the official Ekrām frame. It now separates current snapshots from activity during the selected period, contains seven documented management indicators, uses actual database queries, provides visual trends and supporting tables, and exports the complete supporting dataset to Excel.

The source-level automatic logout defect was reproduced by running the new session regression test against the original AuthContext: a network error, HTTP 503, or HTTP 419 caused the saved token to be erased. The fix retains authentication on transient failures, clears it only for a 401 tied to the current token, and synchronizes login/logout across tabs.

The existing Notification Center now reads persistent per-user database notifications, supports unread counts and read/all-read state, polls for updates, filters categories, scopes records to the authenticated recipient, and creates deduplicated inventory, beneficiary, and distribution alerts. An hourly inventory alert command and scheduler process were added.

Critical public account-reset and test-seeding routes were removed. Document/report downloads now require authentication. A backend middleware enforces the existing role/module/action matrix, and driver distribution access is scoped to the assigned driver.

Automated verification passed 45 Laravel tests with 175 assertions and 38 frontend tests. The production build passed. A local Playwright run loaded 13 authenticated modules, refreshed the session, opened a second authenticated tab, and captured desktop/mobile governance views: 16 checks passed with no HTTP/JavaScript errors. The browser run lasted 156.339 seconds. This is not a 24-hour stability test.

## Test environment and roles

- PHP 8.3.30, Laravel ^13.8, PHPUnit 12, SQLite in-memory feature tests.
- React 19/Vite production build, Vitest/jsdom, Chromium through Playwright.
- Isolated browser database populated with 50 `TEST_BENEFICIARY_*`, 50 `TEST_EMPLOYEE_*`, and 50 `TEST_ORGANIZATION_*` records.
- Actual roles exercised in authorization tests: `admin`, `assistant_admin`, `delivery_driver`, `readonly`, `warehouse`, `staff`, and `reception`. No role was invented.
- Five browser fixture accounts were created only in an isolated disposable database. Generated passwords were passed in-memory and were not logged, committed, included in screenshots, or written to reports.

## Modules tested

Login, Dashboard, Beneficiaries, Daily Beneficiaries, Warehouse/Inventory, Staff, Beneficiary Entities/Neighborhood Representatives, Receiver/QR, Delivery, Governance, Audit, Accounts, and Settings passed authenticated page-load/navigation checks locally. Refresh and a second tab remained authenticated. Desktop and 390px mobile governance layouts were captured.

Feature tests also covered authentication failure, role middleware, beneficiary CRUD/validation/persistence, daily beneficiary flows, inventory rules, distributions, notification isolation/read state/deduplication, report filters, PDF generation, complete Excel row export, and the previously hidden beneficiary query case.

The following were not tested end-to-end in production: real credential login, production CRUD, production logs, external OCR, WhatsApp/provider delivery, real QR camera hardware, external storage links, production queue/resource behavior, and 24-hour uptime. Destructive production operations were not performed.

## Findings and fixes

### SEC-01 — CRITICAL — System accounts — FIXED

- Problem: unauthenticated GET endpoints could reset system accounts and seed data.
- Reproduction: source inspection of `/api/fix-admin` and `/api/seed-test-data`; regression requests now return 404.
- Expected: no public mutation or credential-reset route.
- Actual before fix: route closures performed account and database writes.
- Root cause: deployment/debug helpers were registered in the public API routes.
- Fix: removed both routes and added login throttling.
- Files: `routes/api.php`, `tests/Feature/SystemAuditTest.php`.
- Verification: PASS.

### SEC-02 — CRITICAL — Authorization — FIXED for routed API matrix

- Problem: most authenticated users could directly invoke mutation endpoints; report/document endpoints were public.
- Reproduction: authenticate as non-admin and POST `/api/users` or a disallowed beneficiary mutation.
- Expected: backend authorization matching the established UI roles and nested permissions.
- Actual before fix: only `auth:sanctum` protected the main group.
- Root cause: `RoleMiddleware` existed but was not applied to module routes, and `User::hasPermission()` expected a flat permission list while the UI stores a nested matrix.
- Fix: added `ModulePermission`, protected report/document exports, reserved user administration for admin, and restricted driver records to their assignments.
- Files: `app/Http/Middleware/ModulePermission.php`, `routes/api.php`, `app/Http/Controllers/DistributionController.php`, `app/Http/Controllers/ReceiverController.php`.
- Verification: PASS for the current API routes and tested roles. A formal business-owner review of every permission combination remains recommended.

### AUTH-01 — HIGH — Unexpected logout — FIXED

- Problem: a temporary network/server/419 failure during `/api/me` erased the bearer token and user.
- Steps: save a valid token; make `/api/me` fail without a 401; mount the original AuthProvider.
- Expected: preserve the current login through transient transport/server errors.
- Actual before fix: the user became anonymous for every exception.
- Root cause: unconditional localStorage clearing in `fetchUser`; the Axios interceptor could also process a stale request after a newer login.
- Fix: clear only for 401 and only when the failed request used the currently stored token; synchronize authentication state across browser tabs.
- Files: `frontend/src/context/AuthContext.jsx`, `frontend/src/api/axios.js`, `frontend/src/test/AuthSession.test.jsx`.
- Verification: original-code reproduction FAIL for network/503/419; fixed-code tests PASS. Refresh and second-tab Playwright checks PASS. A real long-idle production reproduction remains NOT TESTED pending credentials and elapsed time.

### DEPLOY-01 — HIGH — Redeploy stability — FIXED in configuration

- Problem: container startup ran DatabaseSeeder on every deployment and generated an APP_KEY when absent.
- Expected: migrations may run safely; production account data and encryption keys remain stable.
- Actual before fix: seeders could overwrite existing accounts/passwords, and a missing key could make encrypted values unreadable after redeploy.
- Root cause: destructive initialization was embedded in `docker/entrypoint.sh`.
- Fix: removed automatic seeding, require a configured persistent APP_KEY, disabled production debug, and changed Render APP_KEY to a secret environment value.
- Files: `docker/entrypoint.sh`, `render.yaml`.
- Verification: source/configuration check PASS. A Render redeploy was not performed.

### DATA-01 — HIGH — Saved beneficiary appears missing — FIXED

- Problem: a saved non-employee beneficiary with null priority was absent from the default list and search.
- Steps: create the record, verify it in the database, then query `/api/beneficiaries?search=...`.
- Expected: the saved record is returned.
- Actual before fix: SQL `priority != employee` excluded null values.
- Root cause: SQL three-valued null comparison in the default scope.
- Fix: explicitly include null `priority` and `is_employee` values.
- Files: `app/Http/Controllers/Beneficiaries/BeneficiaryController.php`, `tests/Feature/SystemAuditTest.php`.
- Verification: reproduced as FAIL before fix; PASS afterward. This explains one confirmed disappearance path, not every historical production report.

### DATA-02 — MEDIUM — Concurrent stock adjustment — FIXED

- Problem: main-inventory stock was read before the transaction lock, permitting concurrent deductions against stale quantity.
- Expected: validate and update the locked current row.
- Root cause: transaction used an already-loaded model.
- Fix: reload the item with `lockForUpdate()` inside the transaction and preserve validation responses.
- Files: `app/Http/Controllers/InventoryController.php`.
- Verification: Laravel inventory tests PASS; high-contention PostgreSQL load testing remains NOT TESTED.

### NOTIF-01 — HIGH — Notification Center disconnected from database — FIXED

- Problem: backend wrote values outside the original table enums, swallowed failures, and the UI displayed shared browser-local notifications instead of persistent per-user history. Admin querying could include other admins' records.
- Expected: valid persisted records, per-user isolation, unread/read state, categories, deduplication, and operational alerts.
- Root cause: two incomplete implementations used incompatible schemas and status semantics.
- Fix: added `category`, `read_at`, and unique `event_key`; standardized valid recipient/status values; recipient-scoped endpoints; polling UI; read/all-read writes; category filters; hourly low-stock/expiry scan; scheduler worker; and module-aware recipient selection.
- Files: notification model/service/controller/context/component, new migration, `InventoryAlertService`, `routes/console.php`, `docker/supervisord.conf`.
- Verification: persistence, deduplication, unread state, foreign-recipient rejection, event registration, and frontend behavior PASS.

### REPORT-01 — HIGH — Governance report accuracy/design — FIXED

- Problem: weak pagination/visual hierarchy, tiny charts, date-filter leakage, misleading snapshot/period mixing, a synthetic short-period timeline, and a funnel that implied an eligibility stage not present in the schema.
- Expected: executive report using real data and clear metric provenance.
- Root cause: presentation and aggregation logic were combined, timeline windows were rewritten, and missing workflow states were inferred.
- Fix: added `GovernanceReportService`; strict date validation; exact period bins; current-versus-period labeling; real `delivered_at` receipt metrics; full beneficiary/financial/geographic/inventory/entity/audit/notification sections; management insights; readable charts; and detailed appendices. The report explicitly says that no independent eligibility decision field exists.
- Files: `app/Services/GovernanceReportService.php`, `AnalyticsController.php`, `PdfExportController.php`, report Blade views, Governance page.
- Verification: a 17-page PDF generated from varied test data, parsed successfully, and was visually inspected page by page with no clipping/overlap found. Calculation assertions confirm 73.3% completion, 22 delivered operations, and seven analytical indicators.

### REPORT-02 — MEDIUM — Category wording variants — WARNING

- Problem: `ذوي الاحتياجات الخاصة` and `ذوو الاحتياجات الخاصة` may be separate stored categories.
- Expected: management sees the data-quality issue without silent semantic changes.
- Fix: the report presents stored category names unchanged and counts both known variants for review.
- Verification: PASS. No database values were merged because no approved equivalence rule was found.

### EXPORT-01 — MEDIUM — Complete Excel data — FIXED for governance and shared paging

- Problem: client exports could export only currently loaded records; governance exported aggregates rather than the complete supporting rows.
- Fix: added an authenticated server-side governance workbook with analysis indicators, monthly trend, beneficiary snapshot, registrations, scheduled and received operations, daily activity, inventory snapshots/movements, organizations, and staff. Credentials, encrypted IBAN, OCR payloads, and document paths are excluded. Shared export logic follows pagination; main lists request all records.
- Files: `PdfExportController.php`, `GovernancePage.jsx`, `excelExport.js`, beneficiary/staff/delivery list pages.
- Verification: generated XLSX reopens successfully; the beneficiary dataset contains its header plus all 50 matching records. PASS.

### UI-01 — MEDIUM — API/document origin coupling — FIXED for core client

- Problem: the API client defaulted to a development host and document helpers defaulted to production, causing environment-dependent failures.
- Fix: the API default is same-origin `/api`; authenticated document downloads use the configured API origin and bearer token.
- Verification: local production bundle and 13-module browser navigation PASS. Some direct legacy storage links still use deployment configuration and should be consolidated later.

### UI-02 — LOW — Frontend bundle size — WARNING

- Problem: the production JavaScript bundle exceeds Vite's 500 kB warning threshold.
- Actual: build succeeds; initial download may be slower on weak networks.
- Recommendation: lazy-load route modules and isolate spreadsheet/chart dependencies.
- Status: remaining optional improvement.

## Analytical indicators added

The PDF and Excel contain seven management indicators calculated from selected-period and current-snapshot data:

1. Registration growth versus the immediately previous period of equal duration.
2. Distribution scheduling completion rate.
3. Overdue scheduled operations.
4. Average delivered operations per unique beneficiary.
5. Average monthly rent burden for renters with positive recorded income.
6. Data completeness for district, category, and birth date.
7. Percentage of current low-stock items across main and daily inventory.

Each indicator includes its formula, data scope, interpretation note, and displays “غير متاح” when the denominator is absent. Visual analysis includes monthly registration/actual receipt trends, top-district concentration, and scheduled-operation status distribution.

## Security findings

The highest-risk public write routes and unauthenticated reports were fixed. Login is throttled. Backend module permissions are now applied. Secrets and test passwords were not placed in artifacts. `APP_DEBUG` is false and APP_KEY must be managed as a persistent Render secret.

Remaining security work: conduct an authenticated production authorization review with the association's approved role matrix, rotate any historical shared/default credentials, verify private document storage policy, and review legacy direct storage URLs.

## Session/logout findings

The application uses Sanctum personal access tokens, not the Laravel cookie session lifetime, for the SPA. Increasing `SESSION_LIFETIME` would not have corrected the reproduced bug. The confirmed cause was frontend error handling, with deployment key/account initialization as a separate redeploy risk. Fixed-code transient-failure, refresh, and multi-tab checks pass. Production idle duration and real network transitions remain unverified.

## Notification findings

The existing custom database notification architecture was retained and activated. The UI no longer treats localStorage as notification truth. Polling is intentionally used because no configured WebSocket/broadcast infrastructure exists. Inventory checks run hourly and use event keys to avoid duplicate alerts for the same daily condition. There are no queued notification jobs to monitor; synchronous model events and the scheduler command are the active mechanisms.

## Data persistence findings

Create/read/update/refresh persistence passed in isolated database tests. The null-priority visibility defect and deploy-time account overwrite risk were fixed. PostgreSQL itself is configured as a separate Render database, which is persistent relative to the web container; production backup/restore and redeploy testing were not performed. Existing soft deletion applies to daily inventory; cascade relationships and legacy duplicate models remain documented in `audit_findings.md`.

## PDF, Excel, and UI findings

The final inspection PDF contains the official association identity on every page, RTL typography, reporting period, generation timestamp, generated-by identity, page numbering, header/footer-safe margins, management KPIs, labeled visual analyses, and appendices. It does not invent warehouses, historical snapshots, or eligibility decisions absent from the data model.

The Excel export returns all matching supporting rows rather than a visible page. The local workbook opens programmatically and its principal row count reconciles to the database fixture.

The report filter/export 422 defect is fixed. The client now sends only the date fields used by the selected period, and the API validates only those active fields. Validation responses are also shown in the Arabic error toast. Regression coverage verifies that stale inactive daily, monthly, yearly, and range values do not block a valid report request.

Desktop and mobile governance routes rendered in the browser run. Full interactive CRUD coverage for every button and every breakpoint would require a longer dedicated matrix; only executed checks are marked PASS here.

## 24-hour stability test

- Status: NOT TESTED.
- Actual stability-test duration: 156.339 seconds for the completed browser run; separate automated suites lasted seconds.
- Covered: authentication, 13 module loads, refresh, second tab, local database-backed API traffic, and responsive captures.
- Unverified: 24-hour authentication continuity, Render instance sleep/restart, long-running queue/scheduler behavior, real provider delivery, production resource pressure, and production database persistence across deploys.

No shorter run is represented as equivalent to 24 hours.

## Remaining issues

- Production end-to-end QA requires authorized credentials and a non-destructive test account/data policy.
- A real 24-hour environment was not available in this turn.
- The role/permission matrix needs business-owner sign-off despite enforcement now matching the existing UI.
- Main inventory has no expiry column; expiry indicators correctly use daily inventory only.
- `Organization` records have no recorded assistance relationship; the report keeps them separate from neighborhood representatives.
- The frontend production bundle size warning remains.
- Some older controllers/models and legacy direct storage URL builders remain candidates for consolidation.

## Recommended Future Improvements

These are optional improvements, separate from confirmed bugs:

- Add route-level code splitting for faster initial loading.
- Replace polling with broadcasting only after deploying and monitoring a supported WebSocket service.
- Add an explicit eligibility-decision/history model if management needs a true historical eligibility funnel.
- Add immutable monthly snapshot tables if reports must reproduce the exact historical state at period end.
- Define an approved category vocabulary and supervised merge/migration process.
- Add backup/restore drills and a staging deployment stability run before production rollout.
- Add accessibility and device-camera test passes for scanner workflows.

## Final recommendation

Deploy the migration and application changes first to staging, configure a persistent APP_KEY, run migrations, verify the scheduler process, and execute the credentialed role matrix there. Promote to production only after the association approves the permission matrix and the staging report totals reconcile with known records. Then run the true 24-hour stability test and update this report with production evidence.
