# IKRAM system: baseline audit

Inspected 2026-09-13, before implementation. Production data and credentials were not used. Existing untracked package-lock.json belongs to the workspace and is preserved.

## Architecture

- Laravel ^13.8 / PHP ^8.3 declared in composer.json; installed dependency completeness still needs verification. React 19 SPA, Vite, Axios, React Query, Tailwind; Blade is used for PDF views.
- API login issues database-backed Sanctum personal access tokens. The SPA stores the bearer token in localStorage. Sanctum expiration is null. No token refresh or idle timeout is implemented in AuthContext. Cookie session defaults are database / 120 minutes / HTTP-only / SameSite lax, but API bearer authentication does not depend on cookie lifetime.
- RoleMiddleware exists but the main API group only applies auth:sanctum. User permissions use a nested module/action matrix in the UI while User::hasPermission expects a flat list. Existing roles include admin, assistant_admin, delivery_driver, driver, reception, staff, warehouse, readonly. No new role is needed.
- Beneficiary (UUID) has category, dependents, distributions, demographics, nationality, family information and stored financial calculations; encrypted IBAN is hidden in JSON. Staff (integer ID) and legacy StaffMember both exist. Organization is a separate model/table, while the visible entity module uses NeighborhoodRep and RepDistribution.
- InventoryItem/InventoryMovement represent main stock; DailyInventoryItem/DailyInventoryMovement have reserved quantities, expiry, soft deletion. DailyBeneficiary has documents and DailyReceivingTransaction. Distribution relates to beneficiary, basket, assigned user, driver user and Receipt. Driver and DeliveryOrder also exist, with older controllers not wired into the primary routes.
- AnalyticsController supplies governance JSON. PdfExportController calls it and renders weekly_comprehensive_report through mPDF. Dompdf also exists as a dependency. Excel uses SheetJS in the SPA and PhpSpreadsheet for server imports/exports.
- Custom Notification model/table/service exists (not Laravel's standard database-notification schema). Model events dispatch beneficiary/distribution/inventory notifications synchronously. Beneficiary listener can be auto-discovered; the explicit EventServiceProvider is not registered. No actual operational schedule in routes/console.php; only inspire. Queue tables/config exist but these notifications do not require a queue worker.
- PHPUnit feature/unit tests, frontend Vitest tests and Playwright simulations exist. Initial PHPUnit execution failed because vendor/phpunit/phpunit executable is missing; runtime availability is not a test pass.
- Render Docker startup runs migrations and DatabaseSeeder on every boot. The seeder updateOrCreate resets existing account attributes/passwords. Startup generates an APP_KEY when missing. Render configuration enables production debugging and embeds a key; values are deliberately omitted here.

## Confirmed source findings and reproduction plans

### SEC-01 / CRITICAL / accounts / FAIL
Unauthenticated GET /api/fix-admin resets accounts; GET /api/seed-test-data writes test data. Expected: no public account-reset/data-seeding endpoints. Root cause: public route closures. Remove these routes; regression-check route absence in isolated tests. Do not call them on production.

### SEC-02 / CRITICAL / authorization / FAIL
Authenticated low-privilege users can reach account creation and most mutation APIs without backend module/action authorization. PDF endpoints are public. Expected: backend checks matching the existing permission matrix. Source: routes/api.php, UserController and Sidebar/Users permission definitions. Verify direct API access with actual role fixtures.

### AUTH-01 / HIGH / authentication / FAIL
Log in, fail GET /api/me with network/503 error, reload: AuthContext.fetchUser clears token/user for every exception. Expected: retain credentials for transient failures and clear only on a matching unauthorized response. Axios also risks clearing a newer login on an older request's 401. Reproduce with frontend tests before claiming fixed.

### DEPLOY-01 / HIGH / deployment and persistence / FAIL
Docker restart unconditionally runs DatabaseSeeder, which overwrites account data. Missing APP_KEY generates a new key, risking loss of encrypted-field readability. Do not change lifetime as a workaround. External database durability, production restarts and the reported disappearance of beneficiary records remain NOT REPRODUCED.

### NOTIF-01 / HIGH / notifications / FAIL
Service writes recipient_type=admin and status=unread although migration enums permit neither. Exceptions are logged and swallowed. UI NotificationContext reads browser-local records instead of the API. Expected persistent per-user history, valid schema values and read state. Admin queries also include other admins' records, causing duplicates and cross-user read state.

### REPORT-01 / HIGH / governance / FAIL
Trend calculation replaces short selected periods with six months and truncates long periods to twelve; monthly bins are not clipped to the filter. Several charts are unlabelled current snapshots. Organization metrics actually count NeighborhoodRep. Funnel implies eligibility from status without a distinct eligibility decision. PDF catches render failures and returns HTML with HTTP 200. These are confirmed source issues, pending execution.

### EXPORT-01 / MEDIUM / Excel / WARNING
Shared export helper assumes per_page=-1 is supported and does not follow paginator metadata. Module exports require verification against record totals and filters. Governance workbook currently contains aggregated tables rather than complete supporting datasets.

## Data and workflow limits

Category wording variants will be reported separately without changing stored categories. No authoritative category-equivalence rule was found. Historical snapshots cannot be reconstructed from current records alone. The daily expiry field exists; the main inventory model has no expiry field. No warehouse-location model was found, so warehouse-location counts must not be invented. Authorization and data-persistence checks must distinguish the current and legacy models.

Production browser QA, real server logs, production role assignments, actual category duplicates, long-idle behavior and a true 24-hour stability run are NOT TESTED at baseline. No destructive production operation is authorized or planned.
