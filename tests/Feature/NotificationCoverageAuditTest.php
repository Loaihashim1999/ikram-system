<?php

namespace Tests\Feature;

use App\Models\Notification;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Tests\TestCase;

class NotificationCoverageAuditTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['app.key' => 'base64:'.base64_encode(str_repeat('N', 32))]);
        Queue::fake();
    }

    public function test_notification_service_outbox_entry_point_is_idempotent(): void
    {
        $operation = (string) Str::uuid();
        $first = NotificationService::queueCommunication(
            'coverage:'.$operation,
            'beneficiary',
            $operation,
            'coverage_audit',
            $operation,
            '0501234567',
            'رسالة اختبار',
            now()->addMinutes(15),
        );
        $second = NotificationService::queueCommunication(
            'coverage:'.$operation,
            'beneficiary',
            $operation,
            'coverage_audit',
            $operation,
            '0501234567',
            'رسالة اختبار',
            now()->addMinutes(15),
        );

        $this->assertSame($first->id, $second->id);
        $this->assertDatabaseCount('communication_messages', 1);
        $this->assertSame('sms', $first->channel);
        $this->assertStringNotContainsString('0501234567', $first->destination);
    }

    public function test_outbox_and_application_notification_roll_back_with_business_transaction(): void
    {
        $user = User::create([
            'username' => 'TEST_notification_rollback',
            'full_name' => 'TEST Notification Rollback',
            'password' => 'test-password',
            'role' => 'admin',
            'is_active' => true,
            'can_receive_notifications' => true,
        ]);
        $operation = (string) Str::uuid();

        try {
            DB::transaction(function () use ($operation) {
                NotificationService::notifyAll('support_ready', 'TEST rollback notification');
                NotificationService::queueCommunication(
                    'rollback:'.$operation,
                    'organization',
                    $operation,
                    'receipt',
                    $operation,
                    '0501234567',
                    'TEST rollback message',
                    now()->addMinutes(15),
                );

                throw new \RuntimeException('expected rollback');
            });
        } catch (\RuntimeException $exception) {
            $this->assertSame('expected rollback', $exception->getMessage());
        }

        $this->assertDatabaseMissing('notifications', ['recipient_id' => $user->id]);
        $this->assertDatabaseMissing('communication_messages', ['operation_id' => $operation]);
    }

    public function test_notification_service_deduplicates_one_logical_application_event(): void
    {
        $user = User::create([
            'username' => 'TEST_notification_dedup',
            'full_name' => 'TEST Notification Dedup',
            'password' => 'test-password',
            'role' => 'admin',
            'is_active' => true,
            'can_receive_notifications' => true,
        ]);

        NotificationService::notifyAll('support_ready', 'TEST ready');
        NotificationService::notifyAll('support_ready', 'TEST ready');

        $this->assertSame(1, Notification::where('recipient_id', $user->id)->count());
    }

    public function test_business_code_uses_notification_service_and_does_not_call_providers_directly(): void
    {
        $root = dirname(__DIR__, 2);
        $businessFiles = [
            'app/Services/Delivery/ReceiptVerificationService.php',
            'app/Services/Delivery/DriverAccessService.php',
            'app/Notifications/Channels/FakeResetEmailChannel.php',
        ];

        foreach ($businessFiles as $relative) {
            $source = file_get_contents($root.'/'.$relative);
            $this->assertStringContainsString('NotificationService::queueCommunication', $source, $relative);
            $this->assertStringNotContainsString('CommunicationService', $source, $relative);
            $this->assertDoesNotMatchRegularExpression('/(?:Sms|WhatsApp|Email)ProviderInterface|Http::/', $source, $relative);
        }

        $allowedCommunicationServiceCallers = [
            'app/Services/NotificationService.php',
            'app/Jobs/SendCommunication.php',
            'app/Http/Controllers/DeliveryCommunicationController.php',
        ];
        foreach ($allowedCommunicationServiceCallers as $relative) {
            $this->assertFileExists($root.'/'.$relative);
        }
    }

    public function test_notification_failure_logs_are_sanitized_in_source(): void
    {
        $root = dirname(__DIR__, 2);
        foreach ([
            'app/Services/NotificationService.php',
            'app/Listeners/SendBeneficiaryNotification.php',
        ] as $relative) {
            $source = file_get_contents($root.'/'.$relative);
            $this->assertStringNotContainsString('$e->getMessage()', $source, $relative);
            $this->assertStringNotContainsString('$e->getTraceAsString()', $source, $relative);
        }

        $controller = file_get_contents($root.'/app/Http/Controllers/Beneficiaries/BeneficiaryController.php');
        $this->assertStringContainsString("Log::error('Beneficiary registration failed.', ['exception' => \$e::class])", $controller);
        $this->assertStringNotContainsString('$request->all()', $controller);
        $this->assertStringNotContainsString('$e->getTraceAsString()', $controller);
    }
}
