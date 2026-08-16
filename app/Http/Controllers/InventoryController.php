<?php

namespace App\Http\Controllers;

use App\Models\InventoryItem;
use App\Models\InventoryMovement;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class InventoryController extends Controller
{
    public function index()
    {
        $items = InventoryItem::withCount(['movements as total_in' => function($q) {
            $q->where('type', 'in');
        }, 'movements as total_out' => function($q) {
            $q->where('type', 'out');
        }])->orderBy('created_at', 'desc')->get();

        return response()->json(['data' => $items]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'unit' => 'required|string|max:50',
            'current_quantity' => 'required|integer|min:0',
            'min_threshold' => 'required|integer|min:0',
            'description' => 'nullable|string',
        ]);

        $item = InventoryItem::create($validated);

        if ($validated['current_quantity'] > 0) {
            InventoryMovement::create([
                'inventory_item_id' => $item->id,
                'type' => 'in',
                'quantity' => $validated['current_quantity'],
                'reason' => 'رصيد افتتاحي',
                'user_id' => $request->user()->id,
            ]);
        }

        return response()->json(['success' => true, 'message' => 'تم إضافة الصنف بنجاح', 'data' => $item], 201);
    }

    public function update(Request $request, $id)
    {
        $item = InventoryItem::findOrFail($id);
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'unit' => 'required|string|max:50',
            'min_threshold' => 'required|integer|min:0',
            'description' => 'nullable|string',
        ]);

        $item->update($validated);
        return response()->json(['success' => true, 'message' => 'تم تحديث الصنف بنجاح', 'data' => $item]);
    }

    public function destroy($id)
    {
        $item = InventoryItem::findOrFail($id);
        $item->delete();
        return response()->json(['success' => true, 'message' => 'تم حذف الصنف بنجاح']);
    }

   public function adjustStock(Request $request, $id)
{
    try {
        $request->validate([
            'type' => 'required|in:in,out',
            'quantity' => 'required|integer|min:1',
            'reason' => 'required|string|max:255',
        ]);

        $item = InventoryItem::findOrFail($id);

        // التحقق من وجود المستخدم
        if (!$request->user()) {
            return response()->json([
                'success' => false,
                'message' => 'المستخدم غير مسجل دخوله'
            ], 401);
        }

        DB::transaction(function () use ($request, $item) {
            if ($request->type === 'out' && $item->current_quantity < $request->quantity) {
                throw new \Exception('الكمية المراد صرفها أكبر من المخزون المتاح');
            }

            $item->current_quantity = $request->type === 'in' 
                ? $item->current_quantity + $request->quantity 
                : $item->current_quantity - $request->quantity;
            
            $item->save();

            InventoryMovement::create([
                'inventory_item_id' => $item->id,
                'type' => $request->type,
                'quantity' => $request->quantity,
                'reason' => $request->reason,
                'user_id' => $request->user()->id,
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'تم تعديل المخزون بنجاح',
            'data' => $item->fresh()
        ]);
    } catch (\Exception $e) {
        return response()->json([
            'success' => false,
            'message' => $e->getMessage()
        ], 500);
    }
}
}