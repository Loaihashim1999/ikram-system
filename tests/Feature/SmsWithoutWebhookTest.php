<?php

namespace Tests\Feature;

use App\Providers\AppServiceProvider;
use App\Services\Communications\CommunicationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\RefreshDatabaseState;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class SmsWithoutWebhookTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config([
            'app.key' => 'base64:'.base64_encode(str_repeat('W', 32)),
            'queue.default' => 'database',
            'delivery.communication_queue' => 'ekram-communications-v2',
            'services.communications.provider' => 'taqnyat',
            'services.taqnyat.api_base_url' => 'https://api.taqnyat.sa',
            'services.taqnyat.sms.token' => 'MOCK_ONLY',
            'services.taqnyat.sms.sender' => 'TEST',
            'services.taqnyat.sms_webhook.enabled' => false,
            'services.taqnyat.sms_webhook.acknowledgement' => '',
        ]);
        (new AppServiceProvider($this->app))->register();
        Http::preventStrayRequests();
    }

    protected function tearDown(): void
    {
        parent::tearDown();
        // The queue test commits the fixture transaction to exercise afterCommit.
        RefreshDatabaseState::$inMemoryConnections = [];
        RefreshDatabaseState::$migrated = false;
    }

    public function test_queue_submission_without_webhook_records_acceptance_but_never_delivery(): void
    {
        Http::fake(['api.taqnyat.sa/v1/messages' => Http::response([
            'statusCode' => 201, 'messageId' => 'MOCK_NO_WEBHOOK', 'rejected' => [],
        ], 201)]);
        $service = app(CommunicationService::class);
        $message = $service->enqueue('TEST_NO_WEBHOOK', 'staff', 'TEST', 'TEST', 'TEST', '0501234567', 'TEST', now()->addHour());
        Http::assertNothingSent();

        while (DB::transactionLevel() > 0) {
            DB::commit();
        }
        $this->assertSame(1, DB::table('jobs')->where('queue', 'ekram-communications-v2')->count());
        $this->artisan('queue:work', [
            'connection' => 'database', '--queue' => 'ekram-communications-v2', '--once' => true, '--tries' => 1,
        ])->assertSuccessful();

        $message->refresh();
        $this->assertSame('sent', $message->status);
        $this->assertSame('MOCK_NO_WEBHOOK', $message->provider_reference);
        $this->assertSame('provider_accepted', $message->provider_diagnostics['acceptance_state']);
        $this->assertSame('unconfirmed', $message->provider_diagnostics['delivery_state']);
        $this->assertNotNull($message->sent_at);
        $this->assertNull($message->delivered_at);
        $this->assertNull($message->encrypted_payload);

        // An unsolicited callback cannot turn provider acceptance into delivery.
        $this->postJson('/api/webhooks/taqnyat/sms', ['status' => 'delivered'])
            ->assertStatus(503)->assertExactJson(['status' => 'unavailable']);
        $this->assertNull($message->fresh()->delivered_at);
        $this->assertSame('unconfirmed', $message->fresh()->provider_diagnostics['delivery_state']);

        $same = $service->enqueue('TEST_NO_WEBHOOK', 'staff', 'TEST', 'TEST', 'TEST', '0501234567', 'TEST', now()->addHour());
        $this->assertSame($message->id, $same->id);
        $service->send($message->id);
        try {
            $service->retry($message->id);
            $this->fail('An accepted submission must not be retried without a webhook.');
        } catch (ValidationException) {
            $this->assertSame(1, $message->fresh()->attempts);
        }
        $this->assertSame(0, DB::table('jobs')->count());
        $this->assertSame(0, DB::table('support_receipts')->count());
        $this->assertSame(0, DB::table('inventory_movements')->count());
        Http::assertSentCount(1);
    }

    public function test_ambiguous_outcome_stays_quarantined_without_webhook(): void
    {
        Http::fake(['api.taqnyat.sa/v1/messages' => Http::response([], 503)]);
        $service = app(CommunicationService::class);
        $message = $service->enqueue('TEST_UNKNOWN_NO_WEBHOOK', 'staff', 'TEST', 'TEST', 'TEST', '0501234567', 'TEST', now()->addHour(), dispatch: false);
        $service->send($message->id);
        $service->send($message->id);

        $message->refresh();
        $this->assertSame('send_outcome_unknown', $message->error_code);
        $this->assertTrue($message->provider_diagnostics['reconciliation_required']);
        $this->assertSame('unknown', $message->provider_diagnostics['delivery_state']);
        $this->assertNull($message->delivered_at);
        try {
            $service->retry($message->id);
            $this->fail('Missing delivery reports must never authorize an ambiguous retry.');
        } catch (ValidationException) {
            $this->assertSame(1, $message->fresh()->attempts);
        }
        $this->assertSame(0, DB::table('jobs')->count());
        Http::assertSentCount(1);
    }
}
