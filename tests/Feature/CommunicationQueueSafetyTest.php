<?php

namespace Tests\Feature;

use App\Contracts\Communications\SmsProviderInterface;
use App\Jobs\SendCommunication;
use App\Services\Communications\CommunicationService;
use App\Services\Communications\TaqnyatSmsProvider;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\RefreshDatabaseState;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class CommunicationQueueSafetyTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        parent::tearDown();
        // These tests deliberately commit to exercise real afterCommit dispatch.
        // Do not reuse their in-memory PDO or migration state in another test.
        RefreshDatabaseState::$inMemoryConnections = [];
        RefreshDatabaseState::$migrated = false;
    }

    protected function setUp(): void
    {
        parent::setUp();
        config([
            'queue.default' => 'database',
            'services.taqnyat.sms.token' => 'MOCK_ONLY',
            'services.taqnyat.sms.sender' => 'TEST',
        ]);
        Http::preventStrayRequests();
        $this->app->bind(SmsProviderInterface::class, TaqnyatSmsProvider::class);
    }

    public function test_after_commit_dispatch_and_worker_leave_legacy_queue_untouched(): void
    {
        Http::fake(['api.taqnyat.sa/*' => Http::response(['statusCode' => 201, 'messageId' => 'MOCK_REF', 'rejected' => []], 201)]);
        $service = app(CommunicationService::class);
        $legacy = $service->enqueue('LEGACY', 'staff', '1', 'TEST', '1', '0501234567', 'TEST', now()->addHour(), dispatch: false);
        Queue::push((new SendCommunication($legacy->id))->onQueue('default'));
        DB::beginTransaction();
        $message = $service->enqueue('NEW', 'staff', '1', 'TEST', '1', '0501234567', 'TEST', now()->addHour());
        $this->assertSame(0, DB::table('jobs')->where('queue', 'ekram-communications-v2')->count());
        while (DB::transactionLevel() > 0) {
            DB::commit();
        }
        $this->assertSame(1, DB::table('jobs')->where('queue', 'ekram-communications-v2')->count());
        $this->artisan('queue:work', ['connection' => 'database', '--queue' => 'ekram-communications-v2', '--once' => true, '--tries' => 1])->assertSuccessful();
        $this->assertSame('pending', $legacy->fresh()->status);
        $this->assertSame(1, DB::table('jobs')->where('queue', 'default')->count());
        $this->assertSame('MOCK_REF', $message->fresh()->provider_reference);
        $this->assertSame('unconfirmed', $message->fresh()->provider_diagnostics['delivery_state']);
        $this->assertSame(1, $message->fresh()->attempts);
        Http::assertSentCount(1);
        $this->artisan('communications:queue-inspect')->expectsOutputToContain('SendCommunication')->assertSuccessful();
        $this->artisan('communications:queue-inspect', ['--failed' => true])->expectsOutputToContain('"failed":true')->assertSuccessful();
        $service->enqueue('NEW', 'staff', '1', 'TEST', '1', '0501234567', 'TEST', now()->addHour());
        $service->send($message->id);
        $this->assertSame(0, DB::table('jobs')->where('queue', 'ekram-communications-v2')->count());
        Http::assertSentCount(1);
    }

    public function test_production_recovery_requires_explicit_scope_and_excludes_older_intents(): void
    {
        config(['services.communications.provider' => 'taqnyat']);
        $service = app(CommunicationService::class);
        $legacy = $service->enqueue('OLD', 'staff', '1', 'TEST', '1', '0501234567', 'TEST', now()->addHour(), dispatch: false);
        $legacy->update(['requested_at' => now()->subDay()]);
        $fresh = $service->enqueue('FRESH', 'staff', '1', 'TEST', '1', '0501234567', 'TEST', now()->addHour(), dispatch: false);
        $this->artisan('communications:drain')->assertExitCode(1);
        $this->assertSame(0, DB::table('jobs')->count());
        $this->artisan('communications:drain', ['--since' => now()->subMinute()->utc()->format('Y-m-d\TH:i:s\Z')])->assertSuccessful();
        while (DB::transactionLevel() > 0) {
            DB::commit();
        }
        $this->assertSame(1, DB::table('jobs')->count());
        $this->assertStringContainsString($fresh->id, DB::table('jobs')->value('payload'));
        $this->assertStringNotContainsString($legacy->id, DB::table('jobs')->value('payload'));
        Http::assertNothingSent();
    }

    public function test_ambiguous_server_or_malformed_acceptance_never_resubmits(): void
    {
        Http::fakeSequence()->push(['statusCode' => 201], 201)->push([], 503);
        $service = app(CommunicationService::class);
        foreach (['malformed', 'server'] as $key) {
            $message = $service->enqueue($key, 'staff', '1', 'TEST', '1', '0501234567', 'TEST', now()->addHour(), dispatch: false);
            $service->send($message->id);
            $service->send($message->id);
            $this->assertSame('send_outcome_unknown', $message->fresh()->error_code);
            $this->assertTrue($message->fresh()->provider_diagnostics['reconciliation_required']);
            try {
                $service->retry($message->id);
                $this->fail('An ambiguous provider submission must not be retried.');
            } catch (ValidationException) {
                $this->assertSame(1, $message->fresh()->attempts);
            }
        }
        Http::assertSentCount(2);
    }

    public function test_failed_job_inventory_suppresses_exception_and_payload_secrets(): void
    {
        $message = app(CommunicationService::class)->enqueue('FAILED_INSPECT', 'staff', '1', 'TEST', '1', '0501234567', 'PRIVATE_BODY', now()->addHour(), dispatch: false);
        $message->update(['status' => 'failed', 'error_code' => 'provider_rejected']);
        $uuid = (string) Str::uuid();
        DB::table('failed_jobs')->insert([
            'uuid' => $uuid, 'connection' => 'database', 'queue' => 'ekram-communications-v2',
            'payload' => json_encode(['displayName' => SendCommunication::class, 'data' => ['command' => serialize(new SendCommunication($message->id))], 'secret' => 'PRIVATE_PAYLOAD']),
            'exception' => 'Bearer PRIVATE_TOKEN PRIVATE_BODY', 'failed_at' => now(),
        ]);
        $this->assertSame(0, Artisan::call('communications:queue-inspect', ['--failed' => true]));
        $output = Artisan::output();
        $this->assertStringContainsString($uuid, $output);
        $this->assertStringContainsString('provider_rejected', $output);
        foreach (['PRIVATE_TOKEN', 'PRIVATE_BODY', 'PRIVATE_PAYLOAD', '0501234567'] as $private) {
            $this->assertStringNotContainsString($private, $output);
        }
        $this->assertSame(1, DB::table('failed_jobs')->count());
        Http::assertNothingSent();
    }
}
