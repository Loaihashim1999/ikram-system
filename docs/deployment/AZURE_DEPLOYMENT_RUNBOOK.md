# Azure deployment readiness and runbook

This document prepares the application for a later live Azure environment audit. It does not provision resources or authorize a production deployment. The only prepared deployment workflow is manually dispatched, requires a boolean confirmation and the protected GitHub `production` environment, and uses OIDC.

## Runtime architecture

The Docker image serves the Laravel API and React/Vite SPA from one container: Nginx listens on port `8080` and forwards PHP requests to PHP-FPM. The container runs as `www-data`; only `storage/` and `bootstrap/cache/` are writable. The image contains production Composer dependencies and frontend assets built from the same commit.

Use Azure Container Apps as the first architecture to evaluate because this image can be deployed as a web app while queue workers, scheduled commands, and release migrations run as separate processes/jobs from the same immutable image. This is a recommendation for the live audit, not a final service decision. App Service for Containers is a viable alternative and must be compared against networking, scale, health-probe, identity, and operational requirements before provisioning.

```text
GitHub Actions (manual + protected environment + OIDC)
  -> tests and Docker build
  -> local image-content checks
  -> Azure Container Registry (tag = full Git commit SHA)
  -> one release migration job (same immutable image)
  -> Azure Container App web revision
  -> HTTPS /readiness verification
  -> previous immutable image rollback on failed deployment health
```

The workflow requires these GitHub **environment variables** in the protected `production` environment: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `AZURE_RESOURCE_GROUP`, `AZURE_ACR_NAME`, `AZURE_ACR_LOGIN_SERVER`, `AZURE_CONTAINER_APP_NAME`, `AZURE_MIGRATION_JOB_NAME`, and `AZURE_APP_URL`. Configure Azure federated credentials for the GitHub OIDC subject and grant only the required ACR push/tag-attribute and Container Apps deployment/job permissions. No credentials are stored in the repository. The environment must have required reviewers configured before the workflow is enabled for use.

## Azure resources to evaluate

| Purpose | Candidate | Readiness note |
|---|---|---|
| Image registry | Azure Container Registry | Use a private registry, managed identity for runtime pulls, and SHA-addressed images. |
| Compute | Azure Container Apps or App Service for Containers | Compare web ingress, worker separation, scheduled jobs, revisions, egress, and operating model before choosing. |
| Authoritative database | Azure Database for PostgreSQL Flexible Server | Production is PostgreSQL only; require TLS verification, private networking where available, backups, and restore tests. |
| Secrets | Azure Key Vault plus managed identity, or protected Container Apps secrets/config | Inject at runtime. Never put secret values in the image or build arguments. |
| Persistent object storage | Azure Blob Storage | The application currently stores uploads via Laravel's `public` disk. Do not make personal/business documents publicly readable; settle authenticated download and URL behavior before switching this disk. |
| Logs and telemetry | Azure Monitor / Application Insights; optional Sentry | Runtime-injected configuration, data minimization, retention, and alert ownership need live review. |
| Shared coordination | PostgreSQL-backed cache/session/queue initially; evaluate managed Redis as load grows | Shared stores are required across replicas. Do not use local file stores or per-replica scheduler state. |
| Deterministic egress | Container Apps workload profiles/NAT Gateway or equivalent | **TAQNYAT STATIC OUTBOUND IP REQUIRED IF IP ALLOWLISTING REMAINS ENABLED.** Verify actual egress and allowlist with the provider in the live audit. |

No resource in this table is provisioned by this change.

## Production environment contract

Set runtime values in the Azure secret/configuration store, not in `.env`, Docker build arguments, or GitHub source. See [AZURE_ENVIRONMENT_CONTRACT.md](AZURE_ENVIRONMENT_CONTRACT.md) for the required/optional and secret/non-secret matrix.

Production must set `APP_ENV=production`, `APP_DEBUG=false`, a persistent externally generated `APP_KEY`, the final HTTPS `APP_URL`, and PostgreSQL `DB_CONNECTION=pgsql`. Use `DB_SSLMODE=verify-full` with the Azure PostgreSQL CA certificate supplied as a mounted file and `DB_SSLROOTCERT` pointing to that file. Do not use SQLite, local QA databases, or Aiven.

For the initial multi-instance deployment, PostgreSQL-backed `CACHE_STORE=database`, `SESSION_DRIVER=database`, and `QUEUE_CONNECTION=database` provide shared state without assuming local disk persistence. Confirm the corresponding framework tables exist in the release schema. The production entrypoint fails closed unless debug is off, PostgreSQL is selected, all three shared drivers are database-backed, Azure Blob disks are selected, Blob visibility is private, and Blob credentials/configuration are present. Moving to managed Redis requires a deliberate runtime/extension and guard update, plus sizing and security review. Keep queue `retry_after` greater than the worker timeout.

Private beneficiary, daily-beneficiary, and representative documents are served through authenticated API endpoints protected by the corresponding module's `view` permission. The endpoint resolves only allowlisted database fields/document records, then returns a no-store redirect or JSON response containing a read-only Blob SAS that expires after five minutes. The SPA requests the endpoint with its bearer token before opening the returned URL. Never expose a Blob URL from an API resource or frontend bundle. Confirm the actual Blob container access level is private; application configuration cannot revoke public access previously granted at the Azure resource.

Set `LOG_CHANNEL=stderr` so container logs flow to the platform. Use `SESSION_SECURE_COOKIE=true`, `SESSION_SAME_SITE=lax`, and an explicit `CORS_ALLOWED_ORIGINS` list. With the single-origin container deployment, the frontend uses same-origin `/api`; do not compile an Azure URL or provider secret into the Vite bundle. If ingress terminates TLS, set `TRUSTED_PROXIES` only to trusted ingress proxy addresses/ranges; a wildcard is acceptable only if direct untrusted ingress to the container is impossible and this is verified.

`COMMUNICATION_PROVIDER` remains `fake` until production SMS activation is separately approved and tested. Only then may the Taqnyat SMS configuration be injected. WhatsApp credentials/settings are retired and are not part of this contract.

## Build and release

Build from the repository root so the root `.dockerignore` is applied:

```sh
docker build --pull -t ikram-system:<git-sha> .
```

The image must be scanned before push. It must not contain `.env`, Git history, QA databases, tests, local logs, temporary PDF files, or secrets. In the prepared GitHub Actions flow, the full Git SHA is the deployment identifier; the workflow disables write/delete for the pushed ACR tag and reuses an existing SHA tag on retries. Do not deploy `latest`.

Create the Azure Container Apps migration job only after approval, with image command `/usr/local/bin/ikram-migrate`, a manual trigger, parallelism/completion count 1, retry limit 0, and timeout 1800 seconds. Reuse the PostgreSQL configuration, managed identity, and Key Vault references. The script runs only `php artisan migrate --force --no-interaction` and requires production mode, debug disabled, explicit PostgreSQL settings, and database `ikram_prod`. Administrator bootstrap is separate/manual and must never run as part of migrations. The deployment workflow updates the job to the release image and waits for its single execution to succeed. Migration failure blocks web deployment. App replicas never migrate during startup.

The image includes the system CA bundle at `/etc/ssl/certs/ca-certificates.crt`, usable as `DB_SSLROOTCERT` with `DB_SSLMODE=verify-full`. Verify the Azure server certificate chain and hostname before changing the live SSL configuration. The production migration script and entrypoint must use LF line endings; the image build checks both shell scripts before packaging.

The original 73 migrations are followed by a compatibility migration for existing installations. It refuses nonempty sessions with an incompatible user-id type and adds the PostgreSQL medical-percentage CHECK without changing evidence values. Legacy staff UUID references are preserved; numeric staff links remain in `staff_id`. Policy evidence codes use the existing `additional_document` storage type, so migration 66 intentionally needs no enum extension. Migration 51's single `first_admin` initialization marker is required for the manual setup locking workflow; it creates no user and is not a seeder. Conditional staff creation retains its existing behavior; nullable/type/FK changes still require production metadata review.

After successful migration, the workflow updates the web app to the SHA-tagged image and requires `https://<configured-host>/readiness` to return success. Azure ingress should also probe `/health` for liveness. Run a post-deployment smoke test of login, core read-only paths, upload/download authorization, and SMS-disabled flows before accepting the release.

### Other processes

- **Web:** default container command (Supervisor for Nginx and PHP-FPM only); scale according to measured load.
- **Queue worker:** separate Container App/process using `/usr/local/bin/ikram-entrypoint php artisan queue:work --tries=3 --timeout=75 --sleep=1`. Scale based on queue depth. `SendCommunication` intentionally has one job attempt; its outbox retry/idempotency policy remains authoritative.
- **Scheduler:** a single Azure Container Apps Job with cron `* * * * *`, command `/usr/local/bin/ikram-entrypoint`, and argument `php artisan schedule:run`. Do not run a scheduler in every web replica. The Laravel tasks use `withoutOverlapping()` and `onOneServer()`; this requires a shared cache capable of atomic locks.
- **Release migration:** a separate one-off job described above; use `/usr/local/bin/ikram-migrate`, never `migrate:fresh`, `db:wipe`, or a web startup hook.

Active Laravel scheduled jobs are:

| Command | Frequency | Purpose |
|---|---|---|
| `notifications:inventory` | Hourly | Evaluate and persist deduplicated low-stock/expiry alerts. |
| `communications:drain` | Every minute | Dispatch pending outbox messages and erase expired encrypted payloads. |

Review execution frequency, shared-cache locks, queue depth, and outbox age in the live audit.

## Storage and data durability

The container's writable local filesystem is ephemeral. Treat only process/runtime artifacts as ephemeral:

- mPDF temporary files under `storage/app/mpdf/`;
- logs (streamed to stderr/stdout);
- compiled views and framework cache under `storage/framework/`;
- temporary upload/request buffers.

The local `public/storage` symlink is created in the image at build time for local development/compatibility; it does not make local container storage durable.

Beneficiary and daily-beneficiary document uploads, representative/staff identity and supporting documents, and any business file referenced by a database row are persistent business data. Back these up and store them outside the container. Laravel code uses `Storage` for uploaded documents. The configured `public` disk name is retained for compatibility, but in production it targets a private Azure Blob container; download access is issued only after API authentication and module-level authorization. Historical absolute document URLs are no longer returned by beneficiary/representative resources. Existing object migration, container access-level verification, and authenticated download smoke tests remain go-live blockers. Do not expose personal documents through a public blob container. The adapter is community-maintained and not Microsoft-supported, so review maintenance, authentication, URL behavior, and dependency advisories before activation.

Do not migrate files during this task. Before cutover, plan a verified copy, path preservation, access-control test, rollback window, and reconciliation of database references against object keys.

## Migration and rollback policy

Use **expand → deploy compatible application → backfill/verify → contract later**. Add columns/tables and nullable/default-compatible fields first; deploy code that works with old and new schema; remove or rename old fields only in a later release after all old replicas and rollback windows have ended. Audit SQL locks, table rewrites, large backfills, and long transactions against realistic PostgreSQL data before production.

The deployment workflow captures the current image, migrates once, deploys the new immutable image, and selects the prior image if readiness fails. Database migrations are not automatically reversed. Keep schema changes backward-compatible with the old image during the rollback window; separately plan any forward repair migration. Never blindly reverse database history or restore a database without an approved recovery plan.

Static review found no column drops or renames in migration `up()` methods. Several existing migrations do alter columns in place, including nullable/type changes and `2026_09_19_040000_widen_general_warehouse_quantities_to_decimal.php` (integer-to-decimal changes). These can acquire PostgreSQL locks and the widening may rewrite large tables; validate duration, lock impact, and old/new application compatibility on production-sized disposable PostgreSQL data before scheduling the first live migration. Their `down()` methods are not part of image rollback and must not be run automatically.

## Health, HTTPS, and operations

- `/health` is a minimal process/application liveness response and does not expose environment or infrastructure data.
- `/readiness` verifies the database with a trivial query and returns only `ready` or `unavailable`; connection errors are not returned to callers.
- Laravel's built-in `/up` remains available.
- Require HTTPS at ingress, set `APP_URL` to the eventual HTTPS origin, configure trusted ingress proxies, and require secure session cookies.
- Stream logs to stderr; configure platform retention, alerting, and restricted access. Do not log OTPs, credentials, national identifiers, or provider payloads.
- Inject Sentry only if approved; keep DSNs outside image and frontend code. Health endpoints should be excluded from noisy exception telemetry.
- Bound worker concurrency and retries; monitor failed jobs and the communication outbox without exposing encrypted payloads.

## Backups, restore, and emergency response

Before production: configure PostgreSQL automated backups and retention, point-in-time restore where supported, Blob versioning/soft-delete and backup policy, and a documented restore test. Mark all as **LIVE AZURE ENVIRONMENT AUDIT REQUIRED**. Verify a restore in an isolated environment and record RPO/RTO before go-live.

For an unhealthy release, stop/scale down the new revision if needed, redeploy the recorded prior SHA image, and verify `/health` and `/readiness`. Preserve the database and migration ledger. If schema compatibility is broken, keep traffic gated and apply a reviewed forward fix or execute the approved database recovery procedure; do not run ad hoc down migrations.

## Live environment audit checklist

- [ ] Configure protected GitHub `production` environment with reviewers and OIDC federated identity.
- [ ] Provision and least-privilege ACR, compute, PostgreSQL, Key Vault/secrets, shared stores, and private Blob storage as approved.
- [ ] Verify PostgreSQL TLS chain/hostname, private networking, backup retention, PITR, and a restore drill.
- [ ] Verify all runtime variables and persistent APP_KEY handling; keep debug off.
- [ ] Verify ingress TLS, trusted proxy ranges, secure cookies, CORS origins, and health/readiness probe behavior.
- [ ] Verify web, worker, scheduler, and migration job configuration and shared-cache lock behavior.
- [ ] Verify private document authorization before selecting the Blob disk; reconcile a staged file migration.
- [ ] Verify deterministic outbound IP if Taqnyat allowlisting remains enabled; obtain provider-side approval before activating SMS.
- [ ] Run deployment, migration-failure block, readiness-failure rollback, and database-backward-compatibility drills in non-production.
- [ ] Review telemetry, sanitized logs, alert routing, incident ownership, and post-deployment smoke tests.

**Not performed here:** Azure login/resource access, ACR push, Azure PostgreSQL access, production migrations/data changes, DNS changes, live communication, production deployment, or rollback.
