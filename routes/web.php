<?php

use App\Http\Controllers\HealthController;
use Illuminate\Support\Facades\Route;

// Email reset-link route (password.reset) retired: password recovery now uses
// a 6-digit SMS OTP. The catch-all below still serves the SPA for any legacy link.
Route::get('/health', [HealthController::class, 'live'])->withoutMiddleware('web');
Route::get('/readiness', [HealthController::class, 'ready'])->withoutMiddleware('web');

Route::get('/{any}', function () {
    return view('app');
})->where('any', '^(?!api|storage(?:/|$)).*$');
