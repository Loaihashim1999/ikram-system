<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\Beneficiary;
use App\Models\InventoryItem;
use App\Models\InventoryMovement;
use App\Models\Organization;
use App\Models\PickupLocation;
use App\Models\Staff;
use App\Models\SupportDistribution;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class SupportDistributionService
{
    public static function rules(): array
    {
        return [
            'recipient_type' => 'required|in:beneficiary,staff,organization',
            'beneficiary_id' => 'nullable|required_if:recipient_type,beneficiary|prohibited_unless:recipient_type,beneficiary|uuid|exists:beneficiaries,id',
            'staff_id' => 'nullable|required_if:recipient_type,staff|prohibited_unless:recipient_type,staff|integer|exists:staff,id',
            'organization_id' => 'nullable|required_if:recipient_type,organization|prohibited_unless:recipient_type,organization|uuid|exists:organizations,id',
            'fulfillment_method' => 'required|in:pickup,delivery',
            'pickup_location_id' => 'nullable|required_if:fulfillment_method,pickup|prohibited_unless:fulfillment_method,pickup|uuid|exists:pickup_locations,id',
            'driver_id' => 'nullable|prohibited_unless:fulfillment_method,delivery|uuid|exists:drivers,id',
            'support_date' => 'nullable|date',
            'notes' => 'nullable|string|max:5000',
            'items' => 'required|array|min:1|max:100',
            'items.*.inventory_item_id' => 'required|uuid|distinct|exists:inventory_items,id',
            'items.*.requested_quantity' => ['required', 'numeric', 'gt:0', 'max:9999999999.99', 'regex:/^\d+(\.\d{1,2})?$/'],
        ];
    }

    private function payload(array $data): array
    {
        $data = Validator::make($data, self::rules())->validate();
        $type = $data['recipient_type'];
        foreach (['beneficiary', 'staff', 'organization'] as $other) {
            if ($other !== $type && ($data[$other.'_id'] ?? null) !== null) {
                $this->invalid('recipient_type', 'يجب تحديد مستلم واحد مطابق لنوع المستلم.');
            }
        }
        $recipient = match ($type) {
            'beneficiary' => Beneficiary::whereKey($data['beneficiary_id'])->lockForUpdate()->firstOrFail(),
            'staff' => Staff::findOrFail($data['staff_id']),
            'organization' => Organization::findOrFail($data['organization_id']),
        };
        if ($type === 'beneficiary' && $recipient->archived_at) {
            $this->invalid('beneficiary_id', 'لا يمكن إنشاء دعم جديد لمستفيد مؤرشف.');
        }
        $data['recipient_name'] = $type === 'beneficiary' ? $recipient->full_name : $recipient->name;
        $data['recipient_reference'] = $type === 'organization' ? $recipient->code : (string) $recipient->id;
        $data['pickup_location_name'] = null;
        $data['pickup_location_url'] = null;
        if ($type !== 'beneficiary') {
            $data['beneficiary_id'] = null;
        }
        if ($type !== 'staff') {
            $data['staff_id'] = null;
        }
        if ($type !== 'organization') {
            $data['organization_id'] = null;
        }
        if ($data['fulfillment_method'] === 'pickup') {
            $location = PickupLocation::whereKey($data['pickup_location_id'])->lockForUpdate()->firstOrFail();
            if (! $location->is_active) {
                $this->invalid('pickup_location_id', 'موقع الاستلام غير نشط.');
            }
            $data['pickup_location_name'] = $location->name;
            $data['pickup_location_url'] = $location->location_url;
            $data['driver_id'] = null;
        } else {
            $data['pickup_location_id'] = null;
        }

        return $data;
    }

    public function create(array $data, string $actor): SupportDistribution
    {
        return DB::transaction(function () use ($data, $actor) {
            $data = $this->payload($data);
            $items = $data['items'];
            unset($data['items']);
            $distribution = SupportDistribution::create($data + ['status' => 'draft', 'created_by' => $actor]);
            $this->writeItems($distribution, $items);
            $this->audit($distribution, 'CREATED', $actor, null);
            $this->notify($distribution, 'created');

            return $distribution->load('items');
        });
    }

    public function update(string $id, array $data, string $actor): SupportDistribution
    {
        return DB::transaction(function () use ($id, $data, $actor) {
            $distribution = SupportDistribution::whereKey($id)->lockForUpdate()->firstOrFail();
            if ($distribution->status !== 'draft') {
                $this->invalid('status', 'التعديل متاح للمسودة فقط.');
            }
            $data = $this->payload(array_replace($distribution->only(array_keys(self::rules())), ['items' => $distribution->items->toArray()], $data));
            $items = $data['items'];
            unset($data['items']);
            $distribution->update($data);
            $distribution->items()->delete();
            $this->writeItems($distribution, $items);
            $this->audit($distribution, 'UPDATED', $actor, 'draft');

            return $distribution->load('items');
        });
    }

    private function writeItems(SupportDistribution $distribution, array $items): void
    {
        foreach ($items as $item) {
            $inventory = InventoryItem::findOrFail($item['inventory_item_id']);
            $distribution->items()->create([
                'inventory_item_id' => $inventory->id,
                'requested_quantity' => $item['requested_quantity'],
                'unit_snapshot' => $inventory->unit,
            ]);
        }
    }

    public function transition(string $id, string $action, string $actor, array $input = []): SupportDistribution
    {
        return DB::transaction(function () use ($id, $action, $actor, $input) {
            $distribution = SupportDistribution::whereKey($id)->lockForUpdate()->firstOrFail();
            $from = $distribution->status;
            if ($action === 'complete' && $from === 'completed') {
                abort(409, 'تم إكمال عملية الدعم مسبقاً.');
            }
            $next = match ($action) {
                'approve' => $from === 'draft' ? 'approved' : null,
                'reserve' => $from === 'approved' ? 'reserved' : null,
                'ready' => $from === 'reserved' ? 'ready' : null,
                'dispatch' => $from === 'ready' && $distribution->fulfillment_method === 'delivery' ? 'in_delivery' : null,
                'complete' => (($from === 'ready' && $distribution->fulfillment_method === 'pickup') || ($from === 'in_delivery' && $distribution->fulfillment_method === 'delivery')) ? 'completed' : null,
                'cancel' => in_array($from, ['draft', 'approved', 'reserved', 'ready'], true) ? 'cancelled' : null,
                default => null,
            };
            if (! $next) {
                $this->invalid('status', 'انتقال حالة الدعم غير مسموح.');
            }
            if ($action === 'dispatch' && ! $distribution->driver_id) {
                $this->invalid('driver_id', 'يجب تعيين سائق قبل الإرسال.');
            }
            if (array_diff(array_keys($input), ['cancellation_reason'])) {
                $this->invalid('items', 'يجب صرف كامل الكمية المحجوزة؛ لا يُسمح بتغيير الكميات عند الانتقال.');
            }
            Validator::make($input, ['cancellation_reason' => 'nullable|string|max:255'])->validate();
            if (in_array($action, ['reserve', 'complete', 'cancel'], true)) {
                $items = $distribution->items()->orderBy('inventory_item_id')->get();
                foreach ($items as $item) {
                    $stock = InventoryItem::whereKey($item->inventory_item_id)->lockForUpdate()->firstOrFail();
                    $available = $stock->available_quantity; // Raises on corrupt inventory.
                    $quantity = $item->requested_quantity;
                    if ($action === 'reserve') {
                        if ((float) $available < (float) $quantity) {
                            $this->invalid('items', 'المخزون المتاح غير كافٍ لحجز كامل الكمية.');
                        }
                        $stock->reserved_quantity = SupportQuantity::add($stock->reserved_quantity, $quantity);
                        $item->reserved_quantity = $quantity;
                    } elseif ($action === 'complete') {
                        if (SupportQuantity::compare($item->reserved_quantity, $quantity) !== 0 || SupportQuantity::compare($item->fulfilled_quantity, '0') !== 0 || SupportQuantity::compare($stock->reserved_quantity, $quantity) < 0) {
                            $this->invalid('items', 'الحجز غير متطابق مع الكمية المعتمدة.');
                        }
                        $stock->current_quantity = SupportQuantity::subtract($stock->current_quantity, $quantity);
                        $stock->reserved_quantity = SupportQuantity::subtract($stock->reserved_quantity, $quantity);
                        $item->reserved_quantity = 0;
                        $item->fulfilled_quantity = $quantity;
                    } else {
                        if (SupportQuantity::compare($stock->reserved_quantity, $item->reserved_quantity) < 0) {
                            throw new \LogicException('Reservation ledger mismatch');
                        }
                        $stock->reserved_quantity = SupportQuantity::subtract($stock->reserved_quantity, $item->reserved_quantity);
                        $item->reserved_quantity = 0;
                    }
                    $stock->available_quantity;
                    $stock->save();
                    $item->save();
                    if ($action === 'complete') {
                        InventoryMovement::create([
                            'inventory_item_id' => $stock->id, 'type' => 'out', 'quantity' => $quantity,
                            'balance_after' => $stock->current_quantity, 'support_distribution_id' => $distribution->id,
                            'user_id' => $actor, 'reason' => 'صرف دعم رقم '.$distribution->id,
                        ]);
                    }
                }
            }
            $distribution->status = $next;
            if ($action === 'approve') {
                $distribution->approved_by = $actor;
            }
            if ($action === 'complete') {
                $distribution->completed_at = now();
            }
            if ($action === 'cancel') {
                $distribution->cancelled_at = now();
                $distribution->cancellation_reason = $input['cancellation_reason'] ?? null;
            }
            $distribution->save();
            $event = match ($action) {
                'ready' => 'READY', 'dispatch' => 'DISPATCHED', default => strtoupper($next)
            };
            $this->audit($distribution, $event, $actor, $from);
            $this->notify($distribution, strtolower($event));

            return $distribution->load('items');
        });
    }

    private function audit(SupportDistribution $distribution, string $action, string $actor, ?string $from): void
    {
        AuditLog::create(['user_id' => $actor, 'action' => $action, 'target_table' => 'support_distributions', 'target_id' => $distribution->id,
            'details' => ['from' => $from, 'to' => $distribution->status]]);
    }

    private function notify(SupportDistribution $distribution, string $event): void
    {
        DB::afterCommit(fn () => NotificationService::notifyAll('support_'.$event, 'تحديث عملية الدعم '.$distribution->id, $distribution));
    }

    private function invalid(string $field, string $message): never
    {
        throw ValidationException::withMessages([$field => $message]);
    }
}
