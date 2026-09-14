<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Distribution;
use App\Models\Notification;
use App\Models\RepDistribution;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;

class ReceiverController extends Controller
{
    /**
     * Scan QR code / Search by Barcode Code
     */
    public function scan(string $code): JsonResponse
    {
        $code = strtoupper(trim($code));

        // Check regular distribution first
        $dist = Distribution::with(['beneficiary.dependents', 'basket'])
            ->where('barcode_code', $code)
            ->first();

        if ($dist) {
            if (in_array(request()->user()->role, ['driver', 'delivery_driver'])) abort_unless($dist->driver_id === request()->user()->id, 403);
            return response()->json([
                'success' => true,
                'type' => 'regular',
                'data' => $dist,
            ]);
        }

        // Check representative distribution
        $repDist = RepDistribution::with(['representative', 'basket'])
            ->where('barcode_code', $code)
            ->first();

        if ($repDist) {
            if (in_array(request()->user()->role, ['driver', 'delivery_driver'])) abort_unless($repDist->driver_id === request()->user()->id, 403);
            return response()->json([
                'success' => true,
                'type' => 'representative',
                'data' => $repDist,
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => 'لم يتم العثور على رمز الاستلام أو الباركود أدخل رمزاً صحيحاً.',
        ], 444);
    }

    /**
     * Confirm Receipt (تسليم الدعم)
     */
    public function confirm(Request $request, string $code): JsonResponse
    {
        $code = strtoupper(trim($code));

        return DB::transaction(function () use ($request, $code) {
            $dist = Distribution::with('beneficiary')->where('barcode_code', $code)->lockForUpdate()->first();

            if ($dist) {
                if (User::isDriverRole($request->user()?->role)) {
                    abort_unless($dist->driver_id === $request->user()->id, 403);
                }
                if ($dist->status === 'delivered') {
                    return response()->json(['success' => false, 'message' => 'تم الاستلام مسبقاً'], 409);
                }
                $dist->update(['status' => 'delivered', 'delivered_at' => now()]);
                $user = $request->user();
                $recipientName = $dist->beneficiary->full_name ?? $dist->beneficiary->name ?? 'المستفيد';

                foreach (User::where('role', 'admin')->get() as $supervisor) {
                    Notification::create([
                        'id' => Str::uuid(), 'recipient_type' => 'staff', 'recipient_id' => $supervisor->id,
                        'related_record_type' => 'distributions', 'related_record_id' => $dist->id,
                        'message_body' => "تم استلام الدعم للمستفيد {$recipientName} بواسطة ".($user?->full_name ?? 'الموظف'),
                        'status' => 'sent', 'sent_at' => now(),
                    ]);
                }
                AuditLog::create([
                    'id' => Str::uuid(), 'user_id' => $user?->id, 'action' => 'confirm_receipt',
                    'target_table' => 'distributions', 'target_id' => $dist->id,
                    'details' => ['barcode_code' => $code, 'beneficiary' => $recipientName, 'actor_name' => $user?->full_name],
                ]);
                return response()->json([
                    'success' => true,
                    'message' => "تم تأكيد استلام الدعم للمستفيد ({$recipientName}) بنجاح وإشعار المشرف.",
                    'pdf_url' => url("/api/documents/individual-receipt/{$dist->id}/pdf"),
                    'distribution' => $dist->fresh(),
                ]);
            }

            $repDist = RepDistribution::with('representative')->where('barcode_code', $code)->lockForUpdate()->first();
            if ($repDist) {
                if (User::isDriverRole($request->user()?->role)) {
                    abort_unless($repDist->driver_id === $request->user()->id, 403);
                }
                if ($repDist->status === 'delivered') {
                    return response()->json(['success' => false, 'message' => 'تم الاستلام مسبقاً'], 409);
                }
                $repDist->update(['status' => 'delivered', 'picked_up_at' => now()]);
                $repName = $repDist->representative->full_name ?? 'مندوب الحي';
                return response()->json([
                    'success' => true,
                    'message' => "تم تأكيد استلام السلال لمندوب الحي ({$repName}) بنجاح.",
                    'pdf_url' => url("/api/documents/rep-receipt/{$repDist->rep_id}/pdf"),
                    'rep_dist' => $repDist->fresh(),
                ]);
            }

            return response()->json(['success' => false, 'message' => 'الرمز غير صحيح.'], 404);
        });
    }
}
