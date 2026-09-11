<?php

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Route;

Route::get('/emergency-reset-admin', function (Request $request) {
    // Require secret query parameter token to prevent unauthorized access
    if ($request->query('token') !== 'ikram_secure_2026') {
        return response()->json([
            'error' => 'Unauthorized access. Valid token parameter required.'
        ], 403);
    }

    $migrationError = null;
    try {
        Artisan::call('migrate', ['--force' => true]);
    } catch (\Throwable $e) {
        $migrationError = $e->getMessage();
    }

    $rolesConfig = [
        [
            'username' => 'admin',
            'full_name' => 'مدير النظام (Admin)',
            'email' => 'admin@ikram.test',
            'role' => 'admin',
            'can_receive_notifications' => true,
        ],
        [
            'username' => 'reception',
            'full_name' => 'موظف الاستقبال (Reception)',
            'email' => 'reception@ikram.test',
            'role' => 'reception',
            'can_receive_notifications' => true,
        ],
        [
            'username' => 'staff',
            'full_name' => 'موظف العمليات (Staff)',
            'email' => 'staff@ikram.test',
            'role' => 'staff',
            'can_receive_notifications' => false,
        ],
        [
            'username' => 'warehouse',
            'full_name' => 'أمين المستودع (Warehouse)',
            'email' => 'warehouse@ikram.test',
            'role' => 'warehouse',
            'can_receive_notifications' => false,
        ],
        [
            'username' => 'readonly',
            'full_name' => 'مدقق حسابات (Readonly)',
            'email' => 'readonly@ikram.test',
            'role' => 'readonly',
            'can_receive_notifications' => false,
        ],
    ];

    $results = [];
    foreach ($rolesConfig as $conf) {
        $user = User::updateOrCreate(
            ['username' => $conf['username']],
            [
                'full_name' => $conf['full_name'],
                'email' => $conf['email'],
                'password' => Hash::make('admin123'),
                'role' => $conf['role'],
                'is_active' => true,
                'can_receive_notifications' => $conf['can_receive_notifications'],
                'permissions' => [
                    'can_receive_notifications' => $conf['can_receive_notifications'],
                    'role' => $conf['role'],
                ],
            ]
        );

        $results[] = [
            'username' => $user->username,
            'role' => $user->role,
            'can_receive_notifications' => $user->canReceiveNotifications(),
            'action' => $user->wasRecentlyCreated ? 'CREATED' : 'UPDATED',
        ];
    }

    return response()->json([
        'status' => 'SUCCESS',
        'migration_status' => $migrationError ? 'ERROR: ' . $migrationError : 'MIGRATED_OR_UP_TO_DATE',
        'message' => 'All 5 roles seeded with password admin123',
        'users' => $results,
    ]);
});

Route::get('/{any}', function () {
    return view('app');
})->where('any', '^(?!api).*$');
