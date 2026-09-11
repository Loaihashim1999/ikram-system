<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use App\Models\Beneficiary;
use App\Models\Organization;
use App\Models\User;

class TestDataSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        DB::transaction(function () {
            // 5 specific test accounts
            User::factory()->create([
                'email' => 'admin@example.com',
                'role' => 'admin',
                'password' => bcrypt('password'),
                'is_active' => true,
            ]);
            User::factory()->create([
                'email' => 'staff@example.com',
                'role' => 'staff',
                'password' => bcrypt('password'),
                'is_active' => true,
            ]);
            User::factory()->create([
                'email' => 'reception@example.com',
                'role' => 'reception',
                'password' => bcrypt('password'),
                'is_active' => true,
            ]);
            User::factory()->create([
                'email' => 'inactive@example.com',
                'role' => 'staff',
                'password' => bcrypt('password'),
                'is_active' => false,
            ]);
            User::factory()->create([
                'email' => 'readonly@example.com',
                'role' => 'readonly',
                'password' => bcrypt('password'),
                'is_active' => true,
            ]);

            // 50 Employees (staff role)
            User::factory()->state(['role' => 'staff'])->count(50)->create();

            // 50 Beneficiaries
            Beneficiary::factory()->count(50)->create();

            // 50 Organizations
            Organization::factory()->count(50)->create();
        });
    }
}
?>
