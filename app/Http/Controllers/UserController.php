<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

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
            'password' => 'required|string|min:6',
            'full_name' => 'required|string|max:150',
            'phone' => 'nullable|string|max:20',
            'role' => 'required|string|max:50',
            'permissions' => 'nullable|array',
        ]);

        $user = User::create([
            'id' => Str::uuid(),
            'username' => $validated['username'],
            'password' => Hash::make($validated['password']),
            'full_name' => $validated['full_name'],
            'phone' => $validated['phone'] ?? null,
            'role' => $validated['role'],
            'permissions' => $validated['permissions'] ?? null,
            'is_active' => true,
        ]);

        return response()->json([
            'success' => true,
            'message' => "تم إنشاء حساب {$user->full_name} بنجاح.",
            'data' => $user,
        ], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $user = User::findOrFail($id);

        $validated = $request->validate([
            'full_name' => 'sometimes|required|string|max:150',
            'phone' => 'nullable|string|max:20',
            'role' => 'sometimes|required|string|max:50',
            'password' => 'nullable|string|min:6',
            'is_active' => 'nullable|boolean',
            'permissions' => 'nullable|array',
        ]);

        $updateData = [];
        if (isset($validated['full_name'])) {
            $updateData['full_name'] = $validated['full_name'];
        }
        if (array_key_exists('phone', $validated)) {
            $updateData['phone'] = $validated['phone'];
        }
        if (isset($validated['role'])) {
            $updateData['role'] = $validated['role'];
        }
        if (array_key_exists('is_active', $validated)) {
            $updateData['is_active'] = $validated['is_active'];
        }
        if (array_key_exists('permissions', $validated)) {
            $updateData['permissions'] = $validated['permissions'];
        }
        if (! empty($validated['password'])) {
            $updateData['password'] = Hash::make($validated['password']);
        }

        $user->update($updateData);

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
}
