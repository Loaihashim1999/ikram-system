<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use App\Services\Auth\PasswordResetOtpService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;

/**
 * Password recovery: username → 6-digit SMS OTP → new password.
 * Email reset links are retired from the active recovery flow; the channel
 * is SMS via NotificationService → CommunicationService → TaqnyatSmsProvider.
 * Controllers never call Taqnyat directly.
 */
class PasswordRecoveryController extends Controller
{
    public function change(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'confirmed', 'different:current_password', Password::min(12)->mixedCase()->numbers()->symbols()],
        ]);
        $user = $request->user();
        if (! Hash::check($validated['current_password'], $user->password)) {
            return response()->json(['message' => 'كلمة المرور الحالية غير صحيحة.'], 422);
        }
        if ($user->temporary_password_expires_at?->lte(now())) {
            return response()->json(['message' => 'انتهت صلاحية كلمة المرور المؤقتة. اطلب من المدير إصدار كلمة جديدة.'], 422);
        }
        DB::transaction(function () use ($user, $validated) {
            $user->forceFill(['password' => Hash::make($validated['password']), 'must_change_password' => false, 'temporary_password_expires_at' => null, 'is_locked' => false, 'locked_until' => null, 'failed_login_attempts' => 0])->save();
            $user->tokens()->delete();
            AuditLog::create([
                'user_id' => $user->id,
                'action' => 'PASSWORD_CHANGED',
                'target_table' => 'users',
                'target_id' => $user->id,
                'details' => [],
            ]);
        });

        return response()->json(['message' => 'تم تغيير كلمة المرور. سجل الدخول بكلمة المرور الجديدة.']);
    }

    /**
     * Step 1 — request a 6-digit OTP by username. The response is identical
     * whether or not the account exists (no account/phone enumeration).
     */
    public function forgot(Request $request, PasswordResetOtpService $service): JsonResponse
    {
        $this->ensureRecoveryAvailable();
        $validated = $request->validate(['username' => ['required', 'string', 'max:100']]);
        $service->requestOtp($validated['username']);

        return response()->json(['message' => PasswordResetOtpService::GENERIC_MESSAGE]);
    }

    /**
     * Step 2 — verify the OTP. On success returns a short-lived recovery
     * authorization token (not the OTP itself).
     */
    public function verifyOtp(Request $request, PasswordResetOtpService $service): JsonResponse
    {
        $this->ensureRecoveryAvailable();
        $validated = $request->validate([
            'username' => ['required', 'string', 'max:100'],
            'code' => ['required', 'string', 'regex:/^[0-9]{6}$/D'],
        ]);
        $result = $service->verifyOtp($validated['username'], $validated['code'], $request->ip());
        $payload = ['message' => $result['message']];
        if ($result['status'] === 200) {
            $payload += ['recovery_token' => $result['recovery_token'], 'expires_in_minutes' => $result['expires_in_minutes']];
        }

        return response()->json($payload, $result['status']);
    }

    /**
     * Step 3 — set the new password using the recovery authorization token.
     */
    public function reset(Request $request, PasswordResetOtpService $service): JsonResponse
    {
        $this->ensureRecoveryAvailable();
        $validated = $request->validate([
            'username' => ['required', 'string', 'max:100'],
            'recovery_token' => ['required', 'string', 'max:200'],
            'password' => ['required', 'confirmed', Password::min(12)->mixedCase()->numbers()->symbols()],
        ]);
        $service->resetPassword($validated['username'], $validated['recovery_token'], $validated['password']);

        return response()->json(['message' => 'تم تغيير كلمة المرور بنجاح. يمكنك تسجيل الدخول الآن.']);
    }

    private function ensureRecoveryAvailable(): void
    {
        abort_unless(User::query()->where('role', 'admin')->where('is_active', true)->exists(), 409, 'خدمة الاستعادة غير متاحة قبل إعداد المشرف.');
    }
}
