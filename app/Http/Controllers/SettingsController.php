<?php

namespace App\Http\Controllers;

use App\Models\Setting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SettingsController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(['data' => DB::table('settings')->pluck('value', 'key')]);
    }

    public function update(Request $request): JsonResponse
    {
        $rules = [
            'first_class_max_income' => 'sometimes|required|numeric|min:0|max:9999999999.99',
            'second_class_max_income' => 'sometimes|required|numeric|min:0|max:9999999999.99',
            'resident_need_threshold' => 'sometimes|required|numeric|min:0|max:9999999999.99',
            'elderly_min_age' => 'sometimes|required|integer|min:0|max:150',
            'warehouse_alert_threshold_days' => 'sometimes|required|integer|min:0|max:3650',
            'system_name' => 'sometimes|required|string|max:255',
            'organization_name' => 'sometimes|required|string|max:255',
        ];
        foreach (array_diff(array_keys($request->all()), array_keys($rules)) as $key) {
            throw ValidationException::withMessages([$key => 'مفتاح إعداد غير مسموح.']);
        }
        $data = $request->validate($rules);
        DB::transaction(function () use ($data) {
            foreach ($data as $key => $value) {
                Setting::set($key, (string) $value);
            }
        });

        return response()->json(['success' => true, 'message' => 'تم حفظ الإعدادات بنجاح.', 'data' => DB::table('settings')->pluck('value', 'key')]);
    }
}
