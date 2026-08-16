<?php

namespace App\Http\Controllers\Beneficiaries;

use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class CategoryController extends Controller
{
    public function index()
    {
        $categories = Category::withCount('beneficiaries')->get();

        return response()->json([
            'success' => true,
            'data' => $categories
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:100|unique:categories,name',
            'description' => 'nullable|string',
            'basket_entitlement_per_period' => 'integer|min:1',
        ]);

        $category = Category::create(array_merge($validated, [
            'id' => Str::uuid(),
        ]));

        return response()->json([
            'success' => true,
            'message' => 'تم إضافة الفئة بنجاح',
            'data' => $category
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $category = Category::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:100|unique:categories,name,' . $id,
            'description' => 'nullable|string',
            'basket_entitlement_per_period' => 'sometimes|integer|min:1',
        ]);

        $category->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث الفئة',
            'data' => $category
        ]);
    }

    public function destroy($id)
    {
        $category = Category::findOrFail($id);
        $category->delete();

        return response()->json([
            'success' => true,
            'message' => 'تم حذف الفئة'
        ]);
    }
}