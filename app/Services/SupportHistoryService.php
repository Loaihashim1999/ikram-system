<?php

namespace App\Services;

use App\Models\Beneficiary;
use App\Models\Organization;
use App\Models\Staff;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class SupportHistoryService
{
    public function query(array $input)
    {
        $data = Validator::make($input, [
            'population' => 'required|in:beneficiaries,staff,organizations',
            'inventory_item_id' => 'required|uuid|exists:inventory_items,id',
            'from' => 'nullable|date', 'to' => 'nullable|date|after_or_equal:from',
            'never_received' => 'sometimes|boolean',
            'not_received_since' => 'nullable|date', 'not_received_days' => 'nullable|integer|min:0|max:36500',
        ])->validate();
        [$model, $type, $key] = match ($data['population']) {
            'beneficiaries' => [Beneficiary::class, 'beneficiary', 'beneficiary_id'],
            'staff' => [Staff::class, 'staff', 'staff_id'],
            'organizations' => [Organization::class, 'organization', 'organization_id'],
        };
        $table = (new $model)->getTable();
        $receipts = DB::table('support_distributions as d')->join('support_distribution_items as i', 'i.support_distribution_id', '=', 'd.id')
            ->where('d.status', 'completed')->where('d.recipient_type', $type)
            ->where('i.inventory_item_id', $data['inventory_item_id'])->whereColumn('d.'.$key, $table.'.id');
        $period = clone $receipts;
        if (! empty($data['from'])) {
            $period->where('d.completed_at', '>=', Carbon::parse($data['from'])->startOfDay());
        }
        if (! empty($data['to'])) {
            $period->where('d.completed_at', '<=', Carbon::parse($data['to'])->endOfDay());
        }
        $query = $model::query()->select($table.'.id')->selectRaw($table.'.'.($type === 'beneficiary' ? 'full_name' : 'name').' as recipient_name')
            ->selectSub((clone $receipts)->selectRaw('MAX(d.completed_at)'), 'last_received_at')
            ->selectSub($period->selectRaw('COALESCE(SUM(i.fulfilled_quantity), 0)'), 'total_received_in_period');
        if ($data['never_received'] ?? false) {
            $query->whereNotExists((clone $receipts)->selectRaw('1'));
        }
        $since = ! empty($data['not_received_since']) ? Carbon::parse($data['not_received_since'])->startOfDay() : null;
        if (isset($data['not_received_days'])) {
            $since = now()->subDays($data['not_received_days'])->startOfDay();
        }
        if ($since) {
            $query->whereNotExists((clone $receipts)->where('d.completed_at', '>=', $since)->selectRaw('1'));
        }

        return $query->orderBy($table.'.id')->paginate(50)->through(function ($row) {
            return ['id' => $row->id, 'recipient_name' => $row->recipient_name, 'last_received_at' => $row->last_received_at,
                'days_since_received' => $row->last_received_at ? (int) Carbon::parse($row->last_received_at)->startOfDay()->diffInDays(now()->startOfDay()) : null,
                'total_received_in_period' => number_format((float) $row->total_received_in_period, 2, '.', '')];
        });
    }
}
