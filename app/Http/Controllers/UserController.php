<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

use App\Models\AuditLog;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function index(): JsonResponse
    {
        $users = User::latest()->get();

        return response()->json(['data' => $users]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'username' => 'required|string|max:50|unique:users,username',
            'email' => 'nullable|email|max:100|unique:users,email',
            'password' => 'required|string|min:6',
            'full_name' => 'required|string|max:150',
            'phone' => 'nullable|string|max:20',
            'role' => ['required', Rule::in(['admin', 'assistant_admin', 'reception', 'staff', 'warehouse', 'readonly', 'driver', 'delivery_driver'])],
            'permissions' => 'nullable|array',
        ], [
            'username.unique' => 'اسم المستخدم مستخدم بالفعل في حساب آخر.',
            'email.unique' => 'البريد الإلكتروني مستخدم بالفعل في حساب آخر.',
            'password.min' => 'يجب أن لا تقل كلمة المرور عن 6 أحرف.',
        ]);

        $user = User::create([
            'id' => Str::uuid(),
            'username' => $validated['username'],
            'email' => $validated['email'] ?? null,
            'password' => Hash::make($validated['password']),
            'full_name' => $validated['full_name'],
            'phone' => $validated['phone'] ?? null,
            'role' => $validated['role'],
            'permissions' => User::isDriverRole($validated['role']) ? User::DRIVER_PERMISSIONS : ($validated['permissions'] ?? null),
            'is_active' => true,
        ]);

        try {
            AuditLog::create([
                'user_id' => $request->user()?->id,
                'action' => 'CREATE_USER_ACCOUNT',
                'details' => "إنشاء حساب مستخدم جديد: {$user->username} ({$user->full_name}) برتبة {$user->role}",
            ]);
        } catch (\Exception $e) {}

        return response()->json([
            'success' => true,
            'message' => "تم إنشاء حساب {$user->full_name} بنجاح.",
            'data' => $user,
        ], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $user = User::findOrFail($id);
        $currentUser = $request->user();

        $validated = $request->validate([
            'full_name' => 'sometimes|required|string|max:150',
            'username' => ['sometimes', 'required', 'string', 'max:50', Rule::unique('users', 'username')->ignore($user->id)],
            'email' => ['nullable', 'email', 'max:100', Rule::unique('users', 'email')->ignore($user->id)],
            'phone' => 'nullable|string|max:20',
            'role' => ['sometimes', 'required', Rule::in(['admin', 'assistant_admin', 'reception', 'staff', 'warehouse', 'readonly', 'driver', 'delivery_driver'])],
            'password' => 'nullable|string|min:6',
            'is_active' => 'nullable|boolean',
            'permissions' => 'nullable|array',
        ], [
            'username.unique' => 'اسم المستخدم مستخدم بالفعل في حساب آخر.',
            'email.unique' => 'البريد الإلكتروني مستخدم بالفعل في حساب آخر.',
            'password.min' => 'يجب أن لا تقل كلمة المرور عن 6 أحرف.',
        ]);

        // Security check: Only admins can change roles or permissions
        if (isset($validated['role']) && $validated['role'] !== $user->role) {
            if ($currentUser && $currentUser->role !== 'admin') {
                return response()->json(['success' => false, 'message' => 'غير مصرح لك بتغيير أدوار الحسابات.'], 403);
            }
        }

        if (isset($validated['permissions']) && $currentUser && $currentUser->role !== 'admin') {
            return response()->json(['success' => false, 'message' => 'غير مصرح لك بتعديل مصفوفة الصلاحيات.'], 403);
        }

        $updateData = [];
        if (isset($validated['full_name'])) {
            $updateData['full_name'] = $validated['full_name'];
        }
        if (isset($validated['username'])) {
            $updateData['username'] = $validated['username'];
        }
        if (array_key_exists('email', $validated)) {
            $updateData['email'] = $validated['email'];
        }
        if (array_key_exists('phone', $validated)) {
            $updateData['phone'] = $validated['phone'];
        }
        if (isset($validated['role']) && (!$currentUser || $currentUser->role === 'admin')) {
            $updateData['role'] = $validated['role'];
        }
        if (array_key_exists('is_active', $validated)) {
            $updateData['is_active'] = $validated['is_active'];
        }
        if (array_key_exists('permissions', $validated) && (!$currentUser || $currentUser->role === 'admin')) {
            $updateData['permissions'] = $validated['permissions'];
        }
        if (User::isDriverRole($updateData['role'] ?? $user->role)) {
            $updateData['permissions'] = User::DRIVER_PERMISSIONS;
        }
        if (! empty($validated['password'])) {
            $updateData['password'] = Hash::make($validated['password']);
        }

        $user->update($updateData);

        try {
            AuditLog::create([
                'user_id' => $currentUser?->id,
                'action' => 'UPDATE_USER_ACCOUNT',
                'details' => "تعديل بيانات الحساب {$user->username} ({$user->full_name})",
            ]);
        } catch (\Exception $e) {}

        return response()->json([
            'success' => true,
            'message' => "تم تحديث بيانات وتصاريح حساب {$user->full_name} بنجاح.",
            'data' => $user,
        ]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $user = User::findOrFail($id);
        if ($user->username === 'admin' || $user->id === $request->user()?->id) {
            return response()->json(['success' => false, 'message' => 'لا يمكن حذف حساب المدير الرئيسي أو الحساب الحالي.'], 403);
        }

        DB::transaction(function () use ($request, $user) {
            $user->auditLogs()->get()->each(function (AuditLog $log) use ($user) {
                $details = $log->details ?? [];
                $details['actor_name'] ??= $user->full_name;
                $details['actor_role'] ??= $user->role;
                $details['actor_username'] ??= $user->username;
                $log->update(['details' => $details]);
            });
            $user->tokens()->delete();
            $user->delete();
            AuditLog::create([
                'user_id' => $request->user()?->id,
                'action' => 'DELETE_USER_ACCOUNT',
                'target_table' => 'users',
                'target_id' => $user->id,
                'details' => [
                    'deleted_username' => $user->username,
                    'deleted_full_name' => $user->full_name,
                    'deleted_role' => $user->role,
                ],
            ]);
        });

        return response()->json(['success' => true, 'message' => 'تم حذف صلاحية دخول الحساب مع الاحتفاظ بجميع سجلات الأعمال.']);
    }

    public function drivers(): JsonResponse
    {
        $query = User::whereIn('role', ['driver', 'delivery_driver'])->where('is_active', true);
        if (User::isDriverRole(request()->user()?->role)) {
            $query->whereKey(request()->user()->id);
        }
        $drivers = $query->get();

        return response()->json(['data' => $drivers]);
    }

    /**
     * Grant or revoke notification receiving privileges for a user (Admin only).
     */
    public function toggleNotifications(Request $request, string $id): JsonResponse
    {
        if ($request->user()?->role !== 'admin') {
            return response()->json([
                'success' => false,
                'message' => 'ليس لديك الصلاحيات المطلوبة (خاص بمدير النظام).'
            ], 403);
        }

        $user = User::findOrFail($id);

        $currentState = $user->canReceiveNotifications();
        $newState = $request->has('can_receive_notifications')
            ? (bool) $request->input('can_receive_notifications')
            : !$currentState;

        $user->can_receive_notifications = $newState;
        $permissions = $user->permissions ?? [];
        $permissions['can_receive_notifications'] = $newState;
        $user->permissions = $permissions;
        $user->save();

        try {
            AuditLog::create([
                'user_id' => $request->user()?->id,
                'action' => 'TOGGLE_NOTIFICATIONS',
                'details' => "تعديل صلاحية الإشعارات للمستخدم {$user->username} إلى: " . ($newState ? 'مفعل' : 'معطل'),
            ]);
        } catch (\Exception $e) {}

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث صلاحية استقبال الإشعارات بنجاح.',
            'user' => [
                'id' => $user->id,
                'username' => $user->username,
                'can_receive_notifications' => $newState,
            ]
        ]);
    }
}
