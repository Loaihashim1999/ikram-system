FROM node:22-alpine AS frontend-build

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM php:8.3-fpm-alpine AS php-extensions

RUN apk add --no-cache --virtual .php-build-deps \
        $PHPIZE_DEPS \
        postgresql-dev \
        libzip-dev \
        libpng-dev \
        libjpeg-turbo-dev \
        freetype-dev \
        icu-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j"$(nproc)" pdo pdo_pgsql pgsql zip gd bcmath intl opcache pcntl

FROM php:8.3-fpm-alpine AS libxml-security-build

RUN apk add --no-cache build-base binutils curl patch perl libxml2-dev xz-dev zlib-dev
COPY docker/security/ /security/
RUN sh /security/build-libxml-backport.sh

FROM php-extensions AS composer-deps

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
WORKDIR /app
COPY composer.json composer.lock ./
COPY app/ app/
COPY database/factories/ database/factories/
COPY database/seeders/ database/seeders/
RUN composer install \
    --no-dev \
    --no-interaction \
    --prefer-dist \
    --optimize-autoloader \
    --no-scripts

FROM php:8.3-fpm-alpine AS runtime

RUN apk upgrade --no-cache \
    && apk add --no-cache \
        ca-certificates \
        nginx \
        supervisor \
        postgresql-libs \
        libzip \
        libpng \
        libjpeg-turbo \
        freetype \
        icu-libs \
    && mkdir -p \
        /var/lib/nginx/tmp/client_body \
        /var/lib/nginx/tmp/fastcgi \
        /var/lib/nginx/tmp/proxy \
        /var/lib/nginx/tmp/scgi \
        /var/lib/nginx/tmp/uwsgi \
        /var/log/nginx \
        /var/www/html/storage/app/mpdf \
        /var/www/html/storage/app/private \
        /var/www/html/storage/app/public \
        /var/www/html/storage/framework/cache/data \
        /var/www/html/storage/framework/sessions \
        /var/www/html/storage/framework/views \
        /var/www/html/storage/logs \
        /var/www/html/bootstrap/cache \
    && chown -R www-data:www-data \
        /var/lib/nginx \
        /var/log/nginx \
        /var/www/html/storage \
        /var/www/html/bootstrap/cache \
    && chmod -R u=rwX,g=rX,o= \
        /var/www/html/storage \
        /var/www/html/bootstrap/cache

# Retain libxml2.so.2 ABI and Alpine security patches; fail closed on an unreviewed base.
RUN apk list --installed libxml2 | grep -q '^libxml2-2.13.9-r2 '
COPY --from=libxml-security-build /out/usr/lib/libxml2.so.2.13.9 /usr/lib/libxml2.so.2.13.9
COPY --from=libxml-security-build /out/usr/share/ikram-security/ /usr/share/ikram-security/

COPY --from=php-extensions /usr/local/lib/php/extensions/ /usr/local/lib/php/extensions/
COPY --from=php-extensions /usr/local/etc/php/conf.d/ /usr/local/etc/php/conf.d/

WORKDIR /var/www/html
COPY app/ app/
COPY bootstrap/ bootstrap/
COPY config/ config/
COPY database/migrations/ database/migrations/
COPY public/ public/
COPY resources/ resources/
COPY routes/ routes/
COPY artisan composer.json ./
COPY --from=composer-deps /app/vendor/ vendor/
COPY --from=frontend-build /app/public/ public/
COPY public/assets/pdf-letterhead-header.jpg public/assets/pdf-letterhead-header.jpg
COPY public/assets/pdf-letterhead-footer.jpg public/assets/pdf-letterhead-footer.jpg

COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/security-headers.conf /etc/nginx/security-headers.conf
COPY docker/php-production.ini /usr/local/etc/php/conf.d/zz-production.ini
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY docker/php-fpm-app.conf /usr/local/etc/php-fpm.d/zz-app.conf
COPY docker/entrypoint.sh /usr/local/bin/ikram-entrypoint
COPY docker/migrate.sh /usr/local/bin/ikram-migrate

RUN ! grep -q "$(printf '\r')" /usr/local/bin/ikram-entrypoint /usr/local/bin/ikram-migrate \
    && sh -n /usr/local/bin/ikram-entrypoint \
    && sh -n /usr/local/bin/ikram-migrate \
    && php artisan package:discover --ansi \
    && php artisan storage:link \
    && chown -R root:root /var/www/html \
    && chown -R www-data:www-data storage bootstrap/cache \
    && chmod -R u=rwX,g=rX,o= storage bootstrap/cache \
    && chmod 0555 /usr/local/bin/ikram-entrypoint /usr/local/bin/ikram-migrate

USER www-data

EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/ikram-entrypoint"]
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
