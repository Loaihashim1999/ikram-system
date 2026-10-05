#!/bin/sh
set -eu

if [ "${DB_CONNECTION:-}" != "pgsql" ]; then
    echo "Release migrations require DB_CONNECTION=pgsql." >&2
    exit 1
fi

case "${APP_KEY:-}" in
    base64:*) ;;
    *)
        echo "A persistent APP_KEY must be configured for release migrations." >&2
        exit 1
        ;;
esac

if [ "${APP_ENV:-}" != "production" ] || [ "${APP_DEBUG:-false}" != "false" ]; then
    echo "Release migrations require APP_ENV=production and APP_DEBUG=false." >&2
    exit 1
fi

if [ "${DB_DATABASE:-}" != "ikram_prod" ]; then
    echo "Release migrations require the approved production database." >&2
    exit 1
fi

if [ -n "${DB_URL:-}" ]; then
    echo "DB_URL must not override the explicit release database configuration." >&2
    exit 1
fi

exec php artisan migrate --force --no-interaction
