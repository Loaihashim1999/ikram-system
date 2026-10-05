# EKRAM route / permission matrix — Wave 0

Source authority: `routes/api.php`, `frontend/src/App.jsx`, `app/Http/Middleware/ModulePermission.php`, `frontend/src/utils/modulePermissions.js`, and policy controller action contracts. Discovery: 2026-10-04.

Authenticated APIs use Sanctum and module middleware. Active admin bypasses module checks; temporary-password restrictions apply first. Ordinary driver roles are restricted to account identity/logout and use dedicated scoped links for delivery. Frontend visibility never grants backend capability.

| Page / operation | API dependency | Backend capability | Alignment / remediation requirement |
|---|---|---|---|
| Permanent beneficiary list/detail | GET `/beneficiaries`, `/beneficiaries/{id}` | beneficiary role access plus `beneficiaries.view` when configured | Existing role guards cover admin, assistant admin, reception, staff, readonly. Actions must inspect grants. |
| Unified registry / export | GET `/beneficiaries/unified`, `/unified/export` | Selected tabs require relevant `beneficiaries` and/or `daily_beneficiaries` view; export additionally requires export | Preserve tab-aware restrictions; all tab needs both domains. |
| Register beneficiary | POST `/beneficiaries` | `beneficiaries.create` under existing role/module semantics | Add explicit review contract without weakening grant. Import remains separate capability. |
| Edit beneficiary | PUT/PATCH or multipart POST `/beneficiaries/{id}` | `beneficiaries.edit` | Detail edit visibility uses `hasModuleAction`; preserve multipart update mapping. |
| Delete / future archive | DELETE `/beneficiaries/{id}`; archive route not yet present | Existing delete grant; future archive mapping must be explicit | DELETE currently hard-deletes. Do not invent authorization from 404 or silently route archive to create. |
| Evaluate policy | POST `/beneficiary-policy/evaluate` | `beneficiary_policy.evaluate` | Read/review alone cannot execute reevaluation. |
| Policy settings | Version list/history and lifecycle endpoints | view, edit_draft, approve, publish, retire independently | Query permissions endpoint and preserve lifecycle separation. |
| Policy review | Beneficiary evaluations and evaluation review/documents/social/decision endpoints | Any D action grants reads; writes use verify_documents, social_assessment, review or decide | `PolicyReviewLinks` mirrors D read grants. New evaluation UI must distinguish evaluate from review. |
| Policy application runs | Version/run list, simulate, approval, execution/retry/cancel | view_application_runs, simulate, apply_scope, execute_reevaluation | Preserve independent simulation/execution permissions and no execution on reads. |
| Support workspace | GET `/support/distributions`, history | `support.view` | `/support-delivery` and `/receiver` use canViewSupport. Split fulfillment tabs/pages without granting dependencies. |
| Support create/edit | POST/PATCH `/support/distributions` | support.create / support.edit | Creation dependencies on beneficiaries/inventory/pickup locations must be intentional and permission aligned. |
| Support transitions | PATCH `/{id}/approve,reserve,ready,dispatch,complete,cancel` | approve, reserve, fulfill, cancel respectively | Preserve state machine and receipt verification authority. |
| Receipt code / verification | POST `/support/distributions/{id}/receipt-code,verify` | `support.fulfill`; excludes readonly/driver roles | Hide controls without grant; canonical verification remains authoritative. |
| Drivers / assignments | GET/POST `/support/drivers`, `/support/assignments`, POST revoke | Middleware support view/create; controller restrictions also apply | Current management UI is admin-only. Verify effective controller permissions before changing exposure. |
| Driver scoped portal | `/driver-access`; GET/POST `/api/driver-access/tasks/*` | Scoped token/signature/expiry and assignment checks, throttling | No ordinary application-user grant required; do not create driver login dependency. |
| Main inventory | `/api/inventory/*` | warehouse view/create/edit/delete/export and role rules | New support selector must not fetch forbidden inventory accidentally. |
| Daily registry / receiving / inventory | `/daily-beneficiaries`, `/daily-receiving`, `/daily-inventory` | daily_beneficiaries actions | Preserve separation from warehouse support. |
| Notifications | `/notifications`, unread, mark-read | Authenticated active user; recipient scope enforced by controller | Navigation destination must also be authorized and resolvable. |
| Communications administration | `/settings/communications/*` | Settings middleware plus controller-specific authority | Provider diagnostic visibility must sanitize secrets and distinguish acceptance/delivery. |
| Governance and official documents | `/analytics`, `/governance/analytics`, comprehensive exports, `/documents/*` | governance.view; independent export_excel/export_pdf; documents map domain issue_document | Preserve export separation and document-domain permissions. |
| Legacy delivery | `/delivery`, `/send-support` redirect; legacy distribution APIs | delivery role/module rules, additional page dependencies | Existing source fetches beneficiary, representatives, inventory; consolidate intentionally onto canonical support workflow. |

New route mappings and dependency selectors require role/API-denial tests. Shared `App.jsx`, `routes/api.php`, and middleware must have one assigned writer at a time. The matrix describes current source, not a completed authorization test gate.
