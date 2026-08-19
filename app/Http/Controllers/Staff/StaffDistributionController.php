<?php

namespace App\Http\Controllers;

use App\Models\Staff;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StaffController extends Controller
{
    /**
     * عرض جميع الموظفين
     * GET /api/staff
     */
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => Staff::latest()->get(),
        ]);
    }

    /**
     * إضافة موظف جديد
     * POST /api/staff
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'national_id' => 'required|string|size:10|unique:staff,national_id',
            'phone' => 'required|string|max:20',
            'email' => 'nullable|email|unique:staff,email',
            'job_title' => 'required|string|max:100',
            'department' => 'nullable|string|max:100',
            'hire_date' => 'required|date',
            'salary' => 'nullable|numeric|min:0',
            'status' => 'nullable|in:active,on_leave,terminated',
        ], [
            'name.required' => 'اسم الموظف مطلوب.',
            'national_id.required' => 'رقم الهوية مطلوب.',
            'national_id.size' => 'رقم الهوية يجب أن يتكون من 10 أرقام.',
            'national_id.unique' => 'رقم الهوية مسجل لموظف آخر.',
            'phone.required' => 'رقم الهاتف مطلوب.',
            'job_title.required' => 'المسمى الوظيفي مطلوب.',
            'hire_date.required' => 'تاريخ التعيين مطلوب.',
        ]);

        $staff = Staff::create($validated);

        return response()->json([
            'data' => $staff,
            'message' => 'تمت إضافة الموظف بنجاح.',
        ], 201);
    }

    /**
     * عرض موظف واحد
     * GET /api/staff/{staff}
     */
    public function show(Staff $staff): JsonResponse
    {
        return response()->json(['data' => $staff]);
    }

    /**
     * تعديل بيانات موظف
     * PUT /api/staff/{staff}
     */
    public function update(Request $request, Staff $staff): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'national_id' => 'sometimes|required|string|size:10|unique:staff,national_id,'.$staff->id,
            'phone' => 'sometimes|required|string|max:20',
            'email' => 'nullable|email|unique:staff,email,'.$staff->id,
            'job_title' => 'sometimes|required|string|max:100',
            'department' => 'nullable|string|max:100',
            'hire_date' => 'sometimes|required|date',
            'salary' => 'nullable|numeric|min:0',
            'status' => 'sometimes|in:active,on_leave,terminated',
        ]);

        $staff->update($validated);

        return response()->json([
            'data' => $staff,
            'message' => 'تم تعديل بيانات الموظف بنجاح.',
        ]);
    }

    /**
     * حذف موظف
     * DELETE /api/staff/{staff}
     */
    public function destroy(Staff $staff): JsonResponse
    {
        $staff->delete();

        return response()->json([
            'message' => 'تم حذف الموظف بنجاح.',
        ]);
    }
}
