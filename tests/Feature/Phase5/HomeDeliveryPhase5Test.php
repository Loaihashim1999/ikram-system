<?php

namespace Tests\Feature\Phase5;

use App\Models\CommunicationMessage;
use App\Models\Driver;
use App\Models\DriverAssignment;
use App\Models\InventoryItem;
use App\Models\InventoryMovement;
use App\Models\Organization;
use App\Models\SupportDistribution;
use App\Models\SupportReceipt;
use App\Models\User;
use App\Services\Communications\SaudiPhoneNumber;
use App\Services\Delivery\DriverAccessService;
use App\Services\Delivery\ReceiptVerificationService;
use App\Services\SupportDistributionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class HomeDeliveryPhase5Test extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private InventoryItem $stock;

    private Organization $organization;

    protected function setUp(): void
    {
        parent::setUp();
        config(['app.key' => 'base64:'.base64_encode(str_repeat('T', 32))]);
        Queue::fake();
        $this->admin = User::create(['username' => 'TEST_P5', 'full_name' => 'TEST Admin', 'password' => 'test-password', 'email' => 'p5@example.invalid', 'role' => 'admin', 'is_active' => true]);
        Sanctum::actingAs($this->admin);
        $this->stock = InventoryItem::create(['name' => 'TEST rice', 'unit' => 'kg', 'current_quantity' => 100, 'min_threshold' => 1]);
        $this->organization = Organization::create(['name' => 'TEST organization', 'code' => 'TEST_P5', 'contact' => '966574917155', 'status' => 'active']);
    }

    public function test_driver_phone_is_stored_canonically_and_malformed_input_is_rejected(): void
    {
        $phones = app(SaudiPhoneNumber::class);
        $this->assertSame('966574917155', $phones->normalize('0574917155'));
        $this->assertSame('966574917155', $phones->normalize('+966574917155'));
        $this->assertSame('0574917155', $phones->display('966574917155'));
        $this->assertSame('MANUAL REVIEW', $phones->classifyStored('40574917155'));
        $this->assertSame('MANUAL REVIEW', $phones->classifyStored('10574917155'));
        $this->assertSame('MANUAL REVIEW', $phones->classifyStored('00574917155'));
        $this->assertSame('VALID', $phones->classifyStored('966574917155'));
        $this->assertSame('AUTO-FIX SAFE', $phones->classifyStored('0574917155'));

        $this->postJson('/api/support/drivers', ['full_name' => 'TEST local', 'phone' => '0574917155'])->assertCreated();
        $this->postJson('/api/support/drivers', ['full_name' => 'TEST international', 'phone' => '+966574917166'])->assertCreated();
        $this->postJson('/api/support/drivers', ['full_name' => 'TEST canonical', 'phone' => '966574917177'])->assertCreated();
        $this->assertEqualsCanonicalizing(['966574917155', '966574917166', '966574917177'], Driver::pluck('phone')->all());
        $this->postJson('/api/support/drivers', ['full_name' => 'TEST malformed', 'phone' => '40574917155'])->assertStatus(422)->assertJsonValidationErrors('phone');
        $this->assertNull(Driver::where('phone', '40574917155')->first());

        $legacy = Driver::create(['full_name' => 'TEST legacy', 'phone' => '40574917155', 'is_active' => true]);
        $this->assertSame('40574917155', $legacy->fresh()->phone);
    }

    public function test_delivery_period_metrics_come_from_the_operational_service_and_queue_counts_stay_separate(): void
    {
        SupportDistribution::create(['recipient_type' => 'organization', 'organization_id' => $this->organization->id, 'recipient_name' => 'TEST delivery due', 'fulfillment_method' => 'delivery', 'status' => 'ready', 'support_date' => '2026-10-02 10:00:00']);
        SupportDistribution::create(['recipient_type' => 'organization', 'organization_id' => $this->organization->id, 'recipient_name' => 'TEST pickup due', 'fulfillment_method' => 'pickup', 'status' => 'ready', 'support_date' => '2026-10-02 10:00:00']);
        SupportDistribution::create(['recipient_type' => 'organization', 'organization_id' => $this->organization->id, 'recipient_name' => 'TEST delivering', 'fulfillment_method' => 'delivery', 'status' => 'in_delivery', 'support_date' => '2026-10-02 10:00:00']);

        $snapshot = $this->getJson('/api/support/distributions?fulfillment_method=delivery')->assertOk();
        $snapshot->assertJsonPath('metrics.queue.not_started', 1)
            ->assertJsonPath('metrics.queue.in_delivery', 1)
            ->assertJsonPath('metrics.queue.basis', 'current_snapshot')
            ->assertJsonPath('metrics.operational', null)
            ->assertJsonPath('metrics.total', 2)
            ->assertJsonMissingPath('metrics.remaining');

        $period = $this->getJson('/api/support/distributions?fulfillment_method=delivery&metrics_from=2026-10-01&metrics_to=2026-10-03')->assertOk();
        $period->assertJsonPath('metrics.operational.fulfillment_method', 'delivery')
            ->assertJsonPath('metrics.operational.total_due', 2)
            ->assertJsonPath('metrics.operational.due_date_field', 'support_date')
            ->assertJsonPath('metrics.queue.not_started', 1);
    }

    public function test_production_driver_links_use_the_public_host_and_regeneration_invalidates_the_old_token(): void
    {
        $service = app(DriverAccessService::class);
        config(['app.public_url' => 'https://ca-rev.azurecontainerapps.io', 'app.url' => 'https://ca-rev.azurecontainerapps.io']);
        $previous = $this->app['env'];
        $this->app['env'] = 'production';
        try {
            $base = $service->publicBaseUrl();
            $this->assertSame('https://systemben.ekramfb.org.sa', $base);
            $this->assertStringNotContainsString('azurecontainerapps.io', $base);
        } finally {
            $this->app['env'] = $previous;
        }
        config(['app.public_url' => 'https://systemben.ekramfb.org.sa']);

        $support = $this->readyDelivery();
        $created = $this->postJson('/api/support/assignments', ['driver_id' => $this->driver('966574917188')->id, 'tasks' => [$support->id], 'minutes' => 60])->assertCreated();
        $url = $created->json('access_url');
        $this->assertStringStartsWith('https://systemben.ekramfb.org.sa/driver-access#', $url);
        preg_match('/#([a-f0-9]{64})$/', $url, $match);
        $assignment = DriverAssignment::firstOrFail();
        $this->postJson('/api/support/assignments/'.$assignment->id.'/resend', ['minutes' => 60])->assertOk();
        $this->withHeader('X-Driver-Token', $match[1])->getJson('/api/driver-access')->assertUnauthorized();
        $this->assertNotSame(hash('sha256', $match[1]), $assignment->fresh()->token_hash);
    }

    public function test_driver_portal_is_scoped_and_completion_is_atomic_idempotent_and_snapshotted(): void
    {
        $first = $this->readyDelivery();
        $second = $this->readyDelivery();
        $driverA = $this->driver('966574917199');
        $driverB = $this->driver('966574917100');
        $tokenA = $this->tokenFor($driverA, $first);
        $tokenB = $this->tokenFor($driverB, $second);

        $this->withHeader('X-Driver-Token', $tokenA)->getJson('/api/driver-access')->assertOk()->assertJsonPath('data.total', 1)->assertJsonPath('data.tasks.0.id', $first->id);
        $this->withHeader('X-Driver-Token', $tokenA)->postJson('/api/driver-access/tasks/'.$second->id.'/confirm', ['code' => '0000'])->assertNotFound();

        $code = $this->issue($first);
        $this->withHeader('X-Driver-Token', $tokenA)->postJson('/api/driver-access/tasks/'.$first->id.'/confirm', ['code' => '9999'])->assertStatus(422);
        $this->assertSame(0, SupportReceipt::count());
        $this->assertSame(0, InventoryMovement::count());
        $this->assertNull($first->fresh()->completed_at);

        $this->withHeader('X-Driver-Token', $tokenA)->postJson('/api/driver-access/tasks/'.$first->id.'/confirm', ['code' => $code])->assertOk();
        $this->withHeader('X-Driver-Token', $tokenA)->postJson('/api/driver-access/tasks/'.$first->id.'/confirm', ['code' => $code])->assertOk()->assertJsonPath('already_completed', true);
        $this->assertSame(1, SupportReceipt::count());
        $this->assertSame(1, InventoryMovement::where('type', 'out')->count());
        $this->assertNotNull($first->fresh()->completed_at);
        $snapshotPhone = SupportReceipt::first()->proof_snapshot['recipient']['phone'];
        $this->organization->update(['contact' => '966500000000']);

        $row = $this->getJson('/api/support/distributions?fulfillment_method=delivery&reference='.$first->id)->assertOk()->json('data.0');
        $this->assertSame($snapshotPhone, $row['contact_phone']);
        $this->assertSame('snapshot', $row['history_source']);
        $this->assertSame('receipt_code', $row['verification_method']);
        $this->assertNotSame('966500000000', $row['contact_phone']);
        $this->assertSame('in_delivery', $second->fresh()->status);
        $this->withHeader('X-Driver-Token', $tokenB)->getJson('/api/driver-access')->assertOk()->assertJsonPath('data.tasks.0.id', $second->id);

        $staff = User::create(['username' => 'TEST_P5_STAFF', 'full_name' => 'TEST Staff', 'password' => 'test-password', 'role' => 'staff', 'is_active' => true, 'permissions' => ['support' => ['view' => true]]]);
        Sanctum::actingAs($staff);
        $this->postJson('/api/support/drivers', ['full_name' => 'TEST blocked', 'phone' => '0574917155'])->assertForbidden();
        $this->getJson('/api/support/distributions?fulfillment_method=delivery')->assertOk();
    }

    private function readyDelivery(): SupportDistribution
    {
        $service = app(SupportDistributionService::class);
        $support = $service->create(['recipient_type' => 'organization', 'organization_id' => $this->organization->id, 'fulfillment_method' => 'delivery', 'items' => [['inventory_item_id' => $this->stock->id, 'requested_quantity' => '2.50']]], $this->admin->id);
        foreach (['approve', 'reserve', 'ready'] as $action) {
            $support = $service->transition($support->id, $action, $this->admin->id);
        }

        return $support;
    }

    private function driver(string $phone): Driver
    {
        return Driver::create(['full_name' => 'TEST '.$phone, 'phone' => $phone, 'is_active' => true]);
    }

    private function tokenFor(Driver $driver, SupportDistribution $support): string
    {
        $assignment = app(DriverAccessService::class)->assign($driver->id, [$support->id], 60, $this->admin->id);
        preg_match('/driver-access#([a-f0-9]{64})/', CommunicationMessage::where('operation_id', $assignment->id)->first()->encrypted_payload['body'], $match);

        return $match[1];
    }

    private function issue(SupportDistribution $support): string
    {
        app(ReceiptVerificationService::class)->issue($support->id, $this->admin->id);
        preg_match('/رمز الاستلام: ([0-9]{4})/', CommunicationMessage::where('operation_id', $support->id)->latest('id')->first()->encrypted_payload['body'], $match);

        return $match[1];
    }
}
