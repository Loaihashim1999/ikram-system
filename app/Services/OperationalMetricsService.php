<?php

namespace App\Services;

use App\Models\SupportDistribution;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Validation\ValidationException;

/**
 * Operational support metrics. support_date is the due date.
 * completed_at is the completion timestamp. There is no ready_at history.
 */
final class OperationalMetricsService
{
    /** States that mean the operation entered actual fulfillment. */
    public const DUE_STATUSES = ['ready', 'in_delivery', 'completed'];

    public function summarize(Carbon $from, Carbon $to, ?string $fulfillmentMethod = null): array
    {
        if ($from->gt($to)) {
            throw ValidationException::withMessages([
                'end_date' => 'تاريخ النهاية يجب أن يساوي تاريخ البداية أو يأتي بعده.',
            ]);
        }

        $due = $this->due($from, $to, $fulfillmentMethod);
        $completedByCutoff = (clone $due)->whereNotNull('completed_at')->where('completed_at', '<=', $to);
        $notCompleted = (clone $due)->where(function (Builder $query) use ($to) {
            $query->whereNull('completed_at')->orWhere('completed_at', '>', $to);
        });
        $overdue = (clone $notCompleted)->whereDate('support_date', '<', $to->toDateString());

        return [
            'total_due' => (clone $due)->count(),
            'completed_by_cutoff' => (clone $completedByCutoff)->count(),
            'completed_in_period' => $this->completedInPeriod($from, $to, $fulfillmentMethod)->count(),
            'not_completed' => (clone $notCompleted)->count(),
            'overdue' => (clone $overdue)->count(),
            'unique_due_beneficiaries' => $this->distinctBeneficiaries($due),
            'unique_completed_beneficiaries' => $this->distinctBeneficiaries($completedByCutoff),
            'unique_not_completed_beneficiaries' => $this->distinctBeneficiaries($notCompleted),
            'due_date_field' => 'support_date',
            'completion_field' => 'completed_at',
            'due_statuses' => self::DUE_STATUSES,
            'fulfillment_method' => $fulfillmentMethod,
        ];
    }

    private function due(Carbon $from, Carbon $to, ?string $fulfillmentMethod = null): Builder
    {
        return $this->scoped(SupportDistribution::query()
            ->whereIn('status', self::DUE_STATUSES)
            ->whereBetween('support_date', [$from, $to]), $fulfillmentMethod);
    }

    private function completedInPeriod(Carbon $from, Carbon $to, ?string $fulfillmentMethod = null): Builder
    {
        return $this->scoped(SupportDistribution::query()
            ->where('status', 'completed')
            ->whereBetween('completed_at', [$from, $to]), $fulfillmentMethod);
    }

    private function scoped(Builder $query, ?string $fulfillmentMethod): Builder
    {
        if ($fulfillmentMethod !== null && $fulfillmentMethod !== '') {
            $query->where('fulfillment_method', $fulfillmentMethod);
        }

        return $query;
    }

    private function distinctBeneficiaries(Builder $query): int
    {
        return (clone $query)->whereNotNull('beneficiary_id')->distinct()->count('beneficiary_id');
    }
}
