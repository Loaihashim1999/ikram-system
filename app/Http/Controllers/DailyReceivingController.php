<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\DailyBeneficiary;
use App\Models\DailyInventoryItem;
use App\Models\DailyInventoryMovement;
use App\Models\DailyReceivingTransaction;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DailyReceivingController extends Controller
{
    /**
     * عرض قائمة عمليات استلام مساعدات المستفيدين اليوميين
     */
    public function index(Request $request): JsonResponse
    {
        $query = DailyReceivingTransaction::with(['beneficiary', 'inventoryItem', 'authorizedUser']);

        if ($request->filled('search')) {
            $term = trim($request->search);
            $query->where(function ($q) use ($term) {
                $q->where('document_number', 'like', "%{$term}%")
                  ->orWhereHas('beneficiary', function ($bq) use ($term) {
                      $bq->where('full_name', 'like', "%{$term}%")
                         ->orWhere('national_id', 'like', "%{$term}%")
                         ->orWhere('phone', 'like', "%{$term}%");
                  });
            });
        }

        if ($request->filled('item_id') && $request->item_id !== 'all') {
            $query->where('daily_inventory_item_id', $request->item_id);
        }

        if ($request->filled('district') && $request->district !== 'all') {
            $query->whereHas('beneficiary', function ($bq) use ($request) {
                $bq->where('district', $request->district);
            });
        }

        if ($request->filled('date_from')) {
            $query->whereDate('receiving_date', '>=', $request->date_from);
        }
        if ($request->filled('date_to')) {
            $query->whereDate('receiving_date', '<=', $request->date_to);
        }

        $perPage = intval($request->get('per_page', 20));
        if ($perPage <= 0 || $request->boolean('all')) {
            $transactions = $query->latest('receiving_date')->get();
        } else {
            $transactions = $query->latest('receiving_date')->paginate($perPage);
        }

        // إحصائيات سريعة
        $today = Carbon::today();
        $todayTransactionsCount = DailyReceivingTransaction::whereDate('receiving_date', $today)->count();
        $todayBasketsCount = DailyReceivingTransaction::whereDate('receiving_date', $today)->sum('quantity');
        $todayBeneficiariesCount = DailyReceivingTransaction::whereDate('receiving_date', $today)->distinct('daily_beneficiary_id')->count('daily_beneficiary_id');

        return response()->json([
            'success' => true,
            'data' => $transactions,
            'stats' => [
                'today_transactions' => $todayTransactionsCount,
                'today_baskets' => $todayBasketsCount,
                'today_beneficiaries' => $todayBeneficiariesCount,
            ],
        ]);
    }

    /**
     * تسجيل عملية استلام مساعدة للمستفيد اليومي مع خصم آلي من المستودع وتحديث السجل
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'daily_beneficiary_id' => 'required|uuid|exists:daily_beneficiaries,id',
            'daily_inventory_item_id' => 'required|uuid|exists:daily_inventory_items,id',
            'quantity' => 'nullable|integer|min:1',
            'receiving_date' => 'nullable|date',
            'notes' => 'nullable|string',
        ], [
            'daily_beneficiary_id.required' => 'يرجى اختيار المستفيد اليومي.',
            'daily_inventory_item_id.required' => 'يرجى تحديد السلة أو صنف المساعدة من المستودع.',
            'quantity.min' => 'يجب تسليم سلة واحدة على الأقل.',
        ]);

        $quantity = $validated['quantity'] ?? 1;
        $receivingDate = !empty($validated['receiving_date']) ? Carbon::parse($validated['receiving_date']) : Carbon::now();

        return DB::transaction(function () use ($validated, $quantity, $receivingDate, $request) {
            // 1. قفل صنف المستودع والتحقق من توفر الكمية الكافية
            $item = DailyInventoryItem::lockForUpdate()->findOrFail($validated['daily_inventory_item_id']);

            if ($item->current_quantity < $quantity) {
                return response()->json([
                    'success' => false,
                    'message' => "الرصيد المتاح في المستودع من ({$item->name}) هو {$item->current_quantity} فقط، ولا يكفي لتسليم الكمية المطلوبة ({$quantity}).",
                ], 422);
            }

            // 2. التحقق من المستفيد
            $beneficiary = DailyBeneficiary::lockForUpdate()->findOrFail($validated['daily_beneficiary_id']);

            // 3. إنشاء رقم السند التسلسلي اليومي (DRV-YYYYMMDD-XXXX)
            $todayStr = $receivingDate->format('Ymd');
            $lastTx = DailyReceivingTransaction::where('document_number', 'like', "DRV-{$todayStr}-%")
                ->latest('created_at')
                ->first();

            $sequence = 1;
            if ($lastTx && preg_match('/-(\d+)$/', $lastTx->document_number, $matches)) {
                $sequence = intval($matches[1]) + 1;
            }
            $documentNumber = sprintf('DRV-%s-%04d', $todayStr, $sequence);

            // 4. خصم الكمية من المستودع
            $item->decrement('current_quantity', $quantity);

            // 5. إنشاء سجل عملية الاستلام
            $transaction = DailyReceivingTransaction::create([
                'document_number' => $documentNumber,
                'daily_beneficiary_id' => $beneficiary->id,
                'daily_inventory_item_id' => $item->id,
                'basket_type_name' => $item->name,
                'quantity' => $quantity,
                'status' => 'received',
                'receiving_date' => $receivingDate,
                'authorized_user_id' => $request->user()?->id,
                'notes' => $validated['notes'] ?? null,
            ]);

            // 6. تسجيل حركة الصرف في سجل حركات المستودع
            DailyInventoryMovement::create([
                'daily_inventory_item_id' => $item->id,
                'type' => 'out',
                'quantity' => $quantity,
                'reason' => "تسليم مساعدة يومية رقم ({$documentNumber}) للمستفيد: {$beneficiary->full_name}",
                'notes' => $validated['notes'] ?? 'صرف فوري بموجب سند الاستلام',
                'user_id' => $request->user()?->id,
                'related_receiving_id' => $transaction->id,
            ]);

            // 7. تحديث إحصائيات المستفيد وسجل استلامه
            $beneficiary->increment('total_received_count');
            $beneficiary->update([
                'last_delivery_date' => $receivingDate,
            ]);

            // 8. تسجيل في سجل التدقيق
            try {
                AuditLog::create([
                    'user_id' => $request->user()?->id,
                    'action' => 'DAILY_RECEIVING_CONFIRMED',
                    'details' => "تسليم مساعدة يومية ({$documentNumber}) للمستفيد {$beneficiary->full_name} - {$quantity} {$item->unit} من {$item->name}",
                ]);
            } catch (\Exception $e) {
                // non-blocking
            }

            return response()->json([
                'success' => true,
                'message' => "تم تأكيد الاستلام بنجاح، ورقم السند: {$documentNumber}",
                'data' => $transaction->load(['beneficiary', 'inventoryItem', 'authorizedUser']),
            ], 201);
        });
    }

    /**
     * عرض تفاصيل سند الاستلام
     */
    public function show(string $id): JsonResponse
    {
        $transaction = DailyReceivingTransaction::with([
            'beneficiary',
            'inventoryItem',
            'authorizedUser',
        ])->findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => $transaction,
        ]);
    }
}
