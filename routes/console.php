<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('notifications:inventory', function () {
    app(\App\Services\InventoryAlertService::class)->scan();
    $this->info('Inventory alerts evaluated.');
})->purpose('Persist deduplicated low-stock and expiry alerts');
\Illuminate\Support\Facades\Schedule::command('notifications:inventory')->hourly()->withoutOverlapping();
