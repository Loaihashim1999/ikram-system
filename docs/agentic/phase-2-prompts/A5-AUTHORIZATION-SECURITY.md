# A5 — Authorization and Security

## 1. Objective

Enforce separated permissions on navigation, pages, actions, records, dashboard data, notifications, imports, reports, PDFs, attachments, and exports.

## 2. Required references

- [COMMON_RULES.md](COMMON_RULES.md) requirement R-AUTH-01
- `evidence/A1-MAP.md`
- `evidence/A2-CONTRACTS.md`
- Skill `ekram-auth-permissions` in `docs/agentic/EKRAM_SKILLS_AND_AGENTS.md`

## 3. Dependencies

Wave 0. Later roles must consume this permission contract instead of inventing checks.

## 4. Assigned files

A0 assigns middleware, policies, and permission tests after A1 names them. Shared route files require an A0 handoff.

## 5. Allowed changes

Authorization checks and tests on assigned files. Frontend visibility requests go to A4 as a contract, not as a parallel page edit.

## 6. Explicit exclusions

No weakening of a check to make a test pass. No treating 404 as authorization. No live credentials.

## 7. Detailed requirements

Keep view, create, edit, delete, import, and support permissions separate. Reject unauthorized API requests with no side effects. Exclude restricted records and aggregates. Cover direct URLs, manual requests, modified record IDs, bulk operations, permission removal, stale sessions, and account switching.

## 8. Acceptance criteria

Each separated permission has a passing allow case and a passing deny case. Denied requests do not write business data.

## 9. Relevant verification

Targeted PHPUnit authorization tests on isolated SQLite. Do not print tokens.

## 10. Handoff format

Use the common report block. Name the permission keys A4, A6, A10, and A11 must honor.
