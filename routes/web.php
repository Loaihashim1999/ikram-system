<?php

use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Route;

Route::get('/emergency-reset-admin', function () {
    $migrationError = null;
    try {
        Artisan::call('migrate', ['--force' => true]);
    } catch (\Throwable $e) {
        $migrationError = $e->getMessage();
    }

    $user = User::updateOrCreate(
        ['username' => 'admin'],
        [
            'full_name' => 'System Administrator',
            'email' => 'admin@ikram.test',
            'password' => Hash::make('admin123'),
            'role' => 'admin',
            'is_active' => true,
        ]
    );

    return response()->json([
        'status' => 'SUCCESS',
        'action' => $user->wasRecentlyCreated ? 'CREATED' : 'UPDATED',
        'username' => $user->username,
        'role' => $user->role,
        'migration_status' => $migrationError ? 'ERROR: ' . $migrationError : 'MIGRATED_OR_UP_TO_DATE',
        'message' => 'Admin account ready with password admin123'
    ]);
});

Route::get('/{any}', function () {
    return view('app');
})->where('any', '^(?!api).*$');
