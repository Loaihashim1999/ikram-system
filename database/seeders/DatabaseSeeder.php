<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // 1. إنشاء الحسابات الأساسية لجميع الأدوار لضمان توفرها دائمًا
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

        foreach ($rolesConfig as $conf) {
            User::updateOrCreate(
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
        }

        // 2. تشغيل باقي الـ Seeders
        $this->call([
            SettingSeeder::class,
            CategorySeeder::class,
            ComprehensiveTestDataSeeder::class,
        ]);
    }
}
