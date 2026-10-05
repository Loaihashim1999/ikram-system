<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;

class FirstAdminSetupController extends Controller
{
    public function status(): JsonResponse
    {
        return response()->json(['data' => ['setup_required' => $this->isSetupRequired()]]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'full_name' => ['required', 'string', 'max:150'],
            'username' => ['required', 'string', 'max:50', 'alpha_dash', 'unique:users,username'],
            'email' => ['required', 'email:rfc', 'max:100', 'unique:users,email'],
            'password' => ['required', 'confirmed', Password::min(12)->mixedCase()->numbers()->symbols()],
        ]);

        try {
            $admin = DB::transaction(function () use ($validated) {
                $state = DB::table('system_initializations')
                    ->where('key', 'first_admin')
                    ->lockForUpdate()
                    ->first();

                if (! $state || $state->completed_at !== null || User::query()->where('role', 'admin')->exists()) {
                    abort(403);
                }

                $claimed = DB::table('system_initializations')
                    ->where('key', 'first_admin')
                    ->whereNull('completed_at')
                    ->update(['completed_at' => now(), 'updated_at' => now()]);

                if ($claimed !== 1) {
                    abort(403);
                }

                $admin = User::query()->create([
                    'username' => Str::lower(trim($validated['username'])),
                    'email' => Str::lower(trim($validated['email'])),
                    'password' => Hash::make($validated['password']),
                    'full_name' => trim($validated['full_name']),
                    'role' => 'admin',
                    'permissions' => [],
                    'is_active' => true,
                    'can_receive_notifications' => true,
                ]);

                AuditLog::query()->create([
                    'user_id' => $admin->id,
                    'action' => 'FIRST_ADMIN_INITIALIZED',
                    'target_table' => 'users',
                    'target_id' => $admin->id,
                    'details' => ['event' => 'initialization_completed'],
                ]);

                return $admin;
            }, 3);
        } catch (QueryException $exception) {
            usleep(200000);
            if (! $this->isSetupRequired()) {
                abort(403);
            }

            throw $exception;
        }

        return response()->json([
            'success' => true,
            'message' => 'تم إنشاء حساب المشرف وإغلاق الإعداد الأولي بنجاح.',
            'data' => ['username' => $admin->username],
        ], 201);
    }

    private function isSetupRequired(): bool
    {
        $completed = DB::table('system_initializations')
            ->where('key', 'first_admin')
            ->whereNotNull('completed_at')
            ->exists();

        return ! $completed && ! User::query()->where('role', 'admin')->where('is_active', true)->exists();
    }
}
