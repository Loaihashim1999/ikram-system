<?php

namespace App\Http\Controllers;

use App\Models\InventoryItem;
use App\Models\InventoryMovement;
use App\Models\SupportDistributionItem;
use App\Services\SupportQuantity;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class InventoryController extends Controller
{
    public function index()
    {
        $items = InventoryItem::withCount(['movements as total_in' => function ($q) {
            $q->where('type', 'in');
        }, 'movements as total_out' => function ($q) {
            $q->where('type', 'out');
        }])->orderBy('created_at', 'desc')->get();

        return response()->json(['data' => $items]);
    }

    public function show($id)
    {
        $item = InventoryItem::withCount(['movements as total_in' => function ($q) {
            $q->where('type', 'in');
        }, 'movements as total_out' => function ($q) {
            $q->where('type', 'out');
        }])->findOrFail($id);

        return response()->json(['success' => true, 'data' => $item]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'unit' => 'required|string|max:50',
            'current_quantity' => 'required|numeric|decimal:0,2|min:0|max:9999999999.99',
            'min_threshold' => 'required|numeric|decimal:0,2|min:0|max:9999999999.99',
            'description' => 'nullable|string',
            'expiration_date' => 'nullable|date',
            'expiry_date' => 'nullable|date',
            'basket_number' => 'nullable|string|max:100',
        ]);

        $rawDate = $request->input('expiration_date', $request->input('expiry_date'));
        $normalizedDate = $rawDate ? substr((string) $rawDate, 0, 10) : null;
        $validated['expiration_date'] = $normalizedDate;
        $validated['expiry_date'] = $normalizedDate;

        $item = DB::transaction(function () use ($validated, $request) {
            $item = InventoryItem::create($validated);
            if ($validated['current_quantity'] > 0) {
                InventoryMovement::create([
                    'inventory_item_id' => $item->id,
                    'type' => 'in',
                    'quantity' => $validated['current_quantity'],
                    'reason' => 'رصيد افتتاحي',
                    'user_id' => $request->user()?->id,
                ]);
            }

            return $item;
        });

        return response()->json(['success' => true, 'message' => 'تم إضافة الصنف بنجاح', 'data' => $item->fresh()], 201);
    }

    public function update(Request $request, $id)
    {
        $item = InventoryItem::findOrFail($id);
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'unit' => 'required|string|max:50',
            'min_threshold' => 'required|numeric|decimal:0,2|min:0|max:9999999999.99',
            'current_quantity' => 'sometimes|required|numeric|decimal:0,2|min:0|max:9999999999.99',
            'description' => 'nullable|string',
            'expiration_date' => 'nullable|date',
            'expiry_date' => 'nullable|date',
            'basket_number' => 'nullable|string|max:100',
        ]);

        if ($request->has('expiration_date') || $request->has('expiry_date')) {
            $rawDate = $request->input('expiration_date', $request->input('expiry_date'));
            $normalizedDate = $rawDate ? substr((string) $rawDate, 0, 10) : null;
            $validated['expiration_date'] = $normalizedDate;
            $validated['expiry_date'] = $normalizedDate;
        }

        $item = DB::transaction(function () use ($id, $validated) {
            $item = InventoryItem::whereKey($id)->lockForUpdate()->firstOrFail();
            if (isset($validated['current_quantity']) && (float) $validated['current_quantity'] < (float) $item->reserved_quantity) {
                throw ValidationException::withMessages(['current_quantity' => 'لا يمكن خفض المخزون عن الكمية المحجوزة.']);
            }
            if (isset($validated['current_quantity']) && SupportQuantity::compare($validated['current_quantity'], $item->current_quantity) !== 0) {
                throw ValidationException::withMessages(['current_quantity' => 'لتغيير الرصيد استخدم تعديل المخزون لتسجيل حركة المخزون.']);
            }
            $item->update($validated);

            return $item;
        });

        return response()->json(['success' => true, 'message' => 'تم تحديث الصنف بنجاح', 'data' => $item->fresh()]);
    }

    public function destroy($id)
    {
        $item = InventoryItem::findOrFail($id);
        if ($item->reserved_quantity > 0 || SupportDistributionItem::where('inventory_item_id', $id)->exists()) {
            throw ValidationException::withMessages(['inventory_item' => 'الصنف مرتبط بسجل دعم أو حجز ولا يمكن حذفه.']);
        }
        $item->delete();

        return response()->json(['success' => true, 'message' => 'تم حذف الصنف بنجاح']);
    }

    public function adjustStock(Request $request, $id)
    {
        try {
            $request->validate([
                'type' => 'required|in:in,out',
                'quantity' => 'required|numeric|decimal:0,2|gt:0|max:9999999999.99',
                'reason' => 'required|string|max:255',
            ]);

            $item = InventoryItem::findOrFail($id);

            // التحقق من وجود المستخدم
            if (! $request->user()) {
                return response()->json([
                    'success' => false,
                    'message' => 'المستخدم غير مسجل دخوله',
                ], 401);
            }

            DB::transaction(function () use ($request, $item) {
                $item = InventoryItem::whereKey($item->id)->lockForUpdate()->firstOrFail();
                if ($request->type === 'out' && $item->available_quantity < $request->quantity) {
                    throw ValidationException::withMessages(['quantity' => 'الكمية المراد صرفها أكبر من المخزون المتاح بعد الحجز.']);
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
                'data' => $item->fresh(),
            ]);
        } catch (ValidationException $e) {
            throw $e;
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }
}
