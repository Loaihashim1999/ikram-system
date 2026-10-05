# Azure production environment contract

All values below are examples/placeholders, not credentials. Configure runtime values using Azure Key Vault and/or protected Container Apps secrets/config. Do not store a production `.env` in Git or bake values into an image.

| Variable | Example shape | Classification | Required |
|---|---|---|---|
| `APP_NAME` | `IKRAM` | NON_SECRET | Yes |
| `APP_ENV` | `production` | NON_SECRET | Yes |
| `APP_DEBUG` | `false` | NON_SECRET | Yes |
| `APP_URL` | `https://<production-host>` | NON_SECRET | Yes |
| `APP_KEY` | `<persistent-base64-key-from-secure-generation>` | SECRET | Yes; generate once outside this workflow and retain |
| `IKRAM_ADMIN_PASSWORD` | `<one-time-bootstrap-password>` | SECRET | Optional; only for the initial admin bootstrap |
| `IKRAM_ADMIN_USERNAME` | `<initial-admin-username>` | NON_SECRET | Required only when the bootstrap password is set |
| `IKRAM_ADMIN_EMAIL` | `<initial-admin-email>` | NON_SECRET | Optional |
| `IKRAM_ADMIN_FULL_NAME` | `<initial-admin-name>` | NON_SECRET | Optional |
| `LOG_CHANNEL` | `stderr` | NON_SECRET | Yes |
| `LOG_LEVEL` | `info` | NON_SECRET | Yes |
| `DB_CONNECTION` | `pgsql` | NON_SECRET | Yes |
| `DB_HOST` | `<azure-postgresql-fqdn>` | NON_SECRET | Yes |
| `DB_PORT` | `5432` | NON_SECRET | Yes |
| `DB_DATABASE` | `<production-database>` | NON_SECRET | Yes |
| `DB_USERNAME` | `<least-privilege-runtime-user>` | NON_SECRET | Yes |
| `DB_PASSWORD` | `<injected-secret>` | SECRET | Yes |
| `DB_SSLMODE` | `verify-full` | NON_SECRET | Yes |
| `DB_SSLROOTCERT` | `<mounted-path-to-azure-ca-bundle>` | NON_SECRET | Yes |
| `CACHE_STORE` | `database` | NON_SECRET | Yes |
| `SESSION_DRIVER` | `database` | NON_SECRET | Yes |
| `SESSION_SECURE_COOKIE` | `true` | NON_SECRET | Yes |
| `SESSION_SAME_SITE` | `lax` | NON_SECRET | Yes |
| `QUEUE_CONNECTION` | `database` | NON_SECRET | Yes |
| `COMMUNICATION_QUEUE` | `ekram-communications-v2` | NON_SECRET | Required for reviewed new-message worker scope; never consume the legacy `default` queue |
| `DB_QUEUE_RETRY_AFTER` | `90` (greater than worker timeout) | NON_SECRET | Yes |
| `FILESYSTEM_DISK` | `azure` for production-persistent file operations | NON_SECRET | Yes |
| `PUBLIC_FILESYSTEM_DRIVER` | `azure-storage-blob` for persistent upload paths | NON_SECRET | Yes; private authenticated download endpoints are implemented, but production use still requires a private container and data migration validation |
| `PUBLIC_FILESYSTEM_VISIBILITY` | `private` | NON_SECRET | Yes; production rejects public Blob visibility |
| `AZURE_STORAGE_ACCOUNT_NAME` | `<storage-account-name>` | NON_SECRET | Yes for production Blob storage |
| `AZURE_STORAGE_CONTAINER` | `<private-container-name>` | NON_SECRET | Yes for the configured production Blob driver |
| `AZURE_CLIENT_ID` | `<user-assigned-managed-identity-client-id>` | NON_SECRET | Yes; identifies the User Assigned Managed Identity used for Blob access |
| `PUBLIC_FILESYSTEM_URL` | `<approved-download-origin>` | NON_SECRET | Optional; never point sensitive files at a public URL |
| `CORS_ALLOWED_ORIGINS` | `https://<production-host>` | NON_SECRET | Yes; comma-separated explicit origins |
| `TRUSTED_PROXIES` | `<trusted-ingress-CIDR[,CIDR...]>` | NON_SECRET | Yes when forwarded headers are used |
| `COMMUNICATION_PROVIDER` | `fake` until separately authorized | NON_SECRET | Yes |
| `TAQNYAT_SMS_TOKEN` | `<Key-Vault-secret-reference>` | SECRET | Optional; only after live SMS activation approval |
| `TAQNYAT_SMS_SENDER` | `<approved-sender-id>` | NON_SECRET | Optional; only after provider approval |
| `TAQNYAT_API_BASE_URL` | `https://api.taqnyat.sa/` | NON_SECRET | Optional; required when Taqnyat is activated. All production outbound calls to this host must leave through NAT gateway `nat-ekram-prod-egress` and static IP `20.196.4.138` (`pip-ekram-taqnyat-egress`) |
| `TAQNYAT_CONNECT_TIMEOUT` | `5` | NON_SECRET | Optional |
| `TAQNYAT_TIMEOUT` | `10` | NON_SECRET | Optional |
| `TAQNYAT_SMS_WEBHOOK_ENABLED` | `false` | NON_SECRET | Leave false for the selected no-webhook SMS mode; callback configuration is not required for outbound sending |
| `TAQNYAT_SMS_WEBHOOK_ACK` | `EKRAM_WEBHOOK_RECEIVED` | NON_SECRET | Optional; portal response phrase only. Never use it as a token or signature |
| `SENTRY_LARAVEL_DSN` | `<Key-Vault-secret-reference>` | SECRET | Optional |
| `SENTRY_DSN` | `<Key-Vault-secret-reference>` | SECRET | Optional; never expose a private DSN in the browser bundle |

## Azure Blob authentication

Production Blob authentication uses the User Assigned Managed Identity. Configure `FILESYSTEM_DISK=azure`, `PUBLIC_FILESYSTEM_DRIVER=azure-storage-blob`, and `PUBLIC_FILESYSTEM_VISIBILITY=private`, together with `AZURE_STORAGE_ACCOUNT_NAME`, `AZURE_STORAGE_CONTAINER`, and `AZURE_CLIENT_ID`.

`AZURE_STORAGE_CONNECTION_STRING` and Storage Account keys are prohibited in production. Public Blob visibility is also prohibited. The connection-string variable may appear only in negative/rejection tests; it must not be present in active runtime configuration.

The production APP_KEY is persistent: replacing it after production data exists can invalidate encrypted values and protected cookies. Never run `key:generate` on application startup or during a normal deployment.

The initial shared-state recommendation is PostgreSQL-backed cache/session/queue. If load later requires managed Redis, classify its endpoint as NON_SECRET and password/TLS credentials as SECRET, then verify distributed scheduler locks and queue retry behavior before cutover.

The production download path authenticates the caller, checks the applicable module's view permission, resolves only a known database document field/record, and issues a read-only Blob SAS that expires after five minutes. The SPA obtains the SAS via the authenticated API before opening it. Verify the Azure container itself is private and plan a verified migration/reconciliation for any existing objects or URLs. Never fall back to public or ephemeral container storage for business records.

There are no `TAQNYAT_WHATSAPP_TOKEN` or `TAQNYAT_WHATSAPP_BASE_URL` settings: WhatsApp runtime is retired.

## Runtime secrets inventory

Store `APP_KEY`, `DB_PASSWORD`, Taqnyat/API tokens, Sentry DSNs, and any future provider keys in Key Vault or equivalent protected runtime secret storage. Blob access uses the User Assigned Managed Identity; do not configure a storage connection string, Storage Account key, or SAS credential. Keep account identifiers, hosts, database names, origins, ports, and container names in non-secret configuration.

The example `APP_KEY` used by automated tests is disposable and unrelated to production. This contract contains no production credential or Azure identifier.
