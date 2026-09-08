<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\DailyInventoryItem;
use App\Models\DailyInventoryMovement;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DailyInventoryController extends Controller
{
    /**
     * عرض قائمة أصناف مستودع المستفيدين اليوميين
     */
    public function index(Request $request): JsonResponse
    {
        $query = DailyInventoryItem::query();

        if ($request->filled('search')) {
            $term = trim($request->search);
            $query->where(function ($q) use ($term) {
                $q->where('name', 'like', "%{$term}%")
                  ->orWhere('batch_number', 'like', "%{$term}%")
                  ->orWhere('supplier', 'like', "%{$term}%")
                  ->orWhere('category', 'like', "%{$term}%");
            });
        }

        if ($request->filled('category') && $request->category !== 'all') {
            $query->where('category', $request->category);
        }

        if ($request->filled('status') && $request->status !== 'all') {
            if ($request->status === 'low_stock') {
                $query->whereColumn('current_quantity', '<=', 'min_threshold');
            } elseif ($request->status === 'expired') {
                $query->whereNotNull('expiry_date')->whereDate('expiry_date', '<', Carbon::today());
            } elseif ($request->status === 'available') {
                $query->where('current_quantity', '>', 0);
            } else {
                $query->where('status', $request->status);
            }
        }

        $items = $query->latest()->get();

        // إحصائيات سريعة للمستودع
        $totalItems = DailyInventoryItem::count();
        $totalQuantity = DailyInventoryItem::sum('current_quantity');
        $lowStockCount = DailyInventoryItem::whereColumn('current_quantity', '<=', 'min_threshold')->count();
        $expiredCount = DailyInventoryItem::whereNotNull('expiry_date')->whereDate('expiry_date', '<', Carbon::today())->count();
        $categories = DailyInventoryItem::distinct()->whereNotNull('category')->pluck('category');

        return response()->json([
            'success' => true,
            'data' => $items,
            'stats' => [
                'total_items' => $totalItems,
                'total_quantity' => $totalQuantity,
                'low_stock_count' => $lowStockCount,
                'expired_count' => $expiredCount,
            ],
            'categories' => $categories,
        ]);
    }

    /**
     * إضافة صنف جديد إلى مستودع المستفيدين اليوميين
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:150',
            'quantity' => 'required|integer|min:0',
            'unit' => 'nullable|string|max:50',
            'min_threshold' => 'nullable|integer|min:1',
            'category' => 'nullable|string|max:100',
            'batch_number' => 'nullable|string|max:100',
            'supplier' => 'nullable|string|max:150',
            'expiry_date' => 'nullable|date',
            'description' => 'nullable|string',
        ], [
            'name.required' => 'اسم الصنف أو السلة مطلوب.',
            'quantity.required' => 'الكمية الابتدائية مطلوبة.',
            'quantity.min' => 'الكمية يجب أن تكون صفراً أو أكثر.',
        ]);

        return DB::transaction(function () use ($validated, $request) {
            $item = DailyInventoryItem::create([
                'name' => $validated['name'],
                'current_quantity' => $validated['quantity'],
                'reserved_quantity' => 0,
                'unit' => $validated['unit'] ?? 'سلة',
                'min_threshold' => $validated['min_threshold'] ?? 5,
                'category' => $validated['category'] ?? null,
                'batch_number' => $validated['batch_number'] ?? null,
                'supplier' => $validated['supplier'] ?? null,
                'expiry_date' => $validated['expiry_date'] ?? null,
                'description' => $validated['description'] ?? null,
                'status' => 'available',
            ]);

            // حركة رصيد افتتاحي
            if ($validated['quantity'] > 0) {
                DailyInventoryMovement::create([
                    'daily_inventory_item_id' => $item->id,
                    'type' => 'in',
                    'quantity' => $validated['quantity'],
                    'reason' => 'رصيد افتتاحي عند إنشاء الصنف في مستودع المستفيدين اليوميين',
                    'user_id' => $request->user()?->id,
                ]);
            }

            try {
                AuditLog::create([
                    'user_id' => $request->user()?->id,
                    'action' => 'CREATE_DAILY_INVENTORY_ITEM',
                    'details' => "تمت إضافة صنف جديد لمستودع المستفيدين اليوميين: {$item->name} بكمية {$item->current_quantity}",
                ]);
            } catch (\Exception $e) {
                // non-blocking
            }

            return response()->json([
                'success' => true,
                'message' => 'تمت إضافة الصنف إلى المستودع بنجاح.',
                'data' => $item,
            ], 201);
        });
    }

    /**
     * عرض تفاصيل الصنف مع سجل حركاته
     */
    public function show(string $id): JsonResponse
    {
        $item = DailyInventoryItem::with(['movements.user'])->findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => $item,
        ]);
    }

    /**
     * تعديل بيانات صنف في المستودع
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $item = DailyInventoryItem::findOrFail($id);

        $validated = $request->validate([
            'name' => 'required|string|max:150',
            'unit' => 'nullable|string|max:50',
            'min_threshold' => 'nullable|integer|min:1',
            'category' => 'nullable|string|max:100',
            'batch_number' => 'nullable|string|max:100',
            'supplier' => 'nullable|string|max:150',
            'expiry_date' => 'nullable|date',
            'description' => 'nullable|string',
            'status' => 'nullable|string|max:30',
        ]);

        $item->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث بيانات الصنف بنجاح.',
            'data' => $item,
        ]);
    }

    /**
     * حذف صنف
     */
    public function destroy(string $id): JsonResponse
    {
        $item = DailyInventoryItem::findOrFail($id);
        $item->delete();

        return response()->json([
            'success' => true,
            'message' => 'تم حذف الصنف من المستودع بنجاح.',
        ]);
    }

    /**
     * تسوية وتعديل يدوي لكمية الصنف في المستودع (توريد / صرف / تسوية جرد)
     */
    public function adjustStock(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'type' => 'required|in:in,out,adjustment',
            'quantity' => 'required|integer|min:1',
            'reason' => 'required|string|max:255',
            'notes' => 'nullable|string',
        ], [
            'type.required' => 'نوع الحركة مطلوب (توريد / صرف / تسوية).',
            'quantity.required' => 'الكمية مطلوبة.',
            'quantity.min' => 'الكمية يجب أن تكون أكبر من صفر.',
            'reason.required' => 'سبب التعديل إلزامي لضمان دقة الرقابة والتدقيق.',
        ]);

        return DB::transaction(function () use ($id, $validated, $request) {
            $item = DailyInventoryItem::lockForUpdate()->findOrFail($id);
            $qty = $validated['quantity'];
            $type = $validated['type'];

            if ($type === 'in') {
                $item->current_quantity += $qty;
            } elseif ($type === 'out') {
                if ($item->current_quantity < $qty) {
                    return response()->json([
                        'success' => false,
                        'message' => "الكمية المراد صرفها ({$qty}) تتجاوز الرصيد المتوفر في المستودع ({$item->current_quantity}).",
                    ], 422);
                }
                $item->current_quantity -= $qty;
            } elseif ($type === 'adjustment') {
                // Adjustment sets new total quantity
                $item->current_quantity = $qty;
            }

            $item->save();

            // تسجيل الحركة
            $movement = DailyInventoryMovement::create([
                'daily_inventory_item_id' => $item->id,
                'type' => $type,
                'quantity' => $qty,
                'reason' => $validated['reason'],
                'notes' => $validated['notes'] ?? null,
                'user_id' => $request->user()?->id,
            ]);

            try {
                AuditLog::create([
                    'user_id' => $request->user()?->id,
                    'action' => 'ADJUST_DAILY_INVENTORY',
                    'details' => "تعديل رصيد صنف {$item->name}: النوع {$type}، الكمية {$qty}، السبب: {$validated['reason']}",
                ]);
            } catch (\Exception $e) {
                // non-blocking
            }

            return response()->json([
                'success' => true,
                'message' => 'تم تحديث رصيد الصنف وتسجيل حركة المستودع بنجاح.',
                'data' => [
                    'item' => $item,
                    'movement' => $movement->load('user'),
                ],
            ]);
        });
    }

    /**
     * عرض سجل حركات مستودع المستفيدين اليوميين الشامل
     */
    public function movements(Request $request): JsonResponse
    {
        $query = DailyInventoryMovement::with(['item', 'user']);

        if ($request->filled('item_id') && $request->item_id !== 'all') {
            $query->where('daily_inventory_item_id', $request->item_id);
        }

        if ($request->filled('type') && $request->type !== 'all') {
            $query->where('type', $request->type);
        }

        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->date_from);
        }
        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->date_to);
        }

        $perPage = intval($request->get('per_page', 20));
        $movements = $query->latest()->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $movements,
        ]);
    }
}
