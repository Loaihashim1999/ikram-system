<?php

namespace Tests\Feature;

use App\Models\Basket;
use App\Models\Staff;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class StaffSalaryAndDistributionTest extends TestCase
{
    use RefreshDatabase;

    public function test_staff_salary_persists_through_create_read_update_and_staff_dispatch(): void
    {
        $admin = User::create([
            'username' => 'TEST_STAFF_ADMIN_'.Str::random(8),
            'full_name' => 'TEST STAFF ADMIN',
            'password' => Str::random(40),
            'role' => 'admin',
            'is_active' => true,
        ]);
        Sanctum::actingAs($admin);

        $created = $this->postJson('/api/staff', [
            'name' => 'TEST STAFF SALARY',
            'national_id' => '9888888888',
            'phone' => '0508888888',
            'job_title' => 'أخصائي خدمات',
            'department' => 'خدمات المستفيدين',
            'hire_date' => '2026-09-01',
            'salary' => 5400,
            'status' => 'active',
        ])->assertCreated();

        $staffId = $created->json('data.id');
        $this->assertDatabaseHas('staff', ['id' => $staffId, 'salary' => 5400]);
        $this->getJson('/api/staff/'.$staffId)->assertOk()->assertJsonPath('data.salary', '5400.00');

        $this->putJson('/api/staff/'.$staffId, [
            'name' => 'TEST STAFF SALARY',
            'national_id' => '9888888888',
            'phone' => '0508888888',
            'job_title' => 'أخصائي خدمات',
            'department' => 'خدمات المستفيدين',
            'hire_date' => '2026-09-01',
            'salary' => 6200,
            'status' => 'active',
        ])->assertOk()->assertJsonPath('data.salary', '6200.00');

        $basket = Basket::create(['name' => 'TEST STAFF BASKET', 'stock_quantity' => 2]);
        $dispatch = $this->postJson('/api/distributions', [
            'staff_ids' => [$staffId],
            'basket_id' => $basket->id,
            'scheduled_at' => '2026-09-16 09:00:00',
            'pickup_location' => 'مقر الاختبار',
        ])->assertCreated();

        $distributionId = $dispatch->json('distributions.0.id');
        $this->assertNotEmpty($distributionId);
        $this->assertDatabaseHas('staff_distributions', [
            'id' => $distributionId,
            'staff_id' => $staffId,
            'basket_id' => $basket->id,
            'status' => 'scheduled',
        ]);
        $this->assertSame(1, $basket->fresh()->stock_quantity);
        $this->assertSame('6200.00', Staff::findOrFail($staffId)->salary);
    }
}
