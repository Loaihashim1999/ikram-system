<?php

namespace App\Http\Controllers;

use App\Models\SupportDistribution;
use App\Models\SupportReceipt;
use App\Models\User;
use App\Services\SupportDistributionService;
use App\Services\SupportHistoryService;
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
            'driver_id' => 'nullable|uuid', 'employee_id' => 'nullable|uuid', 'district' => 'nullable|string|max:200',
            'reference' => 'nullable|uuid',
            'per_page' => 'nullable|integer|min:-1|max:100|not_in:0',
        ]);
        if (! empty($filters['date_from']) && ! empty($filters['date_to'])) {
            $request->validate(['date_to' => 'after_or_equal:date_from']);
        }
        $query = SupportDistribution::query();
        foreach (['fulfillment_method', 'status', 'driver_id'] as $field) {
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
                $query->whereDate(DB::raw('COALESCE(completed_at, support_date, created_at)'), $operator, $filters[$field]);
            }
        }
        if (! empty($filters['employee_id'])) {
            $query->whereIn('id', SupportReceipt::select('support_distribution_id')->where('confirmed_by', $filters['employee_id']));
        }
        if (! empty($filters['district'])) {
            $query->whereHas('beneficiary', fn ($r) => $r->where('district', 'like', '%'.$filters['district'].'%'));
        }
        $counts = (clone $query)->selectRaw('status, COUNT(*) AS total')->groupBy('status')->pluck('total', 'status');
        $total = (int) $counts->sum();
        $metrics = [
            'total' => $total, 'in_delivery' => (int) ($counts['in_delivery'] ?? 0),
            'completed' => (int) ($counts['completed'] ?? 0), 'cancelled' => (int) ($counts['cancelled'] ?? 0),
            'not_started' => (int) ($counts['draft'] ?? 0) + (int) ($counts['approved'] ?? 0) + (int) ($counts['reserved'] ?? 0) + (int) ($counts['ready'] ?? 0),
            'remaining' => $total - (int) ($counts['completed'] ?? 0) - (int) ($counts['cancelled'] ?? 0),
            'delivered_beneficiaries' => (clone $query)->where('status', 'completed')->whereNotNull('beneficiary_id')->distinct()->count('beneficiary_id'),
        ];
        $requestedPageSize = (int) ($filters['per_page'] ?? 50);
        $perPage = $requestedPageSize === -1 ? 100 : $requestedPageSize;
        $page = $query->with(['items.inventoryItem', 'driver', 'beneficiary', 'staff', 'organization'])->latest()->orderBy('id')->paginate($perPage);
        $receipts = SupportReceipt::whereIn('support_distribution_id', $page->pluck('id'))->get()->keyBy('support_distribution_id');
        $employees = User::whereIn('id', $receipts->pluck('confirmed_by'))->pluck('full_name', 'id');
        $page->getCollection()->each(function ($support) use ($receipts, $employees) {
            $recipient = $support->{$support->recipient_type};
            $receipt = $receipts->get($support->id);
            $support->setAttribute('contact_phone', $support->recipient_type === 'organization' ? $recipient?->contact : $recipient?->phone);
            $support->setAttribute('address', $recipient?->street ?? $recipient?->national_address);
            $support->setAttribute('district', $recipient?->district);
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
