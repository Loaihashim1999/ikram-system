# Functional regression

Business meaning was not edited. Evidence is automated plus one rendered login/setup screen.

| Check | Result |
| --- | --- |
| Frontend production build | passed |
| ESLint on the edited UI files | passed, no findings |
| `UnifiedBeneficiaryPage` Vitest | 4 passed |
| `PdfFinalizationTest` | 6 passed, 162 assertions, after the frame correction |
| `NationalityReportAndPdfTest` | 1 passed, 176 assertions |
| `AuthenticationFailureTest` | 4 passed, 11 assertions |
| `BeneficiaryControllerTest` | 7 passed, 32 assertions |
| `AuthorizationDriverQrDataIntegrityTest` | 3 passed, 28 assertions |
| `UserAccountAuditAtomicityTest` | 4 passed, 16 assertions |
| `EkramPermissionRemediationTest` | 3 passed, 24 assertions |
| Login render | form and brand panel rendered; a later load showed the one-time admin setup because the API reported that setup is required |
| Click-through of registration, edit, staff, accounts, permissions, notifications, exports | not repeated in the browser in this pass |

`UserEditHttpFlow` was not re-run. Its earlier failure was `ECONNRESET` on `GET /api/users`, which is an environment failure.

Dashboard KPI counts still come from full `/beneficiaries` and `/distributions` payloads. That path was left in place and recorded as debt.
