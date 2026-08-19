<?php

namespace App\Http\Controllers;

use App\Models\Basket;
use App\Models\Beneficiary;
use App\Models\Distribution;
use App\Models\InventoryItem;
use App\Models\InventoryMovement;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class DistributionController extends Controller
{
    // ─── Index ───────────────────────────────────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        $query = Distribution::with(['beneficiary', 'basket', 'driver']);

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

        return response()->json(['data' => $query->latest()->paginate($perPage)]);
    }

    // ─── Show ────────────────────────────────────────────────────────────────

    public function show(string $id): JsonResponse
    {
        $dist = Distribution::with(['beneficiary', 'basket', 'driver'])->findOrFail($id);

        return response()->json(['data' => $dist]);
    }

    // ─── Store (Create Distribution Batch) ───────────────────────────────────

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'beneficiary_ids' => 'required|array|min:1',
            'beneficiary_ids.*' => 'required|uuid|exists:beneficiaries,id',
            'basket_id' => 'required|uuid',
            'scheduled_at' => 'required|date',
            'driver_id' => 'nullable|string',
            'pickup_location' => 'nullable|string|max:255',
        ]);

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
            $code = strtoupper(Str::random(8));

            $dist = Distribution::create([
                'id' => Str::uuid(),
                'beneficiary_id' => $beneficiaryId,
                'basket_id' => $basket->id,
                'assigned_by' => $userId,
                'driver_id' => $validated['driver_id'] ?? null,
                'scheduled_at' => $validated['scheduled_at'],
                'pickup_location' => $validated['pickup_location'] ?? null,
                'barcode_code' => $code,
                'status' => 'scheduled',
                'sms_status' => 'pending',
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
            'message' => "تم إنشاء وتخصيص {$count} سلة دعم بنجاح.",
            'distributions' => $distributions,
        ], 201);
    }

    // ─── Mark Received ────────────────────────────────────────────────────────

    public function markReceived(string $id): JsonResponse
    {
        $dist = Distribution::findOrFail($id);
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
        $phone = preg_replace('/[^0-9]/', '', $beneficiary->phone ?? '');
        if (str_starts_with($phone, '0')) {
            $phone = '966'.substr($phone, 1);
        } elseif (! str_starts_with($phone, '966') && strlen($phone) == 9) {
            $phone = '966'.$phone;
        }

        $name = $beneficiary->full_name ?? $beneficiary->name ?? 'المستفيد';
        $natId = $beneficiary->national_id ?? '—';
        $date = Carbon::parse($dist->scheduled_at)->format('Y-m-d');
        $code = $dist->barcode_code;
        $location = $dist->pickup_location ?? 'توصيل للمنزل عبر السائق';
        $basketName = $basket->name ?? 'سلة دعم مخصصة';

        $driver = $dist->driver_id ? User::find($dist->driver_id) : null;
        $driverName = $driver ? ($driver->full_name ?? $driver->name) : 'سائق الجمعية المعتمد';
        $driverPhone = $driver ? ($driver->phone ?? 'غير متوفر') : 'غير متوفر';

        $token = 'EAAWdAqNkBc0BSJF3DkKRBWLlCpV99nPjZAYmWCYecZAj1omO6dbWu8oYfwCeSTRkWrbvR21aDVVdY6opFCZB5u69OLxFOnbbz7P0lhSt29z5NbeBVdqFaXc8wnms4RlxZBrfPnJjZBZCpiJ8YbqjLEOEn3P9ZCBpvPYRfVTvpGonXOKT5MlCvxavkDZCCWvTLV07rerZBsF1ZBxFXWCRCMZANMgaFnu1lZCDDBbyutOchPUIEL3cFFtjhI3TU27ytehZC3wzP2rfkZCnX7K9481QRAfoScuzmW';
        $phoneId = '1216386488232408';

        $qrImageUrl = "https://api.qrserver.com/v1/create-qr-code/?size=600x600&data={$code}";

        // 1. Meta Official Utility Template (Image Header + Named Body Parameters)
        $templatePayload = [
            'messaging_product' => 'whatsapp',
            'recipient_type' => 'individual',
            'to' => $phone,
            'type' => 'template',
            'template' => [
                'name' => 'beneficiary_support_confirmation',
                'language' => ['code' => 'ar'],
                'components' => [
                    [
                        'type' => 'header',
                        'parameters' => [
                            [
                                'type' => 'image',
                                'image' => [
                                    'link' => $qrImageUrl,
                                ],
                            ],
                        ],
                    ],
                    [
                        'type' => 'body',
                        'parameters' => [
                            ['type' => 'text', 'parameter_name' => 'full_name',       'text' => $name],
                            ['type' => 'text', 'parameter_name' => 'national_id',     'text' => $natId],
                            ['type' => 'text', 'parameter_name' => 'delivery_date',  'text' => $date],
                            ['type' => 'text', 'parameter_name' => 'pickup_location', 'text' => $location],
                            ['type' => 'text', 'parameter_name' => 'barcode_code',    'text' => $code],
                        ],
                    ],
                ],
            ],
        ];

        // 2. Direct Image Media Payload as fallback
        $imagePayload = [
            'messaging_product' => 'whatsapp',
            'recipient_type' => 'individual',
            'to' => $phone,
            'type' => 'image',
            'image' => [
                'link' => $qrImageUrl,
                'caption' => "*جمعية إكرام ترحب بكم وتفيدكم بتأكيد موعد وتفاصيل التوصيل:*\n👤 *اسم المستفيد:* {$name}\n🪪 *رقم الهوية:* {$natId}\n📦 *سلة الدعم:* {$basketName}\n🚚 *اسم السائق:* {$driverName}\n📞 *رقم جوال السائق:* {$driverPhone}\n📅 *تاريخ التسليم:* {$date}\n📍 *العنوان والموقع:* {$location}\n🔑 *كود الـ QR للاستلام:* {$code}",
            ],
        ];

        try {
            $res = Http::withToken($token)
                ->post("https://graph.facebook.com/v25.0/{$phoneId}/messages", $templatePayload);

            if (! $res->successful()) {
                Http::withToken($token)
                    ->post("https://graph.facebook.com/v25.0/{$phoneId}/messages", $imagePayload);
            }

            \Log::info("WhatsApp Meta Utility Template Message sent to {$phone}");
        } catch (\Throwable $e) {
            \Log::error('WhatsApp Meta API error: '.$e->getMessage());
        }

        $dist->update(['sms_status' => 'sent']);
    }
}
