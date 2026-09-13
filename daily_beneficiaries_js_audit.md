# IKRAM Daily Beneficiaries JavaScript Audit

## Root cause

The reported stack (`Cannot read properties of undefined (reading 'startTime') at et.reportAllChanges`) matches the LCP Web Vitals observer vendored by `@sentry/browser-utils` 10.74.0. Its `getLCP` handler iterates performance entries and dereferences `entry.startTime` although a browser may supply an undefined entry. The exact defect is documented in getsentry/sentry-javascript issue 24278 against the same version and stack.

Older IKRAM production bundles in `public/assets` initialized Sentry with Browser Tracing, Replay, `tracesSampleRate: 1`, and Web Vitals. That initialization registered the faulty observer. No Daily Beneficiaries component reads `startTime` or calls `reportAllChanges`.

Classification: application-loaded monitoring dependency. It is not business logic in Daily Beneficiaries and evidence does not identify a browser extension as the source.

## Exact source

- Package: `@sentry/browser-utils` 10.74.0
- Package file: `metrics/web-vitals/getLCP.js`
- Function: `onLCP` / `handleEntries`
- Trigger: Sentry `BrowserTracing` adds `WebVitals` and registers the Largest Contentful Paint observer.

## Fix

IKRAM still uses Sentry GlobalHandlers for application error reporting. The Sentry configuration now excludes `BrowserTracing`, `WebVitals`, `BrowserProfiling`, and `Replay`, with tracing and replay sample rates set to zero. IKRAM has no requirement to collect those performance products, so their observers should not be initialized.

This removes the faulty observer at its owning integration boundary. It does not catch, suppress, or use optional chaining around the exception.

## Validation

- Chrome clean test tab: production login rendered and Console contained no warning or error at inspection time.
- Static bundle comparison: old bundles contain `integrations:[browserTracingIntegration(), replayIntegration()]`, `tracesSampleRate:1`, and `reportAllChanges`; the rebuilt bundle initializes Sentry with the four performance integrations filtered and all performance/replay sample rates zero.
- Monitoring regression test asserts GlobalHandlers remains and all four performance integrations are removed.
- Daily Beneficiaries feature suite: create, duplicate validation, inventory create/adjust/movement, receiving, insufficient stock rollback, and analytics.
- Full Laravel suite: 46 tests, 202 assertions.
- Frontend suite: 10 files, 39 tests.
- Production frontend build completed successfully.
- Existing isolated browser coverage includes authenticated module loading, responsive captures, refresh and second-tab session checks. The newest local browser rerun was blocked by the isolated fixture token returning 401 from settings; this test-infrastructure failure is not represented as an application pass.

## Coverage assessment

Backend feature coverage verifies Daily Beneficiary create/read persistence, duplicate validation, historical receiving records, assistance delivery, inventory movement and rollback, analytics, notifications, and permission middleware. Frontend routing and production compilation cover the dashboard, list, details, add, receiving, inventory, search/filter/pagination code paths and Excel export compilation.

Production CRUD and destructive deletion were not executed. The production Chrome tab was at `/login` and did not expose an authenticated session. Mobile production interaction was therefore not claimed. Existing local responsive captures cover 390px and 1440px layouts.

## Before and after

- Before: an older IKRAM bundle registered Sentry Web Vitals and could throw the reported uncaught `startTime` exception.
- After: the rebuilt bundle does not initialize the Web Vitals observer; application error reporting remains enabled.

## Remaining items

- Deploy the rebuilt frontend before judging production behavior; the source fix cannot change the currently deployed bundle by itself.
- Repeat authenticated production Console/Network validation after deployment with an approved test account.
- Vite still reports the existing bundle-size warning (approximately 1.85 MB minified). It is unrelated to the runtime exception.
