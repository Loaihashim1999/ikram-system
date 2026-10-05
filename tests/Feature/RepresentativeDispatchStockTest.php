<?php

namespace Tests\Feature;

use App\Contracts\Communications\EmailProviderInterface;
use App\Contracts\Communications\SmsProviderInterface;
use App\Models\Basket;
use App\Models\InventoryItem;
use App\Models\NeighborhoodRep;
use App\Models\RepDistribution;
use App\Services\Communications\FakeEmailProvider;
use App\Services\Communications\FakeSmsProvider;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\PolicyEScenario as Scenario;
use Tests\TestCase;

class RepresentativeDispatchStockTest extends TestCase
{
    use RefreshDatabase;

    protected function databaseDriver(): string
    {
        return 'sqlite';
    }

    public static function insufficientStockRoles(): array
    {
        return ['admin' => ['admin'], 'assistant_admin' => ['assistant_admin'], 'staff' => ['staff']];
    }

    public static function deniedRoles(): array
    {
        return ['reception' => ['reception'], 'warehouse' => ['warehouse'], 'readonly' => ['readonly'], 'driver' => ['driver'], 'delivery_driver' => ['delivery_driver']];
    }

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame($this->databaseDriver(), DB::connection()->getPdo()->getAttribute(\PDO::ATTR_DRIVER_NAME));
        if ($this->databaseDriver() === 'sqlite') {
            $this->assertSame(':memory:', config('database.connections.sqlite.database'));
        }
        Http::preventStrayRequests();
        Mail::fake();
        Queue::fake();
        $this->assertInstanceOf(FakeSmsProvider::class, app(SmsProviderInterface::class));
        $this->assertInstanceOf(FakeEmailProvider::class, app(EmailProviderInterface::class));
    }

    private function fixture(string $role = 'admin', int $stock = 10, int $required = 2): array
    {
        $actor = Scenario::actor([], $role);
        $actor->update(['permissions' => ['representatives' => ['view' => true, 'edit' => true]]]);
        Sanctum::actingAs($actor->fresh());

        $representative = NeighborhoodRep::create([
            'full_name' => 'IKR009 SYNTHETIC REP',
            'phone' => '0500000091',
            'district_name' => 'IKR009 DISTRICT',
            'city' => 'IKR009 CITY',
            'status' => 'active',
            'beneficiaries_count' => $required,
        ]);
        $basket = Basket::create([
            'name' => 'IKR009 SYNTHETIC BASKET A',
            'stock_quantity' => $stock,
            'low_stock_threshold' => 1,
        ]);
        $otherBasket = Basket::create([
            'name' => 'IKR009 SYNTHETIC BASKET B',
            'stock_quantity' => 17,
            'low_stock_threshold' => 1,
        ]);
        $otherItem = InventoryItem::create([
            'name' => 'IKR009 UNRELATED ITEM B',
            'unit' => 'box',
            'current_quantity' => '8.00',
            'reserved_quantity' => '2.00',
            'min_threshold' => '1.00',
        ]);
        $driver = Scenario::actor([], 'driver');

        return compact('actor', 'representative', 'basket', 'otherBasket', 'otherItem', 'driver');
    }

    private function snapshot(): array
    {
        $snapshot = [];
        foreach (['baskets', 'rep_distributions', 'inventory_items', 'inventory_movements', 'neighborhood_reps', 'audit_logs'] as $table) {
            $snapshot[$table] = hash('sha256', json_encode(DB::table($table)->orderBy('id')->get(), JSON_THROW_ON_ERROR));
        }

        return $snapshot;
    }

    private function dispatch(array $f)
    {
        return $this->postJson('/api/neighborhood-reps/'.$f['representative']->id.'/dispatch', [
            'basket_id' => $f['basket']->id,
            'scheduled_date' => '2026-10-04',
            'driver_id' => $f['driver']->id,
        ]);
    }

    #[DataProvider('insufficientStockRoles')]
    public function test_insufficient_basket_stock_is_rejected_without_any_mutation(string $role): void
    {
        $f = $this->fixture($role, stock: 1, required: 2);
        $this->assertSame($role, $f['actor']->role);
        $this->assertTrue($f['actor']->fresh()->permissions['representatives']['view']);
        $this->assertTrue($f['actor']->fresh()->permissions['representatives']['edit']);
        $this->assertNull(InventoryItem::find($f['basket']->id), 'This fixture exercises the legacy Basket-only stock path.');
        $before = $this->snapshot();

        $this->dispatch($f)->assertUnprocessable()->assertJsonValidationErrors('basket_id');

        $this->assertSame($before, $this->snapshot());
        $this->assertSame(1, $f['basket']->fresh()->stock_quantity);
        $this->assertSame(17, $f['otherBasket']->fresh()->stock_quantity);
        $this->assertSame('8.00', $f['otherItem']->fresh()->current_quantity);
        $this->assertDatabaseCount('rep_distributions', 0);
        $this->assertDatabaseCount('inventory_movements', 0);
        $this->assertSame('active', $f['representative']->fresh()->status);
    }

    public function test_exact_stock_succeeds_and_consumes_only_the_selected_basket(): void
    {
        $f = $this->fixture('admin', stock: 2, required: 2);
        $response = $this->dispatch($f)->assertOk()->assertJson(['success' => true]);
        $distribution = RepDistribution::findOrFail($response->json('data.id'));

        $this->assertSame($f['representative']->id, $distribution->rep_id);
        $this->assertSame($f['basket']->id, $distribution->basket_id);
        $this->assertSame($f['driver']->id, $distribution->driver_id);
        $this->assertSame(2, $distribution->basket_count);
        $this->assertSame(2, $distribution->target_beneficiaries_count);
        $this->assertSame('scheduled', $distribution->status);
        $this->assertSame('2026-10-04', $distribution->scheduled_at->format('Y-m-d'));
        $this->assertSame(0, $f['basket']->fresh()->stock_quantity);
        $this->assertSame(17, $f['otherBasket']->fresh()->stock_quantity);
        $this->assertSame('8.00', $f['otherItem']->fresh()->current_quantity);
        $this->assertSame(1, RepDistribution::count());
        // Basket-only stock has no InventoryItem ledger target; no movement is applicable.
        $this->assertDatabaseCount('inventory_movements', 0);
        $this->assertSame('active', $f['representative']->fresh()->status);
    }

    public function test_more_than_enough_stock_is_decremented_by_exact_required_quantity(): void
    {
        $f = $this->fixture('assistant_admin', stock: 5, required: 2);
        $response = $this->dispatch($f)->assertOk();

        $this->assertSame($f['representative']->id, RepDistribution::findOrFail($response->json('data.id'))->rep_id);
        $this->assertSame(3, $f['basket']->fresh()->stock_quantity);
        $this->assertSame(17, $f['otherBasket']->fresh()->stock_quantity);
        $this->assertSame('8.00', $f['otherItem']->fresh()->current_quantity);
        $this->assertSame(1, RepDistribution::count());
        $this->assertDatabaseCount('inventory_movements', 0);
    }

    public function test_zero_stock_is_rejected_without_distribution_or_ledger_effect(): void
    {
        $f = $this->fixture('staff', stock: 0, required: 2);
        $before = $this->snapshot();

        $this->dispatch($f)->assertUnprocessable()->assertJsonValidationErrors('basket_id');

        $this->assertSame($before, $this->snapshot());
        $this->assertSame(0, $f['basket']->fresh()->stock_quantity);
        $this->assertDatabaseCount('rep_distributions', 0);
        $this->assertDatabaseCount('inventory_movements', 0);
    }

    public function test_repeated_dispatch_cannot_overdraw_exact_remaining_stock(): void
    {
        $f = $this->fixture('admin', stock: 2, required: 2);
        $first = $this->dispatch($f)->assertOk();
        $firstId = $first->json('data.id');
        $this->assertSame(0, $f['basket']->fresh()->stock_quantity);
        $beforeSecond = $this->snapshot();

        $this->dispatch($f)->assertUnprocessable()->assertJsonValidationErrors('basket_id');

        $this->assertSame($beforeSecond, $this->snapshot());
        $this->assertSame(0, $f['basket']->fresh()->stock_quantity);
        $this->assertSame($firstId, RepDistribution::sole()->id);
        $this->assertDatabaseCount('inventory_movements', 0);
    }

    #[DataProvider('deniedRoles')]
    public function test_denied_roles_keep_authorization_and_cannot_mutate_stock(string $role): void
    {
        $f = $this->fixture($role, stock: 5, required: 2);
        $before = $this->snapshot();
        $this->assertTrue($f['actor']->fresh()->permissions['representatives']['view']);
        $this->assertTrue($f['actor']->fresh()->permissions['representatives']['edit']);

        $this->dispatch($f)->assertForbidden();

        $this->assertSame($before, $this->snapshot());
        $this->assertSame(5, $f['basket']->fresh()->stock_quantity);
        $this->assertDatabaseCount('rep_distributions', 0);
        $this->assertDatabaseCount('inventory_movements', 0);
    }

    public function test_linked_reserved_inventory_item_still_blocks_dispatch(): void
    {
        $f = $this->fixture('staff', stock: 10, required: 2);
        DB::table('inventory_items')->insert([
            'id' => $f['basket']->id,
            'name' => 'IKR009 LINKED INVENTORY ITEM',
            'unit' => 'box',
            'current_quantity' => 2,
            'reserved_quantity' => 1,
            'min_threshold' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $before = $this->snapshot();

        $this->dispatch($f)->assertUnprocessable()->assertJsonValidationErrors('basket_id');

        $this->assertSame($before, $this->snapshot());
        $this->assertSame(10, $f['basket']->fresh()->stock_quantity);
        $this->assertSame('2.00', InventoryItem::findOrFail($f['basket']->id)->fresh()->current_quantity);
        $this->assertSame('1.00', InventoryItem::findOrFail($f['basket']->id)->fresh()->reserved_quantity);
        $this->assertDatabaseCount('rep_distributions', 0);
        $this->assertDatabaseCount('inventory_movements', 0);
    }
}
