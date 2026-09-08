<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Category;
use App\Models\DailyBeneficiary;
use App\Models\DailyBeneficiaryDocument;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class DailyBeneficiaryController extends Controller
{
    /**
     * عرض قائمة المستفيدين اليوميين مع البحث والتصفية المتقدمة
     */
    public function index(Request $request): JsonResponse
    {
        $query = DailyBeneficiary::with(['category']);

        // بحث بالاسم أو رقم الهوية أو رقم الجوال
        if ($request->filled('search')) {
            $term = trim($request->search);
            $query->search($term);
        }

        // تصفية حسب الحي
        if ($request->filled('district') && $request->district !== 'all') {
            $query->where('district', $request->district);
        }

        // تصفية حسب الفئة
        if ($request->filled('category_id') && $request->category_id !== 'all') {
            $query->where('category_id', $request->category_id);
        }

        // تصفية حسب الحالة (نشط / غير نشط)
        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        // تصفية حسب تاريخ التسجيل
        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->date_from);
        }
        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->date_to);
        }

        // تصفية حسب تاريخ آخر استلام
        if ($request->filled('last_delivery_from')) {
            $query->whereDate('last_delivery_date', '>=', $request->last_delivery_from);
        }
        if ($request->filled('last_delivery_to')) {
            $query->whereDate('last_delivery_date', '<=', $request->last_delivery_to);
        }

        $perPage = intval($request->get('per_page', 15));
        $beneficiaries = $query->latest()->paginate($perPage);

        // جلب قائمة الأحياء المتاحة للاستخدام في فلتر الواجهة
        $districts = DailyBeneficiary::distinct()->whereNotNull('district')->pluck('district');
        $categories = Category::all(['id', 'name']);

        return response()->json([
            'success' => true,
            'data' => $beneficiaries,
            'districts' => $districts,
            'categories' => $categories,
        ]);
    }

    /**
     * التحقق المسبق من وجود رقم الهوية / الإقامة لمنع التكرار
     */
    public function checkNationalId(string $nationalId, Request $request): JsonResponse
    {
        $ignoreId = $request->query('ignore_id');
        $query = DailyBeneficiary::where('national_id', $nationalId);

        if ($ignoreId) {
            $query->where('id', '!=', $ignoreId);
        }

        $exists = $query->exists();
        $existing = $exists ? $query->first(['id', 'full_name', 'phone', 'district']) : null;

        return response()->json([
            'exists' => $exists,
            'beneficiary' => $existing,
        ]);
    }

    /**
     * إضافة مستفيد يومي جديد
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'full_name' => 'required|string|max:150',
            'national_id' => [
                'required',
                'string',
                'size:10',
                'regex:/^[12]\d{9}$/',
                'unique:daily_beneficiaries,national_id',
            ],
            'phone' => [
                'required',
                'string',
                'regex:/^(05\d{8}|5\d{8})$/',
            ],
            'district' => 'required|string|max:100',
            'date_of_birth' => 'nullable|date',
            'category_id' => 'nullable|uuid|exists:categories,id',
            'status' => 'nullable|in:active,inactive',
            'notes' => 'nullable|string',
        ], [
            'full_name.required' => 'اسم المستفيد الرباعي مطلوب.',
            'national_id.required' => 'رقم الهوية الوطنية أو الإقامة مطلوب.',
            'national_id.size' => 'رقم الهوية أو الإقامة يجب أن يتكون من 10 أرقام.',
            'national_id.regex' => 'رقم الهوية الوطنية يبدأ برقم 1 ورقم الإقامة يبدأ برقم 2.',
            'national_id.unique' => 'رقم الهوية أو الإقامة مسجل بالفعل لمستفيد آخر.',
            'phone.required' => 'رقم الجوال مطلوب.',
            'phone.regex' => 'رقم الجوال غير صحيح (يجب أن يبدأ بـ 05 ويتكون من 10 أرقام).',
            'district.required' => 'اسم الحي مطلوب.',
        ]);

        // تطبيع رقم الجوال إذا بدأ بـ 5
        if (str_starts_with($validated['phone'], '5')) {
            $validated['phone'] = '0' . $validated['phone'];
        }

        // جلب اسم الفئة إن وجدت
        if (!empty($validated['category_id'])) {
            $cat = Category::find($validated['category_id']);
            $validated['category_name'] = $cat?->name;
        }

        $validated['created_by'] = $request->user()?->id;
        $validated['status'] = $validated['status'] ?? 'active';

        $beneficiary = DailyBeneficiary::create($validated);

        try {
            AuditLog::create([
                'user_id' => $request->user()?->id,
                'action' => 'CREATE_DAILY_BENEFICIARY',
                'details' => "تمت إضافة مستفيد يومي جديد: {$beneficiary->full_name} ({$beneficiary->national_id})",
            ]);
        } catch (\Exception $e) {
            // non-blocking
        }

        return response()->json([
            'success' => true,
            'message' => 'تم تسجيل المستفيد اليومي بنجاح.',
            'data' => $beneficiary->load('category'),
        ], 201);
    }

    /**
     * عرض تفاصيل مستفيد يومي
     */
    public function show(string $id): JsonResponse
    {
        $beneficiary = DailyBeneficiary::with([
            'category',
            'documents.uploader',
            'receivingTransactions.inventoryItem',
            'receivingTransactions.authorizedUser',
        ])->findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => $beneficiary,
        ]);
    }

    /**
     * تعديل بيانات المستفيد اليومي
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $beneficiary = DailyBeneficiary::findOrFail($id);

        $validated = $request->validate([
            'full_name' => 'required|string|max:150',
            'national_id' => [
                'required',
                'string',
                'size:10',
                'regex:/^[12]\d{9}$/',
                Rule::unique('daily_beneficiaries', 'national_id')->ignore($beneficiary->id),
            ],
            'phone' => [
                'required',
                'string',
                'regex:/^(05\d{8}|5\d{8})$/',
            ],
            'district' => 'required|string|max:100',
            'date_of_birth' => 'nullable|date',
            'category_id' => 'nullable|uuid|exists:categories,id',
            'status' => 'required|in:active,inactive',
            'notes' => 'nullable|string',
        ], [
            'full_name.required' => 'اسم المستفيد الرباعي مطلوب.',
            'national_id.required' => 'رقم الهوية الوطنية أو الإقامة مطلوب.',
            'national_id.size' => 'رقم الهوية أو الإقامة يجب أن يتكون من 10 أرقام.',
            'national_id.regex' => 'رقم الهوية الوطنية يبدأ برقم 1 ورقم الإقامة يبدأ برقم 2.',
            'national_id.unique' => 'رقم الهوية أو الإقامة مسجل بالفعل لمستفيد آخر.',
            'phone.required' => 'رقم الجوال مطلوب.',
            'phone.regex' => 'رقم الجوال غير صحيح (يجب أن يبدأ بـ 05 ويتكون من 10 أرقام).',
            'district.required' => 'اسم الحي مطلوب.',
        ]);

        if (str_starts_with($validated['phone'], '5')) {
            $validated['phone'] = '0' . $validated['phone'];
        }

        if (!empty($validated['category_id'])) {
            $cat = Category::find($validated['category_id']);
            $validated['category_name'] = $cat?->name;
        } else {
            $validated['category_name'] = null;
        }

        $beneficiary->update($validated);

        try {
            AuditLog::create([
                'user_id' => $request->user()?->id,
                'action' => 'UPDATE_DAILY_BENEFICIARY',
                'details' => "تم تحديث بيانات المستفيد اليومي: {$beneficiary->full_name} ({$beneficiary->national_id})",
            ]);
        } catch (\Exception $e) {
            // non-blocking
        }

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث بيانات المستفيد بنجاح.',
            'data' => $beneficiary->fresh(['category']),
        ]);
    }

    /**
     * حذف مستفيد يومي (حذف آمن مع حماية سجلات الاستلام السابقة)
     */
    public function destroy(string $id, Request $request): JsonResponse
    {
        $beneficiary = DailyBeneficiary::findOrFail($id);
        $name = $beneficiary->full_name;
        $natId = $beneficiary->national_id;

        $beneficiary->delete(); // Soft delete

        try {
            AuditLog::create([
                'user_id' => $request->user()?->id,
                'action' => 'DELETE_DAILY_BENEFICIARY',
                'details' => "تم حذف المستفيد اليومي: {$name} ({$natId}) مع الاحتفاظ بأرشيف استلاماته",
            ]);
        } catch (\Exception $e) {
            // non-blocking
        }

        return response()->json([
            'success' => true,
            'message' => 'تم حذف المستفيد اليومي بنجاح مع الحفاظ على سجل المعاملات التاريخية.',
        ]);
    }

    /**
     * رفع وثيقة للمستفيد اليومي
     */
    public function uploadDocument(Request $request, string $id): JsonResponse
    {
        $beneficiary = DailyBeneficiary::findOrFail($id);

        $request->validate([
            'document' => 'required|file|mimes:pdf,jpg,jpeg,png,docx|max:10240', // max 10MB
            'document_type' => 'required|string|max:50',
            'title' => 'nullable|string|max:150',
        ], [
            'document.required' => 'يرجى اختيار ملف الوثيقة.',
            'document.mimes' => 'صيغ الملفات المسموحة: PDF, JPG, PNG, DOCX.',
            'document.max' => 'الحد الأقصى لحجم الملف هو 10 ميجابايت.',
        ]);

        $file = $request->file('document');
        $fileName = $request->input('title') ?: $file->getClientOriginalName();
        $storedPath = $file->store("documents/daily/{$beneficiary->id}", 'public');

        $doc = DailyBeneficiaryDocument::create([
            'daily_beneficiary_id' => $beneficiary->id,
            'document_type' => $request->document_type,
            'file_name' => $fileName,
            'file_path' => $storedPath,
            'file_url' => Storage::url($storedPath),
            'file_type' => $file->getClientMimeType(),
            'file_size' => $file->getSize(),
            'uploaded_by' => $request->user()?->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'تم رفع الوثيقة بنجاح.',
            'data' => $doc->load('uploader'),
        ], 201);
    }

    /**
     * حذف وثيقة مستفيد يومي
     */
    public function deleteDocument(string $docId, Request $request): JsonResponse
    {
        $doc = DailyBeneficiaryDocument::findOrFail($docId);

        if ($doc->file_path && Storage::disk('public')->exists($doc->file_path)) {
            Storage::disk('public')->delete($doc->file_path);
        }

        $doc->delete();

        return response()->json([
            'success' => true,
            'message' => 'تم حذف الوثيقة بنجاح.',
        ]);
    }

    /**
     * سجل استلامات المساعدات للمستفيد اليومي
     */
    public function receivingHistory(string $id, Request $request): JsonResponse
    {
        $beneficiary = DailyBeneficiary::findOrFail($id);

        $perPage = intval($request->get('per_page', 15));
        $history = $beneficiary->receivingTransactions()
            ->with(['inventoryItem', 'authorizedUser'])
            ->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $history,
            'beneficiary' => [
                'id' => $beneficiary->id,
                'full_name' => $beneficiary->full_name,
                'national_id' => $beneficiary->national_id,
                'phone' => $beneficiary->phone,
                'district' => $beneficiary->district,
                'total_received_count' => $beneficiary->total_received_count,
                'last_delivery_date' => $beneficiary->last_delivery_date,
            ],
        ]);
    }
}
