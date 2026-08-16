<?php

namespace App\Http\Controllers;

use App\Models\Basket;
use App\Models\Distribution;
use App\Models\Beneficiary;
use App\Models\InventoryItem;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class DistributionController extends Controller
{
    // ─── Index ───────────────────────────────────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        $query = Distribution::with(['beneficiary', 'basket']);

        if ($request->filled('status'))
            $query->where('status', $request->status);
        if ($request->filled('basket_id'))
            $query->where('basket_id', $request->basket_id);
        if ($request->filled('scheduled_date'))
            $query->whereDate('scheduled_at', $request->scheduled_date);

        return response()->json(['data' => $query->latest()->paginate(50)]);
    }

    // ─── Show ────────────────────────────────────────────────────────────────

    public function show(string $id): JsonResponse
    {
        $dist = Distribution::with(['beneficiary', 'basket'])->findOrFail($id);
        return response()->json(['data' => $dist]);
    }

    // ─── Store (Create Distribution Batch) ───────────────────────────────────

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'beneficiary_ids'   => 'required|array|min:1',
            'beneficiary_ids.*' => 'required|uuid|exists:beneficiaries,id',
            'basket_id'         => 'required|uuid',
            'scheduled_at'      => 'required|date',
            'pickup_location'   => 'nullable|string|max:255',
        ]);

        // Find in Basket model or InventoryItem model
        $basket = Basket::find($validated['basket_id']);
        $inventoryItem = null;

        if (!$basket) {
            $inventoryItem = InventoryItem::find($validated['basket_id']);
            if ($inventoryItem) {
                $basket = Basket::updateOrCreate(
                    ['id' => $inventoryItem->id],
                    [
                        'name'                => $inventoryItem->name,
                        'description'         => $inventoryItem->description ?? 'سلة دعم مخصصة',
                        'stock_quantity'      => $inventoryItem->current_quantity,
                        'low_stock_threshold' => $inventoryItem->min_threshold,
                    ]
                );
            }
        }

        if (!$basket) {
            return response()->json([
                'success' => false,
                'message' => 'السلة أو مادة الدعم المختارة غير موجودة في النظام.',
            ], 422);
        }

        $count = count($validated['beneficiary_ids']);
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

        foreach ($validated['beneficiary_ids'] as $beneficiaryId) {
            $beneficiary = Beneficiary::find($beneficiaryId);
            $code        = strtoupper(Str::random(8));

            $dist = Distribution::create([
                'id'              => Str::uuid(),
                'beneficiary_id'  => $beneficiaryId,
                'basket_id'       => $basket->id,
                'assigned_by'     => $userId,
                'scheduled_at'    => $validated['scheduled_at'],
                'pickup_location' => $validated['pickup_location'] ?? null,
                'barcode_code'    => $code,
                'status'          => 'scheduled',
                'sms_status'      => 'pending',
            ]);

            if ($beneficiary) {
                $this->sendWhatsappMessage($beneficiary, $dist, $basket);
            }

            $distributions[] = $dist;
        }

        // Deduct from Basket
        $basket->decrement('stock_quantity', $count);

        // Also deduct from InventoryItem and log movement if linked
        $linkedItem = $inventoryItem ?? InventoryItem::find($basket->id);
        if ($linkedItem) {
            $linkedItem->decrement('current_quantity', $count);
            try {
                \App\Models\InventoryMovement::create([
                    'inventory_item_id' => $linkedItem->id,
                    'type'              => 'out',
                    'quantity'          => $count,
                    'reason'            => "توزيع دعم للمستفيدين (دفعة {$count})",
                    'user_id'           => $userId,
                ]);
            } catch (\Exception $e) {
                \Log::warning("Inventory movement log error: " . $e->getMessage());
            }
        }

        return response()->json([
            'success'       => true,
            'message'       => "تم إنشاء وتخصيص {$count} سلة دعم بنجاح.",
            'distributions' => $distributions,
        ], 201);
    }

    // ─── Mark Received ────────────────────────────────────────────────────────

    public function markReceived(string $id): JsonResponse
    {
        $dist = Distribution::findOrFail($id);
        $dist->update([
            'status'       => 'delivered',
            'delivered_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'تم تأكيد الاستلام.',
            'data'    => $dist,
        ]);
    }

    // ─── Send WhatsApp ────────────────────────────────────────────────────────

    public function sendWhatsapp(string $id): JsonResponse
    {
        $dist = Distribution::with(['beneficiary', 'basket'])->findOrFail($id);
        $this->sendWhatsappMessage($dist->beneficiary, $dist, $dist->basket);

        return response()->json(['success' => true, 'message' => 'تم إعادة إرسال رسالة واتساب.']);
    }

    // ─── WhatsApp Helper (Stub) ───────────────────────────────────────────────

    private function sendWhatsappMessage(Beneficiary $beneficiary, Distribution $dist, Basket $basket): void
    {
        $date    = \Carbon\Carbon::parse($dist->scheduled_at)->format('Y-m-d');
        $message = "مرحباً {$beneficiary->name}،\n"
                 . "جمعية إكرام تُعلمكم بموعد استلام دعمكم:\n"
                 . "📦 نوع الدعم: {$basket->name}\n"
                 . "📅 تاريخ الاستلام: {$date}\n"
                 . "🔑 رمز الاستلام: {$dist->barcode_code}\n"
                 . "شكراً لكم.";

        // TODO: Replace with real WhatsApp API call
        // Example using UltraMsg:
        // Http::post("https://api.ultramsg.com/{instance}/messages/chat", [
        //     'token' => config('services.ultramsg.token'),
        //     'to'    => '966' . ltrim($beneficiary->phone, '0'),
        //     'body'  => $message,
        // ]);

        \Log::info("WhatsApp stub → {$beneficiary->phone}: {$message}");

        $dist->update(['sms_status' => 'sent']);
    }
}
