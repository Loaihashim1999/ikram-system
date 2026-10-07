<?php

namespace App\Http\Controllers;

use App\Models\SupportDistribution;
use App\Models\SupportReceipt;
use App\Models\User;
use App\Services\OperationalMetricsService;
use App\Services\SupportDistributionService;
use App\Services\SupportHistoryService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SupportDistributionController extends Controller
{
    public function index(Request $request)
    {
        $filters = $request->validate([
            'fulfillment_method' => 'nullable|in:pickup,delivery', 'q' => 'nullable|string|max:200',
            'status' => 'nullable|in:draft,approved,reserved,ready,in_delivery,completed,cancelled',
            'date_from' => 'nullable|date_format:Y-m-d', 'date_to' => 'nullable|date_format:Y-m-d',
            'due_from' => 'nullable|date_format:Y-m-d', 'due_to' => 'nullable|date_format:Y-m-d',
            'metrics_from' => 'nullable|date_format:Y-m-d', 'metrics_to' => 'nullable|date_format:Y-m-d',
            'driver_id' => 'nullable|uuid', 'employee_id' => 'nullable|uuid', 'district' => 'nullable|string|max:200',
            'beneficiary_id' => 'nullable|uuid', 'organization_id' => 'nullable|uuid',
            'reference' => 'nullable|uuid',
            'per_page' => 'nullable|integer|min:-1|max:100|not_in:0',
        ]);
        if (! empty($filters['date_from']) && ! empty($filters['date_to'])) {
            $request->validate(['date_to' => 'after_or_equal:date_from']);
        }
        if (! empty($filters['due_from']) && ! empty($filters['due_to'])) {
            $request->validate(['due_to' => 'after_or_equal:due_from']);
        }
        if (! empty($filters['metrics_from']) && ! empty($filters['metrics_to'])) {
            $request->validate(['metrics_to' => 'after_or_equal:metrics_from']);
        }
        $query = SupportDistribution::query();
        foreach (['fulfillment_method', 'status', 'driver_id', 'beneficiary_id', 'organization_id'] as $field) {
            if (! empty($filters[$field])) {
                $query->where($field, $filters[$field]);
            }
        }
        if (! empty($filters['reference'])) {
            $query->whereKey($filters['reference']);
        }
        if (! empty($filters['q'])) {
            $value = '%'.$filters['q'].'%';
            $query->where(fn ($q) => $q->where('recipient_name', 'like', $value)
                ->orWhere('recipient_reference', 'like', $value)->orWhereRaw('CAST(id AS TEXT) LIKE ?', [$value])
                ->orWhereHas('items.inventoryItem', fn ($item) => $item->where('name', 'like', $value)));
        }
        foreach (['date_from' => '>=', 'date_to' => '<='] as $field => $operator) {
            if (! empty($filters[$field])) {
                $query->whereDate('completed_at', $operator, $filters[$field]);
            }
        }
        foreach (['due_from' => '>=', 'due_to' => '<='] as $field => $operator) {
            if (! empty($filters[$field])) {
                $query->whereDate('support_date', $operator, $filters[$field]);
            }
        }
        if (! empty($filters['employee_id'])) {
            $query->whereIn('id', SupportReceipt::select('support_distribution_id')->where('confirmed_by', $filters['employee_id']));
        }
        if (! empty($filters['district'])) {
            $query->whereHas('beneficiary', fn ($r) => $r->where('district', 'like', '%'.$filters['district'].'%'));
        }
        $filteredCounts = (clone $query)->selectRaw('status, COUNT(*) AS total')->groupBy('status')->pluck('total', 'status');
        $queueBase = SupportDistribution::query();
        if (! empty($filters['fulfillment_method'])) {
            $queueBase->where('fulfillment_method', $filters['fulfillment_method']);
        }
        $queueCounts = (clone $queueBase)->selectRaw('status, COUNT(*) AS total')->groupBy('status')->pluck('total', 'status');
        $notStarted = (int) ($queueCounts['draft'] ?? 0) + (int) ($queueCounts['approved'] ?? 0) + (int) ($queueCounts['reserved'] ?? 0) + (int) ($queueCounts['ready'] ?? 0);
        $operational = null;
        if (! empty($filters['metrics_from']) && ! empty($filters['metrics_to'])) {
            $operational = app(OperationalMetricsService::class)->summarize(
                Carbon::parse($filters['metrics_from'])->startOfDay(),
                Carbon::parse($filters['metrics_to'])->endOfDay(),
                $filters['fulfillment_method'] ?? null,
            );
        }
        $metrics = [
            'total' => (int) $filteredCounts->sum(),
            'not_started' => $notStarted,
            'queue' => [
                'not_started' => $notStarted,
                'in_delivery' => (int) ($queueCounts['in_delivery'] ?? 0),
                'completed' => (int) ($queueCounts['completed'] ?? 0),
                'basis' => 'current_snapshot',
                'date_field' => null,
            ],
            'operational' => $operational,
        ];
        $requestedPageSize = (int) ($filters['per_page'] ?? 50);
        $perPage = $requestedPageSize === -1 ? 100 : $requestedPageSize;
        $page = $query->with(['items.inventoryItem', 'driver', 'beneficiary', 'staff', 'organization'])->latest()->orderBy('id')->paginate($perPage);
        $receipts = SupportReceipt::whereIn('support_distribution_id', $page->pluck('id'))->get()->keyBy('support_distribution_id');
        $employees = User::whereIn('id', $receipts->pluck('confirmed_by'))->pluck('full_name', 'id');
        $page->getCollection()->each(function ($support) use ($receipts, $employees) {
            $recipient = $support->{$support->recipient_type};
            $receipt = $receipts->get($support->id);
            $snapshot = is_array($receipt?->proof_snapshot) ? $receipt->proof_snapshot : null;
            $snapshotRecipient = is_array($snapshot['recipient'] ?? null) ? $snapshot['recipient'] : null;
            if ($support->status === 'completed' && $snapshotRecipient) {
                $support->setAttribute('history_name', $snapshotRecipient['display_name'] ?? $support->recipient_name);
                $support->setAttribute('contact_phone', $snapshotRecipient['phone'] ?? null);
                $support->setAttribute('address', $snapshotRecipient['address'] ?? ($snapshotRecipient['full_address'] ?? null));
                $support->setAttribute('history_driver_name', $snapshot['driver']['name'] ?? $support->driver?->full_name);
                $support->setAttribute('verification_method', $snapshot['verification_method'] ?? null);
                $support->setAttribute('history_source', 'snapshot');
            } elseif ($support->status === 'completed' && $receipt) {
                $support->setAttribute('history_name', $support->recipient_name);
                $support->setAttribute('contact_phone', $support->recipient_type === 'organization' ? $recipient?->contact : $recipient?->phone);
                $support->setAttribute('address', $recipient?->street ?? $recipient?->national_address);
                $support->setAttribute('history_driver_name', $support->driver?->full_name);
                $support->setAttribute('verification_method', 'receipt_code');
                $support->setAttribute('history_source', 'legacy');
            } else {
                $support->setAttribute('history_name', $support->recipient_name);
                $support->setAttribute('contact_phone', $support->recipient_type === 'organization' ? $recipient?->contact : $recipient?->phone);
                $support->setAttribute('address', $recipient?->street ?? $recipient?->national_address);
                $support->setAttribute('history_driver_name', $support->driver?->full_name);
                $support->setAttribute('verification_method', null);
                $support->setAttribute('history_source', 'current');
            }
            $support->setAttribute('district', $snapshotRecipient['district'] ?? $recipient?->district);
            $support->setAttribute('receipt', $receipt ? $receipt->toArray() + ['employee_name' => $employees[$receipt->confirmed_by] ?? null, 'confirmation_method' => 'receipt_code'] : null);
            $support->setAttribute('proof_available', $receipt !== null && $support->status === 'completed');
            // Operational lists expose contact details, never a full financial/identity record.
            $support->unsetRelation('beneficiary')->unsetRelation('staff')->unsetRelation('organization');
        });

        return response()->json($page->toArray() + ['metrics' => $metrics]);
    }

    public function show(string $id)
    {
        return response()->json(['data' => SupportDistribution::with('items')->findOrFail($id)]);
    }

    public function store(Request $request, SupportDistributionService $service)
    {
        $data = $request->validate(SupportDistributionService::rules());

        return response()->json(['data' => $service->create($data, $request->user()->id)], 201);
    }

    public function update(Request $request, string $id, SupportDistributionService $service)
    {
        return response()->json(['data' => $service->update($id, $request->all(), $request->user()->id)]);
    }

    public function transition(Request $request, string $id, string $action, SupportDistributionService $service)
    {
        abort_if($action === 'complete', 409, 'يجب تأكيد رمز الاستلام عبر مسار التحقق.');

        return response()->json(['data' => $service->transition($id, $action, $request->user()->id, $request->all())]);
    }

    public function history(Request $request, SupportHistoryService $service)
    {
        return response()->json($service->query($request->all()));
    }
}
