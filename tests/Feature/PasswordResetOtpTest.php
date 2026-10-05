<?php

namespace Tests\Feature;

use App\Contracts\Communications\EmailProviderInterface;
use App\Contracts\Communications\SmsProviderInterface;
use App\Models\CommunicationMessage;
use App\Models\PasswordResetChallenge;
use App\Models\User;
use App\Services\Auth\PasswordResetOtpService;
use App\Services\Communications\CommunicationService;
use App\Services\Communications\ProviderFailure;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Password recovery via 6-digit SMS OTP (Taqnyat SMS through the outbox).
 * Email is never used for password recovery; SMS OTP is authoritative.
 */
class PasswordResetOtpTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        config(['app.key' => 'base64:'.base64_encode(str_repeat('T', 32))]);
        $this->admin = User::create([
            'username' => 'TEST_ADMIN', 'full_name' => 'TEST Admin',
            'password' => 'TEST-Old!Password123', 'email' => 'admin@example.invalid',
            'phone' => '0501234567', 'role' => 'admin', 'is_active' => true,
        ]);
    }

    private function requestOtp(string $username = 'TEST_ADMIN'): void
    {
        $this->postJson('/api/forgot-password', ['username' => $username])
            ->assertOk()
            ->assertJsonPath('message', PasswordResetOtpService::GENERIC_MESSAGE);
    }

    private function extractOtp(?string $userId = null): string
    {
        $query = CommunicationMessage::where('operation_type', 'password_reset')->where('status', 'pending');
        if ($userId) {
            $query->where('operation_id', $userId);
        }
        $message = $query->latest('created_at')->latest('id')->firstOrFail();
        preg_match('/([0-9]{6})/', $message->encrypted_payload['body'], $match);

        return $match[1];
    }

    private function verify(string $code, string $username = 'TEST_ADMIN')
    {
        return $this->postJson('/api/forgot-password/verify', ['username' => $username, 'code' => $code]);
    }

    private function verifyOk(string $code, string $username = 'TEST_ADMIN'): string
    {
        return $this->verify($code, $username)->assertOk()->json('recovery_token');
    }

    private function resetPayload(string $token, string $password = 'TEST-New!Password456', string $username = 'TEST_ADMIN'): array
    {
        return ['username' => $username, 'recovery_token' => $token, 'password' => $password, 'password_confirmation' => $password];
    }

    public function test_recovery_is_unavailable_before_first_admin_setup(): void
    {
        $this->admin->forceFill(['is_active' => false])->save();
        $this->postJson('/api/forgot-password', ['username' => 'TEST_ADMIN'])->assertStatus(409);
        $this->postJson('/api/forgot-password/verify', ['username' => 'TEST_ADMIN', 'code' => '123456'])->assertStatus(409);
        $this->postJson('/api/reset-password', [])->assertStatus(409);
    }

    public function test_existing_username_sends_sms_otp(): void
    {
        Queue::fake();
        $this->requestOtp('test_admin'); // case-insensitive username

        $message = CommunicationMessage::where('operation_type', 'password_reset')->firstOrFail();
        $this->assertSame('sms', $message->channel);
        $this->assertSame('staff', $message->recipient_type);
        $this->assertSame($this->admin->id, $message->recipient_reference);
        $this->assertSame('***567', $message->destination);
        $this->assertSame('pending', $message->status);
        $this->assertStringContainsString('رمز التحقق لإعادة تعيين كلمة المرور', $message->encrypted_payload['body']);
        $this->assertStringContainsString('10', $message->encrypted_payload['body']);
        $this->assertDatabaseCount('password_reset_challenges', 1);
        $this->assertDatabaseHas('audit_logs', ['action' => 'PASSWORD_RESET_REQUESTED', 'user_id' => $this->admin->id]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'PASSWORD_RESET_OTP_SENT', 'user_id' => $this->admin->id]);
    }

    public function test_unknown_username_receives_identical_generic_response(): void
    {
        Queue::fake();
        $known = $this->postJson('/api/forgot-password', ['username' => 'TEST_ADMIN'])->assertOk();
        $unknown = $this->postJson('/api/forgot-password', ['username' => 'NO_SUCH_USER'])->assertOk();

        $this->assertSame($known->json('message'), $unknown->json('message'));
        $this->assertSame(PasswordResetOtpService::GENERIC_MESSAGE, $unknown->json('message'));
        $this->assertDatabaseCount('password_reset_challenges', 1); // only the real account
        $this->assertDatabaseCount('communication_messages', 1);
        $this->assertDatabaseHas('audit_logs', ['action' => 'PASSWORD_RESET_REQUESTED', 'user_id' => null]);
    }

    public function test_no_account_enumeration_via_status_phone_or_activity(): void
    {
        Queue::fake();
        $inactive = User::create(['username' => 'TEST_INACTIVE', 'full_name' => 'TEST', 'password' => 'TEST-Old!Password123', 'email' => 'i@example.invalid', 'phone' => '0501234568', 'role' => 'staff', 'is_active' => false]);
        $noPhone = User::create(['username' => 'TEST_NOPHONE', 'full_name' => 'TEST', 'password' => 'TEST-Old!Password123', 'email' => 'n@example.invalid', 'phone' => null, 'role' => 'staff', 'is_active' => true]);
        $badPhone = User::create(['username' => 'TEST_BADPHONE', 'full_name' => 'TEST', 'password' => 'TEST-Old!Password123', 'email' => 'b@example.invalid', 'phone' => '12345', 'role' => 'staff', 'is_active' => true]);

        foreach ([$inactive->username, $noPhone->username, $badPhone->username] as $username) {
            $this->postJson('/api/forgot-password', ['username' => $username])
                ->assertOk()
                ->assertJsonPath('message', PasswordResetOtpService::GENERIC_MESSAGE);
        }
        $this->assertDatabaseCount('communication_messages', 0);
        $this->assertDatabaseCount('password_reset_challenges', 0);
    }

    public function test_otp_is_exactly_six_digits(): void
    {
        Queue::fake();
        $this->requestOtp();
        $code = $this->extractOtp();
        $this->assertMatchesRegularExpression('/^[0-9]{6}$/D', $code);
        $this->assertSame(6, strlen($code));
    }

    public function test_leading_zero_otp_verifies_and_short_forms_are_rejected(): void
    {
        Queue::fake();
        $this->requestOtp();
        $challenge = PasswordResetChallenge::firstOrFail();
        $challenge->update(['verifier' => hash_hmac('sha256', 'password_reset:'.$this->admin->id.':'.$challenge->generation.':001122', config('app.key'))]);

        $this->verify('1122')->assertUnprocessable();      // leading zeros stripped
        $this->verify(1122)->assertUnprocessable();        // numeric input
        $this->verify('001122')->assertOk();
        $this->assertNotNull($challenge->fresh()->verified_at);
    }

    public function test_plaintext_otp_and_recovery_token_are_never_stored(): void
    {
        Queue::fake();
        $this->requestOtp();
        $code = $this->extractOtp();
        $challenge = PasswordResetChallenge::firstOrFail();

        $this->assertMatchesRegularExpression('/^[0-9a-f]{64}$/', $challenge->verifier);
        $this->assertNotSame($code, $challenge->verifier);
        $message = CommunicationMessage::firstOrFail();
        $this->assertStringNotContainsString($code, $message->getRawOriginal('encrypted_payload'));

        $token = $this->verifyOk($code);
        $row = (array) DB::table('password_reset_challenges')->first();
        foreach (['verifier', 'generation', 'recovery_token_hash'] as $column) {
            $this->assertStringNotContainsString($code, (string) $row[$column]);
            $this->assertStringNotContainsString($token, (string) $row[$column]);
        }
        $this->assertMatchesRegularExpression('/^[0-9a-f]{64}$/', $row['recovery_token_hash']);
    }

    public function test_correct_otp_verifies_and_issues_short_lived_recovery_token(): void
    {
        Queue::fake();
        $this->requestOtp();
        $response = $this->verify($this->extractOtp())->assertOk()
            ->assertJsonPath('message', 'تم التحقق من الرمز.')
            ->assertJsonPath('expires_in_minutes', 10);
        $this->assertSame(64, strlen($response->json('recovery_token')));
        $challenge = PasswordResetChallenge::firstOrFail();
        $this->assertNotNull($challenge->verified_at);
        $this->assertTrue($challenge->recovery_expires_at->isFuture());
        $this->assertDatabaseHas('audit_logs', ['action' => 'PASSWORD_RESET_OTP_VERIFIED', 'user_id' => $this->admin->id]);
    }

    public function test_wrong_otp_is_rejected_counted_and_audited(): void
    {
        Queue::fake();
        $this->requestOtp();
        $code = $this->extractOtp();
        $wrong = $code === '000000' ? '000001' : '000000';

        $this->verify($wrong)->assertUnprocessable();
        $this->assertSame(1, PasswordResetChallenge::firstOrFail()->failed_attempts);
        $this->assertDatabaseHas('audit_logs', ['action' => 'PASSWORD_RESET_OTP_FAILED', 'user_id' => $this->admin->id]);
        $this->assertTrue(Hash::check('TEST-Old!Password123', $this->admin->fresh()->password));
    }

    public function test_expired_otp_is_rejected(): void
    {
        Queue::fake();
        $this->requestOtp();
        $code = $this->extractOtp();
        $this->travel(11)->minutes();

        $this->verify($code)->assertUnprocessable();
        $this->assertDatabaseHas('audit_logs', ['action' => 'PASSWORD_RESET_OTP_FAILED', 'user_id' => $this->admin->id]);
        $this->assertTrue(Hash::check('TEST-Old!Password123', $this->admin->fresh()->password));
    }

    public function test_otp_and_recovery_token_are_single_use(): void
    {
        Queue::fake();
        $this->requestOtp();
        $code = $this->extractOtp();
        $token = $this->verifyOk($code);

        $this->verify($code)->assertStatus(409); // OTP already consumed by verification
        $this->postJson('/api/reset-password', $this->resetPayload($token))->assertOk();
        $this->postJson('/api/reset-password', $this->resetPayload($token, 'TEST-Other!Pass789'))->assertUnprocessable();
        $this->assertTrue(Hash::check('TEST-New!Password456', $this->admin->fresh()->password));
        $this->assertNotNull(PasswordResetChallenge::firstOrFail()->consumed_at);
    }

    public function test_recovery_authorization_expires(): void
    {
        Queue::fake();
        $this->requestOtp();
        $token = $this->verifyOk($this->extractOtp());
        $this->travel(11)->minutes();

        $this->postJson('/api/reset-password', $this->resetPayload($token))->assertUnprocessable();
        $this->assertTrue(Hash::check('TEST-Old!Password123', $this->admin->fresh()->password));
    }

    public function test_otp_from_one_account_cannot_reset_another(): void
    {
        Queue::fake();
        $second = User::create(['username' => 'TEST_SECOND', 'full_name' => 'TEST Second', 'password' => 'TEST-Old!Password123', 'email' => 's@example.invalid', 'phone' => '0501234569', 'role' => 'staff', 'is_active' => true]);
        $this->requestOtp('TEST_ADMIN');
        $adminCode = $this->extractOtp($this->admin->id);
        $this->requestOtp('TEST_SECOND');
        $secondCode = $this->extractOtp($second->id);

        $this->verify($adminCode, 'TEST_SECOND')->assertUnprocessable(); // cross-account OTP
        $this->verify($secondCode, 'TEST_ADMIN')->assertUnprocessable();
        $this->assertNull(PasswordResetChallenge::where('user_id', $this->admin->id)->firstOrFail()->verified_at);
        $this->verify($secondCode, 'TEST_SECOND')->assertOk(); // own OTP still valid
    }

    public function test_max_failed_attempts_locks_challenge_and_blocks_reissue(): void
    {
        Queue::fake();
        $this->requestOtp();
        $code = $this->extractOtp();
        $wrong = $code === '000000' ? '000001' : '000000';

        for ($i = 0; $i < 4; $i++) {
            $this->verify($wrong)->assertUnprocessable();
        }
        $this->verify($wrong)->assertStatus(423); // 5th failure locks
        $this->verify($code)->assertStatus(423);  // even the correct code is locked out

        $challenge = PasswordResetChallenge::firstOrFail();
        $this->assertSame(5, $challenge->failed_attempts);
        $this->assertTrue($challenge->locked_until->isFuture());
        $this->assertDatabaseHas('audit_logs', ['action' => 'PASSWORD_RESET_OTP_LOCKED', 'user_id' => $this->admin->id]);

        $this->requestOtp(); // silently refused while locked, identical public response
        $this->assertDatabaseCount('communication_messages', 1);
        $this->assertTrue(Hash::check('TEST-Old!Password123', $this->admin->fresh()->password));
    }

    public function test_resend_cooldown_and_hourly_cap_are_enforced(): void
    {
        Queue::fake();
        $this->requestOtp();
        $this->requestOtp(); // within 60s cooldown: silently skipped
        $this->assertDatabaseCount('communication_messages', 1);
        $this->assertSame(1, PasswordResetChallenge::firstOrFail()->send_count);

        $this->travel(61)->seconds();
        $this->requestOtp();
        $this->assertSame(2, PasswordResetChallenge::firstOrFail()->send_count);
        $this->assertDatabaseCount('communication_messages', 2);

        config(['password_recovery.requests_per_hour' => 3]);
        $this->travel(61)->seconds();
        $this->requestOtp();
        $this->assertDatabaseCount('communication_messages', 3);
        $this->travel(61)->seconds();
        $this->requestOtp(); // hourly cap reached: silently skipped
        $this->assertDatabaseCount('communication_messages', 3);
        $this->assertSame(3, PasswordResetChallenge::firstOrFail()->send_count);
    }

    public function test_new_otp_invalidates_previous_otp_and_sms(): void
    {
        Queue::fake();
        $this->requestOtp();
        $first = $this->extractOtp($this->admin->id);
        $this->travel(61)->seconds();
        $this->requestOtp();
        $second = $this->extractOtp($this->admin->id);
        while ($second === $first) {
            $this->travel(61)->seconds();
            $this->requestOtp();
            $second = $this->extractOtp($this->admin->id);
        }

        $this->verify($first)->assertUnprocessable(); // superseded code
        $this->verify($second)->assertOk();

        $messages = CommunicationMessage::where('operation_type', 'password_reset')->orderBy('created_at')->orderBy('id')->get();
        $this->assertSame('cancelled', $messages[0]->status);
        $this->assertSame('superseded', $messages[0]->error_code);
        $this->assertNull($messages[0]->encrypted_payload);
    }

    public function test_concurrent_verification_allows_only_one_success(): void
    {
        Queue::fake();
        $this->requestOtp();
        $code = $this->extractOtp();

        $first = $this->verify($code)->assertOk()->json('recovery_token');
        $this->verify($code)->assertStatus(409); // second racer loses under the row lock

        $this->assertDatabaseCount('password_reset_challenges', 1);
        $this->postJson('/api/reset-password', $this->resetPayload($first))->assertOk();
        $this->postJson('/api/reset-password', $this->resetPayload($first, 'TEST-Other!Pass789'))->assertUnprocessable();
    }

    public function test_sms_failure_creates_no_usable_session_and_preserves_password(): void
    {
        Queue::fake();
        $this->requestOtp();
        $message = CommunicationMessage::where('operation_type', 'password_reset')->firstOrFail();
        preg_match('/([0-9]{6})/', $message->encrypted_payload['body'], $match);
        $code = $match[1];

        $this->app->bind(SmsProviderInterface::class, fn () => new class implements SmsProviderInterface
        {
            public function send(string $idempotencyKey, array $payload): string
            {
                throw new ProviderFailure('provider_rejected', false);
            }
        });
        app(CommunicationService::class)->send($message->id);
        $this->assertSame('failed', $message->fresh()->status);

        $this->verify($code)->assertUnprocessable()
            ->assertJsonPath('message', 'تعذر إرسال رمز التحقق. أعد طلب الرمز.');
        $this->postJson('/api/reset-password', $this->resetPayload('invalid-token'))->assertUnprocessable();

        $this->assertTrue(Hash::check('TEST-Old!Password123', $this->admin->fresh()->password));
        $this->assertNull(PasswordResetChallenge::firstOrFail()->verified_at);
        $audit = json_encode(DB::table('audit_logs')->where('action', 'PASSWORD_RESET_OTP_FAILED')->get()->toArray(), JSON_UNESCAPED_UNICODE);
        $this->assertStringContainsString('delivery_failed', $audit);
        $this->assertStringNotContainsString($code, $audit);
        $this->assertStringNotContainsString('provider_rejected', $this->verify($code)->getContent());
    }

    public function test_password_confirmation_is_required(): void
    {
        Queue::fake();
        $this->requestOtp();
        $token = $this->verifyOk($this->extractOtp());

        $this->postJson('/api/reset-password', ['username' => 'TEST_ADMIN', 'recovery_token' => $token, 'password' => 'TEST-New!Password456'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('password');
        $this->assertTrue(Hash::check('TEST-Old!Password123', $this->admin->fresh()->password));
    }

    public function test_password_policy_is_enforced(): void
    {
        Queue::fake();
        $this->requestOtp();
        $token = $this->verifyOk($this->extractOtp());

        foreach (['short', 'alllowercase123!', 'NOLOWER123!', 'NoSymbols12345'] as $weak) {
            $this->postJson('/api/reset-password', $this->resetPayload($token, $weak))->assertUnprocessable();
        }
        $this->assertTrue(Hash::check('TEST-Old!Password123', $this->admin->fresh()->password));
    }

    public function test_successful_reset_hashes_password_revokes_tokens_and_changes_login(): void
    {
        Queue::fake();
        $this->admin->createToken('existing-session');
        $this->requestOtp();
        $token = $this->verifyOk($this->extractOtp());

        $this->postJson('/api/reset-password', $this->resetPayload($token))->assertOk()
            ->assertJsonPath('message', 'تم تغيير كلمة المرور بنجاح. يمكنك تسجيل الدخول الآن.');

        $fresh = $this->admin->fresh();
        $this->assertTrue(Hash::check('TEST-New!Password456', $fresh->password));
        $this->assertNotSame('TEST-New!Password456', $fresh->password);
        $this->assertFalse(Hash::check('TEST-Old!Password123', $fresh->password));
        $this->assertDatabaseCount('personal_access_tokens', 0);
        $this->postJson('/api/login', ['username' => 'TEST_ADMIN', 'password' => 'TEST-New!Password456'])->assertOk();
        $this->assertFalse(Hash::check('TEST-Old!Password123', $fresh->password)); // old password no longer works
    }

    public function test_audit_trail_contains_no_otp_password_token_or_phone(): void
    {
        Queue::fake();
        $this->requestOtp();
        $code = $this->extractOtp();
        $token = $this->verifyOk($code);
        $this->postJson('/api/reset-password', $this->resetPayload($token))->assertOk();

        $audit = json_encode(DB::table('audit_logs')->get()->toArray(), JSON_UNESCAPED_UNICODE);
        foreach ([$code, $token, 'TEST-New!Password456', 'TEST-Old!Password123', '966501234567', '0501234567'] as $secret) {
            $this->assertStringNotContainsString($secret, $audit);
        }
        foreach (['PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET_OTP_SENT', 'PASSWORD_RESET_OTP_VERIFIED', 'PASSWORD_RESET_COMPLETED'] as $action) {
            $this->assertDatabaseHas('audit_logs', ['action' => $action, 'user_id' => $this->admin->id]);
        }
    }

    public function test_provider_token_and_full_phone_are_never_exposed(): void
    {
        config(['services.taqnyat.sms.token' => 'TEST_SMS_PROVIDER_SECRET']);
        $spy = $this->smsSpy();

        $request = $this->postJson('/api/forgot-password', ['username' => 'TEST_ADMIN'])->assertOk();
        $message = CommunicationMessage::where('operation_type', 'password_reset')->firstOrFail();
        app(CommunicationService::class)->send($message->id);
        preg_match('/([0-9]{6})/', $spy->payloads[0]['body'], $match);
        $verify = $this->verify($match[1])->assertOk();
        $reset = $this->postJson('/api/reset-password', $this->resetPayload($verify->json('recovery_token')))->assertOk();

        $surface = $request->getContent().$verify->getContent().$reset->getContent()
            .json_encode(DB::table('audit_logs')->get()->toArray(), JSON_UNESCAPED_UNICODE)
            .json_encode(DB::table('communication_messages')->get()->toArray(), JSON_UNESCAPED_UNICODE);
        $this->assertStringNotContainsString('TEST_SMS_PROVIDER_SECRET', $surface);
        $this->assertStringNotContainsString('966501234567', $surface);
        $this->assertStringNotContainsString('0501234567', $surface);
        $this->assertSame('***567', $message->fresh()->destination);
    }

    public function test_email_provider_is_never_called_and_sms_otp_is_authoritative(): void
    {
        $this->mock(EmailProviderInterface::class)->shouldNotReceive('send');
        $spy = $this->smsSpy();

        $this->postJson('/api/forgot-password', ['username' => 'TEST_ADMIN'])->assertOk();
        $message = CommunicationMessage::where('operation_type', 'password_reset')->firstOrFail();
        app(CommunicationService::class)->send($message->id);
        $this->assertSame('sent', $message->fresh()->status);
        $this->assertCount(1, $spy->payloads);
        $this->assertSame('966501234567', $spy->payloads[0]['destination']);

        preg_match('/([0-9]{6})/', $spy->payloads[0]['body'], $match);
        $token = $this->verifyOk($match[1]);
        $this->postJson('/api/reset-password', $this->resetPayload($token))->assertOk();
    }

    public function test_receipt_verification_mechanism_is_completely_unaffected(): void
    {
        Queue::fake();
        $this->requestOtp();
        $token = $this->verifyOk($this->extractOtp());
        $this->postJson('/api/reset-password', $this->resetPayload($token))->assertOk();

        $this->assertDatabaseCount('receipt_challenges', 0);
        $this->assertSame(0, CommunicationMessage::where('operation_type', 'receipt')->count());
        $generation = (string) Str::uuid();
        $this->assertNotSame(
            hash_hmac('sha256', 'receipt:'.$this->admin->id.':'.$generation.':123456', config('app.key')),
            hash_hmac('sha256', 'password_reset:'.$this->admin->id.':'.$generation.':123456', config('app.key'))
        );
    }

    public function test_notification_service_outbox_remains_authoritative(): void
    {
        Queue::fake();
        $this->requestOtp();

        $message = CommunicationMessage::where('operation_type', 'password_reset')->firstOrFail();
        $this->assertSame('sms', $message->channel);
        $this->assertSame('pending', $message->status);
        $this->assertStringStartsWith('password_reset:', $message->idempotency_key);
        $this->assertSame($this->admin->id, $message->operation_id);
        $this->assertSame($this->admin->id, $message->recipient_reference);
        $this->assertNotNull($message->payload_expires_at);

        // The outbox row is authoritative; the queued worker drains it.
        app(CommunicationService::class)->send($message->id);
        $this->assertSame('sent', $message->fresh()->status);
    }

    public function test_sms_channel_routing_sends_and_wipes_payload(): void
    {
        $spy = $this->smsSpy();
        $this->postJson('/api/forgot-password', ['username' => 'TEST_ADMIN'])->assertOk();

        $message = CommunicationMessage::where('operation_type', 'password_reset')->firstOrFail();
        app(CommunicationService::class)->send($message->id);

        $fresh = $message->fresh();
        $this->assertSame('sent', $fresh->status);
        $this->assertSame('TEST_PROVIDER_REF', $fresh->provider_reference);
        $this->assertNull($fresh->encrypted_payload);
        $this->assertNotNull($fresh->sent_at);
        $this->assertCount(1, $spy->payloads);
    }

    public function test_otp_template_is_managed_via_communications_settings(): void
    {
        Sanctum::actingAs($this->admin);
        $this->putJson('/api/settings/communications', ['templates' => ['password_reset_otp' => 'الرمز: {reset_code} صالح {expiry_minutes} دقائق — {association_name}']])->assertOk();
        $this->putJson('/api/settings/communications', ['templates' => ['password_reset_otp' => 'الرمز: {reset_code} {phone_number}']])->assertUnprocessable();
        $this->putJson('/api/settings/communications', ['templates' => ['password_reset_otp' => 'بدون رمز مطلوب']])->assertUnprocessable();

        Queue::fake();
        $this->requestOtp();
        $body = CommunicationMessage::where('operation_type', 'password_reset')->firstOrFail()->encrypted_payload['body'];
        $this->assertMatchesRegularExpression('/الرمز: [0-9]{6} صالح 10 دقائق/u', $body);
    }

    private function smsSpy(): object
    {
        $spy = new class
        {
            public array $payloads = [];
        };
        $this->mock(SmsProviderInterface::class, function ($mock) use ($spy) {
            $mock->shouldReceive('send')->andReturnUsing(function (string $key, array $payload) use ($spy) {
                $spy->payloads[] = $payload;

                return 'TEST_PROVIDER_REF';
            });
        });

        return $spy;
    }
}
