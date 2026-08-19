#!/bin/sh

echo "Ensuring storage, logs, cache and database permissions..."
mkdir -p /var/www/html/storage/framework/views \
         /var/www/html/storage/framework/sessions \
         /var/www/html/storage/framework/cache \
         /var/www/html/storage/logs \
         /var/www/html/bootstrap/cache \
         /var/www/html/database

touch /var/www/html/storage/logs/laravel.log
touch /var/www/html/database/database.sqlite

chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache /var/www/html/database
chmod -R 777 /var/www/html/storage /var/www/html/bootstrap/cache /var/www/html/database

echo "Checking Application Key..."
case "$APP_KEY" in
  base64:*) echo "APP_KEY is set correctly." ;;
  *)
    echo "Generating new Laravel APP_KEY..."
    php /var/www/html/artisan key:generate --force
    ;;
esac

echo "Running Laravel Migrations & Seeders..."
php /var/www/html/artisan migrate --force || true
php /var/www/html/artisan db:seed --force || true

echo "Clearing Caches..."
php /var/www/html/artisan config:clear || true
php /var/www/html/artisan route:clear || true
php /var/www/html/artisan storage:link || true

# Final permission check
chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache /var/www/html/database
chmod -R 777 /var/www/html/storage /var/www/html/bootstrap/cache /var/www/html/database

echo "Laravel Initialization Completed Successfully!"
