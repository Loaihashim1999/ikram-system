<?php

namespace Tests\Feature;

use App\Models\Basket;
use App\Models\Beneficiary;
use App\Models\Category;
use App\Models\DailyInventoryItem;
use App\Models\Distribution;
use App\Models\InventoryItem;
use App\Models\Notification;
use App\Models\Organization;
use App\Models\Staff;
use App\Models\User;
use App\Services\GovernanceReportService;
use App\Services\InventoryAlertService;
use App\Services\NotificationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use PhpOffice\PhpSpreadsheet\IOFactory;
use Tests\TestCase;

class SystemAuditTest extends TestCase
{
    use RefreshDatabase;

    private function account(string $role = 'admin', array $permissions = []): User
    {
        return User::create(['username' => 'TEST_'.Str::random(12), 'full_name' => 'TEST_ACCOUNT', 'password' => Str::random(40), 'role' => $role, 'permissions' => $permissions, 'is_active' => true]);
    }

    public function test_public_dangerous_routes_are_removed_and_reports_require_login(): void
    {
        $this->getJson('/api/fix-admin')->assertNotFound();
        $this->getJson('/api/seed-test-data')->assertNotFound();
        $this->getJson('/api/reports/comprehensive/pdf')->assertUnauthorized();
        $this->getJson('/api/reports/comprehensive/excel')->assertUnauthorized();
    }

    public function test_actual_roles_and_module_permissions_are_enforced(): void
    {
        foreach (['readonly', 'staff', 'warehouse', 'reception', 'assistant_admin'] as $role) {
            $user = $this->account($role, ['beneficiaries' => ['view' => true, 'create' => false]]);
            Sanctum::actingAs($user);
            $this->postJson('/api/users', [])->assertForbidden();
            $this->postJson('/api/beneficiaries', [])->assertForbidden();
            if ($role === 'warehouse') {
                $this->getJson('/api/beneficiaries')->assertForbidden();
            } else {
                $this->getJson('/api/beneficiaries')->assertOk();
            }
        }
    }

    public function test_disabled_account_cannot_reuse_token(): void
    {
        $user = $this->account();
        $user->update(['is_active' => false]);
        Sanctum::actingAs($user);
        $this->getJson('/api/me')->assertUnauthorized();
    }

    public function test_notifications_persist_deduplicate_and_are_recipient_scoped(): void
    {
        $first = $this->account();
        $second = $this->account();
        NotificationService::notifyAll('stock_changed', 'TEST_STOCK_EVENT');
        NotificationService::notifyAll('stock_changed', 'TEST_STOCK_EVENT');
        $this->assertSame(2, Notification::count());
        Sanctum::actingAs($first);
        $this->getJson('/api/notifications')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/notifications/unread-count')->assertJsonPath('unread_count', 1);
        $foreign = Notification::where('recipient_id', $second->id)->first();
        $this->postJson('/api/notifications/'.$foreign->id.'/mark-as-read')->assertNotFound();
        $this->postJson('/api/notifications/mark-all-read')->assertOk();
        $this->getJson('/api/notifications/unread-count')->assertJsonPath('unread_count', 0);
        $this->assertNull($foreign->fresh()->read_at);
    }

    public function test_real_beneficiary_event_completes_notification_lifecycle_and_respects_permissions(): void
    {
        $admin = $this->account();
        $reception = $this->account('reception', ['beneficiaries' => ['view' => true, 'notifications' => true]]);
        $warehouse = $this->account('warehouse', ['warehouse' => ['view' => true, 'notifications' => true]]);
        $blocked = $this->account('staff', ['beneficiaries' => ['view' => false, 'notifications' => true]]);
        $reception->update(['can_receive_notifications' => true]);
        $warehouse->update(['can_receive_notifications' => true]);
        $blocked->update(['can_receive_notifications' => true]);

        $beneficiary = Beneficiary::create([
            'full_name' => 'TEST_NOTIFICATION_BENEFICIARY', 'national_id' => '9666666666',
            'phone' => '0506666666', 'status' => 'active',
        ]);

        $this->assertDatabaseHas('notifications', [
            'recipient_id' => $admin->id, 'category' => 'system_event',
            'action_url' => '/beneficiaries/'.$beneficiary->id,
        ]);
        $this->assertDatabaseHas('notifications', ['recipient_id' => $reception->id]);
        $this->assertDatabaseMissing('notifications', ['recipient_id' => $warehouse->id]);
        $this->assertDatabaseMissing('notifications', ['recipient_id' => $blocked->id]);

        Sanctum::actingAs($reception);
        $notice = Notification::where('recipient_id', $reception->id)->firstOrFail();
        $this->getJson('/api/notifications')->assertOk()
            ->assertJsonPath('data.0.action_url', '/beneficiaries/'.$beneficiary->id)
            ->assertJsonPath('data.0.category', 'system_event');
        $this->getJson('/api/notifications/unread-count')->assertOk()->assertJsonPath('unread_count', 1);
        $this->postJson('/api/notifications/'.$notice->id.'/mark-as-read')->assertOk();
        $this->getJson('/api/notifications/unread-count')->assertJsonPath('unread_count', 0);
        $this->assertNotNull($notice->fresh()->read_at);

        $beneficiary->update(['district' => 'TEST_NOTIFICATION_UPDATED']);
        $this->assertSame(2, Notification::where('recipient_id', $reception->id)->count());
        $this->postJson('/api/notifications/mark-all-read')->assertOk();
        $this->assertSame(0, Notification::where('recipient_id', $reception->id)->whereNull('read_at')->count());
    }

    public function test_beneficiary_with_unclassified_priority_remains_searchable(): void
    {
        Sanctum::actingAs($this->account());
        $record = Beneficiary::create(['full_name' => 'TEST_UNCLASSIFIED', 'national_id' => '9000000099', 'phone' => '0500000000', 'priority' => null, 'is_employee' => false]);
        $this->assertNotNull($record->fresh());
        $this->getJson('/api/beneficiaries?search=TEST_UNCLASSIFIED&all=true')->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_report_filters_and_complete_fixture_dataset(): void
    {
        Sanctum::actingAs($this->account());
        $category = Category::create(['name' => 'TEST_CATEGORY']);
        for ($i = 1; $i <= 50; $i++) {
            Beneficiary::create(['full_name' => sprintf('TEST_BENEFICIARY_%03d', $i), 'national_id' => '9'.str_pad($i, 9, '0', STR_PAD_LEFT), 'phone' => '0500000000', 'category_id' => $category->id, 'beneficiary_type' => 'citizen', 'status' => 'active', 'district' => 'TEST_DISTRICT_'.($i % 5), 'monthly_salary' => 1500 + $i * 30, 'family_members_count' => 1 + $i % 7]);
            Staff::create(['job_title' => 'TEST_JOB', 'hire_date' => now()->toDateString(), 'name' => sprintf('TEST_EMPLOYEE_%03d', $i), 'national_id' => '8'.str_pad($i, 9, '0', STR_PAD_LEFT), 'phone' => '0500000000', 'status' => 'active']);
            Organization::create(['name' => sprintf('TEST_ORGANIZATION_%03d', $i), 'code' => 'TEST_ORG_'.$i, 'status' => 'active']);
        }
        $this->assertSame(50, Beneficiary::count());
        $this->assertSame(50, Staff::count());
        $this->assertSame(50, Organization::count());
        $date = now()->toDateString();
        $response = $this->getJson('/api/analytics?start_date='.$date.'&end_date='.$date)->assertOk();
        $response->assertJsonCount(1, 'charts.line_chart.data')->assertJsonPath('beneficiaries.registered_in_period', 50);
        $this->getJson('/api/analytics?start_date=bad')->assertUnprocessable();
        $this->getJson('/api/analytics?start_date=2026-09-10&end_date=2026-09-01')->assertUnprocessable();
        $this->getJson('/api/analytics?period_type=weekly&start_date='.$date.'&end_date='.$date.'&month=invalid&year=invalid&date=invalid')
            ->assertOk();
        $this->getJson('/api/analytics?period_type=monthly&month=9&year=2026&start_date=invalid&end_date=invalid')
            ->assertOk();
        $request = Request::create('/api/reports/comprehensive/pdf', 'GET', ['start_date' => $date, 'end_date' => $date]);
        $request->setUserResolver(fn () => auth()->user());
        $report = app(GovernanceReportService::class)->build($request);
        $this->assertCount(50, $report['datasets']['beneficiaries_snapshot']);
        $this->assertCount(50, $report['datasets']['organizations_snapshot']);
        // Diverse, explicitly synthetic database activity exercises actual chart calculations.
        $basket = Basket::create(['name' => 'TEST_FOOD_BASKET', 'stock_quantity' => 100]);
        $driver = $this->account('delivery_driver');
        foreach (Beneficiary::orderBy('national_id')->get() as $index => $person) {
            $registered = now()->subDays($index % 3 * 30 + 2);
            DB::table('beneficiaries')->where('id', $person->id)->update(['created_at' => $registered]);
            $person->update(['date_of_birth' => '1985-01-15', 'annual_rent_amount' => 12000, 'housing_type' => 'rent']);
            if ($index < 30) {
                Distribution::create([
                    'beneficiary_id' => $person->id, 'basket_id' => $basket->id, 'assigned_by' => auth()->id(), 'driver_id' => $driver->id,
                    'barcode_code' => 'TEST_QA_'.$index, 'scheduled_at' => $registered->copy()->addDay(),
                    'status' => $index % 4 === 0 ? 'scheduled' : 'delivered',
                    'delivered_at' => $index % 4 === 0 ? null : $registered->copy()->addDays(2),
                ]);
            }
        }
        InventoryItem::create(['name' => 'TEST_RICE', 'unit' => 'kg', 'current_quantity' => 5, 'min_threshold' => 10]);
        DailyInventoryItem::create(['name' => 'TEST_DAILY_BASKET', 'unit' => 'basket', 'current_quantity' => 8, 'min_threshold' => 10, 'expiry_date' => now()->addDays(3)]);
        app(InventoryAlertService::class)->scan();
        $inspectionStart = now()->subDays(90)->toDateString();
        $request->query->set('start_date', $inspectionStart);
        $inspectionReport = app(GovernanceReportService::class)->build($request);
        $this->assertSame(73.3, $inspectionReport['completion']);
        $this->assertSame(22, $inspectionReport['received_operations']);
        $this->assertSame(22, array_sum(array_column($inspectionReport['timeline'], 'receipts')));
        $this->assertCount(7, $inspectionReport['indicators']);
        $pdf = $this->get('/api/reports/comprehensive/pdf?start_date='.$inspectionStart.'&end_date='.$date)->assertOk();
        $this->assertStringStartsWith('%PDF', $pdf->getContent());
        if (! is_dir(storage_path('app/reports'))) {
            mkdir(storage_path('app/reports'), 0755, true);
        }
        file_put_contents(storage_path('app/reports/inspection-governance.pdf'), $pdf->getContent());
        $excel = $this->get('/api/reports/comprehensive/excel?start_date='.$inspectionStart.'&end_date='.$date)->assertOk();
        $bytes = $excel->streamedContent();
        $this->assertStringStartsWith('PK', $bytes);
        file_put_contents(storage_path('app/reports/inspection-governance.xlsx'), $bytes);
        $workbook = IOFactory::load(storage_path('app/reports/inspection-governance.xlsx'));
        $this->assertSame(51, $workbook->getSheetByName('beneficiaries_snapshot')->getHighestRow());
        $record = Beneficiary::first();
        $record->update(['district' => 'TEST_PERSISTENCE']);
        $this->assertSame('TEST_PERSISTENCE', $record->fresh()->district);
        $this->assertSame(50, Beneficiary::count());
    }
}
