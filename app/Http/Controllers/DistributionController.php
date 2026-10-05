<?php

namespace App\Http\Controllers;

use App\Models\Basket;
use App\Models\Beneficiary;
use App\Models\Distribution;
use App\Models\InventoryItem;
use App\Models\InventoryMovement;
use App\Models\RepDistribution;
use App\Models\Staff;
use App\Models\StaffDistribution;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class DistributionController extends Controller
{
    public function driverDeliveries(Request $request): JsonResponse
    {
        abort_unless(User::isDriverRole($request->user()?->role), 403);

        $beneficiaryDeliveries = Distribution::with(['beneficiary', 'basket'])
            ->where('driver_id', $request->user()->id)->latest()->get();
        $representativeDeliveries = RepDistribution::with(['representative', 'basket'])
            ->where('driver_id', $request->user()->id)->latest()->get();

        return response()->json(['data' => [
            'beneficiary_deliveries' => $beneficiaryDeliveries,
            'representative_deliveries' => $representativeDeliveries,
        ]]);
    }

    // ─── Index ───────────────────────────────────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        $query = Distribution::with(['beneficiary', 'basket', 'driver']);
        if (in_array($request->user()->role, ['driver', 'delivery_driver'])) {
            $query->where('driver_id', $request->user()->id);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('basket_id')) {
            $query->where('basket_id', $request->basket_id);
        }
        if ($request->filled('driver_id')) {
            $query->where('driver_id', $request->driver_id);
        }
        if ($request->filled('scheduled_date')) {
            $query->whereDate('scheduled_at', $request->scheduled_date);
        }

        $perPage = intval($request->get('per_page', 50));
        if ($perPage <= 0 || $request->boolean('all')) {
            return response()->json(['data' => $query->latest()->get()]);
        }

        return response()->json(['data' => $query->latest()->paginate($perPage)]);
    }

    // ─── Show ────────────────────────────────────────────────────────────────

    public function show(string $id): JsonResponse
    {
        $dist = Distribution::with(['beneficiary', 'basket', 'driver'])->findOrFail($id);
        if (in_array(request()->user()->role, ['driver', 'delivery_driver'])) {
            abort_unless($dist->driver_id === request()->user()->id, 403);
        }

        return response()->json(['data' => $dist]);
    }

    // ─── Store (Create Distribution Batch) ───────────────────────────────────

    public function store(Request $request): JsonResponse
    {
        return DB::transaction(function () use ($request) {
            $validated = $request->validate([
                'beneficiary_ids' => 'required_without:staff_ids|array|min:1',
                'beneficiary_ids.*' => 'required|uuid|exists:beneficiaries,id',
                'staff_ids' => 'required_without:beneficiary_ids|array|min:1',
                'staff_ids.*' => 'required|integer|exists:staff,id',
                'basket_id' => 'required|uuid',
                'scheduled_at' => 'required|date',
                'driver_id' => 'nullable|string',
                'pickup_location' => 'nullable|string|max:255',
            ]);
            $guardItem = InventoryItem::whereKey($validated['basket_id'])->lockForUpdate()->first();
            $guardCount = count($validated['staff_ids'] ?? $validated['beneficiary_ids'] ?? []);
            if ($guardItem && (float) $guardItem->available_quantity < $guardCount) {
                throw ValidationException::withMessages(['basket_id' => 'المخزون المتاح بعد الحجز غير كافٍ.']);
            }

            // Find in Basket model or InventoryItem model
            $basket = Basket::find($validated['basket_id']);
            $inventoryItem = null;

            if (! $basket) {
                $inventoryItem = InventoryItem::find($validated['basket_id']);
                if ($inventoryItem) {
                    $basket = Basket::updateOrCreate(
                        ['id' => $inventoryItem->id],
                        [
                            'name' => $inventoryItem->name,
                            'description' => $inventoryItem->description ?? 'سلة دعم مخصصة',
                            'stock_quantity' => $inventoryItem->current_quantity,
                            'low_stock_threshold' => $inventoryItem->min_threshold,
                        ]
                    );
                }
            }

            if (! $basket) {
                return response()->json([
                    'success' => false,
                    'message' => 'السلة أو مادة الدعم المختارة غير موجودة في النظام.',
                ], 422);
            }

            $isStaffDistribution = ! empty($validated['staff_ids']);
            $recipientIds = $isStaffDistribution ? $validated['staff_ids'] : $validated['beneficiary_ids'];
            $count = count($recipientIds);
            $availableStock = $basket->stock_quantity;

            // Check stock
            if ($availableStock < $count) {
                return response()->json([
                    'success' => false,
                    'message' => "الكمية المتاحة في المستودع ({$availableStock}) أقل من عدد المستفيدين المحددين ({$count}).",
                ], 422);
            }

            $distributions = [];
            $userId = $request->user()?->id ?? User::first()?->id;

            foreach ($recipientIds as $recipientId) {
                $code = strtoupper(Str::random(8));

                if ($isStaffDistribution) {
                    $staff = Staff::findOrFail($recipientId);
                    $distributions[] = StaffDistribution::create([
                        'id' => Str::uuid(),
                        'staff_id' => $staff->id,
                        'basket_id' => $basket->id,
                        'scheduled_at' => $validated['scheduled_at'],
                        'barcode_code' => $code,
                        'status' => 'scheduled',
                    ]);

                    continue;
                }

                $beneficiary = Beneficiary::findOrFail($recipientId);
                $dist = Distribution::create([
                    'id' => Str::uuid(),
                    'beneficiary_id' => $beneficiary->id,
                    'basket_id' => $basket->id,
                    'assigned_by' => $userId,
                    'driver_id' => $validated['driver_id'] ?? null,
                    'scheduled_at' => $validated['scheduled_at'],
                    'pickup_location' => $validated['pickup_location'] ?? null,
                    'barcode_code' => $code,
                    'status' => 'scheduled',
                    'sms_status' => 'pending',
                ]);

                $distributions[] = $dist;
            }

            // Deduct from Basket
            $basket->decrement('stock_quantity', $count);

            // Also deduct from InventoryItem and log movement if linked
            $linkedItem = $inventoryItem ?? InventoryItem::find($basket->id);
            if ($linkedItem) {
                $linkedItem->decrement('current_quantity', $count);
                try {
                    InventoryMovement::create([
                        'inventory_item_id' => $linkedItem->id,
                        'type' => 'out',
                        'quantity' => $count,
                        'reason' => "توزيع دعم للمستفيدين (دفعة {$count})",
                        'user_id' => $userId,
                    ]);
                } catch (\Exception $e) {
                    \Log::warning('Inventory movement log error: '.$e->getMessage());
                }
            }

            return response()->json([
                'success' => true,
                'message' => $isStaffDistribution
                    ? "تم إنشاء وتخصيص {$count} سلة دعم للموظفين بنجاح."
                    : "تم إنشاء وتخصيص {$count} سلة دعم بنجاح.",
                'distributions' => $distributions,
            ], 201);

        });
    }

    // ─── Mark Received ────────────────────────────────────────────────────────

    public function markReceived(Request $request, string $id): JsonResponse
    {
        $dist = Distribution::findOrFail($id);
        if (User::isDriverRole($request->user()?->role)) {
            abort_unless($dist->driver_id === $request->user()->id, 403);
        }
        if ($dist->status === 'delivered') {
            return response()->json(['success' => false, 'message' => 'تم الاستلام مسبقاً.'], 409);
        }
        $dist->update([
            'status' => 'delivered',
            'delivered_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'تم تأكيد الاستلام.',
            'data' => $dist,
        ]);
    }
}
