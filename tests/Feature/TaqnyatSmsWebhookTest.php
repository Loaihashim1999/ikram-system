<?php

namespace Tests\Feature;

use App\Models\CommunicationMessage;
use App\Services\Communications\CommunicationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class TaqnyatSmsWebhookTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config([
            'services.taqnyat.sms_webhook.enabled' => false,
            'services.taqnyat.sms_webhook.acknowledgement' => 'EKRAM_WEBHOOK_RECEIVED',
        ]);
    }

    public function test_disabled_and_unverified_requests_do_not_acknowledge_or_change_sms_state(): void
    {
        Queue::fake();
        $message = $this->sms();
        $before = $message->fresh()->only(['status', 'provider_reference', 'delivered_at', 'failed_at', 'provider_diagnostics', 'attempts']);

        foreach (['get', 'put', 'patch'] as $method) {
            $response = $this->json($method, '/api/webhooks/taqnyat/sms', $this->unverifiedFixture());
            $response->assertStatus(405);
            $this->assertStringNotContainsString('EKRAM_WEBHOOK_RECEIVED', $response->getContent());
        }

        $post = $this->postJson('/api/webhooks/taqnyat/sms', $this->unverifiedFixture());
        $post->assertStatus(503)->assertExactJson(['status' => 'unavailable']);
        $this->assertStringNotContainsString('EKRAM_WEBHOOK_RECEIVED', $post->getContent());

        $this->withHeader('Authorization', 'Bearer TEST_NOT_A_WEBHOOK_SECRET')
            ->postJson('/api/webhooks/taqnyat/sms', $this->unverifiedFixture())
            ->assertStatus(503)
            ->assertExactJson(['status' => 'unavailable']);

        config(['services.taqnyat.sms_webhook.enabled' => true]);
        $enabled = $this->postJson('/api/webhooks/taqnyat/sms', $this->unverifiedFixture());
        $enabled->assertStatus(503)->assertExactJson(['status' => 'unavailable']);
        $this->assertStringNotContainsString('EKRAM_WEBHOOK_RECEIVED', $enabled->getContent());

        $this->assertSame($before, $message->fresh()->only(['status', 'provider_reference', 'delivered_at', 'failed_at', 'provider_diagnostics', 'attempts']));
        $this->assertSame(0, DB::table('support_receipts')->count());
        $this->assertSame(0, DB::table('inventory_items')->count());
        $this->assertSame(0, DB::table('inventory_movements')->count());
        Queue::assertNothingPushed();
        $this->mock(CommunicationService::class, function ($mock) {
            $mock->shouldNotReceive('send');
            $mock->shouldNotReceive('retry');
        });
        $this->postJson('/api/webhooks/taqnyat/sms', $this->unverifiedFixture())->assertStatus(503);
    }

    public function test_oversized_malformed_and_duplicate_reports_stay_unacknowledged(): void
    {
        $message = $this->sms();
        Log::spy();

        $this->call('POST', '/api/webhooks/taqnyat/sms', [], [], [], [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], str_repeat('x', 8193))
            ->assertStatus(503)
            ->assertExactJson(['status' => 'unavailable']);

        $this->call('POST', '/api/webhooks/taqnyat/sms', [], [], [], [
            'CONTENT_TYPE' => 'text/plain',
            'HTTP_ACCEPT' => 'application/json',
        ], 'not-a-delivery-report')
            ->assertStatus(503);

        $this->postJson('/api/webhooks/taqnyat/sms', ['status' => 'unknown-provider-state'])->assertStatus(503);
        $this->postJson('/api/webhooks/taqnyat/sms', ['status' => 'unknown-provider-state'])->assertStatus(503);

        $this->assertNull($message->fresh()->delivered_at);
        $this->assertSame('unconfirmed', $message->fresh()->provider_diagnostics['delivery_state']);
        Log::shouldHaveReceived('info')->withArgs(function (string $message, array $context) {
            $encoded = json_encode($context);

            return $message === 'taqnyat_sms_webhook'
                && ($context['result'] ?? null) === 'rejected'
                && ! str_contains((string) $encoded, 'EKRAM_WEBHOOK_RECEIVED')
                && ! str_contains((string) $encoded, 'not-a-delivery-report');
        });
    }

    public function test_configured_phrase_is_exact_and_is_not_a_successful_response(): void
    {
        $this->assertSame('EKRAM_WEBHOOK_RECEIVED', config('services.taqnyat.sms_webhook.acknowledgement'));
        $this->assertFalse(config('services.taqnyat.sms_webhook.enabled'));

        config(['services.taqnyat.sms_webhook.acknowledgement' => '']);
        config(['services.taqnyat.sms_webhook.enabled' => true]);
        $this->postJson('/api/webhooks/taqnyat/sms', [])
            ->assertStatus(503)
            ->assertExactJson(['status' => 'unavailable']);
    }

    public function test_refusal_does_not_query_or_acknowledge_when_logging_fails(): void
    {
        Queue::fake();
        DB::flushQueryLog();
        DB::enableQueryLog();
        $this->postJson('/api/webhooks/taqnyat/sms', $this->unverifiedFixture())->assertStatus(503);
        $this->assertSame([], DB::getQueryLog());
        DB::disableQueryLog();

        Log::shouldReceive('info')->once()->andThrow(new \RuntimeException('TEST log failure'));
        $failed = $this->postJson('/api/webhooks/taqnyat/sms', $this->unverifiedFixture());
        $failed->assertStatus(503)->assertExactJson(['status' => 'unavailable']);
        $this->assertStringNotContainsString('EKRAM_WEBHOOK_RECEIVED', $failed->getContent());
        Queue::assertNothingPushed();
    }

    /**
     * Internal negative fixture. This is not a verified Taqnyat delivery-report example.
     * messageId below is only the documented SMS submission response field, not a callback schema.
     *
     * @return array<string, string>
     */
    private function unverifiedFixture(): array
    {
        return [
            'messageId' => 'TEST-SUBMISSION-REFERENCE',
            'status' => 'delivered',
        ];
    }

    private function sms(): CommunicationMessage
    {
        return CommunicationMessage::create([
            'idempotency_key' => 'TEST_WEBHOOK_SMS',
            'channel' => 'sms',
            'operation_type' => 'TEST',
            'operation_id' => 'TEST',
            'recipient_type' => 'driver',
            'recipient_reference' => 'TEST',
            'destination' => '***567',
            'payload_expires_at' => now()->addHour(),
            'status' => 'sent',
            'requested_at' => now(),
            'sent_at' => now(),
            'provider_reference' => 'TEST-PROVIDER-REF',
            'provider_diagnostics' => [
                'acceptance_state' => 'provider_accepted',
                'delivery_state' => 'unconfirmed',
            ],
        ]);
    }
}
