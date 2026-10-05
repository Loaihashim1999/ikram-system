<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class LoginController extends Controller
{
    /**
     * تسجيل دخول المستخدم
     */
    public function login(Request $request)
    {
        if (! User::query()->where('role', 'admin')->where('is_active', true)->exists()) {
            return response()->json([
                'success' => false,
                'code' => 'SETUP_REQUIRED',
                'message' => 'يلزم إعداد حساب المشرف الأول قبل تسجيل الدخول.',
            ], 409);
        }

        // التحقق من المدخلات
        $request->validate([
            'username' => 'required|string',
            'password' => 'required|string',
        ]);

        $loginInput = trim($request->username);

        // البحث عن المستخدم باسم المستخدم أو البريد الإلكتروني (غير حساس لحالة الأحرف)
        $user = User::whereRaw('LOWER(username) = ?', [strtolower($loginInput)])
            ->orWhereRaw('LOWER(email) = ?', [strtolower($loginInput)])
            ->first();

        // التحقق من وجود المستخدم
        if (! $user) {
            throw ValidationException::withMessages([
                'username' => ['اسم المستخدم أو البريد الإلكتروني غير موجود'],
            ]);
        }

        if ($user->is_locked && $user->locked_until?->isFuture()) {
            throw ValidationException::withMessages(['username' => ['الحساب مقفل مؤقتاً. حاول مرة أخرى لاحقاً.']]);
        }
        if ($user->is_locked || $user->locked_until?->isPast()) {
            $user->forceFill(['is_locked' => false, 'locked_until' => null])->save();
        }

        // التحقق من كلمة المرور
        $passwordMatches = Hash::check($request->password, $user->password);
        if (! $passwordMatches) {
            $attempts = $user->failed_login_attempts + 1;
            $lockMinutes = $this->lockMinutes($user, $attempts);
            $user->forceFill(['failed_login_attempts' => $attempts, 'is_locked' => $lockMinutes > 0, 'locked_until' => $lockMinutes > 0 ? now()->addMinutes($lockMinutes) : null])->save();
            throw ValidationException::withMessages([
                'username' => [$lockMinutes > 0 ? "تم قفل الحساب مؤقتاً لمدة {$lockMinutes} دقيقة بعد محاولات فاشلة متكررة." : 'اسم المستخدم أو كلمة المرور غير صحيحة'],
            ]);
        }

        // التحقق من أن الحساب نشط
        if (! $user->is_active) {
            throw ValidationException::withMessages([
                'username' => ['هذا الحساب معطل. تواصل مع مسؤول النظام.'],
            ]);
        }

        if ($user->temporary_password_expires_at?->lte(now())) {
            throw ValidationException::withMessages(['username' => ['انتهت صلاحية كلمة المرور المؤقتة. اطلب من المدير إصدار كلمة جديدة.']]);
        }
        $user->forceFill(['failed_login_attempts' => 0, 'is_locked' => false, 'locked_until' => null])->save();

        abort_if(User::isDriverRole($user->role), 403, 'استخدم رابط التكليف المؤقت للوصول إلى مهام التوصيل.');

        // إنشاء توكن المصادقة
        $token = $user->createToken('auth_token')->plainTextToken;

        // تسجيل في Audit Log
        try {
            AuditLog::create([
                'id' => Str::uuid(),
                'user_id' => $user->id,
                'action' => 'login',
                'target_table' => 'users',
                'target_id' => $user->id,
                'details' => ['ip' => $request->ip(), 'user_agent' => $request->userAgent()],
            ]);
        } catch (\Throwable $e) {
            // تجاهل خطأ الـ Audit Log لعدم تعطيل عملية تسجيل الدخول
        }

        return response()->json([
            'success' => true,
            'message' => 'تم تسجيل الدخول بنجاح',
            'data' => [
                'user' => [
                    'id' => $user->id,
                    'username' => $user->username,
                    'full_name' => $user->full_name,
                    'role' => $user->role,
                    'permissions' => $user->permissions,
                    'must_change_password' => $user->must_change_password,
                ],
                'token' => $token,
            ],
        ]);
    }

    private function lockMinutes(User $user, int $attempts): int
    {
        if ($user->role !== 'admin') {
            return $attempts >= config('account_security.user_failure_limit') ? 1 : 0;
        }
        foreach (config('account_security.admin_lock_minutes') as $index => $minutes) {
            if ($attempts <= (($index + 1) * 3)) {
                return $minutes;
            }
        }

        return (int) last(config('account_security.admin_lock_minutes'));
    }

    /**
     * الحصول على بيانات المستخدم الحالي
     */
    public function me(Request $request)
    {
        return response()->json([
            'success' => true,
            'data' => $request->user(),
        ]);
    }
}
