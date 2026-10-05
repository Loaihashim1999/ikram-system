<?php

namespace Tests\Feature;

use App\Contracts\Communications\EmailProviderInterface;
use App\Contracts\Communications\SmsProviderInterface;
use App\Models\AuditLog;
use App\Models\DailyBeneficiary;
use App\Models\DailyInventoryItem;
use App\Models\DailyInventoryMovement;
use App\Models\DailyReceivingTransaction;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\PolicyEScenario;
use Tests\TestCase;

class DailyReceivingAuditTest extends TestCase
{
    use RefreshDatabase;

    protected function databaseDriver(): string
    {
        return 'sqlite';
    }

    protected function setUp(): void
    {
        parent::setUp();
        config(['hashing.bcrypt.rounds' => 4]);
        Http::preventStrayRequests();
        Queue::fake();
        Mail::fake();
        Carbon::setTestNow('2026-10-03 12:00:00');
        $this->assertSame($this->databaseDriver(), DB::connection()->getPdo()->getAttribute(\PDO::ATTR_DRIVER_NAME));
        if ($this->databaseDriver() === 'sqlite') {
            $this->assertSame(':memory:', config('database.connections.sqlite.database'));
        }
        foreach ([SmsProviderInterface::class, EmailProviderInterface::class] as $contract) {
            $this->assertStringContainsString('Fake', get_class(app($contract)));
        }
    }

    public static function roles(): array
    {
        return ['admin' => ['admin'], 'assistant_admin' => ['assistant_admin'], 'reception' => ['reception'], 'staff' => ['staff']];
    }

    private function fixtures(string $role = 'assistant_admin', bool $grant = true): array
    {
        $actor = PolicyEScenario::actor([], $role);
        $actor->permissions = ['daily_beneficiaries' => ['view' => true, 'create' => $grant]];
        $actor->save();
        $this->assertSame($grant, $actor->fresh()->permissions['daily_beneficiaries']['create']);
        Sanctum::actingAs($actor);
        $a = DailyBeneficiary::create(['full_name' => 'Synthetic receipt A', 'national_id' => '1555555555', 'phone' => '0505555555', 'district' => 'ALPHA', 'status' => 'active', 'total_received_count' => 0]);
        $b = DailyBeneficiary::create(['full_name' => 'Synthetic receipt B', 'national_id' => '1666666666', 'phone' => '0506666666', 'district' => 'OMEGA', 'status' => 'active', 'total_received_count' => 0]);
        $item = DailyInventoryItem::create(['name' => 'Synthetic item A', 'unit' => 'unit', 'current_quantity' => 10, 'min_threshold' => 1]);
        DailyInventoryItem::create(['name' => 'Synthetic item B', 'unit' => 'unit', 'current_quantity' => 20, 'min_threshold' => 1]);
        AuditLog::create(['user_id' => $actor->id, 'action' => 'SYNTHETIC_CONTROL', 'target_table' => 'daily_beneficiaries', 'target_id' => $b->id, 'details' => ['synthetic' => true]]);

        return [$actor, $a, $item];
    }

    private function payload(DailyBeneficiary $a, DailyInventoryItem $item): array
    {
        return ['daily_beneficiary_id' => $a->id, 'daily_inventory_item_id' => $item->id, 'quantity' => 2, 'receiving_date' => '2026-10-03 10:30:00', 'notes' => 'Synthetic receipt'];
    }

    private function snapshot(array $omit = []): array
    {
        $out = [];
        foreach (DB::getSchemaBuilder()->getTableListing() as $table) {
            $name = preg_replace('/^.*\./', '', $table);
            $query = DB::table($table);
            foreach ($omit[$name] ?? [] as $id) {
                $query->where('id', '!=', $id);
            }
            $out[$name] = hash('sha256', json_encode($query->get(), JSON_THROW_ON_ERROR));
        }

        return $out;
    }

    private function verifyBusiness($response, $actor, $a, $item): array
    {
        $response->assertCreated()->assertJson(['success' => true]);
        $id = $response->json('data.id');
        $this->assertSame(1, DailyReceivingTransaction::count());
        $receipt = DailyReceivingTransaction::findOrFail($id);
        $this->assertSame($a->id, $receipt->daily_beneficiary_id);
        $this->assertSame($item->id, $receipt->daily_inventory_item_id);
        $this->assertSame($actor->id, $receipt->authorized_user_id);
        $this->assertSame(2, (int) $receipt->quantity);
        $this->assertSame('received', $receipt->status);
        $this->assertSame('DRV-20261003-0001', $receipt->document_number);
        $this->assertSame(8, (int) $item->fresh()->current_quantity);
        $this->assertSame(1, (int) $a->fresh()->total_received_count);
        $this->assertSame('2026-10-03 10:30:00', $a->fresh()->last_delivery_date->format('Y-m-d H:i:s'));
        $moves = DailyInventoryMovement::where('related_receiving_id', $id)->get();
        $this->assertCount(1, $moves);
        $move = $moves->first();
        $this->assertSame($item->id, $move->daily_inventory_item_id);
        $this->assertSame($actor->id, $move->user_id);
        $this->assertSame('out', $move->type);
        $this->assertSame(2, (int) $move->quantity);

        return [$id, $move->id];
    }

    #[DataProvider('roles')]
    public function test_confirmation_has_one_correct_audit_and_preserves_other_state(string $role): void
    {
        [$actor, $a, $item] = $this->fixtures($role);
        $before = $this->snapshot(['daily_beneficiaries' => [$a->id], 'daily_inventory_items' => [$item->id]]);
        [$id, $moveId] = $this->verifyBusiness($this->postJson('/api/daily-receiving', $this->payload($a, $item)), $actor, $a, $item);
        $events = AuditLog::where('action', 'DAILY_RECEIVING_CONFIRMED')->get();
        $this->assertCount(1, $events);
        $event = $events->first();
        $this->assertSame('daily_receiving_transactions', $event->target_table);
        $this->assertSame($id, $event->target_id);
        $this->assertSame($actor->id, $event->user_id);
        $this->assertSame('DAILY_RECEIVING_CONFIRMED', $event->action);
        $this->assertEquals(['daily_beneficiary_id' => $a->id, 'daily_inventory_item_id' => $item->id, 'quantity' => 2], $event->details);
        $this->assertSame($before, $this->snapshot(['daily_beneficiaries' => [$a->id], 'daily_inventory_items' => [$item->id], 'daily_receiving_transactions' => [$id], 'daily_inventory_movements' => [$moveId], 'audit_logs' => [$event->id]]));
    }

    public function test_denied_role_and_missing_grant_create_no_mutation_or_success_event(): void
    {
        [$actor, $a, $item] = $this->fixtures('warehouse');
        $before = $this->snapshot();
        $this->postJson('/api/daily-receiving', $this->payload($a, $item))->assertForbidden();
        $this->assertSame($before, $this->snapshot());
        $actor->role = 'assistant_admin';
        $actor->permissions = ['daily_beneficiaries' => ['view' => true, 'create' => false]];
        $actor->save();
        Sanctum::actingAs($actor);
        $before = $this->snapshot();
        $this->postJson('/api/daily-receiving', $this->payload($a, $item))->assertForbidden();
        $this->assertSame($before, $this->snapshot());
        $this->assertSame(0, AuditLog::where('action', 'DAILY_RECEIVING_CONFIRMED')->count());
    }

    public function test_validation_and_insufficient_stock_create_no_mutation_or_success_event(): void
    {
        [$actor, $a, $item] = $this->fixtures();
        $before = $this->snapshot();
        $this->postJson('/api/daily-receiving', array_replace($this->payload($a, $item), ['quantity' => 0]))->assertUnprocessable()->assertJsonValidationErrors('quantity');
        $this->assertSame($before, $this->snapshot());
        $this->postJson('/api/daily-receiving', array_replace($this->payload($a, $item), ['quantity' => 11]))->assertUnprocessable();
        $this->assertSame($before, $this->snapshot());
        $this->assertSame(0, AuditLog::where('action', 'DAILY_RECEIVING_CONFIRMED')->count());
    }

    public function test_audit_failure_is_observable_and_does_not_abort_receiving_transaction(): void
    {
        [$actor, $a, $item] = $this->fixtures();
        $before = $this->snapshot(['daily_beneficiaries' => [$a->id], 'daily_inventory_items' => [$item->id]]);
        Log::spy();
        if ($this->databaseDriver() === 'pgsql') {
            DB::unprepared("CREATE FUNCTION synthetic_receiving_audit_failure() RETURNS trigger LANGUAGE plpgsql AS \$\$ BEGIN IF NEW.action = 'DAILY_RECEIVING_CONFIRMED' THEN RAISE EXCEPTION 'synthetic audit persistence failure'; END IF; RETURN NEW; END; \$\$");
            DB::unprepared('CREATE TRIGGER synthetic_receiving_audit_failure BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION synthetic_receiving_audit_failure()');
        } else {
            DB::unprepared("CREATE TRIGGER synthetic_receiving_audit_failure BEFORE INSERT ON audit_logs WHEN NEW.action = 'DAILY_RECEIVING_CONFIRMED' BEGIN SELECT RAISE(ABORT, 'synthetic audit persistence failure'); END");
        }
        try {
            [$id, $moveId] = $this->verifyBusiness($this->postJson('/api/daily-receiving', $this->payload($a, $item)), $actor, $a, $item);
        } finally {
            if ($this->databaseDriver() === 'pgsql') {
                DB::unprepared('DROP TRIGGER synthetic_receiving_audit_failure ON audit_logs');
                DB::unprepared('DROP FUNCTION synthetic_receiving_audit_failure()');
            } else {
                DB::unprepared('DROP TRIGGER synthetic_receiving_audit_failure');
            }
        }
        $this->assertSame(0, AuditLog::where('action', 'DAILY_RECEIVING_CONFIRMED')->count());
        $this->assertSame($before, $this->snapshot(['daily_beneficiaries' => [$a->id], 'daily_inventory_items' => [$item->id], 'daily_receiving_transactions' => [$id], 'daily_inventory_movements' => [$moveId]]));
        Log::shouldHaveReceived('warning')->once()->with('Daily receiving confirmation audit persistence failed.', ['target_table' => 'daily_receiving_transactions', 'target_id' => $id, 'actor_id' => $actor->id, 'exception_class' => QueryException::class]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }
}
