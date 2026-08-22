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
        // 1. إنشاء مستخدم المدير الافتراضي يدوياً لضمان البيانات الصحيحة
        User::updateOrCreate(
            ['username' => 'admin'],
            [
                'id' => (string) Str::uuid(),
                'password' => Hash::make('admin123'),
                'full_name' => 'مدير النظام',
                'phone' => '0501234567',
                'role' => 'admin',
                'is_active' => true,
            ]
        );

        // 2. تشغيل باقي الـ Seeders
        $this->call([
            SettingSeeder::class,
            CategorySeeder::class,
            ComprehensiveTestDataSeeder::class,
        ]);
    }
}
