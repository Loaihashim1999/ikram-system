#!/bin/sh

echo "Ensuring storage and cache directories exist..."
mkdir -p /var/www/html/storage/framework/views \
         /var/www/html/storage/framework/sessions \
         /var/www/html/storage/framework/cache \
         /var/www/html/storage/logs \
         /var/www/html/bootstrap/cache

chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache
chmod -R 777 /var/www/html/storage /var/www/html/bootstrap/cache

echo "Running Laravel Migrations & Optimizations..."
if [ -z "$APP_KEY" ]; then
    echo "Generating Application Key..."
    php /var/www/html/artisan key:generate --force
fi

php /var/www/html/artisan storage:link || true
php /var/www/html/artisan migrate --force || true
php /var/www/html/artisan config:cache || true
php /var/www/html/artisan route:cache || true
php /var/www/html/artisan view:cache || true

echo "Laravel Initialization Completed Successfully!"
