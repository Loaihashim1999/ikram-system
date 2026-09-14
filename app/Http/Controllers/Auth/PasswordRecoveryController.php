<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password as PasswordBroker;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;

class PasswordRecoveryController extends Controller
{
    public function forgot(Request $request): JsonResponse
    {
        if (! User::query()->where('role', 'admin')->where('is_active', true)->exists()) {
            return response()->json(['message' => 'خدمة الاستعادة غير متاحة قبل إعداد المشرف.'], 409);
        }

        $validated = $request->validate(['email' => ['required', 'email:rfc']]);
        $admin = User::query()->where('role', 'admin')->where('email', Str::lower(trim($validated['email'])))->first();

        if ($admin) {
            PasswordBroker::sendResetLink(['email' => $admin->email]);
        }

        return response()->json(['message' => 'إذا كان البريد مسجلاً فسيصلك رابط استعادة آمن.']);
    }

    public function reset(Request $request): JsonResponse
    {
        if (! User::query()->where('role', 'admin')->where('is_active', true)->exists()) {
            return response()->json(['message' => 'خدمة الاستعادة غير متاحة قبل إعداد المشرف.'], 409);
        }

        $validated = $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email:rfc'],
            'password' => ['required', 'confirmed', Password::min(12)->mixedCase()->numbers()->symbols()],
        ]);

        $status = PasswordBroker::reset($validated, function (User $user, string $password) {
            abort_unless($user->role === 'admin' && $user->is_active, 403);
            $user->forceFill(['password' => Hash::make($password), 'remember_token' => Str::random(60)])->save();
            $user->tokens()->delete();
            event(new PasswordReset($user));
        });

        if ($status !== PasswordBroker::PASSWORD_RESET) {
            return response()->json(['message' => 'رابط الاستعادة غير صالح أو منتهي.'], 422);
        }

        return response()->json(['message' => 'تم تحديث كلمة المرور. يمكنك تسجيل الدخول الآن.']);
    }
}
