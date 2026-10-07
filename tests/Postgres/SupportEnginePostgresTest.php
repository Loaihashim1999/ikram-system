<?php

namespace Tests\Postgres;

use App\Models\Basket;
use App\Models\Beneficiary;
use App\Models\InventoryItem;
use App\Models\Organization;
use App\Models\PickupLocation;
use App\Models\Staff;
use App\Models\User;
use App\Services\SupportDistributionService;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Feature\SupportEngineTest;

class SupportEnginePostgresTest extends SupportEngineTest
{
    public function createApplication()
    {
        $app = require dirname(__DIR__, 2).'/bootstrap/app.php';
        $app->loadEnvironmentFrom('.env.phase2a.pgqa');
        $this->traitsUsedByTest = class_uses_recursive(static::class);
        $app->make(Kernel::class)->bootstrap();
        // Runs before RefreshDatabase can issue migrate:fresh.
        verifyPhase2aTarget();

        return $app;
    }

    private function makeSupport(): string
    {
        return app(SupportDistributionService::class)->create([
            'recipient_type' => 'organization', 'organization_id' => Organization::firstOrFail()->id,
            'fulfillment_method' => 'pickup', 'pickup_location_id' => PickupLocation::firstOrFail()->id,
            'items' => [['inventory_item_id' => InventoryItem::firstOrFail()->id, 'requested_quantity' => '2.50']],
        ], User::firstOrFail()->id)->id;
    }

    private function rejectedByDatabase(callable $operation, string $state): void
    {
        try {
            DB::transaction($operation);
            $this->fail('Database accepted invalid operation');
        } catch (QueryException $e) {
            $this->assertSame($state, $e->errorInfo[0]);
        }
    }

    public function test_database_uuid_defaults(): void
    {
        $uuid = DB::table('pickup_locations')->insertGetId(['name' => 'TEST database UUID']);
        $this->assertTrue(Str::isUuid($uuid));
        $this->assertTrue(Str::isUuid(DB::selectOne('SELECT gen_random_uuid() AS id')->id));
    }

    public function test_recipient_check_bypassing_application_validation(): void
    {
        $id = $this->makeSupport();
        foreach ([['organization_id' => null], ['recipient_type' => 'staff'], ['recipient_type' => 'unknown']] as $bad) {
            $this->rejectedByDatabase(fn () => DB::table('support_distributions')->where('id', $id)->update($bad), '23514');
        }
        $staff = Staff::create(['name' => 'TEST mixed', 'national_id' => '3333333333', 'phone' => '0501111111', 'job_title' => 'TEST', 'hire_date' => '2026-01-01']);
        $this->rejectedByDatabase(fn () => DB::table('support_distributions')->where('id', $id)->update(['staff_id' => $staff->id]), '23514');
    }

    public static function invalidDatabaseQuantities(): array
    {
        return [[['requested_quantity' => 0]], [['reserved_quantity' => -1]], [['fulfilled_quantity' => -1]], [['reserved_quantity' => 3]], [['fulfilled_quantity' => 3]]];
    }

    #[DataProvider('invalidDatabaseQuantities')]
    public function test_support_line_checks(array $bad): void
    {
        $id = $this->makeSupport();
        $this->rejectedByDatabase(fn () => DB::table('support_distribution_items')->where('support_distribution_id', $id)->update($bad), '23514');
    }

    public function test_database_inventory_invariants(): void
    {
        $stock = InventoryItem::firstOrFail();
        foreach ([['current_quantity' => -1], ['reserved_quantity' => -1], ['reserved_quantity' => 501]] as $bad) {
            $this->rejectedByDatabase(fn () => DB::table('inventory_items')->where('id', $stock->id)->update($bad), '23514');
        }
        $this->assertSame('500.00', $stock->fresh()->current_quantity);
    }

    public function test_database_delete_protection_and_item_uniqueness(): void
    {
        $id = $this->makeSupport();
        $this->rejectedByDatabase(fn () => InventoryItem::firstOrFail()->delete(), '23503');
        $this->rejectedByDatabase(fn () => Organization::firstOrFail()->delete(), '23503');
        $this->rejectedByDatabase(fn () => PickupLocation::firstOrFail()->delete(), '23503');
        $item = (array) DB::table('support_distribution_items')->where('support_distribution_id', $id)->first();
        $item['id'] = (string) Str::uuid();
        $this->rejectedByDatabase(fn () => DB::table('support_distribution_items')->insert($item), '23505');
    }

    public function test_all_five_legacy_foreign_keys_restrict_deletion(): void
    {
        $beneficiary = Beneficiary::create(['full_name' => 'TEST legacy', 'national_id' => '4444444444', 'phone' => '0501111111', 'beneficiary_type' => 'citizen']);
        $rep = DB::table('neighborhood_reps')->insertGetId(['full_name' => 'TEST rep', 'phone' => '0501111111', 'district_name' => 'TEST']);
        foreach ([['distributions', 'beneficiary_id', 'beneficiaries', $beneficiary->id], ['distributions', 'basket_id', 'baskets', null],
            ['rep_distributions', 'rep_id', 'neighborhood_reps', $rep], ['rep_distributions', 'basket_id', 'baskets', null],
            ['staff_distributions', 'basket_id', 'baskets', null]] as [$table, $column, $parent, $parentId]) {
            $basket = Basket::create(['name' => 'TEST legacy basket', 'stock_quantity' => 10]);
            $row = ['basket_id' => $basket->id, 'scheduled_at' => now(), 'barcode_code' => (string) Str::uuid()];
            if ($table === 'distributions') {
                $row['beneficiary_id'] = $beneficiary->id;
            }
            if ($table === 'rep_distributions') {
                $row['rep_id'] = $rep;
            }
            $id = DB::table($table)->insertGetId($row);
            $constraint = DB::selectOne('SELECT confdeltype FROM pg_constraint WHERE conrelid = to_regclass(?) AND conname = ?', [$table, $table.'_'.$column.'_foreign']);
            $this->assertSame('r', $constraint->confdeltype);
            $this->rejectedByDatabase(fn () => DB::table($parent)->where('id', $parentId ?? $basket->id)->delete(), '23503');
            $this->assertDatabaseHas($table, ['id' => $id]);
        }
    }
}
