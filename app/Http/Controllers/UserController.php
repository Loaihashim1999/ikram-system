<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
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
            'role' => 'required|string|max:50',
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
            'permissions' => $validated['permissions'] ?? null,
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
            'role' => 'sometimes|required|string|max:50',
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

    public function destroy(string $id): JsonResponse
    {
        $user = User::findOrFail($id);
        if ($user->username === 'admin') {
            return response()->json(['success' => false, 'message' => 'لا يمكن حذف حساب المدير الرئيسي.'], 403);
        }
        $user->delete();

        return response()->json(['success' => true, 'message' => 'تم حذف الحساب بنجاح.']);
    }

    public function drivers(): JsonResponse
    {
        $drivers = User::whereIn('role', ['driver', 'assistant'])->orWhere('role', 'like', '%driver%')->get();

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
