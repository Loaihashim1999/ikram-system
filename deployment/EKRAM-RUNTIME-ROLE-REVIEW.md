# EKRAM runtime database role independent review

Date: 2026-10-04. Reviewer: A13. Scope: supplied production read-only audit and repository privilege template. Source changes: none. Production role/grant/secret/configuration changes by A13: none. No privileged production DDL, migration or provider call was executed.

## Finding: HIGH — administrative privileges in the application runtime principal

`.tmp/ekram-controlled/production-readonly-audit.json` records `rolcreatedb=true`, `rolcreaterole=true`, `rolbypassrls=true` for the current runtime principal. These are verified privilege flags, not an inference from the username. They expand a compromised application/database credential beyond ordinary application row access into database/role administration and bypass of row-level policies. Application authorization cannot compensate for that database privilege boundary. Actual existing RLS policy effectiveness and administrative memberships require further read-only inventory; no absence of RLS or exploit was assumed.

Classify HIGH, promotion-blocking under the user's controlled-deployment Phase 17 requirement `no Critical/High finding`. Do not resolve by relabeling the pre-existing configuration or by claiming that deployment did not introduce it. Candidate should use a separate least-privilege runtime login, with the existing privileged principal retained only for authorized migration/administration and rollback compatibility. Do not revoke, delete or downgrade the live principal during this candidate validation.

## Proposed additive candidate role

`docs/deployment/postgres-runtime-role.sql` is a useful reviewed starting point: NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOREPLICATION/NOBYPASSRLS/NOINHERIT, database CONNECT, schema USAGE, application table DML, sequence USAGE/SELECT, and migrations-ledger SELECT only. It does not transfer ownership or alter the current privileged role. It deliberately contains no password. Create a securely provisioned role credential and candidate-specific secret reference without logging the value or placing it in image/report files. Keep the migration job on its separate authorized owner role.

Do not execute the template literally until the preflight below is established. `ALL TABLES IN public` is acceptable only if that schema is conclusively dedicated to EKRAM and the granted table set is inventoried; otherwise use an explicit application table allowlist. Default privileges must be scoped to the actual role(s) creating future application objects, not guessed from current runtime username. Granting future-table DML also requires continued explicit migration-ledger exclusion if that ledger is ever recreated; do not regard one current REVOKE as a universal future-object rule.

NOINHERIT alone is not a complete membership boundary: inventory all direct/transitive memberships and applicable SET ROLE permissions, not only `azure_pg_admin`. Verify the runtime role cannot acquire the migration/database owner or another privileged parent. Privileges available through PUBLIC and executable SECURITY DEFINER routines also require inspection. Do not change global PUBLIC grants, owners or RLS policies as an incidental way to make this candidate role work.

## Required production read-only preflight

- Verify exact approved server/database identity; confirm dedicated EKRAM database/schema, complete table/sequence names and owners, schema/database ACLs, and actual migration owner(s). Reconcile the known ledger: 74 applied and the exact three reviewed 2026-10-04 migrations pending, as reported by A0; this reviewer did not independently query the server.
- Inventory current/candidate role flags, role memberships and effective privilege paths, ownership, and privileges inherited through PUBLIC. Determine whether schema CREATE, database administrative capabilities, migration-ledger writes, or owner SET ROLE are available effectively.
- Inspect `relrowsecurity`/`relforcerowsecurity`, table policies, owner roles and policy role targets for every application table. Existing admin access can bypass restrictions the candidate role will actually encounter. Do not assume absence of policies, and do not weaken policies to make candidate requests succeed.
- Inventory SECURITY DEFINER functions/procedures, owners, execution ACLs and search-path definitions; identify any callable elevated operation. Application needs must be distinguished from unrelated public-schema objects.
- Confirm required application table DML/sequence privileges for auth/session/cache/queue, policy/support/inventory/receipt/audit/communications and cleanup; schema lifecycle remains unavailable to runtime. Avoid granting schema CREATE, role membership, ownership or migration-ledger DML to solve missing row privileges.
- Confirm managed secret provisioning and candidate-only connection configuration. Do not modify the 100%-traffic healthy revision, its credentials, traffic weights or retained rollback configuration during role testing. Confirm web, candidate worker and scheduler use the intended role; migration job retains its separate owner role. Merely changing web configuration leaves privileged workers unresolved.

## Required local guarded verification before production role provisioning

Use the existing exclusive guarded disposable PostgreSQL QA environment with synthetic TEST data, fake providers and blank telemetry. Coordinate ownership with A0/A2; A13 did not run concurrent QA or create production roles.

Provision the proposed runtime role/grants in the disposable environment and execute critical candidate workflows with those runtime credentials: login/session/cache/queue processing, beneficiary confirmation/archive, policy evaluation, support reservation/code completion, immutable receipt snapshot, audit/notification/outbox, protected proof and cleanup. Verify no permission failure and no RLS-induced missing/overbroad rows. Run full relevant PostgreSQL coverage under this role when feasible; an owner-role suite does not prove runtime grants.

Execute negative privilege probes in disposable QA only: role/database/schema-object creation denied, migrations-ledger INSERT/UPDATE/DELETE denied, privileged/owner SET ROLE denied, forbidden synthetic RLS rows denied where policies exist, and direct snapshot mutation denied by its trigger. Avoid destructive probes against live objects. Record returned SQLSTATE/boolean evidence with no credentials. For tables/policies not reproduced locally, keep the live-metadata limitation explicit.

After bounded candidate role provisioning, production verification should initially remain read-only: actual role flags/memberships/effective privileges and connectivity/readiness identity. Authorized TEST writes subsequently prove application behavior through the controlled candidate. No database recreation or existing-user mapping is needed: production audit reported no legacy driver Users and two dedicated Drivers; preserve those real Driver records.

## Authorization assessment

The user explicitly authorized controlled deployment, reviewed additive migrations, candidate validation and correction/classification of release risks, and forbids promotion with a Critical/High finding. A narrowly reviewed additive candidate-only runtime role/credential and required application grants are necessary, reversible security remediation within that objective. The template's earlier `REVIEW ONLY` comment was written for the preceding local-only task; it does not independently require a new human approval after the latest deployment authorization. Complete safe read-only preflight and disposable verification first.

This interpretation does **not** authorize revoking/changing the live admin role, changing object ownership or global PUBLIC rights, modifying unrelated databases/schemas, weakening RLS, deleting historical identities, or routing traffic before gates pass. If the actual environment requires any of those broader changes, report the concrete reviewed plan and obtain specific authorization. If the tool's automatic approval review rejects the bounded action, follow that rejection and report the stated reason; do not bypass it by changing execution routes.

## Verdict

Runtime-admin finding remains HIGH/open until a verified least-privilege candidate principal covers web/worker/scheduler and its critical workflows and negative probes pass. Candidate role proposal is appropriate subject to read-only production preflight and guarded local verification. Application migration/release readiness counts alone do not close this privilege finding. Scanner findings reported by A0 are a separate image gate; this role review does not certify image vulnerabilities as resolved.

## Sanitized preflight follow-up and narrow SQL plan

Reviewed `.tmp/ekram-controlled/production-privilege-preflight.json`: **56** public tables including migrations; **55** application tables below. All are owned by ikramadmin, RLS/FORCE RLS flags false, policy list empty and SECURITY DEFINER list empty in the supplied scoped inventory. Public schema ACL grants PUBLIC USAGE only (no CREATE); database ACL is null/default, which must not be misreported as no effective PUBLIC privileges. Candidate role name is absent. Existing ikramadmin is a member of azure_pg_admin and monitoring roles with administration options. No grant to those parent roles is proposed for the new principal.

The following is a **reviewed plan, not execution evidence**. Run only through A0's approved bounded helper after exact server/database/table/role assertions; secure password provisioning is deliberately omitted here and must never be printed. Atomic transaction creates a new role and grants privileges to that new role only. Abort if role already exists rather than modifying an unknown identity. Do not execute ALTER DEFAULT PRIVILEGES in this one-release plan: the three reviewed migrations add columns/trigger/function, not tables, so automatic future-object DML is unnecessary. Future tables require a separately reviewed grant update.

```sql
BEGIN;
CREATE ROLE ekram_runtime_candidate LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
    NOINHERIT NOREPLICATION NOBYPASSRLS;
GRANT CONNECT ON DATABASE ikram_prod TO ekram_runtime_candidate;
GRANT USAGE ON SCHEMA public TO ekram_runtime_candidate;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
    public.audit_logs,
    public.baskets,
    public.beneficiaries,
    public.beneficiary_documents,
    public.beneficiary_policy_evaluations,
    public.beneficiary_policy_versions,
    public.cache,
    public.cache_locks,
    public.categories,
    public.communication_messages,
    public.communication_template_versions,
    public.daily_beneficiaries,
    public.daily_beneficiary_documents,
    public.daily_inventory_items,
    public.daily_inventory_movements,
    public.daily_receiving_transactions,
    public.delivery_orders,
    public.dependents,
    public.distributions,
    public.document_verifications,
    public.driver_assignment_tasks,
    public.driver_assignments,
    public.drivers,
    public.failed_jobs,
    public.inventory_items,
    public.inventory_movements,
    public.job_batches,
    public.jobs,
    public.medical_evidence,
    public.neighborhood_reps,
    public.notifications,
    public.organizations,
    public.password_reset_challenges,
    public.password_reset_tokens,
    public.personal_access_tokens,
    public.pickup_locations,
    public.policy_application_run_items,
    public.policy_application_runs,
    public.policy_decisions,
    public.receipt_challenges,
    public.receipts,
    public.rep_distribution_proofs,
    public.rep_distributions,
    public.sessions,
    public.settings,
    public.social_assessments,
    public.staff,
    public.staff_dependents,
    public.staff_distributions,
    public.staff_members,
    public.support_distribution_items,
    public.support_distributions,
    public.support_receipts,
    public.system_initializations,
    public.users
TO ekram_runtime_candidate;
GRANT SELECT ON TABLE public.migrations TO ekram_runtime_candidate;
-- Insert reviewed explicit GRANT USAGE, SELECT ON SEQUENCE statements
-- only for sequences owned by columns of the 55 allowlisted tables.
-- Never grant a migrations-owned or unrelated sequence by broad ALL SEQUENCES.
COMMIT;
```

Sequence names are not present in the supplied preflight JSON; do not invent them. Read-only discovery should join `pg_class`/`pg_namespace`/`pg_attribute` for the exact 55 table allowlist and call `pg_get_serial_sequence(format('%I.%I', schema, table), column)` for positive attnum/nondropped columns. Return distinct nonnull fully qualified sequence names; confirm each underlying sequence owner and dependency belong to those allowlisted columns. The helper may safely construct identifier-quoted `GRANT USAGE, SELECT ON SEQUENCE <exact-name> TO ekram_runtime_candidate` statements from that reviewed result, never interpolated untrusted text. Fail closed on drift/unexpected sequence ownership. No schema CREATE, memberships, ownership transfers, CREATE DATABASE/ROLE, global PUBLIC change, existing-role alteration or migration-ledger write grant is included.

Existing local guarded QA principal lacks CREATEROLE. Consequently it cannot provision this role or prove login/effective grants/negative probes under a separately created role. Do not claim owner-role application tests verify the runtime proposal. Current status: production metadata/source plan reviewed; local runtime-role provisioning/execution verification **NOT PERFORMED (QA capability limitation)**. A0 can arrange an authorized isolated privileged bootstrap, or explicitly record the local limitation and obtain actual candidate-role connectivity/effective-privilege and authorized TEST-workflow evidence through the controlled candidate. The latter is live candidate evidence, not a local QA pass. Never run privileged negative DDL probes against live production objects, access another operational database, or silently grant QA administrator capabilities as a workaround.

## Concrete helper review

Reviewed `deployment/controlled-runtime-role.php` before execution. Exact principal is `ekram_runtime_candidate`. Its fixed host/database/current-bootstrap-user assertions, atomic new-role-only creation, exact whole-table inventory assertion, table owner/RLS checks, identifier quoting, 55-table allowlist/ledger SELECT and associated sequence grant scope are appropriate. Client-generated SCRAM-SHA-256 verifier construction is correct for a generated ASCII password; no plaintext credential enters SQL. A securely generated non-ASCII credential would require SASLprep handling, so assert generated ASCII rather than accepting arbitrary long Unicode secrets. Reports must not expose the verifier either.

Two improvements were returned to A0 before execution:

1. Fail closed on effective privilege/metadata drift inside the provisioning transaction. Reassert public schema ownership/ACL, absence of SECURITY DEFINER/policies, and candidate effective no schema CREATE/no privileged membership; prove ledger has SELECT and no INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER, plus expected table/sequence privileges before COMMIT. Saved preflight alone is not an executable drift guard. Actual candidate-role login/effective checks and authorized TEST workflows still follow; no live negative DDL.
2. Sequence dependency query must require referenced table namespace public, table kind r/p, positive referenced column and live nondropped attribute. Matching a dependency target by table name alone can include another-schema same-named table; no evidence says such a sequence currently exists, but the helper should preserve the reviewed exact scope if metadata changes.

Database ACL null/default includes PUBLIC CONNECT and TEMP; TEMP allows session-local temporary objects and is not schema CREATE/role/database administration or a promotion-blocking administrator attribute. Retain it for this bounded plan and document effective privileges honestly. Removing PUBLIC TEMP would change other roles globally and is outside this new-principal-only remediation. Do not claim runtime is unable to create any object whatsoever merely because persistent schema CREATE is denied.

Final helper re-review: both improvements are now present. It reasserts exact database/schema owner and approved ACL footprint, empty public SECURITY DEFINER/policy inventory, new-role flags/no memberships/no schema CREATE, no ledger write privileges, expected table DML and sequence privileges before COMMIT. Sequence target is restricted to public real tables and positive live nondropped owned columns. Credential is now exactly 64 lowercase hexadecimal ASCII characters, resolving SASLprep ambiguity. `php -l deployment/controlled-runtime-role.php` independently reports no syntax errors. No unresolved demonstrated helper-source issue remains in this bounded provisioning plan. Syntax/source review is not role execution/login evidence, and the HIGH runtime finding remains open until actual candidate-role verification described above.

Scope precision: grants are limited to ikram_prod/public application objects. PUBLIC/default CONNECT or TEMP privileges elsewhere are not removed or claimed absent by this helper. No existing principal/global ACL is changed. Candidate connection role cannot be described as globally database-exclusive solely from these grants.

## Fixed-helper transport review

Reviewed `deployment/controlled-role-transport.py` without cloud execution. Independently recomputed `controlled-runtime-role.php` SHA-256: `86208b17b06902aabdfed2aaf16e1acf85492fbcb9024e553935dc839f2e7d78`, matching both local transport assertion and server bootstrap assertion. The transport has no arbitrary script/shell argument: its fixed short PHP bootstrap accepts only decompressed bytes with that exact hash before evaluating the already reviewed PHP body. Fixed source starts with the PHP opening tag removed by the bootstrap, and source content has not changed.

Chunked stdin is compressed/base64 text with 500-character lines, below normal terminal canonical-line buffering limits. Local AST inspection confirms bootstrap string newline escapes become valid PHP newline escapes. Bootstrap accumulates the reviewed payload length, strict-base64 decodes/raw-inflates, verifies source hash and captures helper stdout. Result JSON is base64 framed with unique begin/end markers; Python strips terminal ANSI framing, decodes/parses only framed JSON metadata and never prints raw socket data. Helper error exits without a result frame; sanitized transport failure is intentional. The reviewed PHP transaction rolls back caught SQL failures. SQLSTATE exposure is unnecessary and can include sensitive verifier statements, so omission does not prevent the failure from aborting.

A0 inspected the installed frozen Azure CLI implementation: constructor parameters match the transport, stdin prefix is `b'\x00\x00'`, terminal decoder removes two response-prefix bytes, and recv/send proxy the WebSocket. This protocol confirmation is A0-provided implementation evidence; A13 could independently inspect the local transport and hash but did not execute the production socket. Fixed revision/replica remains the known healthy revision solely to execute the bounded approved additive helper, not to change that revision's configuration/traffic.

The prior long command failed with Azure/IIS WebSocket 404 before helper execution and A0 read-only role-existence check confirmed no new role. Shortening transport preserves the exact reviewed mutation scope; it is not authorization to change the PHP payload/hash. Automatic approval review still applies to the upcoming bounded tool action. If execution transport times out/drops or no result frame arrives, database outcome can be ambiguous: perform read-only role/privilege verification before any retry, never infer rollback from missing output. Existing-role refusal prevents a retry from silently changing a principal after an uncertain commit. No unresolved demonstrated transport-source defect was found; no production execution or role-finding closure is claimed by this review.
