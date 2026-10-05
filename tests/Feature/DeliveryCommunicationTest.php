<?php

namespace Tests\Feature;

use App\Contracts\Communications\SmsProviderInterface;
use App\Jobs\SendCommunication;
use App\Models\AuditLog;
use App\Models\Beneficiary;
use App\Models\CommunicationMessage;
use App\Models\Driver;
use App\Models\DriverAssignment;
use App\Models\InventoryItem;
use App\Models\Organization;
use App\Models\PickupLocation;
use App\Models\ReceiptChallenge;
use App\Models\SupportDistribution;
use App\Models\SupportReceipt;
use App\Models\User;
use App\Services\Communications\CommunicationService;
use App\Services\Communications\FakeSmsProvider;
use App\Services\Communications\ProviderFailure;
use App\Services\Delivery\DriverAccessService;
use App\Services\Delivery\ReceiptVerificationService;
use App\Services\SupportDistributionService;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Symfony\Component\Process\Process;
use Tests\TestCase;

class DeliveryCommunicationTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected InventoryItem $stock;

    protected Organization $organization;

    protected PickupLocation $location;

    protected function setUp(): void
    {
        parent::setUp();
        config(['app.key' => 'base64:'.base64_encode(str_repeat('T', 32))]);
        Queue::fake();
        $this->admin = User::create(['username' => 'TEST_2B', 'full_name' => 'TEST Admin', 'password' => 'test-password', 'email' => 'test@example.invalid', 'role' => 'admin', 'is_active' => true]);
        Sanctum::actingAs($this->admin);
        $this->stock = InventoryItem::create(['name' => 'TEST rice', 'unit' => 'kg', 'current_quantity' => 100, 'min_threshold' => 1]);
        $this->organization = Organization::create(['name' => 'TEST organization', 'code' => 'TEST_2B', 'contact' => '0501234567', 'status' => 'active']);
        $this->location = PickupLocation::create(['name' => 'TEST pickup', 'location_url' => 'https://example.invalid/pickup']);
    }

    protected function support(bool $delivery = false): SupportDistribution
    {
        $service = app(SupportDistributionService::class);
        $s = $service->create(['recipient_type' => 'organization', 'organization_id' => $this->organization->id, 'fulfillment_method' => $delivery ? 'delivery' : 'pickup', 'pickup_location_id' => $delivery ? null : $this->location->id, 'items' => [['inventory_item_id' => $this->stock->id, 'requested_quantity' => '2.50']]], $this->admin->id);
        foreach (['approve', 'reserve', 'ready'] as $action) {
            $s = $service->transition($s->id, $action, $this->admin->id);
        }

        return $s;
    }

    protected function issue(SupportDistribution $support): string
    {
        app(ReceiptVerificationService::class)->issue($support->id, $this->admin->id);
        $message = CommunicationMessage::where('operation_id', $support->id)->latest()->first();
        preg_match('/رمز الاستلام: ([0-9]{4})/', $message->encrypted_payload['body'], $match);

        return $match[1];
    }

    protected function driver(): Driver
    {
        return Driver::create(['full_name' => 'TEST Driver', 'phone' => '0501234568', 'is_active' => true]);
    }

    protected function assignment(SupportDistribution $support): array
    {
        $a = app(DriverAccessService::class)->assign($this->driver()->id, [$support->id], 60, $this->admin->id);
        $body = CommunicationMessage::where('operation_id', $a->id)->first()->encrypted_payload['body'];
        preg_match('/driver-access#([a-f0-9]{64})/', $body, $match);

        return [$a, $match[1]];
    }

    public function test_atomic_pickup_and_duplicate_consumption(): void
    {
        $s = $this->support();
        $code = $this->issue($s);
        $this->postJson('/api/support/distributions/'.$s->id.'/verify', ['code' => $code])->assertOk();
        $this->postJson('/api/support/distributions/'.$s->id.'/verify', ['code' => $code])->assertOk()->assertJsonPath('already_completed', true);
        $this->assertSame('97.50', $this->stock->fresh()->current_quantity);
        $this->assertDatabaseCount('support_receipts', 1);
        $this->assertDatabaseCount('inventory_movements', 1);
        $this->assertNotNull(ReceiptChallenge::first()->consumed_at);
    }

    public function test_leading_zero_is_preserved_and_bound_to_operation(): void
    {
        $s = $this->support();
        $this->issue($s);
        $c = ReceiptChallenge::first();
        $c->update(['verifier' => hash_hmac('sha256', 'receipt:'.$s->id.':'.$c->generation.':0042', config('app.key'))]);
        foreach ([42, '42', '00422', 'abcd', ''] as $invalid) {
            $this->postJson('/api/support/distributions/'.$s->id.'/verify', ['code' => $invalid])->assertUnprocessable();
        }
        $this->postJson('/api/support/distributions/'.$s->id.'/verify', ['code' => '0042'])->assertOk();
        $this->assertStringNotContainsString('0042', DB::table('audit_logs')->pluck('details')->implode(' '));
    }

    public function test_lockout_persists_failed_attempts_and_prevents_reissue(): void
    {
        config(['delivery.receipt_max_attempts' => 2]);
        $s = $this->support();
        $code = $this->issue($s);
        $wrong = $code === '0000' ? '0001' : '0000';
        $this->postJson('/api/support/distributions/'.$s->id.'/verify', ['code' => $wrong])->assertUnprocessable();
        $this->postJson('/api/support/distributions/'.$s->id.'/verify', ['code' => $wrong])->assertStatus(423);
        $this->postJson('/api/support/distributions/'.$s->id.'/verify', ['code' => $code])->assertStatus(423);
        $this->postJson('/api/support/distributions/'.$s->id.'/receipt-code')->assertUnprocessable();
        $this->assertSame(2, ReceiptChallenge::first()->failed_attempts);
        $this->assertDatabaseCount('support_receipts', 0);
    }

    public function test_expiry_rate_limit_and_reissue(): void
    {
        $s = $this->support();
        $old = $this->issue($s);
        $this->travel(16)->minutes();
        $this->postJson('/api/support/distributions/'.$s->id.'/verify', ['code' => $old])->assertUnprocessable();
        $generation = ReceiptChallenge::first()->generation;
        $this->issue($s);
        $this->assertNotSame($generation, ReceiptChallenge::first()->generation);
        config(['delivery.verification_per_minute' => 1]);
        $this->postJson('/api/support/distributions/'.$s->id.'/verify', ['code' => '1234'])->assertStatus(429);
    }

    public function test_inventory_failure_does_not_consume_or_create_receipt(): void
    {
        $s = $this->support();
        $code = $this->issue($s);
        DB::table('support_distribution_items')->where('support_distribution_id', $s->id)->update(['reserved_quantity' => 0]);
        $this->postJson('/api/support/distributions/'.$s->id.'/verify', ['code' => $code])->assertUnprocessable();
        $this->assertNull(ReceiptChallenge::first()->consumed_at);
        $this->assertDatabaseCount('support_receipts', 0);
        $this->assertSame('ready', $s->fresh()->status);
    }

    public function test_driver_scope_completion_and_secret_hiding(): void
    {
        $s = $this->support(true);
        $code = $this->issue($s);
        [$a, $token] = $this->assignment($s);
        $other = $this->support(true);
        $this->assignment($other);
        $this->withHeader('X-Driver-Token', $token)->getJson('/api/driver-access')->assertOk()->assertJsonPath('data.remaining', 1)->assertJsonMissingPath('data.tasks.0.income');
        $this->withHeader('X-Driver-Token', $token)->postJson('/api/driver-access/tasks/'.$other->id.'/confirm', ['code' => $code])->assertNotFound();
        $this->withHeader('X-Driver-Token', $token)->postJson('/api/driver-access/tasks/'.$s->id.'/confirm', ['code' => $code])->assertOk()->assertJsonPath('completed', true);
        $this->withHeader('X-Driver-Token', $token)->getJson('/api/driver-access')->assertOk()->assertJsonPath('data.all_completed', true);
        $this->assertStringNotContainsString($token, DB::table('audit_logs')->pluck('details')->implode(' '));
        $this->assertArrayNotHasKey('token_hash', $a->toArray());
        $this->assertArrayNotHasKey('encrypted_payload', CommunicationMessage::first()->toArray());
        $this->assertArrayNotHasKey('verifier', ReceiptChallenge::first()->toArray());
        $this->assertDatabaseHas('support_receipts', ['support_distribution_id' => $s->id, 'driver_assignment_id' => $a->id]);
    }

    public function test_expired_revoked_inactive_driver_and_unknown_token(): void
    {
        [$a,$token] = $this->assignment($this->support(true));
        $this->withHeader('X-Driver-Token', 'invalid')->getJson('/api/driver-access')->assertUnauthorized();
        $a->driver->update(['is_active' => false]);
        $this->withHeader('X-Driver-Token', $token)->getJson('/api/driver-access')->assertForbidden();
        $a->driver->update(['is_active' => true]);
        $this->travel(61)->minutes();
        $this->withHeader('X-Driver-Token', $token)->getJson('/api/driver-access')->assertStatus(410);
        $this->assertDatabaseHas('audit_logs', ['action' => 'DRIVER_LINK_EXPIRED']);
        $a->update(['expires_at' => now()->addHour()]);
        app(DriverAccessService::class)->revoke($a->id, $this->admin->id);
        $this->withHeader('X-Driver-Token', $token)->getJson('/api/driver-access')->assertForbidden();
    }

    public function test_invalid_templates_and_synthetic_preview(): void
    {
        foreach (['{password}', '{{verification_code}}', '<script>x</script>', 'missing required'] as $body) {
            $this->putJson('/api/settings/communications', ['templates' => ['beneficiary_delivery' => $body]])->assertUnprocessable()->assertJsonValidationErrors('beneficiary_delivery');
        }
        $this->putJson('/api/settings/communications', ['templates' => ['password_reset_body' => '{user_name}']])->assertUnprocessable();
        $this->postJson('/api/settings/communications/preview', ['key' => 'beneficiary_delivery', 'template' => '{recipient_name} {verification_code}'])->assertOk()->assertJsonPath('data', 'مستلم تجريبي 0042');
        $this->putJson('/api/settings/communications', ['templates' => ['sms_token' => 'forbidden']])->assertUnprocessable();
    }

    public function test_non_admin_settings_forbidden(): void
    {
        $this->admin->update(['role' => 'assistant_admin', 'permissions' => ['settings' => ['view' => true, 'edit' => true]]]);
        $this->getJson('/api/settings/communications')->assertForbidden();
        $this->putJson('/api/settings/communications', ['templates' => ['association_name' => 'TEST']])->assertForbidden();
    }

    public function test_provider_failure_retry_idempotency_and_no_stock_corruption(): void
    {
        $s = $this->support();
        $this->issue($s);
        $message = CommunicationMessage::first();
        $original = $message->getRawOriginal('encrypted_payload');
        $this->app->bind(SmsProviderInterface::class, fn () => new class implements SmsProviderInterface
        {
            public function send(string $idempotencyKey, array $payload): string
            {
                throw new ProviderFailure('provider_unavailable', true);
            }
        });
        $service = app(CommunicationService::class);
        for ($i = 0; $i < 3; $i++) {
            $service->send($message->id);
            $this->travel(3)->minutes();
        }
        $this->assertSame('failed', $message->fresh()->status);
        $this->assertSame($original, $message->fresh()->getRawOriginal('encrypted_payload'));
        $this->assertSame('100.00', $this->stock->fresh()->current_quantity);
        $this->assertSame('2.50', $this->stock->fresh()->reserved_quantity);
        $service->retry($message->id);
        $this->app->bind(SmsProviderInterface::class, FakeSmsProvider::class);
        $service->send($message->id);
        $service->send($message->id);
        $this->assertSame('sent', $message->fresh()->status);
        $this->assertSame(4, $message->fresh()->attempts);
        $this->assertNull($message->fresh()->encrypted_payload);
    }

    public function test_delivery_template_rejects_pickup_data_and_snapshot_preserved(): void
    {
        $this->putJson('/api/settings/communications', ['templates' => ['organization_delivery' => '{verification_code} {pickup_location_url}']])->assertUnprocessable();
        $s = $this->support();
        $this->location->update(['location_url' => 'https://example.invalid/changed']);
        $this->assertSame('https://example.invalid/pickup', $s->pickup_location_url);
        $this->issue($s);
        $this->assertSame('sms', CommunicationMessage::first()->channel);
    }

    public function test_public_completion_cannot_bypass_receipt_verification(): void
    {
        $s = $this->support();
        $this->patchJson('/api/support/distributions/'.$s->id.'/complete')->assertStatus(409);
        $this->assertSame('ready', $s->fresh()->status);
        $this->assertDatabaseCount('support_receipts', 0);
    }

    public function test_challenge_is_operation_bound_and_reissue_invalidates_old_queue_payload(): void
    {
        $first = $this->support();
        $this->issue($first);
        $firstChallenge = ReceiptChallenge::where('support_distribution_id', $first->id)->first();
        $firstChallenge->update(['verifier' => hash_hmac('sha256', 'receipt:'.$first->id.':'.$firstChallenge->generation.':0042', config('app.key'))]);
        $second = $this->support();
        $this->issue($second);
        $secondChallenge = ReceiptChallenge::where('support_distribution_id', $second->id)->first();
        $secondChallenge->update(['verifier' => $firstChallenge->verifier, 'generation' => $firstChallenge->generation]);
        $this->postJson('/api/support/distributions/'.$second->id.'/verify', ['code' => '0042'])->assertUnprocessable();
        $oldMessage = CommunicationMessage::where('operation_id', $first->id)->first();
        $this->travel(61)->seconds();
        $this->issue($first);
        $this->assertSame('cancelled', $oldMessage->fresh()->status);
        $this->assertNull($oldMessage->fresh()->encrypted_payload);
    }

    public function test_security_policy_and_invalid_assignment_are_rejected(): void
    {
        $s = $this->support(true);
        $driver = $this->driver();
        $this->postJson('/api/support/assignments', ['driver_id' => $driver->id, 'tasks' => [$s->id], 'minutes' => 10081])->assertUnprocessable();
        config(['delivery.receipt_ttl_minutes' => 0]);
        $this->postJson('/api/support/distributions/'.$s->id.'/receipt-code')->assertUnprocessable();
        $this->assertDatabaseCount('receipt_challenges', 0);
    }

    public function test_driver_assignment_uses_sms_without_whatsapp_opt_in_and_normalizes_number(): void
    {
        Http::preventStrayRequests();
        $support = $this->support(true);
        $driver = Driver::create(['full_name' => 'TEST No Consent', 'phone' => '+966501234569', 'is_active' => true]);

        $this->postJson('/api/support/assignments', ['driver_id' => $driver->id, 'tasks' => [$support->id], 'minutes' => 60])->assertCreated();

        $message = CommunicationMessage::firstOrFail();
        $this->assertSame('sms', $message->channel);
        $this->assertSame('driver', $message->recipient_type);
        $this->assertSame('driver_assignment_sms', $message->operation_type);
        $this->assertSame('966501234569', $message->encrypted_payload['destination']);
        $this->assertStringContainsString('/driver-access#', $message->encrypted_payload['body']);
        $this->assertSame('in_delivery', $support->fresh()->status);
        $this->assertDatabaseCount('driver_assignments', 1);
        Http::assertNothingSent();
    }

    public function test_queue_timeout_and_expired_payload_have_bounded_sanitized_state(): void
    {
        $s = $this->support();
        $this->issue($s);
        $message = CommunicationMessage::first();
        $job = new SendCommunication($message->id);
        $this->assertStringNotContainsString('encrypted_payload', serialize($job));
        for ($i = 0; $i < 3; $i++) {
            $job->failed(new \RuntimeException('TEST sensitive transport body'));
        }
        $this->assertSame('failed', $message->fresh()->status);
        $this->assertSame('worker_timeout', $message->fresh()->error_code);
        $this->travel(16)->minutes();
        $this->postJson('/api/settings/communications/messages/'.$message->id.'/retry')->assertUnprocessable();
        $this->artisan('communications:drain')->assertSuccessful();
        $this->assertNull($message->fresh()->encrypted_payload);
    }

    public function test_actual_fake_email_flow_expiry_one_use_and_sanitized_audits(): void
    {
        // RETIRED: email reset links are no longer the active recovery channel.
        // The SMS 6-digit OTP flow is covered end-to-end by PasswordResetOtpTest.
        $this->assertTrue(true);
    }

    public function test_inactive_and_non_admin_recovery_are_generic_without_outbox(): void
    {
        // RETIRED: superseded by PasswordResetOtpTest enumeration-safety cases.
        $this->assertTrue(true);
    }

    public function test_settings_round_trip_and_fake_routing_all_channels(): void
    {
        $this->putJson('/api/settings/communications', ['templates' => ['association_name' => 'TEST جمعية', 'beneficiary_delivery' => '{recipient_name}: {verification_code}']])->assertOk()->assertJsonPath('data.association_name', 'TEST جمعية');
        $driver = $this->driver();
        foreach (['beneficiary' => 'sms', 'staff' => 'sms', 'organization' => 'sms', 'driver' => 'sms', 'account' => 'email'] as $type => $channel) {
            $reference = $type === 'driver' ? $driver->id : $this->admin->id;
            $m = app(CommunicationService::class)->enqueue('TEST_'.$type, $type, $reference, 'TEST', $this->admin->id, $type === 'account' ? 'test@example.invalid' : '0501234567', 'TEST synthetic message', now()->addMinutes(10));
            $this->assertSame($channel, $m->channel);
            app(CommunicationService::class)->send($m->id);
            $this->assertSame('sent', $m->fresh()->status);
            $this->assertStringStartsWith('fake-', $m->fresh()->provider_reference);
        }
    }

    public function test_receipt_audit_failure_rolls_back_code_inventory_and_receipt(): void
    {
        $s = $this->support();
        $code = $this->issue($s);
        AuditLog::creating(function ($audit) {
            if ($audit->action === 'RECEIPT_VERIFIED') {
                throw new \RuntimeException('TEST audit unavailable');
            }
        });
        try {
            app(ReceiptVerificationService::class)->verify($s->id, $code, $this->admin->id);
            $this->fail('Audit failure must abort receipt transaction');
        } catch (\RuntimeException $e) {
            $this->assertSame('TEST audit unavailable', $e->getMessage());
        } finally {
            AuditLog::flushEventListeners();
        }
        $this->assertDatabaseCount('support_receipts', 0);
        $this->assertDatabaseCount('inventory_movements', 0);
        $this->assertNull(ReceiptChallenge::first()->consumed_at);
        $this->assertSame('100.00', $this->stock->fresh()->current_quantity);
    }

    public function test_driver_sms_failure_preserves_driver_assignment_and_reserved_stock(): void
    {
        $s = $this->support(true);
        [$assignment, $token] = $this->assignment($s);
        $this->app->bind(SmsProviderInterface::class, fn () => new class implements SmsProviderInterface
        {
            public function send(string $idempotencyKey, array $payload): string
            {
                throw new ProviderFailure('provider_unavailable', true);
            }
        });
        $message = CommunicationMessage::where('operation_id', $assignment->id)->firstOrFail();
        app(CommunicationService::class)->send($message->id);
        $this->assertSame('retrying', $message->fresh()->status);
        $this->assertSame('in_delivery', $s->fresh()->status);
        $this->assertSame('2.50', $this->stock->fresh()->reserved_quantity);
        $this->withHeader('X-Driver-Token', $token)->getJson('/api/driver-access')->assertOk();
        $this->assertDatabaseHas('driver_assignments', ['id' => $assignment->id]);
    }

    public function test_email_failure_preserves_reset_token_and_encrypted_retry_payload(): void
    {
        // RETIRED: superseded by PasswordResetOtpTest SMS-failure case.
        $this->assertTrue(true);
    }

    public function test_reset_request_rate_limit_is_enforced(): void
    {
        // Password-recovery requests are throttled per IP.
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/forgot-password', ['username' => 'NO_SUCH_USER'])->assertOk();
        }
        $this->postJson('/api/forgot-password', ['username' => 'NO_SUCH_USER'])->assertStatus(429);
        $this->assertDatabaseCount('communication_messages', 0);
    }

    public function test_driver_access_remains_until_last_assigned_task_completes(): void
    {
        $first = $this->support(true);
        $firstCode = $this->issue($first);
        $last = $this->support(true);
        $lastCode = $this->issue($last);
        $assignment = app(DriverAccessService::class)->assign($this->driver()->id, [$first->id, $last->id], 60, $this->admin->id);
        preg_match('/driver-access#([a-f0-9]{64})/', CommunicationMessage::where('operation_id', $assignment->id)->first()->encrypted_payload['body'], $match);
        $this->withHeader('X-Driver-Token', $match[1])->postJson('/api/driver-access/tasks/'.$first->id.'/confirm', ['code' => $firstCode])->assertOk();
        $this->withHeader('X-Driver-Token', $match[1])->getJson('/api/driver-access')->assertOk()->assertJsonPath('data.remaining', 1);
        $this->withHeader('X-Driver-Token', $match[1])->postJson('/api/driver-access/tasks/'.$last->id.'/confirm', ['code' => $lastCode])->assertOk()->assertJsonPath('completed', true);
        $this->withHeader('X-Driver-Token', $match[1])->getJson('/api/driver-access')->assertOk()->assertJsonPath('data.all_completed', true);
        $this->assertDatabaseCount('support_receipts', 2);
    }

    public function test_driver_sms_template_api_and_whatsapp_operational_api_retirement(): void
    {
        config()->offsetUnset('services.taqnyat.whatsapp');
        config()->offsetUnset('services.taqnyat.whatsapp_base_url');

        $settings = $this->getJson('/api/settings/communications')->assertOk();
        $settings->assertJsonPath('definitions.driver_assignment_sms.required.0', 'temporary_driver_link');
        $settings->assertJsonPath('definitions.driver_assignment_sms.allowed.0', 'driver_name');
        $this->putJson('/api/settings/communications', [
            'templates' => ['driver_assignment_sms' => 'مهمة جديدة {temporary_driver_link}'],
        ])->assertOk();
        $this->putJson('/api/settings/communications', [
            'templates' => ['driver_assignment_sms' => '{national_id} {temporary_driver_link}'],
        ])->assertUnprocessable()->assertJsonValidationErrors('driver_assignment_sms');

        $this->getJson('/api/settings/communications/whatsapp/templates')->assertNotFound();
        $this->postJson('/api/settings/communications/whatsapp/test')->assertNotFound();
        $this->postJson('/api/distributions/00000000-0000-4000-8000-000000000001/whatsapp')->assertStatus(410);

        $driver = Driver::create([
            'full_name' => 'TEST Historical Consent',
            'phone' => '0501234569',
            'is_active' => true,
            'whatsapp_opt_in' => false,
            'whatsapp_opt_out_at' => now(),
            'whatsapp_opt_in_source' => 'historical_record',
        ]);
        AuditLog::create([
            'user_id' => $this->admin->id,
            'action' => 'DRIVER_WHATSAPP_OPT_IN_REVOKED',
            'target_table' => 'drivers',
            'target_id' => $driver->id,
            'details' => ['source' => 'historical_record'],
        ]);

        $this->putJson('/api/support/drivers/'.$driver->id.'/whatsapp-consent', [
            'granted' => true,
            'source' => 'test',
        ])->assertNotFound();
        $this->assertFalse($driver->fresh()->whatsapp_opt_in);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'DRIVER_WHATSAPP_OPT_IN_REVOKED',
            'target_id' => $driver->id,
        ]);
        $this->assertNull(config('services.taqnyat.whatsapp'));
        $this->assertNull(config('services.taqnyat.whatsapp_base_url'));
    }

    public function test_duplicate_driver_sms_worker_call_uses_one_provider_request(): void
    {
        $support = $this->support(true);
        [$assignment] = $this->assignment($support);
        $message = CommunicationMessage::where('operation_type', 'driver_assignment_sms')
            ->where('operation_id', $assignment->id)
            ->firstOrFail();

        $provider = new class implements SmsProviderInterface
        {
            public int $calls = 0;

            public function send(string $idempotencyKey, array $payload): string
            {
                $this->calls++;

                return 'sms-driver-once';
            }
        };
        $this->app->instance(SmsProviderInterface::class, $provider);

        app(CommunicationService::class)->send($message->id);
        app(CommunicationService::class)->send($message->id);

        $this->assertSame(1, $provider->calls);
        $this->assertSame(1, $message->fresh()->attempts);
        $this->assertSame('sent', $message->fresh()->status);
        $this->assertNull($message->fresh()->encrypted_payload);
    }

    public function test_receipt_preview_is_operation_bound_and_consumes_nothing(): void
    {
        $support = $this->support();
        $code = $this->issue($support);
        $auditCount = AuditLog::count();
        $this->postJson('/api/support/distributions/'.$support->id.'/verify-preview', ['code' => $code])
            ->assertOk()->assertJsonPath('data.id', $support->id)->assertJsonPath('data.status', 'ready')
            ->assertJsonPath('data.items.0.name', 'TEST rice');
        $this->assertSame($auditCount, AuditLog::count());
        $this->assertSame('ready', $support->fresh()->status);
        $this->assertSame('100.00', $this->stock->fresh()->current_quantity);
        $this->assertDatabaseCount('support_receipts', 0);
        $this->assertDatabaseCount('inventory_movements', 0);
        $this->assertNull(ReceiptChallenge::first()->consumed_at);
        $delivery = $this->support(true);
        $this->postJson('/api/support/distributions/'.$delivery->id.'/verify-preview', ['code' => $code])->assertForbidden();
    }

    public function test_preview_failed_attempts_share_persistent_verification_lockout(): void
    {
        config(['delivery.receipt_max_attempts' => 2]);
        $support = $this->support();
        $code = $this->issue($support);
        $wrong = $code === '0000' ? '0001' : '0000';
        $this->postJson('/api/support/distributions/'.$support->id.'/verify-preview', ['code' => $wrong])->assertUnprocessable();
        $this->postJson('/api/support/distributions/'.$support->id.'/verify', ['code' => $wrong])->assertStatus(423);
        $this->postJson('/api/support/distributions/'.$support->id.'/verify-preview', ['code' => $code])->assertStatus(423);
        $this->assertSame(2, ReceiptChallenge::first()->failed_attempts);
        $this->assertDatabaseCount('support_receipts', 0);
        $this->assertSame('100.00', $this->stock->fresh()->current_quantity);
    }

    public function test_completed_driver_replay_retains_details_but_does_not_bypass_capability_expiry(): void
    {
        $support = $this->support(true);
        $code = $this->issue($support);
        [$assignment, $token] = $this->assignment($support);
        $url = '/api/driver-access/tasks/'.$support->id.'/confirm';
        $this->withHeader('X-Driver-Token', $token)->postJson($url, ['code' => $code])->assertOk();
        $auditCount = AuditLog::where('action', 'RECEIPT_VERIFIED')->count();
        $this->withHeader('X-Driver-Token', $token)->postJson($url, ['code' => $code])->assertOk()->assertJsonPath('already_completed', true);
        $this->withHeader('X-Driver-Token', $token)->getJson('/api/driver-access')->assertOk()
            ->assertJsonPath('data.tasks.0.reference', $support->id)->assertJsonPath('data.tasks.0.status', 'completed')
            ->assertJsonPath('data.tasks.0.support_type', 'TEST rice')->assertJsonPath('data.all_completed', true);
        $this->assertSame($auditCount, AuditLog::where('action', 'RECEIPT_VERIFIED')->count());
        $this->assertDatabaseCount('support_receipts', 1);
        $this->assertDatabaseCount('inventory_movements', 1);
        $this->assertSame('97.50', $this->stock->fresh()->current_quantity);
        $wrong = $code === '0000' ? '0001' : '0000';
        $this->withHeader('X-Driver-Token', $token)->postJson($url, ['code' => $wrong])->assertUnprocessable();
        $this->travel(61)->minutes();
        $this->withHeader('X-Driver-Token', $token)->postJson($url, ['code' => $code])->assertStatus(410);
        $assignment->update(['expires_at' => now()->addHour(), 'revoked_at' => now()]);
        $this->withHeader('X-Driver-Token', $token)->getJson('/api/driver-access')->assertForbidden();
    }

    public function test_resend_rotates_capability_without_reassigning_or_changing_stock(): void
    {
        $support = $this->support(true);
        [$assignment, $oldToken] = $this->assignment($support);
        $oldMessage = CommunicationMessage::where('operation_id', $assignment->id)->first();
        $this->postJson('/api/support/assignments/'.$assignment->id.'/resend', ['minutes' => 120])->assertOk()->assertJsonMissingPath('data.token_hash');
        $this->assertSame('cancelled', $oldMessage->fresh()->status);
        $this->assertNull($oldMessage->fresh()->encrypted_payload);
        $newMessage = CommunicationMessage::where('operation_id', $assignment->id)->where('status', 'pending')->firstOrFail();
        preg_match('/driver-access#([a-f0-9]{64})/', $newMessage->encrypted_payload['body'], $match);
        $this->assertNotSame($oldToken, $match[1]);
        $this->withHeader('X-Driver-Token', $oldToken)->getJson('/api/driver-access')->assertUnauthorized();
        $this->withHeader('X-Driver-Token', $match[1])->getJson('/api/driver-access')->assertOk()->assertJsonPath('data.total', 1);
        $this->assertDatabaseCount('driver_assignments', 1);
        $this->assertDatabaseCount('driver_assignment_tasks', 1);
        $this->assertSame('in_delivery', $support->fresh()->status);
        $this->assertSame('100.00', $this->stock->fresh()->current_quantity);
        $this->assertSame('2.50', $this->stock->fresh()->reserved_quantity);
        app(DriverAccessService::class)->revoke($assignment->id, $this->admin->id);
        $this->withHeader('X-Driver-Token', $match[1])->getJson('/api/driver-access')->assertForbidden();
        $this->postJson('/api/support/assignments/'.$assignment->id.'/resend', ['minutes' => 120])->assertOk();
        $reopened = CommunicationMessage::where('operation_id', $assignment->id)->where('status', 'pending')->firstOrFail();
        preg_match('/driver-access#([a-f0-9]{64})/', $reopened->encrypted_payload['body'], $replacement);
        $this->withHeader('X-Driver-Token', $match[1])->getJson('/api/driver-access')->assertUnauthorized();
        $this->withHeader('X-Driver-Token', $replacement[1])->getJson('/api/driver-access')->assertOk();
        $this->assertDatabaseHas('audit_logs', ['action' => 'DRIVER_LINK_REVOKED', 'target_id' => $assignment->id]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'DRIVER_LINK_REOPENED', 'target_id' => $assignment->id]);
        $this->assertDatabaseCount('driver_assignments', 1);
        $this->assertDatabaseCount('driver_assignment_tasks', 1);
        $this->assertSame('100.00', $this->stock->fresh()->current_quantity);
        $this->assertSame('2.50', $this->stock->fresh()->reserved_quantity);
    }

    public function test_reassignment_moves_only_active_tasks_and_preserves_history_without_consuming_stock(): void
    {
        $first = $this->support(true);
        $second = $this->support(true);
        $assignment = app(DriverAccessService::class)->assign($this->driver()->id, [$first->id, $second->id], 60, $this->admin->id);
        $oldBody = CommunicationMessage::where('operation_id', $assignment->id)->first()->encrypted_payload['body'];
        preg_match('/driver-access#([a-f0-9]{64})/', $oldBody, $oldMatch);
        $oldToken = $oldMatch[1];
        $replacement = Driver::create(['full_name' => 'TEST Replacement', 'phone' => '0501234577', 'is_active' => true]);
        $reader = User::create(['username' => 'TEST_REASSIGN_DENIED', 'full_name' => 'TEST Denied', 'password' => 'test-password', 'role' => 'readonly', 'is_active' => true]);
        Sanctum::actingAs($reader);
        $this->postJson('/api/support/assignments/reassign', ['driver_id' => $replacement->id, 'tasks' => [$first->id], 'minutes' => 90])->assertForbidden();
        Sanctum::actingAs($this->admin);
        $this->postJson('/api/support/assignments/reassign', ['driver_id' => $assignment->driver_id, 'tasks' => [$first->id], 'minutes' => 90])->assertUnprocessable();
        $this->postJson('/api/support/assignments/reassign', ['driver_id' => $replacement->id, 'tasks' => [$first->id], 'minutes' => 90])->assertCreated()->assertJsonMissingPath('data.token_hash');
        $newAssignment = DriverAssignment::where('driver_id', $replacement->id)->firstOrFail();
        $newBody = CommunicationMessage::where('operation_id', $newAssignment->id)->where('status', 'pending')->firstOrFail()->encrypted_payload['body'];
        preg_match('/driver-access#([a-f0-9]{64})/', $newBody, $newMatch);
        $this->assertNotNull(DB::table('driver_assignment_tasks')->where('driver_assignment_id', $assignment->id)->where('support_distribution_id', $first->id)->value('released_at'));
        $this->assertNull(DB::table('driver_assignment_tasks')->where('driver_assignment_id', $assignment->id)->where('support_distribution_id', $second->id)->value('released_at'));
        try {
            DB::transaction(fn () => DB::table('driver_assignment_tasks')->insert([
                'driver_assignment_id' => $newAssignment->id,
                'support_distribution_id' => $first->id,
            ]));
            $this->fail('A second active task membership must be rejected.');
        } catch (QueryException) {
            $this->assertSame(1, DB::table('driver_assignment_tasks')->where('support_distribution_id', $first->id)->whereNull('released_at')->count());
        }
        $this->assertNull($assignment->fresh()->revoked_at);
        $this->assertSame($replacement->id, $first->fresh()->driver_id);
        $this->assertSame($assignment->driver_id, $second->fresh()->driver_id);
        $this->withHeader('X-Driver-Token', $oldToken)->getJson('/api/driver-access')->assertOk()
            ->assertJsonPath('data.total', 1)->assertJsonPath('data.tasks.0.reference', $second->id);
        $this->withHeader('X-Driver-Token', $oldToken)->getJson('/api/driver-access/tasks/'.$first->id)->assertNotFound();
        $this->withHeader('X-Driver-Token', $newMatch[1])->getJson('/api/driver-access')->assertOk()->assertJsonPath('data.tasks.0.reference', $first->id);
        $audit = AuditLog::where('action', 'DRIVER_TASK_REASSIGNED')->first();
        $this->assertSame([$assignment->id], $audit->details['previous_assignment_ids']);
        $this->assertStringNotContainsString($replacement->phone, json_encode($audit->details));
        $this->assertStringNotContainsString($newMatch[1], json_encode($audit->details));
        $this->assertSame('100.00', $this->stock->fresh()->current_quantity);
        $this->assertSame('5.00', $this->stock->fresh()->reserved_quantity);
        $this->assertDatabaseCount('inventory_movements', 0);
        $code = $this->issue($first);
        $this->withHeader('X-Driver-Token', $oldToken)->postJson('/api/driver-access/tasks/'.$first->id.'/confirm', ['code' => $code])->assertNotFound();
        $this->withHeader('X-Driver-Token', $newMatch[1])->postJson('/api/driver-access/tasks/'.$first->id.'/confirm', ['code' => $code])->assertOk();
        $this->withHeader('X-Driver-Token', $newMatch[1])->postJson('/api/driver-access/tasks/'.$first->id.'/confirm', ['code' => $code])->assertOk()->assertJsonPath('already_completed', true);
        $this->postJson('/api/support/assignments/reassign', ['driver_id' => $replacement->id, 'tasks' => [$first->id], 'minutes' => 90])->assertUnprocessable();
        $this->assertDatabaseCount('support_receipts', 1);
        $this->assertDatabaseCount('inventory_movements', 1);
        $this->assertSame('97.50', $this->stock->fresh()->current_quantity);
        $this->assertDatabaseHas('driver_assignments', ['id' => $assignment->id, 'driver_id' => $assignment->driver_id, 'created_by' => $this->admin->id]);
    }

    public function test_item_name_search_matches_only_the_named_item_and_keeps_authorization(): void
    {
        $alpha = InventoryItem::create(['name' => 'TEST_ONLY_ITEM_ALPHA', 'unit' => 'kg', 'current_quantity' => 20, 'min_threshold' => 1]);
        $beta = InventoryItem::create(['name' => 'TEST_ONLY_ITEM_BETA', 'unit' => 'kg', 'current_quantity' => 20, 'min_threshold' => 1]);
        $firstBeneficiary = Beneficiary::create(['full_name' => 'TEST PERSON ONE', 'national_id' => '7222222221', 'phone' => '0501111111', 'beneficiary_type' => 'citizen', 'status' => 'active']);
        $secondBeneficiary = Beneficiary::create(['full_name' => 'TEST PERSON TWO', 'national_id' => '7222222222', 'phone' => '0502222222', 'beneficiary_type' => 'citizen', 'status' => 'active']);
        $service = app(SupportDistributionService::class);
        $alphaSupport = $service->create(['recipient_type' => 'beneficiary', 'beneficiary_id' => $firstBeneficiary->id, 'fulfillment_method' => 'pickup', 'pickup_location_id' => $this->location->id, 'items' => [['inventory_item_id' => $alpha->id, 'requested_quantity' => '1.00']]], $this->admin->id);
        $betaSupport = $service->create(['recipient_type' => 'beneficiary', 'beneficiary_id' => $secondBeneficiary->id, 'fulfillment_method' => 'pickup', 'pickup_location_id' => $this->location->id, 'items' => [['inventory_item_id' => $beta->id, 'requested_quantity' => '1.00']]], $this->admin->id);
        $found = $this->getJson('/api/support/distributions?q=TEST_ONLY_ITEM_ALPHA')->assertOk();
        $this->assertSame([$alphaSupport->id], collect($found->json('data'))->pluck('id')->all());
        $this->assertNotContains($betaSupport->id, collect($found->json('data'))->pluck('id')->all());
        $viewer = User::create(['username' => 'TEST_ITEM_VIEW', 'full_name' => 'TEST Viewer', 'password' => 'test-password', 'role' => 'staff', 'is_active' => true, 'permissions' => ['support' => ['view' => true]]]);
        Sanctum::actingAs($viewer);
        $this->getJson('/api/support/distributions?q=TEST_ONLY_ITEM_ALPHA')->assertOk()->assertJsonPath('data.0.id', $alphaSupport->id);
        $denied = User::create(['username' => 'TEST_ITEM_DENIED', 'full_name' => 'TEST Denied Search', 'password' => 'test-password', 'role' => 'staff', 'is_active' => true, 'permissions' => ['support' => ['view' => false]]]);
        Sanctum::actingAs($denied);
        $this->getJson('/api/support/distributions?q=TEST_ONLY_ITEM_ALPHA')->assertForbidden();
    }

    public function test_driver_management_metrics_and_deactivation_preserve_history(): void
    {
        $support = $this->support(true);
        [$assignment, $token] = $this->assignment($support);
        $this->getJson('/api/support/drivers')->assertOk()->assertJsonPath('data.0.assigned_count', 1)
            ->assertJsonPath('data.0.in_progress_count', 1)->assertJsonPath('data.0.remaining_count', 1);
        $this->patchJson('/api/support/drivers/'.$assignment->driver_id, ['full_name' => 'TEST Updated Driver', 'is_active' => false])->assertOk();
        $this->withHeader('X-Driver-Token', $token)->getJson('/api/driver-access')->assertForbidden();
        $this->assertDatabaseCount('driver_assignment_tasks', 1);
        $this->assertDatabaseHas('audit_logs', ['action' => 'DRIVER_DEACTIVATED', 'target_id' => $assignment->driver_id]);
        $reader = User::create(['username' => 'TEST_DRIVER_READ', 'full_name' => 'TEST Reader', 'password' => 'test-password', 'role' => 'staff', 'is_active' => true,
            'permissions' => ['support' => ['view' => true, 'edit' => true, 'create' => true]]]);
        Sanctum::actingAs($reader);
        $this->patchJson('/api/support/drivers/'.$assignment->driver_id, ['is_active' => true])->assertForbidden();
        $this->postJson('/api/support/assignments/'.$assignment->id.'/resend', ['minutes' => 60])->assertForbidden();
    }

    public function test_operational_filters_metrics_and_pagination_cover_matching_dataset(): void
    {
        $pickup = $this->support();
        $delivery = $this->support(true);
        $payload = $pickup->getAttributes();
        $rows = [];
        for ($i = 0; $i < 104; $i++) {
            $rows[] = array_replace($payload, ['id' => (string) Str::uuid(), 'recipient_name' => 'TEST MATCH '.$i]);
        }
        DB::table('support_distributions')->insert($rows);
        $first = $this->getJson('/api/support/distributions?fulfillment_method=pickup&q=TEST%20MATCH&per_page=-1')
            ->assertOk()->assertJsonPath('total', 104)->assertJsonPath('last_page', 2)->assertJsonPath('metrics.total', 104);
        $this->assertCount(100, $first->json('data'));
        $second = $this->getJson('/api/support/distributions?fulfillment_method=pickup&q=TEST%20MATCH&per_page=-1&page=2')->assertOk();
        $this->assertCount(4, $second->json('data'));
        $this->getJson('/api/support/distributions?fulfillment_method=delivery&reference='.$delivery->id)
            ->assertOk()->assertJsonPath('total', 1)->assertJsonPath('metrics.not_started', 1)->assertJsonPath('data.0.id', $delivery->id);
        $this->getJson('/api/support/distributions?fulfillment_method=pickup&reference='.$delivery->id)->assertOk()->assertJsonPath('total', 0);
        $code = $this->issue($pickup);
        $this->postJson('/api/support/distributions/'.$pickup->id.'/verify', ['code' => $code])->assertOk();
        $this->getJson('/api/support/distributions?status=completed&employee_id='.$this->admin->id.'&date_from='.now()->format('Y-m-d').'&date_to='.now()->format('Y-m-d'))
            ->assertOk()->assertJsonPath('total', 1)->assertJsonPath('data.0.receipt.employee_name', 'TEST Admin')
            ->assertJsonPath('data.0.proof_available', true)->assertJsonMissingPath('data.0.beneficiary');
    }

    public function test_unified_delivery_proof_is_real_pdf_and_requires_completed_authorized_support(): void
    {
        $support = $this->support(true);
        $code = $this->issue($support);
        [$assignment, $token] = $this->assignment($support);
        $this->getJson('/api/support/distributions/'.$support->id.'/proof')->assertStatus(409);
        $this->withHeader('X-Driver-Token', $token)->postJson('/api/driver-access/tasks/'.$support->id.'/confirm', ['code' => $code])->assertOk();
        $pdf = $this->get('/api/support/distributions/'.$support->id.'/proof')->assertOk()->assertHeader('Content-Type', 'application/pdf');
        $this->assertStringStartsWith('%PDF-', $pdf->getContent());
        $path = tempnam(sys_get_temp_dir(), 'ekram-proof-');
        try {
            file_put_contents($path, $pdf->getContent());
            $process = new Process(['pdftotext', '-enc', 'UTF-8', $path, '-']);
            $process->mustRun();
            $text = $process->getOutput();
            foreach (['TEST Driver', 'TEST Admin', 'TEST organization', 'TEST rice', $support->id] as $evidence) {
                $this->assertStringContainsString($evidence, $text);
            }
            $this->assertStringNotContainsString(ReceiptChallenge::first()->verifier, $text);
        } finally {
            if (is_file($path)) {
                unlink($path);
            }
        }
        $reader = User::create(['username' => 'TEST_PROOF_DENIED', 'full_name' => 'TEST Denied', 'password' => 'test-password', 'role' => 'readonly', 'is_active' => true]);
        Sanctum::actingAs($reader);
        $this->getJson('/api/support/distributions/'.$support->id.'/proof')->assertForbidden();
        $this->assertDatabaseCount('support_receipts', 1);
        $this->assertDatabaseCount('inventory_movements', 1);
    }

    public function test_driver_creation_audit_failure_is_atomic(): void
    {
        AuditLog::creating(function ($audit) {
            if ($audit->action === 'DRIVER_CREATED') {
                throw new \RuntimeException('TEST driver audit unavailable');
            }
        });
        try {
            $this->withoutExceptionHandling();
            $this->postJson('/api/support/drivers', ['full_name' => 'TEST atomic driver', 'phone' => '0501234568']);
            $this->fail('Driver creation must roll back with its audit');
        } catch (\RuntimeException $error) {
            $this->assertSame('TEST driver audit unavailable', $error->getMessage());
        } finally {
            AuditLog::flushEventListeners();
        }
        $this->assertDatabaseCount('drivers', 0);
    }

    private function proofText(string $supportId, string $source): string
    {
        $response = $this->get('/api/support/distributions/'.$supportId.'/proof')->assertOk()
            ->assertHeader('Content-Type', 'application/pdf')->assertHeader('X-Proof-Source', $source);
        $path = tempnam(sys_get_temp_dir(), 'ekram-proof-snapshot-');
        try {
            file_put_contents($path, $response->getContent());
            $process = new Process(['pdftotext', '-enc', 'UTF-8', $path, '-']);
            $process->mustRun();

            return $process->getOutput();
        } finally {
            if (is_file($path)) {
                unlink($path);
            }
        }
    }

    public function test_delivery_proof_preserves_confirmation_time_identity_contact_items_and_driver(): void
    {
        $beneficiary = Beneficiary::create(['full_name' => 'TEST BEFORE DELIVERY', 'national_id' => '7111111111',
            'phone' => '0501234567', 'beneficiary_type' => 'citizen', 'status' => 'active',
            'city' => 'TEST CITY', 'district' => 'TEST DISTRICT', 'street' => 'TEST DELIVERY ADDRESS']);
        $service = app(SupportDistributionService::class);
        $support = $service->create(['recipient_type' => 'beneficiary', 'beneficiary_id' => $beneficiary->id,
            'fulfillment_method' => 'delivery', 'items' => [['inventory_item_id' => $this->stock->id, 'requested_quantity' => '2.50']]], $this->admin->id);
        foreach (['approve', 'reserve', 'ready'] as $action) {
            $support = $service->transition($support->id, $action, $this->admin->id);
        }
        $beneficiary->update(['full_name' => 'TEST AT DELIVERY']);
        $code = $this->issue($support);
        [$assignment, $token] = $this->assignment($support);
        $this->withHeader('X-Driver-Token', $token)->postJson('/api/driver-access/tasks/'.$support->id.'/confirm', ['code' => $code])->assertOk();
        $receipt = SupportReceipt::where('support_distribution_id', $support->id)->firstOrFail();
        $snapshot = $receipt->proof_snapshot;
        $this->assertSame('TEST AT DELIVERY', $snapshot['recipient']['display_name']);
        $this->assertSame('0501234567', $snapshot['recipient']['phone']);
        $this->assertStringContainsString('TEST DELIVERY ADDRESS', $snapshot['recipient']['full_address']);
        $this->assertSame('TEST Driver', $snapshot['driver']['name']);
        $this->assertSame($assignment->driver_id, $snapshot['driver']['id']);
        $this->assertSame($assignment->id, $snapshot['driver']['assignment_id']);
        $this->assertSame($support->id, $snapshot['task_reference']);
        $this->assertSame($receipt->confirmed_at->toIso8601String(), $snapshot['confirmed_at']);
        $this->assertSame($support->fresh()->completed_at->toIso8601String(), $snapshot['confirmed_at']);
        $this->assertSame('receipt_code', $snapshot['verification_method']);
        $this->assertSame('TEST rice', $snapshot['items'][0]['name']);
        $this->assertSame('2.50', $snapshot['items'][0]['quantity']);
        $this->assertArrayNotHasKey('proof_snapshot', $receipt->toArray());

        $beneficiary->update(['full_name' => 'TEST CURRENT CONTACT', 'phone' => '0509999999', 'street' => 'TEST NEW ADDRESS']);
        $assignment->driver->update(['full_name' => 'TEST NEW DRIVER']);
        $this->stock->update(['name' => 'TEST NEW ITEM']);
        $this->admin->update(['full_name' => 'TEST NEW EMPLOYEE']);
        $this->withHeader('X-Driver-Token', $token)->postJson('/api/driver-access/tasks/'.$support->id.'/confirm', ['code' => $code])
            ->assertOk()->assertJsonPath('already_completed', true);
        $this->assertSame($snapshot, $receipt->fresh()->proof_snapshot);
        $text = $this->proofText($support->id, 'confirmation-snapshot');
        foreach (['TEST AT DELIVERY', '0501234567', 'TEST DELIVERY ADDRESS', 'TEST Driver', 'TEST Admin', 'TEST rice', $support->id] as $value) {
            $this->assertStringContainsString($value, $text);
        }
        foreach (['TEST CURRENT CONTACT', '0509999999', 'TEST NEW ADDRESS', 'TEST NEW DRIVER', 'TEST NEW ITEM', 'TEST NEW EMPLOYEE'] as $value) {
            $this->assertStringNotContainsString($value, $text);
        }
        $this->assertDatabaseCount('support_receipts', 1);
        $this->assertDatabaseCount('inventory_movements', 1);
        $this->assertSame('97.50', $this->stock->fresh()->current_quantity);
    }

    public function test_historical_receipt_has_explicit_current_data_fallback_without_backfill_on_replay(): void
    {
        $support = $this->support();
        $code = $this->issue($support);
        app(SupportDistributionService::class)->transition($support->id, 'complete', $this->admin->id);
        ReceiptChallenge::first()->update(['consumed_at' => now()]);
        $receipt = SupportReceipt::create(['support_distribution_id' => $support->id,
            'driver_assignment_id' => null, 'confirmed_by' => $this->admin->id, 'confirmed_at' => now()]);
        $this->organization->update(['contact' => '0509999999']);
        $this->postJson('/api/support/distributions/'.$support->id.'/verify', ['code' => $code])
            ->assertOk()->assertJsonPath('already_completed', true);
        $text = $this->proofText($support->id, 'legacy-current-data');
        $this->assertStringContainsString('0509999999', $text);
        $this->assertNull($receipt->fresh()->proof_snapshot);
        $html = view('pdf.support_proof', ['receipt' => $receipt, 'legacy' => true, 'generatedAt' => now(), 'confirmedAt' => $receipt->confirmed_at,
            'proof' => ['fulfillment_method' => 'pickup', 'task_reference' => $support->id,
                'recipient' => ['display_name' => 'TEST', 'reference' => null, 'phone' => null, 'full_address' => null],
                'pickup_location' => 'TEST', 'employee' => ['name' => 'TEST'], 'items' => []]])->render();
        $this->assertStringContainsString('لا تعد إثباتاً لهذه التفاصيل وقت التسليم', $html);
    }

    public function test_snapshot_changes_are_rejected_and_recorded_snapshot_rollback_is_refused(): void
    {
        $support = $this->support();
        $code = $this->issue($support);
        $this->postJson('/api/support/distributions/'.$support->id.'/verify', ['code' => $code])->assertOk();
        $receipt = SupportReceipt::firstOrFail();
        $snapshot = $receipt->proof_snapshot;
        try {
            $receipt->update(['proof_snapshot' => ['recipient' => ['display_name' => 'TEST overwrite']]]);
            $this->fail('An immutable snapshot must reject model overwrite');
        } catch (\LogicException $error) {
            $this->assertSame('Receipt proof snapshots are immutable.', $error->getMessage());
        }
        $this->assertSame($snapshot, $receipt->fresh()->proof_snapshot);
        $migration = require database_path('migrations/2026_10_04_000020_add_immutable_proof_snapshot_to_support_receipts.php');
        try {
            $migration->down();
            $this->fail('Recorded historical evidence must block rollback');
        } catch (\RuntimeException $error) {
            $this->assertStringContainsString('immutable receipt proof snapshots exist', $error->getMessage());
        }
        $this->assertSame($snapshot, $receipt->fresh()->proof_snapshot);
        if (DB::connection()->getDriverName() === 'pgsql') {
            // A savepoint lets the suite continue after PostgreSQL rejects the direct update.
            try {
                DB::transaction(fn () => DB::table('support_receipts')->where('id', $receipt->id)->update(['proof_snapshot' => null]));
                $this->fail('PostgreSQL must reject direct snapshot mutation');
            } catch (QueryException $error) {
                $this->assertStringContainsString('Receipt proof snapshots are immutable', $error->getMessage());
            }
            $this->assertSame($snapshot, $receipt->fresh()->proof_snapshot);
        }
    }

    public function test_assignment_survives_sms_enqueue_failure_and_the_link_still_opens(): void
    {
        $support = $this->support(true);
        $driver = $this->driver();
        $this->mock(CommunicationService::class, function ($mock) {
            $mock->shouldReceive('enqueue')->once()->andThrow(new \RuntimeException('sms unavailable'));
        });

        $response = $this->postJson('/api/support/assignments', [
            'driver_id' => $driver->id,
            'tasks' => [$support->id],
            'minutes' => 60,
        ])->assertCreated();
        $this->assertStringContainsString('no-store', (string) $response->headers->get('Cache-Control'));

        $url = $response->json('access_url');
        preg_match('/driver-access#([a-f0-9]{64})$/', (string) $url, $match);
        $this->assertNotEmpty($match[1] ?? null);
        $assignment = DriverAssignment::firstOrFail();
        $this->assertSame(hash('sha256', $match[1]), $assignment->token_hash);
        $this->assertSame('in_delivery', $support->fresh()->status);
        $this->assertSame(0, CommunicationMessage::where('operation_id', $assignment->id)->count());
        $this->assertSame(200, app(DriverAccessService::class)->access($match[1])['status']);
        $this->assertStringNotContainsString($match[1], AuditLog::query()->pluck('details')->implode(' '));
    }

    public function test_revealing_a_driver_link_does_not_rotate_it(): void
    {
        $support = $this->support(true);
        $created = $this->postJson('/api/support/assignments', [
            'driver_id' => $this->driver()->id,
            'tasks' => [$support->id],
            'minutes' => 60,
        ])->assertCreated();
        $assignment = DriverAssignment::firstOrFail();
        $hash = $assignment->token_hash;
        $messages = CommunicationMessage::where('operation_id', $assignment->id)->count();

        $first = $this->getJson('/api/support/assignments/'.$assignment->id.'/link')
            ->assertOk()->assertHeader('Referrer-Policy', 'no-referrer');
        $this->assertStringContainsString('no-store', (string) $first->headers->get('Cache-Control'));
        $second = $this->getJson('/api/support/assignments/'.$assignment->id.'/link')->assertOk();

        $this->assertSame($created->json('access_url'), $first->json('data.access_url'));
        $this->assertSame($first->json('data.access_url'), $second->json('data.access_url'));
        $this->assertSame($hash, $assignment->fresh()->token_hash);
        $this->assertSame($messages, CommunicationMessage::where('operation_id', $assignment->id)->count());
        preg_match('/driver-access#([a-f0-9]{64})$/', (string) $first->json('data.access_url'), $match);
        $this->assertStringNotContainsString($match[1], AuditLog::query()->pluck('details')->implode(' '));

        $staff = User::create(['username' => 'TEST_2B_STAFF', 'full_name' => 'TEST Staff', 'password' => 'test-password', 'email' => 'staff@example.invalid', 'role' => 'staff', 'is_active' => true]);
        Sanctum::actingAs($staff);
        $this->getJson('/api/support/assignments/'.$assignment->id.'/link')->assertForbidden();
        $this->postJson('/api/support/drivers', ['full_name' => 'TEST blocked', 'phone' => '0501234577'])->assertForbidden();

        Sanctum::actingAs($this->admin);
        $assignment->forceFill(['capability_ciphertext' => null])->save();
        $this->getJson('/api/support/assignments/'.$assignment->id.'/link')->assertNotFound();
        $this->assertSame($hash, $assignment->fresh()->token_hash);

        $rotated = $this->postJson('/api/support/assignments/'.$assignment->id.'/resend', ['minutes' => 60])->assertOk();
        $this->assertNotSame($hash, $assignment->fresh()->token_hash);
        $this->assertNotSame($created->json('access_url'), $rotated->json('access_url'));
        $this->getJson('/api/driver-access', ['X-Driver-Token' => $match[1]])->assertStatus(401);
    }
}
