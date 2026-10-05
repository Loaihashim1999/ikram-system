# EKRAM safe communication queue — 2026-10-04

## Current operating decision — 2026-10-05

The user confirmed that outbound SMS does not require a webhook. The activation sequence is [SMS without a webhook](EKRAM-SMS-WITHOUT-WEBHOOK.md). The earlier rule that blocked outbound activation until a delivery-report contract existed is retired. Keep the webhook disabled. Deployment and the next live send still need their own approval. The 2026-10-04 observations below are historical. The 2026-10-05 attempt is recorded in the activation sequence.

## Current evidence

Production revision `ca-ikram-prod--taqnyat-live-20261004` was inspected inside its running replica. Resolved PostgreSQL configuration matched the intended Azure production source and database `ikram_prod`; a `SELECT 1` succeeded. No Aiven target was used by that revision. Credentials were not printed.

Read-only transactions inspected JSON job metadata without PHP unserialization or execution. Backend: database, queue: `default`, retry_after: 90 seconds, failed backend: database-uuids. There were 16 SendCommunication jobs, all attempts 0 and unreserved; failed_jobs count 0. Oldest creation: 2026-10-03 18:30:05 UTC; newest: 2026-10-04 18:29:27 UTC.

| Operation / state | Queue count | Expired | Provider reference |
| --- | ---: | ---: | ---: |
| password_reset / cancelled | 8 | 8 | 0 |
| password_reset / pending | 2 | 2 | 0 |
| receipt / cancelled | 1 | 1 | 0 |
| driver_assignment_sms / cancelled | 3 | 3 | 0 |
| receipt / pending | 1 | 1 | 0 |
| driver_assignment_sms / pending | 1 | 0 | 0 |

All 16 remain category D for execution/deletion authorization: operation/status/expiry alone does not establish conclusive TEST ownership. No job was deleted. Counts before/after: 16/16. Outbox totals were 9 pending SMS and 13 cancelled SMS; an outbox row is not necessarily a queued job. No body, destination, signed link, or token was inspected or printed.

Azure inventory showed one web Container App and one manual migration Job. The deployed Supervisor runs PHP-FPM and nginx, with no queue or scheduler program. No communication worker was enabled during this task.

## Prepared isolation and idempotency

New SendCommunication instances use `ekram-communications-v2`; existing serialized `default` jobs are not migrated. Repeated enqueue of an existing intent does not dispatch it into the new queue. Real-provider outbox recovery requires an explicitly approved UTC `--since` cutoff. The existing unscoped scheduled drain therefore fails closed in Taqnyat mode. Never configure a production recovery schedule without a reviewed cutoff and an inventory of eligible outbox rows.

Row locks prevent duplicate claims. Timeouts, server errors and malformed acceptance responses are quarantined as `send_outcome_unknown` with reconciliation_required. Neither the drain nor manual service retry can resubmit those outcomes. A recorded provider reference also prevents service retry. Only explicit nonacceptance, such as rate limiting, retains bounded retry semantics.

## Managed worker architecture and activation gate

Use a dedicated Azure Container App in `cae-ikram-prod`, without ingress, with one managed worker replica and the same reviewed image digest and existing managed identity/Key Vault references as the web app. Retain the image entrypoint checks; do not bypass `ikram-entrypoint`. Use `queue:work database --queue=ekram-communications-v2 --sleep=3 --tries=1 --timeout=20 --memory=128 --max-time=3600`. Managed process restart handles the bounded worker lifetime. Job timeout 20 is below retry_after 90. Do not listen on `default` or include it in a queue priority list.

For the first authorized basic SMS, prefer a manual Container Apps Job with one replica, no platform retries, a dedicated per-validation queue, `--max-jobs=1 --stop-when-empty --max-time=300`, and no other queued intent. Enqueue through CommunicationService after commit; never call a live provider directly. Use a durable, fixed validation idempotency key; never replace it to bypass a failed/ambiguous run. Inspect that exact queue and require one intent for the authorized number and harmless body before starting it. No driver-link SMS belongs to this task.

For the selected no-webhook mode, outbound activation requires verified account/runtime configuration, a fresh authorized queue inventory, reviewed deployment and worker scope, and bounded send approval. An SMS delivery-report contract is not required for outbound submission. Automatic reconciliation remains deferred. These instructions are a prepared architecture, not evidence of deployed worker health; recheck the actual healthy revisions before selecting a rollback target.

Immediate SMS requires a queue worker, not a scheduler. Inventory alert scheduling is a separate existing application task. A later authoritative recovery schedule must preserve withoutOverlapping/onOneServer locking and the approved cutoff. Do not run the current unscoped drain as a production scheduler.

## Failed jobs and operator actions

After deploying the reviewed command, inspect with `php artisan communications:queue-inspect` and `php artisan communications:queue-inspect --failed`. These commands validate the DB target, read only, summarize class/queue/time/attempts, and suppress raw payloads and exceptions. Failed details are limited to 100 records with safe reason categories and internal UUIDs. The existing admin-only GET `/api/settings/communications/messages` shows durable communication outcomes even when provider failures are handled by the job and no failed_jobs row is created.

Retry only a specifically reviewed communication through the existing admin-only POST `/api/settings/communications/messages/{id}/retry`; its service guards reject unknown outcomes and accepted submissions. Never use broad `queue:retry`, `queue:retry all`, or bulk recovery of legacy failed SMS. Discard a conclusively reviewed failed queue record only with `php artisan queue:forget <exact-failed-job-uuid>` after confirming its communication is terminal and must not be retried. Preserve the communication/audit record. This task did not execute any retry or discard. Never use queue:flush, queue:clear, or a whole-table deletion.

## Static Taqnyat egress — 2026-10-05

`cae-ikram-prod` is a workload-profiles environment on `vnet-ikram-prod` subnet `snet-containerapps` (`10.20.0.0/23`). Standard NAT gateway `nat-ekram-prod-egress` is attached to that subnet and uses static public IP `20.196.4.138` (`pip-ekram-taqnyat-egress`). All EKRAM outbound calls to Taqnyat must originate from that static NAT IP. Inbound address `74.162.206.2` is unchanged. A container observed `20.196.4.138` and opened HTTPS to `api.taqnyat.sa` without sending SMS. Rollback is to remove the subnet NAT association; do not delete the public IP until outbound is confirmed on the previous path. StandardV2 is not used.

## Deferred delivery callback

This section does not gate outbound SMS. Callback processing stays disabled until a verified contract exists. Outbound activation follows the no-webhook sequence.

[Taqnyat's official SMS API reference](https://dev.taqnyat.sa/en/doc/sms/) and [official OpenAPI](https://github.com/taqnyat/OpenAPI/blob/main/sms/v1/openapi.yaml) document submission, balance, senders and scheduled deletion; they do not specify an SMS status lookup endpoint. [Official account instructions](https://portal.taqnyat.sa/technical_explanations/en/software_solutions/) confirm a delivery webhook configured with a URL and response confirmation phrase. They do not supply its request payload, status mapping, authentication/signature capability or replay identity. The response phrase is an acknowledgement, not proof of caller authentication. The JSON block under the SMS guide's Callback heading is a sender-list example (`senderName`, `status: active`, `destination`), not a delivery-report schema. Context7's Taqnyat Python library documents outbound send and account calls only.

The local route `POST /api/webhooks/taqnyat/sms` is reserved and fails closed. Other methods are not accepted. The provider has not documented that POST is the callback method. It is outside staff authentication, throttled, and size-limited. `TAQNYAT_SMS_WEBHOOK_ENABLED` defaults to false. Even when that switch is true, processing stays closed because no verified callback contract is bound. The handler does not return `EKRAM_WEBHOOK_RECEIVED`, does not set `delivered_at`, and does not resend. Intended public URL, after a later approved deployment and a live check: `https://systemben.ekramfb.org.sa/api/webhooks/taqnyat/sms`. That URL is not active. Nginx in `docker/nginx.conf` serves Laravel's public root, and Laravel prefixes `routes/api.php` with `/api`. `docs/deployment/azure-runtime.env.example` sets `APP_URL` to that host. This is routing evidence, not a live probe.

Do not reuse WhatsApp delivery schemas for SMS, guess a status endpoint, or implement an unauthenticated callback. Obtain the account-specific SMS DLR guide only when callback processing is resumed. Provider acceptance remains `acceptance_state=provider_accepted`, `delivery_state=unconfirmed`; delivered_at must only follow verified delivery evidence. The missing callback contract no longer blocks preparation of outbound sending under the 2026-10-05 no-webhook decision. It still blocks callback activation, and does not relax live-send or deployment approval requirements.

## Test safety

Default PHPUnit now bootstraps explicit process, server and environment overrides before Laravel starts: in-memory SQLite, fake communications, blank remote telemetry and an absent config cache. Tests\TestCase rejects unexpected resolved targets before RefreshDatabase can query or migrate. Separately configured guarded local PostgreSQL QA remains allowed by the target guard. The production local config cache is not removed or rewritten by tests.

An initial adversarial inherited-cache probe showed that XML env overrides alone still resolved the local cached Aiven configuration; DNS resolution failed before a DB connection. The new process bootstrap and resolved-target guard were then installed. Repeating the probe with inherited production/pgsql/cache settings passed the final focused suite entirely on isolated SQLite with mocked HTTP: 54 passed, 442 assertions. Full backend regression: 927 passed, 2 skipped, 4316 assertions (929 total). No frontend files were changed and no Chrome/Edge E2E tests were run.

The 2026-10-04 inventory is historical: the active Taqnyat revision was Healthy at 100%, and local queue isolation was not deployed. On 2026-10-05 one authorized submission was rejected by Taqnyat with HTTP 403 and no provider reference. The missing delivery-report contract does not block the no-webhook sequence. The next deployment and limited send still require explicit approval, after the token, sender `EKRAM-SA`, balance, and send permission are verified.
