<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\Request;

class LogoutController extends Controller
{
    /**
     * تسجيل خروج المستخدم
     */
    public function logout(Request $request)
    {
        // حذف التوكن الحالي
        $request->user()->currentAccessToken()->delete();

        // تسجيل في Audit Log
        AuditLog::create([
            'id' => \Illuminate\Support\Str::uuid(),
            'user_id' => $request->user()->id,
            'action' => 'logout',
            'target_table' => 'users',
            'target_id' => $request->user()->id,
            'details' => ['ip' => $request->ip()],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'تم تسجيل الخروج بنجاح'
        ]);
    }
}