<?php

namespace App\Services\Delivery;

use App\Models\AuditLog;
use App\Models\CommunicationMessage;
use App\Models\DriverAssignment;
use App\Models\ReceiptChallenge;
use App\Models\SupportDistribution;
use App\Models\SupportReceipt;
use App\Models\User;
use App\Services\Communications\MessageTemplates;
use App\Services\NotificationService;
use App\Services\SupportDistributionService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ReceiptVerificationService
{
    public function __construct(private SecurityPolicy $policy) {}

    private function verifier(string $operation, string $generation, string $code): string
    {
        $secret = config('app.key');
        if (! $secret) {
            throw new \LogicException('Receipt verification key unavailable.');
        }

        return hash_hmac('sha256', 'receipt:'.$operation.':'.$generation.':'.$code, $secret);
    }

    public function issue(string $id, string $actor): ReceiptChallenge
    {
        return DB::transaction(function () use ($id, $actor) {
            $support = SupportDistribution::whereKey($id)->lockForUpdate()->firstOrFail();
            abort_unless(in_array($support->status, ['ready', 'in_delivery'], true), 409, 'عملية الدعم ليست جاهزة للاستلام.');
            $old = ReceiptChallenge::where('support_distribution_id', $id)->lockForUpdate()->first();
            if ($old && ($old->consumed_at || $old->locked_until?->isFuture() || $old->updated_at->gt(now()->subSeconds($this->policy->get('reissue_cooldown_seconds'))))) {
                throw ValidationException::withMessages(['receipt' => 'إصدار رمز جديد غير متاح الآن.']);
            }
            CommunicationMessage::where('operation_type', 'receipt')->where('operation_id', $id)->whereIn('status', ['pending', 'retrying', 'failed'])
                ->update(['status' => 'cancelled', 'encrypted_payload' => null, 'error_code' => 'superseded']);
            $code = str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT);
            $generation = (string) Str::uuid();
            $challenge = ReceiptChallenge::updateOrCreate(['support_distribution_id' => $id], [
                'generation' => $generation, 'verifier' => $this->verifier($id, $generation, $code),
                'expires_at' => now()->addMinutes($this->policy->get('receipt_ttl_minutes')),
                'failed_attempts' => 0, 'locked_until' => null, 'consumed_at' => null,
            ]);
            $recipient = $support->{$support->recipient_type};
            $phone = $support->recipient_type === 'organization' ? $recipient?->contact : $recipient?->phone;
            $values = [
                'recipient_name' => $support->recipient_name, 'beneficiary_name' => $support->recipient_type === 'beneficiary' ? $support->recipient_name : '',
                'staff_name' => $support->recipient_type === 'staff' ? $support->recipient_name : '', 'organization_name' => $support->recipient_type === 'organization' ? $support->recipient_name : '',
                'fulfillment_method' => $support->fulfillment_method === 'pickup' ? 'استلام' : 'توصيل',
                'delivery_date' => $support->support_date?->format('Y-m-d H:i') ?? 'الموعد غير محدد', 'verification_code' => $code,
            ];
            if ($support->fulfillment_method === 'pickup') {
                $values += ['pickup_location_name' => $support->pickup_location_name, 'pickup_location_url' => $support->pickup_location_url ?? 'رابط الموقع غير متوفر'];
            }
            $body = app(MessageTemplates::class)->render($support->recipient_type.'_'.$support->fulfillment_method, $values);
            NotificationService::queueCommunication('receipt:'.$generation, $support->recipient_type, $support->recipient_reference ?? $id, 'receipt', $id, (string) $phone, $body, $challenge->expires_at);
            $this->audit($id, 'RECEIPT_CODE_ISSUED', $actor);

            return $challenge;
        });
    }

    /** Caller must hold assignment lock for driver completion; support is always locked before challenge. */
    public function verify(string $id, string $code, string $actor, ?string $assignment = null): array
    {
        if (! preg_match('/^[0-9]{4}$/D', $code)) {
            throw ValidationException::withMessages(['code' => 'أدخل أربعة أرقام بالضبط.']);
        }
        $key = 'receipt:'.hash('sha256', $id.':'.($assignment ?? $actor));
        if (RateLimiter::tooManyAttempts($key, $this->policy->get('verification_per_minute'))) {
            return ['status' => 429, 'message' => 'محاولات كثيرة؛ انتظر ثم أعد المحاولة.'];
        }
        RateLimiter::hit($key, 60);

        return DB::transaction(function () use ($id, $code, $actor, $assignment) {
            $support = SupportDistribution::whereKey($id)->lockForUpdate()->firstOrFail();
            if (($assignment === null && $support->fulfillment_method !== 'pickup') || ($assignment !== null && $support->fulfillment_method !== 'delivery')) {
                abort(403);
            }
            $challenge = ReceiptChallenge::where('support_distribution_id', $id)->lockForUpdate()->first();
            if (! $challenge) {
                return ['status' => 422, 'message' => 'لا يوجد رمز صالح لهذه العملية.'];
            }
            if ($challenge->consumed_at || $support->status === 'completed') {
                if (! hash_equals($challenge->verifier, $this->verifier($id, $challenge->generation, $code))) {
                    return ['status' => 422, 'message' => 'رمز الاستلام غير صحيح.'];
                }
                $receipt = SupportReceipt::where('support_distribution_id', $id)->first();
                if (! $receipt || $receipt->driver_assignment_id !== $assignment) {
                    return ['status' => 409, 'message' => 'سجل التأكيد غير متاح لهذه العملية.'];
                }

                return ['status' => 200, 'message' => 'تم تأكيد الاستلام مسبقاً.', 'already_completed' => true,
                    'receipt_id' => $receipt->id, 'confirmed_at' => $receipt->confirmed_at->toIso8601String(), 'support_distribution_id' => $id];
            }
            if ($challenge->locked_until?->isFuture()) {
                return ['status' => 423, 'message' => 'التحقق مقفل مؤقتاً.'];
            }
            if ($challenge->expires_at->lte(now())) {
                return ['status' => 422, 'message' => 'انتهت صلاحية رمز الاستلام.'];
            }
            if (! hash_equals($challenge->verifier, $this->verifier($id, $challenge->generation, $code))) {
                $challenge->failed_attempts++;
                if ($challenge->failed_attempts >= $this->policy->get('receipt_max_attempts')) {
                    $challenge->locked_until = now()->addMinutes($this->policy->get('receipt_lock_minutes'));
                }
                $challenge->save();
                $this->audit($id, $challenge->locked_until ? 'RECEIPT_LOCKED' : 'RECEIPT_REJECTED', $actor, $assignment);

                return ['status' => $challenge->locked_until ? 423 : 422, 'message' => 'رمز الاستلام غير صحيح.'];
            }
            $completed = app(SupportDistributionService::class)->transition($id, 'complete', $actor);
            $confirmedAt = $completed->completed_at;
            $challenge->update(['consumed_at' => $confirmedAt]);
            CommunicationMessage::where('operation_type', 'receipt')->where('operation_id', $id)->whereIn('status', ['pending', 'retrying', 'failed'])
                ->update(['status' => 'cancelled', 'encrypted_payload' => null, 'error_code' => 'operation_completed']);
            $receipt = SupportReceipt::create(['support_distribution_id' => $id, 'driver_assignment_id' => $assignment,
                'confirmed_by' => $actor, 'confirmed_at' => $confirmedAt,
                'proof_snapshot' => $this->proofSnapshot($completed, $actor, $assignment)]);
            $this->audit($id, 'RECEIPT_VERIFIED', $actor, $assignment);
            DB::afterCommit(fn () => NotificationService::notifyAll('support_receipt_verified', 'تم تأكيد استلام الدعم.', $support));

            return ['status' => 200, 'message' => 'تم تأكيد الاستلام بنجاح.', 'receipt_id' => $receipt->id,
                'confirmed_at' => $receipt->confirmed_at->toIso8601String(), 'support_distribution_id' => $id];
        });
    }

    private function proofSnapshot(SupportDistribution $support, string $actor, ?string $assignment): array
    {
        // Keep the contact read stable until this same confirmation transaction commits.
        $recipient = $support->{$support->recipient_type}()->lockForUpdate()->firstOrFail();
        $driverAssignment = $assignment ? DriverAssignment::with('driver')->findOrFail($assignment) : null;
        $support->load('items.inventoryItem');
        $address = $recipient->street ?? $recipient->national_address;

        return [
            'schema_version' => 1, 'source' => 'confirmation', 'task_reference' => $support->id,
            'fulfillment_method' => $support->fulfillment_method,
            'recipient' => ['type' => $support->recipient_type, 'id' => $recipient->getKey(),
                'display_name' => $recipient->full_name ?? $recipient->name ?? $support->recipient_name,
                'reference' => $support->recipient_reference,
                'phone' => $support->recipient_type === 'organization' ? $recipient->contact : $recipient->phone,
                'city' => $recipient->city, 'district' => $recipient->district, 'address' => $address,
                'full_address' => implode('، ', array_filter([$recipient->city, $recipient->district, $address]))],
            'driver' => $driverAssignment ? ['id' => $driverAssignment->driver_id, 'name' => $driverAssignment->driver?->full_name,
                'assignment_id' => $driverAssignment->id] : null,
            'pickup_location' => $support->pickup_location_name,
            'employee' => ['id' => $actor, 'name' => User::find($actor)?->full_name],
            'confirmed_at' => $support->completed_at->toIso8601String(), 'verification_method' => 'receipt_code',
            'final_status' => 'completed',
            'items' => $support->items->map(fn ($item) => ['inventory_item_id' => $item->inventory_item_id,
                'name' => $item->inventoryItem?->name, 'quantity' => $item->fulfilled_quantity, 'unit' => $item->unit_snapshot])->values()->all(),
        ];
    }

    /** Validate the operation-bound code without consuming it or changing business records. */
    public function preview(string $id, string $code, string $actor): array
    {
        if (! preg_match('/^[0-9]{4}$/D', $code)) {
            throw ValidationException::withMessages(['code' => 'أدخل أربعة أرقام بالضبط.']);
        }
        $key = 'receipt:'.hash('sha256', $id.':'.$actor);
        if (RateLimiter::tooManyAttempts($key, $this->policy->get('verification_per_minute'))) {
            return ['status' => 429, 'message' => 'محاولات كثيرة؛ انتظر ثم أعد المحاولة.'];
        }
        RateLimiter::hit($key, 60);

        return DB::transaction(function () use ($id, $code, $actor) {
            $support = SupportDistribution::whereKey($id)->lockForUpdate()->firstOrFail();
            abort_unless($support->fulfillment_method === 'pickup', 403);
            $challenge = ReceiptChallenge::where('support_distribution_id', $id)->lockForUpdate()->first();
            if (! $challenge || $challenge->expires_at->lte(now())) {
                return ['status' => 422, 'message' => 'لا يوجد رمز صالح لهذه العملية.'];
            }
            if ($challenge->locked_until?->isFuture()) {
                return ['status' => 423, 'message' => 'التحقق مقفل مؤقتاً.'];
            }
            if (! hash_equals($challenge->verifier, $this->verifier($id, $challenge->generation, $code))) {
                if (! $challenge->consumed_at) {
                    $challenge->failed_attempts++;
                    if ($challenge->failed_attempts >= $this->policy->get('receipt_max_attempts')) {
                        $challenge->locked_until = now()->addMinutes($this->policy->get('receipt_lock_minutes'));
                    }
                    $challenge->save();
                    $this->audit($id, $challenge->locked_until ? 'RECEIPT_LOCKED' : 'RECEIPT_REJECTED', $actor);
                }

                return ['status' => $challenge->locked_until ? 423 : 422, 'message' => 'رمز الاستلام غير صحيح.'];
            }
            if (! in_array($support->status, ['ready', 'completed'], true)) {
                return ['status' => 409, 'message' => 'عملية الدعم ليست جاهزة للاستلام.'];
            }
            $support->load('items.inventoryItem');

            return ['status' => 200, 'data' => ['id' => $support->id, 'recipient_name' => $support->recipient_name,
                'recipient_reference' => $support->recipient_reference, 'status' => $support->status,
                'items' => $support->items->map(fn ($item) => ['name' => $item->inventoryItem?->name,
                    'quantity' => $item->requested_quantity, 'unit' => $item->unit_snapshot])->values()]];
        });
    }

    private function audit(string $id, string $action, string $actor, ?string $assignment = null): void
    {
        AuditLog::create(['user_id' => $actor, 'action' => $action, 'target_table' => 'support_distributions', 'target_id' => $id, 'details' => ['driver_assignment_id' => $assignment]]);
    }
}
