#!/bin/sh

echo "Running Laravel Migrations & Optimizations..."
php /var/www/html/artisan migrate --force
php /var/www/html/artisan config:cache
php /var/www/html/artisan route:cache
php /var/www/html/artisan view:cache
echo "Laravel Initialization Completed Successfully!"
