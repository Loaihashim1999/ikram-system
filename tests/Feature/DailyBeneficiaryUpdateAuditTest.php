<?php

namespace Tests\Feature;

use App\Contracts\Communications\EmailProviderInterface;
use App\Contracts\Communications\SmsProviderInterface;
use App\Models\AuditLog;
use App\Models\DailyBeneficiary;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\PolicyEScenario;
use Tests\TestCase;

class DailyBeneficiaryUpdateAuditTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['hashing.bcrypt.rounds' => 4]);
        Http::preventStrayRequests();
        Mail::fake();
        Queue::fake();
        $this->assertSame('sqlite', DB::connection()->getPdo()->getAttribute(\PDO::ATTR_DRIVER_NAME));
        $this->assertSame(':memory:', config('database.connections.sqlite.database'));
        foreach ([SmsProviderInterface::class, EmailProviderInterface::class] as $contract) {
            $this->assertStringContainsString('Fake', get_class(app($contract)));
        }
    }

    public static function authorizedRoles(): array
    {
        return array_combine(
            ['admin', 'assistant_admin', 'reception', 'staff'],
            array_map(fn ($role) => [$role], ['admin', 'assistant_admin', 'reception', 'staff'])
        );
    }

    private function actor(string $role = 'assistant_admin', bool $edit = true): User
    {
        $actor = PolicyEScenario::actor([], $role);
        $actor->permissions = ['daily_beneficiaries' => ['view' => true, 'edit' => $edit]];
        $actor->save();
        $this->assertSame($edit, $actor->fresh()->permissions['daily_beneficiaries']['edit']);
        Sanctum::actingAs($actor);

        return $actor;
    }

    private function parents(User $actor): array
    {
        $a = DailyBeneficiary::create(['full_name' => 'Synthetic A', 'national_id' => '1555555555', 'phone' => '0505555555', 'district' => 'ALPHA', 'status' => 'active', 'nationality' => 'سعودي', 'beneficiary_type' => 'citizen']);
        $b = DailyBeneficiary::create(['full_name' => 'Synthetic B', 'national_id' => '1666666666', 'phone' => '0506666666', 'district' => 'OMEGA', 'status' => 'active', 'nationality' => 'سعودي', 'beneficiary_type' => 'citizen']);
        AuditLog::create(['user_id' => $actor->id, 'action' => 'SYNTHETIC_CONTROL', 'target_table' => 'daily_beneficiaries', 'target_id' => $b->id, 'details' => ['synthetic' => true]]);
        $this->assertDatabaseHas('daily_beneficiaries', ['id' => $a->id, 'status' => 'active']);

        return [$a->fresh(), $b->fresh()];
    }

    private function payload(DailyBeneficiary $parent): array
    {
        return ['full_name' => 'Synthetic changed A', 'national_id' => $parent->national_id, 'phone' => $parent->phone, 'district' => $parent->district, 'status' => 'inactive', 'nationality' => 'سعودي'];
    }

    private function snapshot(array $omit = []): array
    {
        $out = [];
        foreach (DB::getSchemaBuilder()->getTableListing() as $table) {
            $name = preg_replace('/^main\./', '', $table);
            $query = DB::table($table);
            foreach ($omit[$name] ?? [] as $id) {
                $query->where('id', '!=', $id);
            }
            $out[$name] = hash('sha256', json_encode($query->get(), JSON_THROW_ON_ERROR));
        }

        return $out;
    }

    private function assertOnlyRequestedFieldsChanged(DailyBeneficiary $parent): void
    {
        $fresh = $parent->fresh();
        $this->assertSame('inactive', $fresh->status);
        $this->assertSame('Synthetic changed A', $fresh->full_name);
        foreach ($parent->getAttributes() as $key => $value) {
            if (! in_array($key, ['full_name', 'status', 'updated_at'], true)) {
                $this->assertEquals($value, $fresh->getAttributes()[$key] ?? null);
            }
        }
    }

    #[DataProvider('authorizedRoles')]
    public function test_success_has_exactly_one_correctly_targeted_audit_event(string $role): void
    {
        $actor = $this->actor($role);
        [$a, $b] = $this->parents($actor);
        $before = $this->snapshot(['daily_beneficiaries' => [$a->id]]);
        $this->patchJson('/api/daily-beneficiaries/'.$a->id, $this->payload($a))->assertOk()->assertJson(['success' => true, 'data' => ['id' => $a->id]]);
        $this->assertOnlyRequestedFieldsChanged($a);
        $events = AuditLog::where('action', 'UPDATE_DAILY_BENEFICIARY')->get();
        $this->assertCount(1, $events);
        $event = $events->first();
        $this->assertSame('daily_beneficiaries', $event->target_table);
        $this->assertSame($a->id, $event->target_id);
        $this->assertNotSame($b->id, $event->target_id);
        $this->assertSame($actor->id, $event->user_id);
        $this->assertSame('UPDATE_DAILY_BENEFICIARY', $event->action);
        $this->assertIsArray($event->details);
        $this->assertEqualsCanonicalizing(array_merge(array_keys($this->payload($a)), ['category_name', 'beneficiary_type']), $event->details['updated_fields']);
        foreach ([$a->national_id, $a->phone, $a->full_name] as $sensitive) {
            $this->assertStringNotContainsString($sensitive, json_encode($event->details));
        }
        $this->assertSame($before, $this->snapshot(['daily_beneficiaries' => [$a->id], 'audit_logs' => [$event->id]]));
    }

    public function test_denied_role_cannot_mutate_or_create_success_audit(): void
    {
        $actor = $this->actor('warehouse');
        [$a] = $this->parents($actor);
        $before = $this->snapshot();
        $this->patchJson('/api/daily-beneficiaries/'.$a->id, $this->payload($a))->assertForbidden();
        $this->assertSame($before, $this->snapshot());
        $this->assertSame(0, AuditLog::where('action', 'UPDATE_DAILY_BENEFICIARY')->count());
    }

    public function test_missing_edit_grant_cannot_mutate_or_create_success_audit(): void
    {
        $actor = $this->actor('assistant_admin', false);
        [$a] = $this->parents($actor);
        $before = $this->snapshot();
        $this->patchJson('/api/daily-beneficiaries/'.$a->id, $this->payload($a))->assertForbidden();
        $this->assertSame($before, $this->snapshot());
        $this->assertSame(0, AuditLog::where('action', 'UPDATE_DAILY_BENEFICIARY')->count());
    }

    public function test_validation_failure_cannot_mutate_or_create_success_audit(): void
    {
        $actor = $this->actor();
        [$a] = $this->parents($actor);
        $before = $this->snapshot();
        $this->patchJson('/api/daily-beneficiaries/'.$a->id, array_replace($this->payload($a), ['status' => 'invalid']))->assertUnprocessable()->assertJsonValidationErrors('status');
        $this->assertSame($before, $this->snapshot());
        $this->assertSame(0, AuditLog::where('action', 'UPDATE_DAILY_BENEFICIARY')->count());
    }

    public function test_audit_persistence_failure_is_observable_and_business_update_remains_best_effort(): void
    {
        $actor = $this->actor();
        [$a] = $this->parents($actor);
        $before = $this->snapshot(['daily_beneficiaries' => [$a->id]]);
        Log::spy();
        DB::unprepared("CREATE TRIGGER synthetic_audit_failure BEFORE INSERT ON audit_logs WHEN NEW.action = 'UPDATE_DAILY_BENEFICIARY' BEGIN SELECT RAISE(ABORT, 'synthetic audit failure'); END");
        try {
            $this->patchJson('/api/daily-beneficiaries/'.$a->id, $this->payload($a))->assertOk()->assertJson(['success' => true]);
        } finally {
            DB::unprepared('DROP TRIGGER synthetic_audit_failure');
        }
        $this->assertOnlyRequestedFieldsChanged($a);
        $this->assertSame(0, AuditLog::where('action', 'UPDATE_DAILY_BENEFICIARY')->count());
        $this->assertSame($before, $this->snapshot(['daily_beneficiaries' => [$a->id]]));
        Log::shouldHaveReceived('warning')->once()->with('Daily beneficiary update audit persistence failed.', [
            'target_table' => 'daily_beneficiaries', 'target_id' => $a->id, 'actor_id' => $actor->id, 'exception_class' => QueryException::class,
        ]);
    }
}
