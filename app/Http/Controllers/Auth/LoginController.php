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

        // التحقق من كلمة المرور
        $passwordMatches = Hash::check($request->password, $user->password);
        if (! $passwordMatches) {
            throw ValidationException::withMessages([
                'username' => ['اسم المستخدم أو كلمة المرور غير صحيحة'],
            ]);
        }

        // التحقق من أن الحساب نشط
        if (! $user->is_active) {
            throw ValidationException::withMessages([
                'username' => ['هذا الحساب معطل. تواصل مع مسؤول النظام.'],
            ]);
        }

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
                ],
                'token' => $token,
            ],
        ]);
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
