# POLICY-D browser gate recovery — 2026-09-22

Verdict: **POLICY-D PARTIAL — FIX REQUIRED**.

The local browser execution blocker is resolved. `tests/Browser/policyd-review-gate.mjs` actually completed twice with **TOTAL=10, PASSED=10, FAILED=0, UNEXPECTED_REMOTE_REQUESTS=0**. This is the existing settings integration gate, not proof of a complete documentary review UI. Additional real controller authorization probes exposed missing application endpoints; no production logic was changed to conceal that gap.

## Root cause

1. The original runner read `JSON.parse(fixture.stdout).admin.password`. `audit-fixture.php` returns only `token` and `user`. Reproducing that access against the actual fixture output produced exactly: `TypeError: Cannot read properties of undefined (reading 'password')`. The generated login password must be retained from the runner's input credentials instead.
2. The original runner never placed the authenticated token/user in browser localStorage, unlike POLICY-C.
3. `/admin/beneficiary-policy/settings` is not registered in App.jsx. The real settings route used by POLICY-C is `/admin/settings`; the original URL falls through to a redirect.
4. Original readiness did not fail explicitly when polling expired, ignored startup errors, and had no finally cleanup for PHP. A PHP child could keep the Node runner alive after its error. The interrupted reproduction process tree was positively identified by parent/process relationships and stopped; unrelated processes were not stopped.
5. No API proxy/interceptor was installed despite the original comment claiming one. A retrospective performance scan for a few hosted domain substrings neither blocked outbound requests nor counted every unexpected destination.
6. Existing public assets may contain a hosted VITE_API_URL. Relying on that bundle is unsafe for an isolated test.
7. The first full regression additionally found four invalid fixture actors (`TEST_DOC_VERIFIER`, `TEST_RESEARCHER`, `TEST_ADMIN`, `TEST_DOC_REJECTOR`) violating audit_logs.user_id FK. Disabling SQLite foreign keys inside a RefreshDatabase transaction did not repair the invalid fixtures.

## Fix applied — harness/test scope only

- Reused POLICY-C's isolated fixture, actual local login, authenticated localStorage and fetch/route.fulfill pattern, with CORS response headers.
- Built current frontend sources into `.tmp/policyd-recovery/build`, forcing VITE_API_URL=/api; production public assets were not rewritten by this recovery.
- Added `policyd-server-router.php` to serve that test build and the real Laravel API. Allocated a free loopback port, checked startup/readiness and confirmed the isolated SQLite fixture before opening Chromium.
- Explicit testing environment, random local APP_KEY, SQLite database, disabled PHP telemetry and no operational/Aiven database access. Credentials and auth tokens stay in process memory.
- All non-loopback browser requests are aborted and counted as failures. Harness fetches reject remote destinations and redirects. Service workers are blocked. The disposable CSS build omits its Google Fonts import before loading; no production stylesheet or business assertion was changed. No hosted API exception is permitted.
- Installed interception before navigation, retained the original concept assertion and added the exact document-review setting check. No mocked policy approvals or simulated business outcomes.
- Added finally cleanup; account for signal-terminated Node children having null exitCode with non-null signalCode on Windows. Both successful runs terminated their owned PHP/Chromium processes.
- Repaired POLICY-D workflow test fixtures with a real isolated User UUID and retained FK enforcement. Existing assertions were not weakened.
- Added independent real HTTP authorization probes using the exact approve/reject URLs in PolicyDReviewPage. These tests intentionally expose the missing implementation rather than treating 404 as successful authorization.

## Actual final results

- Browser: 10 checks, 10 passed, 0 failed, 0 unexpected remote requests; 11 local API requests proxied. Chromium, PHP readiness, SQLite fixture, authentication, current build and settings rendering all exercised.
- Full backend (`php artisan test --compact --log-junit ...`): 336 tests, 335 passed, 1 skipped, 1,425 assertions, 0 failures/errors. The existing skipped test is BeneficiaryPolicyEngineTest::test_rollback_drops_and_recreates_policy_tables.
- POLICY-D workflow: 9 tests, 15 assertions, 0 failures after fixture repair.
- Existing POLICY-D permissions: 4 tests, 4 assertions, 0 runner failures; **all four are assertTrue(true) placeholders and do not prove permission enforcement**.
- POLICY-D AuditLog: 3 tests, 9 assertions, 0 failures.
- Real controller/API authorization: 6 tests, 6 assertions, **6 failures**. Both `/api/beneficiary-policy/assessment/approve` and `/api/beneficiary-policy/assessment/reject` return404 for guest, view-only and admin requests, instead of reaching authentication/authorization/request validation.
- Frontend: 52 tests across13 files passed; npm run lint passed; npm run build passed (isolated output).
- Git diff check: exit0, no whitespace errors.
- PostgreSQL: retain previously supplied 28/28 passed,155 assertions. Not rerun; no schema or database behavior changed during this recovery.

## Remaining application acceptance gaps

PolicyDReviewPage is not imported/routed by App.jsx and currently seeds its display from hardcoded state. Its approve/reject endpoints are absent from routes/api.php. The available BeneficiaryPolicyController exposes POLICY-A/B lifecycle/evaluation operations, not these POLICY-D review decisions. Fixing these requires actual application integration and authorization work, beyond the requested harness-only recovery. The successful settings browser smoke test must not be represented as end-to-end POLICY-D review/decision acceptance.

The failing authorization probes are in `tests/Acceptance/PolicyDControllerAuthorizationTest.php`, run explicitly with `php artisan test --compact tests/Acceptance/PolicyDControllerAuthorizationTest.php`; the standard phpunit.xml Unit/Feature suites do not include this separate acceptance directory. Their failure is part of this final verdict despite the default regression suite passing.

## Evidence

Local evidence folder: `.tmp/policyd-recovery/`.

- `browser-final.txt`, `browser.json`, `settings.png`
- `original-contract-error.txt`
- `backend-final.txt`, `backend-final-junit.xml`
- `workflow.txt`, `permissions.txt`, `audit.txt`, `controller-authorization.txt`
- `frontend-test.txt`, `frontend-lint.txt`, `frontend-build.txt`
- `diff-check-final.txt`

Recovery changes: browser runner/router, workflow fixtures, independent authorization acceptance probes, and reports only. No production controller/service/route/schema changes, POLICY-E/F/G, Phase2C, Governance implementation, bulk evaluation, simulation, commit, push or deployment.
