<?php

namespace Tests\Feature;

use App\Contracts\Communications\EmailProviderInterface;
use App\Contracts\Communications\SmsProviderInterface;
use App\Jobs\SendCommunication;
use App\Models\AuditLog;
use App\Models\CommunicationMessage;
use App\Models\User;
use App\Providers\AppServiceProvider;
use App\Services\Communications\CommunicationService;
use App\Services\Communications\FakeEmailProvider;
use App\Services\Communications\FakeSmsProvider;
use App\Services\Communications\ProviderFailure;
use App\Services\Communications\SaudiPhoneNumber;
use App\Services\Communications\TaqnyatEmailProvider;
use App\Services\Communications\TaqnyatSmsProvider;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Queue;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class Phase2CTaqnyatTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config([
            'app.key' => 'base64:'.base64_encode(str_repeat('C', 32)),
            'services.taqnyat.api_base_url' => 'https://api.taqnyat.sa',
            'services.taqnyat.sms.token' => 'TEST_SMS_SECRET',
            'services.taqnyat.sms.sender' => 'IKRAM_TEST',
            'services.taqnyat.email.token' => 'TEST_EMAIL_SECRET',
            'services.taqnyat.email.from' => 'noreply@example.invalid',
            'services.taqnyat.email.campaign' => 'IKRAM TEST',
        ]);
        Queue::fake();
    }

    public function test_safe_fake_mode_never_calls_taqnyat_and_missing_real_config_fails_closed(): void
    {
        Http::preventStrayRequests();
        $this->assertInstanceOf(FakeSmsProvider::class, app(SmsProviderInterface::class));
        $this->assertInstanceOf(FakeEmailProvider::class, app(EmailProviderInterface::class));
        $this->assertStringStartsWith('fake-', app(SmsProviderInterface::class)->send('TEST_KEY', []));
        $this->assertGreaterThan(0, config('services.taqnyat.connect_timeout'));
        $this->assertLessThanOrEqual(60, config('services.taqnyat.timeout'));

        config(['services.taqnyat.sms.token' => null]);
        try {
            app(TaqnyatSmsProvider::class)->send('TEST_KEY', ['destination' => '0501234567', 'body' => 'TEST']);
            $this->fail('Missing configuration must fail closed.');
        } catch (ProviderFailure $failure) {
            $this->assertSame('provider_not_configured', $failure->category);
            $this->assertFalse($failure->retryable);
        }
    }

    public function test_explicit_taqnyat_mode_resolves_the_real_provider(): void
    {
        config(['services.communications.provider' => 'taqnyat']);
        (new AppServiceProvider($this->app))->register();

        $this->assertInstanceOf(TaqnyatSmsProvider::class, app(SmsProviderInterface::class));
        $this->assertInstanceOf(TaqnyatEmailProvider::class, app(EmailProviderInterface::class));
    }

    public function test_saudi_mobile_normalization_has_one_strict_provider_format(): void
    {
        $phones = app(SaudiPhoneNumber::class);
        foreach (['0501234567', '501234567', '+966501234567', '00966 50-123-4567', '(+966) 50 123 4567'] as $input) {
            $this->assertSame('966501234567', $phones->normalize($input));
        }
        $this->assertSame('966574917155', $phones->normalize('0574917155'));
        foreach (['', '0112345678', '966401234567', '050123'] as $input) {
            try {
                $phones->normalize($input);
                $this->fail('Invalid or empty mobile accepted: '.$input);
            } catch (ValidationException $exception) {
                $this->assertArrayHasKey('destination', $exception->errors());
            }
        }
    }

    public function test_sms_adapter_uses_official_shape_auth_sender_and_returns_message_id(): void
    {
        Http::fake(['api.taqnyat.sa/v1/messages' => Http::response([
            'statusCode' => 201, 'messageId' => 5452899970, 'accepted' => '[966501234567,]', 'rejected' => '[]',
        ], 201)]);

        $id = app(TaqnyatSmsProvider::class)->send('TEST_KEY', ['destination' => '050 123 4567', 'body' => 'رسالة اختبار']);
        $this->assertSame('5452899970', $id);
        Http::assertSent(function (Request $request) {
            return $request->url() === 'https://api.taqnyat.sa/v1/messages'
                && $request->hasHeader('Authorization', 'Bearer TEST_SMS_SECRET')
                && $request['recipients'] === ['966501234567']
                && $request['sender'] === 'IKRAM_TEST'
                && $request['body'] === 'رسالة اختبار';
        });
    }

    public function test_all_sms_recipient_types_use_adapter_and_persist_safe_provider_ids(): void
    {
        Http::fake(['api.taqnyat.sa/v1/messages' => Http::sequence()
            ->push(['statusCode' => 201, 'messageId' => 101], 201)
            ->push(['statusCode' => 201, 'messageId' => 102], 201)
            ->push(['statusCode' => 201, 'messageId' => 103], 201)
            ->push(['statusCode' => 201, 'messageId' => 104], 201)]);
        $this->app->instance(SmsProviderInterface::class, app(TaqnyatSmsProvider::class));

        foreach (['beneficiary', 'staff', 'organization', 'driver'] as $index => $type) {
            $message = app(CommunicationService::class)->enqueue('TEST_'.$type, $type, (string) $index, 'TEST', (string) $index, '0501234567', 'TEST body', now()->addMinutes(5));
            app(CommunicationService::class)->send($message->id);
            $this->assertSame('sent', $message->fresh()->status);
            $this->assertSame((string) (101 + $index), $message->fresh()->provider_reference);
            $this->assertNull($message->fresh()->encrypted_payload);
        }
        Http::assertSentCount(4);
    }

    public function test_email_uses_official_contract_without_changing_password_reset_channel(): void
    {
        Http::fake(['api.taqnyat.sa/mailSend.php' => Http::response([
            'status' => 1, 'ResponseStatus' => 'success', 'Data' => ['msgId' => 202], 'Error' => null,
        ], 201)]);
        $id = app(TaqnyatEmailProvider::class)->send('TEST_KEY', [
            'destination' => 'admin@example.invalid', 'subject' => 'استعادة الحساب', 'body' => 'رابط آمن',
        ]);
        $this->assertSame('202', $id);
        Http::assertSent(fn (Request $request) => $request['campaignName'] === 'IKRAM TEST'
            && $request['from'] === 'noreply@example.invalid'
            && $request['to'] === ['admin@example.invalid']
            && $request['msg'] === 'رابط آمن');
    }

    public function test_http_timeout_rate_limit_server_and_client_failures_are_classified(): void
    {
        Http::fakeSequence()
            ->pushFailedConnection()
            ->push([], 429)
            ->push([], 503)
            ->push(['statusCode' => 400, 'message' => 'invalid'], 400)
            ->push(['unexpected' => true], 201);
        $cases = [
            ['provider_timeout', true],
            ['provider_rate_limited', true],
            ['provider_temporary', true],
            ['provider_rejected', false],
            ['provider_malformed_response', false],
        ];
        foreach ($cases as [$category, $retryable]) {
            try {
                app(TaqnyatSmsProvider::class)->send('TEST_KEY', ['destination' => '0501234567', 'body' => 'TEST']);
                $this->fail('Provider failure was accepted.');
            } catch (ProviderFailure $failure) {
                $this->assertSame($category, $failure->category);
                $this->assertSame($retryable, $failure->retryable);
            }
        }
    }

    public function test_sanitized_http_diagnostics_are_persisted_without_secrets_or_recipient_data(): void
    {
        Http::fake(['api.taqnyat.sa/v1/messages' => Http::response([
            'message' => '102',
            'reason' => 'IP blocked Bearer LEAK_TOKEN https://example.invalid/driver#TEMP 966501234567 user@example.test ABCDEFGHIJKLMNOPQRSTUVWXYZ123456',
        ], 400, ['Content-Type' => 'application/json; charset=UTF-8'])]);
        $this->app->instance(SmsProviderInterface::class, app(TaqnyatSmsProvider::class));
        $message = app(CommunicationService::class)->enqueue(
            'TEST_DIAGNOSTICS', 'beneficiary', '1', 'TEST', '1', '0501234567', 'TEST', now()->addMinutes(5),
        );

        app(CommunicationService::class)->send($message->id);
        $message->refresh();
        $diagnostics = $message->provider_diagnostics;

        $this->assertSame('failed', $message->status);
        $this->assertSame('provider_ip_not_authorized', $message->error_code);
        $this->assertSame(400, $diagnostics['http_status']);
        $this->assertTrue($diagnostics['response_is_json']);
        $this->assertSame(['message', 'reason'], $diagnostics['top_level_json_keys']);
        $this->assertSame('102', $diagnostics['provider_error_code']);
        $this->assertSame('provider_ip_not_authorized', $diagnostics['provider_error_class']);
        $this->assertStringStartsWith('application/json', $diagnostics['content_type']);
        $encoded = json_encode($diagnostics);
        foreach (['TEST_SMS_SECRET', 'LEAK_TOKEN', 'example.invalid', '966501234567', 'user@example.test', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ123456', 'TEMP'] as $secret) {
            $this->assertStringNotContainsString($secret, $encoded);
        }
    }

    public function test_outbox_distinguishes_retryable_and_permanent_failures(): void
    {
        $service = app(CommunicationService::class);
        $retryable = $service->enqueue('TEST_RETRYABLE', 'beneficiary', '1', 'TEST', '1', '0501234567', 'TEST', now()->addMinutes(5));
        $this->app->instance(SmsProviderInterface::class, new class implements SmsProviderInterface
        {
            public function send(string $idempotencyKey, array $payload): string
            {
                throw new ProviderFailure('provider_rate_limited', true);
            }
        });
        $service->send($retryable->id);
        $this->assertSame('retrying', $retryable->fresh()->status);
        $this->assertSame('provider_rate_limited', $retryable->fresh()->error_code);

        $permanent = $service->enqueue('TEST_PERMANENT', 'beneficiary', '2', 'TEST', '2', '0501234567', 'TEST', now()->addMinutes(5));
        $this->app->instance(SmsProviderInterface::class, new class implements SmsProviderInterface
        {
            public function send(string $idempotencyKey, array $payload): string
            {
                throw new ProviderFailure('provider_rejected', false);
            }
        });
        $service->send($permanent->id);
        $this->assertSame('failed', $permanent->fresh()->status);
        $this->assertSame('provider_rejected', $permanent->fresh()->error_code);
        $this->assertNull($permanent->fresh()->next_attempt_at);
    }

    public function test_duplicate_worker_call_sends_one_provider_request_and_one_outbox_intent(): void
    {
        Http::fake(['api.taqnyat.sa/v1/messages' => Http::response(['statusCode' => 201, 'messageId' => 909], 201)]);
        $this->app->instance(SmsProviderInterface::class, app(TaqnyatSmsProvider::class));
        $service = app(CommunicationService::class);
        $first = $service->enqueue('TEST_DUPLICATE', 'beneficiary', '1', 'TEST', '1', '0501234567', 'TEST', now()->addMinutes(5));
        $second = $service->enqueue('TEST_DUPLICATE', 'beneficiary', '1', 'TEST', '1', '0501234567', 'TEST', now()->addMinutes(5));
        $service->send($first->id);
        $service->send($first->id);

        $this->assertSame($first->id, $second->id);
        $this->assertDatabaseCount('communication_messages', 1);
        $this->assertSame(1, $first->fresh()->attempts);
        $this->assertSame('provider_accepted', $first->fresh()->provider_diagnostics['acceptance_state']);
        $this->assertSame('unconfirmed', $first->fresh()->provider_diagnostics['delivery_state']);
        Http::assertSentCount(1);
    }

    public function test_secrets_are_absent_from_settings_api_audit_and_logs(): void
    {
        Log::spy();
        $admin = User::create(['username' => 'TEST_2C_ADMIN', 'full_name' => 'Admin', 'password' => 'password', 'email' => 'admin@example.invalid', 'role' => 'admin', 'is_active' => true]);
        Sanctum::actingAs($admin);
        $response = $this->getJson('/api/settings/communications')->assertOk();
        $encoded = $response->getContent();
        foreach (['TEST_SMS_SECRET', 'TEST_EMAIL_SECRET'] as $secret) {
            $this->assertStringNotContainsString($secret, $encoded);
        }

        $this->putJson('/api/settings/communications', ['templates' => ['association_name' => 'TEST جمعية']])->assertOk();
        $audit = json_encode(AuditLog::latest()->first()->toArray());
        $this->assertStringNotContainsString('TEST_SMS_SECRET', $audit);
        $this->assertStringNotContainsString('0042', $audit);
        Log::shouldNotHaveReceived('error');
    }

    public function test_ordinary_staff_cannot_administer_or_retry_communications(): void
    {
        $staff = User::create(['username' => 'TEST_2C_STAFF', 'full_name' => 'Staff', 'password' => 'password', 'email' => 'staff@example.invalid', 'role' => 'staff', 'is_active' => true]);
        Sanctum::actingAs($staff);
        $this->getJson('/api/settings/communications')->assertForbidden();

        $message = CommunicationMessage::create([
            'idempotency_key' => 'TEST_AUTH', 'channel' => 'sms', 'operation_type' => 'TEST', 'operation_id' => '1',
            'recipient_type' => 'beneficiary', 'recipient_reference' => '1', 'destination' => '***567',
            'encrypted_payload' => ['destination' => '966501234567', 'body' => 'TEST'], 'payload_expires_at' => now()->addMinutes(5),
            'status' => 'failed', 'requested_at' => now(),
        ]);
        $this->postJson('/api/settings/communications/messages/'.$message->id.'/retry')->assertForbidden();
    }

    public function test_ambiguous_provider_and_worker_timeouts_are_never_blindly_retried(): void
    {
        $service = app(CommunicationService::class);
        $message = $service->enqueue('EKRAM-E2E-TEST-AMBIGUOUS', 'beneficiary', '1', 'TEST', '1', '0501234567', 'TEST', now()->addMinutes(5));
        $provider = new class implements SmsProviderInterface
        {
            public int $calls = 0;

            public function send(string $idempotencyKey, array $payload): string
            {
                $this->calls++;
                throw new ProviderFailure('provider_timeout', true);
            }
        };
        $this->app->instance(SmsProviderInterface::class, $provider);
        $service->send($message->id);
        $service->send($message->id);
        $this->assertSame(1, $provider->calls);
        $this->assertSame('failed', $message->fresh()->status);
        $this->assertSame('send_outcome_unknown', $message->fresh()->error_code);
        $this->assertTrue($message->fresh()->provider_diagnostics['reconciliation_required']);
        try {
            $service->retry($message->id);
            $this->fail('Ambiguous send was retried');
        } catch (ValidationException) {
            $this->assertSame(1, $provider->calls);
        }
        $message->update(['status' => 'sending', 'error_code' => null]);
        (new SendCommunication($message->id))->failed(new \RuntimeException('TEST'));
        $this->assertSame('send_outcome_unknown', $message->fresh()->error_code);
        $this->assertNull($message->fresh()->next_attempt_at);
    }
}
