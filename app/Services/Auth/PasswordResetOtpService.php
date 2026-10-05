<?php

namespace App\Services\Auth;

use App\Models\AuditLog;
use App\Models\CommunicationMessage;
use App\Models\PasswordResetChallenge;
use App\Models\User;
use App\Services\Communications\MessageTemplates;
use App\Services\Communications\SaudiPhoneNumber;
use App\Services\NotificationService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Password recovery via 6-digit SMS OTP (Taqnyat SMS through the
 * NotificationService → CommunicationService outbox). Fully isolated from
 * the 4-digit receipt verification mechanism: separate table, separate HMAC
 * namespace, separate attempts/lock state. Never stores or logs the OTP in
 * plaintext; only an HMAC verifier keyed by user, generation and code.
 */
class PasswordResetOtpService
{
    public const GENERIC_MESSAGE = 'إذا كانت البيانات مطابقة لحساب مسجل، سيتم إرسال رمز التحقق إلى رقم الجوال المسجل.';

    private const INVALID_CODE_MESSAGE = 'رمز التحقق غير صحيح أو منتهي الصلاحية.';

    /**
     * Enumeration-safe OTP issuance. Always succeeds silently from the
     * caller's perspective; only eligible accounts (active, valid Saudi
     * mobile) receive an SMS. Account, cooldown, hourly-cap and lock checks
     * never leak into the public response.
     */
    public function requestOtp(string $username): void
    {
        $username = trim($username);
        DB::transaction(function () use ($username) {
            $user = User::whereRaw('LOWER(username) = ?', [mb_strtolower($username)])->lockForUpdate()->first();
            $this->audit($user?->id, 'PASSWORD_RESET_REQUESTED', []);
            if (! $user || ! $user->is_active || ! $user->phone) {
                return;
            }
            try {
                $destination = app(SaudiPhoneNumber::class)->normalize($user->phone);
            } catch (ValidationException) {
                return;
            }
            $now = now();
            $challenge = PasswordResetChallenge::where('user_id', $user->id)->lockForUpdate()->first();
            if ($challenge?->locked_until?->isFuture()) {
                return;
            }
            if ($challenge && $challenge->last_sent_at->gt($now->copy()->subSeconds((int) config('password_recovery.resend_cooldown_seconds')))) {
                return;
            }
            $windowActive = $challenge?->send_window_start && $challenge->send_window_start->gt($now->copy()->subHour());
            $sendCount = $windowActive ? $challenge->send_count : 0;
            if ($sendCount >= (int) config('password_recovery.requests_per_hour')) {
                return;
            }

            // A newly issued OTP supersedes every previous OTP and SMS.
            CommunicationMessage::where('operation_type', 'password_reset')->where('operation_id', $user->id)
                ->whereIn('status', ['pending', 'retrying', 'failed'])
                ->update(['status' => 'cancelled', 'encrypted_payload' => null, 'error_code' => 'superseded']);

            $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
            $generation = (string) Str::uuid();
            $ttl = (int) config('password_recovery.otp_ttl_minutes');
            $body = app(MessageTemplates::class)->render('password_reset_otp', ['reset_code' => $code, 'expiry_minutes' => (string) $ttl]);
            $message = NotificationService::queueCommunication(
                'password_reset:'.$generation, 'staff', $user->id, 'password_reset', $user->id,
                $destination, $body, $now->copy()->addMinutes($ttl)
            );
            PasswordResetChallenge::updateOrCreate(
                ['user_id' => $user->id],
                [
                    'generation' => $generation,
                    'verifier' => $this->verifier($user->id, $generation, $code),
                    'channel_message_id' => $message->id,
                    'recovery_token_hash' => null,
                    'otp_expires_at' => $now->copy()->addMinutes($ttl),
                    'last_sent_at' => $now,
                    'failed_attempts' => 0,
                    'send_count' => $sendCount + 1,
                    'send_window_start' => $windowActive ? $challenge->send_window_start : $now,
                    'locked_until' => null,
                    'verified_at' => null,
                    'recovery_expires_at' => null,
                    'consumed_at' => null,
                ]
            );
            $this->audit($user->id, 'PASSWORD_RESET_OTP_SENT', ['channel' => 'sms']);
        });
    }

    /**
     * Verify a 6-digit OTP and, on success, issue a short-lived single-use
     * recovery authorization token. Verification is atomic: the user row and
     * the challenge row are locked, so concurrent attempts resolve to exactly
     * one success.
     */
    public function verifyOtp(string $username, string $code, ?string $ip = null): array
    {
        $username = trim($username);
        $limiterKey = 'password-reset-verify:'.hash('sha256', ($ip ?? '').'|'.mb_strtolower($username));
        if (RateLimiter::tooManyAttempts($limiterKey, (int) config('password_recovery.verify_per_minute'))) {
            return ['status' => 429, 'message' => 'محاولات كثيرة؛ انتظر ثم أعد المحاولة.'];
        }
        RateLimiter::hit($limiterKey, 60);

        return DB::transaction(function () use ($username, $code) {
            $user = User::whereRaw('LOWER(username) = ?', [mb_strtolower($username)])->lockForUpdate()->first();
            $challenge = $user ? PasswordResetChallenge::where('user_id', $user->id)->lockForUpdate()->first() : null;
            if (! $user || ! $challenge || $challenge->consumed_at) {
                return ['status' => 422, 'message' => self::INVALID_CODE_MESSAGE];
            }
            if ($challenge->locked_until?->isFuture()) {
                return ['status' => 423, 'message' => 'التحقق مقفل مؤقتاً بسبب محاولات فاشلة متكررة.'];
            }
            if ($challenge->locked_until) {
                // Lock window passed: reset the attempt counter.
                $challenge->fill(['failed_attempts' => 0, 'locked_until' => null])->save();
            }
            if ($challenge->verified_at) {
                return ['status' => 409, 'message' => 'تم التحقق من الرمز مسبقاً.'];
            }
            if ($challenge->otp_expires_at->lte(now())) {
                $this->audit($user->id, 'PASSWORD_RESET_OTP_FAILED', ['reason' => 'expired']);

                return ['status' => 422, 'message' => 'انتهت صلاحية رمز التحقق. اطلب رمزاً جديداً.'];
            }
            $message = $challenge->channel_message_id ? CommunicationMessage::whereKey($challenge->channel_message_id)->first() : null;
            if ($message && $message->status === 'failed') {
                // The SMS never left the platform: this challenge is not usable.
                $this->audit($user->id, 'PASSWORD_RESET_OTP_FAILED', ['reason' => 'delivery_failed']);

                return ['status' => 422, 'message' => 'تعذر إرسال رمز التحقق. أعد طلب الرمز.'];
            }
            if (! hash_equals($challenge->verifier, $this->verifier($user->id, $challenge->generation, $code))) {
                $challenge->failed_attempts++;
                if ($challenge->failed_attempts >= (int) config('password_recovery.max_attempts')) {
                    $challenge->locked_until = now()->addMinutes((int) config('password_recovery.lock_minutes'));
                }
                $challenge->save();
                $this->audit($user->id, $challenge->locked_until ? 'PASSWORD_RESET_OTP_LOCKED' : 'PASSWORD_RESET_OTP_FAILED', ['reason' => 'mismatch']);

                return ['status' => $challenge->locked_until ? 423 : 422, 'message' => $challenge->locked_until ? 'تم قفل التحقق مؤقتاً بسبب محاولات فاشلة متكررة.' : self::INVALID_CODE_MESSAGE];
            }
            $token = Str::random(64);
            $challenge->fill([
                'verified_at' => now(),
                'recovery_token_hash' => $this->recoveryHash($challenge->id, $challenge->generation, $token),
                'recovery_expires_at' => now()->addMinutes((int) config('password_recovery.recovery_token_ttl_minutes')),
            ])->save();
            $this->audit($user->id, 'PASSWORD_RESET_OTP_VERIFIED', []);

            return ['status' => 200, 'message' => 'تم التحقق من الرمز.', 'recovery_token' => $token, 'expires_in_minutes' => (int) config('password_recovery.recovery_token_ttl_minutes')];
        });
    }

    /**
     * Complete the reset using the short-lived recovery authorization.
     * Invalidates the challenge and revokes active Sanctum tokens.
     */
    public function resetPassword(string $username, string $recoveryToken, string $password): void
    {
        $username = trim($username);
        DB::transaction(function () use ($username, $recoveryToken, $password) {
            $user = User::whereRaw('LOWER(username) = ?', [mb_strtolower($username)])->lockForUpdate()->first();
            $challenge = $user ? PasswordResetChallenge::where('user_id', $user->id)->lockForUpdate()->first() : null;
            $valid = $user && $user->is_active && $challenge && $challenge->verified_at && ! $challenge->consumed_at
                && $challenge->recovery_token_hash
                && $challenge->recovery_expires_at?->isFuture()
                && hash_equals($challenge->recovery_token_hash, $this->recoveryHash($challenge->id, $challenge->generation, $recoveryToken));
            if (! $valid) {
                throw ValidationException::withMessages(['recovery' => 'جلسة الاستعادة غير صالحة أو منتهية. أعد طلب رمز التحقق.']);
            }
            $user->forceFill([
                'password' => Hash::make($password),
                'remember_token' => Str::random(60),
                'must_change_password' => false,
                'temporary_password_expires_at' => null,
                'is_locked' => false,
                'locked_until' => null,
                'failed_login_attempts' => 0,
            ])->save();
            $user->tokens()->delete();
            $challenge->update(['consumed_at' => now(), 'recovery_token_hash' => null]);
            CommunicationMessage::where('operation_type', 'password_reset')->where('operation_id', $user->id)
                ->whereIn('status', ['pending', 'retrying', 'failed'])
                ->update(['status' => 'cancelled', 'encrypted_payload' => null, 'error_code' => 'operation_completed']);
            $this->audit($user->id, 'PASSWORD_RESET_COMPLETED', []);
        });
    }

    private function verifier(string $userId, string $generation, string $code): string
    {
        return hash_hmac('sha256', 'password_reset:'.$userId.':'.$generation.':'.$code, $this->key());
    }

    private function recoveryHash(string $challengeId, string $generation, string $token): string
    {
        return hash_hmac('sha256', 'password_reset_recovery:'.$challengeId.':'.$generation.':'.$token, $this->key());
    }

    private function key(): string
    {
        $secret = config('app.key');
        if (! $secret) {
            throw new \LogicException('Password recovery key unavailable.');
        }

        return $secret;
    }

    private function audit(?string $userId, string $action, array $details): void
    {
        AuditLog::create(['user_id' => $userId, 'action' => $action, 'target_table' => 'users', 'target_id' => $userId ?? (string) Str::uuid(), 'details' => $details]);
    }
}
