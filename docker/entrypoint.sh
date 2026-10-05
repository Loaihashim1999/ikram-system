#!/bin/sh
set -eu

case "${APP_KEY:-}" in
    base64:*) ;;
    *)
        echo "A persistent APP_KEY must be configured before startup." >&2
        exit 1
        ;;
esac

if [ "${APP_ENV:-production}" = "production" ]; then
    if [ "$(php -r 'echo filter_var(getenv("APP_DEBUG") ?: "false", FILTER_VALIDATE_BOOLEAN) ? "true" : "false";')" = "true" ]; then
        echo "APP_DEBUG must be false in production." >&2
        exit 1
    fi

    if [ "${DB_CONNECTION:-pgsql}" != "pgsql" ]; then
        echo "DB_CONNECTION must be pgsql in production." >&2
        exit 1
    fi

    if [ "${CACHE_STORE:-database}" != "database" ] \
        || [ "${SESSION_DRIVER:-database}" != "database" ] \
        || [ "${QUEUE_CONNECTION:-database}" != "database" ]; then
        echo "Production cache, session and queue drivers must use the shared database." >&2
        exit 1
    fi

    if [ "${FILESYSTEM_DISK:-azure}" != "azure" ] \
        || [ "${PUBLIC_FILESYSTEM_DRIVER:-azure-storage-blob}" != "azure-storage-blob" ] \
        || [ "${PUBLIC_FILESYSTEM_VISIBILITY:-private}" != "private" ]; then
        echo "Production filesystems must use private Azure Blob storage, not public or ephemeral local disks." >&2
        exit 1
    fi

        if [ -n "${AZURE_STORAGE_CONNECTION_STRING:-}" ]; then
        echo "AZURE_STORAGE_CONNECTION_STRING must not be used in production. Use Managed Identity." >&2
        exit 1
    fi

    if [ -z "${AZURE_STORAGE_ACCOUNT_NAME:-}" ] \
        || [ -z "${AZURE_STORAGE_CONTAINER:-}" ] \
        || [ -z "${AZURE_CLIENT_ID:-}" ]; then
        echo "Azure Blob Managed Identity configuration is required in production." >&2
        exit 1
    fi
fi

exec "$@"
