<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SettingsController extends Controller
{
    public function index(): JsonResponse
    {
        $settings = DB::table('settings')->pluck('value', 'key');
        return response()->json(['data' => $settings]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->all();

        foreach ($data as $key => $value) {
            DB::table('settings')->updateOrInsert(
                ['key' => $key],
                ['value' => $value, 'updated_at' => now()]
            );
        }

        return response()->json([
            'success' => true,
            'message' => 'تم حفظ الإعدادات بنجاح.',
            'data'    => DB::table('settings')->pluck('value', 'key'),
        ]);
    }
}
