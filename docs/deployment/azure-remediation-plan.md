# EKRAM Azure remediation — local preparation only

No production actions are authorized by this document. No deployment, restart,
traffic change, production DB write, secret rotation, commit or push occurred.
The authoritative evidence is the existing AZURE-FINDINGS.json and audit report.

## AZR-001 — source/image drift (MITIGATED locally)

Preserve the dirty working tree and IKR-001 through IKR-013. Build from an
approved snapshot containing current application fixes, not HEAD alone. Before
any later release, verify CategoryController::show(), routes/web.php storage
exclusion, role-aware sidebar/detail controls, and protected source hashes.
The deployed image remains unchanged; remediation cannot close deployed drift
without a separately authorized release. Keep runtime image user www-data,
read-only public source and writable storage/bootstrap/cache as designed.

## AZR-008 — PostgreSQL privileges (REQUIRES AZURE CHANGE)

The existing runtime role has CREATEROLE, CREATEDB, BYPASSRLS and azure_pg_admin
membership. Do not weaken or repurpose that account; keep it for approved schema
lifecycle only. Operational steps, after separate approval:

1. Confirm a dedicated EKRAM database/schema, object owners, RLS policies, role
   inheritance, PUBLIC permissions and required runtime tables/sequences. Do
   not assume NOBYPASSRLS alone isolates data: table owners bypass RLS unless
   FORCE ROW LEVEL SECURITY applies. The new runtime role must not own tables.
2. Review postgres-runtime-role.sql in disposable PostgreSQL first. It creates
   a new restricted role, grants app DML/sequence usage, and reserves migrations
   writes/schema changes for a separate owner. No table ownership changes.
   For shared schemas, replace ALL TABLES/SEQUENCES grants with an audited
   EKRAM-only allowlist. The template is not safe for an unverified shared schema.
3. Provision a NEW runtime credential securely through the approved secret
   process and a NEW Key Vault reference; never print it, overwrite/rotate the
   existing admin secret, or put a password in this file. Confirm passwordless
   Entra auth support separately before selecting that alternative.
4. Prepare a future app revision using the restricted runtime identity and
   preserve the existing migration job's administrative credentials. No such
   revision or credential action is executed in this local task.
5. Verify false for all six admin flags/membership, no privileged parent roles,
   no schema CREATE or migrations-table writes, and correct RLS behavior. Test
   login, sessions, cache, queue, inventory, documents and policy flows in QA.
6. Schedule a separately approved release and rollback plan. Rollback selects
   the prior revision/configuration; never blindly revoke an operational role.

## AZR-002 / AZR-003 — image-local changes

Nginx includes security-headers.conf at server scope with always inheritance so
SPA, API, static assets and error responses receive the same policy. QR camera
access is limited to self; blob worker/PDF/image URLs remain usable. React
inline styles are permitted; inline/eval scripts are not. Headers must be tested
against the rebuilt UI before release, including private previews and QR flows.
HSTS has no includeSubDomains or preload. PHP runtime overrides disable display
and PHP fingerprinting while preserving stderr logging and argument redaction.
The web root remains public; routing, authorization and storage guards are
unchanged. No production documents are moved or inspected.

## AZR-004 — probes (REQUIRES AZURE CHANGE)

azure-container-probes.json is a reviewed fragment, not deployable full config.
Merge its probes into the named container of a future configuration while
preserving environment values, identity, resources, image and traffic. Startup
and liveness use DB-independent /health; readiness uses /readiness. Test DB
failure in isolated QA and measure boot time before selecting final thresholds.
Do not execute az containerapp update or apply this fragment during remediation.

## AZR-005 — URL/proxies (REQUIRES AZURE CHANGE)

azure-runtime.env.example sets the verified canonical HTTPS domain for future
configuration. Do not load it automatically or overwrite developer .env files.
Confirm actual ingress source IPs/CIDRs before populating TRUSTED_PROXIES; * is
not accepted as a shortcut. Validate HTTPS URL/signature generation through that
specific proxy, with hostile forwarded headers from untrusted sources rejected.
Production APP_URL cannot be fixed locally; schedule it in an approved revision.

## AZR-006 — Blob RBAC (REQUIRES AZURE CHANGE)

After separate approval, resolve the existing application identity and exact
ikram-documents container resource. First add Storage Blob Data Contributor at
that container scope, verify synthetic upload/read/delete and access denial to
a second QA container, then remove ONLY the account-level assignment belonging
to that application identity. Preserve all other identities and assignments.
Do not move files, enable public access, use account keys or connection strings.
Confirm inheritance/group assignments do not reintroduce account-wide rights.
RBAC propagation and rollback must be planned; no RBAC change occurs here.

## AZR-007 — caches (INFO / NO CHANGE)

No config/route cache lifecycle change: this informational finding has no
measured impact, and secrets must not be baked into build-time config cache.
Cache optimization needs separate boot/config review and isolated validation.
Do not run artisan optimize or change the existing startup guards in this task.

## Release boundary

Local tests do not authorize production changes. A future build must pass guarded
backend/frontend/PostgreSQL/browser checks and native Linux Docker image checks.
If Docker is unavailable, report the gap; do not push or substitute ACR builds.
Record source snapshot hashes and attach remediation results for release review.
