<?php

namespace App\Services;

use App\Http\Controllers\AnalyticsController;
use App\Models\AuditLog;
use App\Models\Beneficiary;
use App\Models\BeneficiaryPolicyEvaluation;
use App\Models\Category;
use App\Models\DailyBeneficiary;
use App\Models\DailyInventoryItem;
use App\Models\DailyInventoryMovement;
use App\Models\DailyReceivingTransaction;
use App\Models\Distribution;
use App\Models\InventoryItem;
use App\Models\InventoryMovement;
use App\Models\Notification;
use App\Models\Organization;
use App\Models\PolicyDecision;
use App\Models\Staff;
use App\Models\SupportDistribution;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

/** A single validated read model shared by Governance, Excel and PDF. */
class GovernanceReportService
{
    public const DATASETS = ['beneficiaries', 'daily_beneficiaries', 'policy_evaluations', 'policy_decisions', 'support_distributions', 'legacy_distributions', 'main_inventory_movements', 'daily_inventory_movements'];

    public function build(Request $request, bool $paginate = false): array
    {
        $filters = $this->filters($request);
        $response = app(AnalyticsController::class)->index($request);
        abort_if($response->getStatusCode() !== 200, 422, 'Invalid reporting period');
        $analytics = $response->getData(true);
        $from = Carbon::parse($analytics['period']['start_date'])->startOfDay();
        $to = Carbon::parse($analytics['period']['end_date'])->endOfDay();
        $period = [$from, $to];
        if (! isset($analytics['nationality_analysis'])) {
            $analytics['nationality_analysis'] = $this->nationalityAnalysis($request, $from, $to);
        }

        $permanent = $this->beneficiaries($filters)->whereBetween('created_at', $period);
        $daily = $this->daily($filters)->whereBetween('created_at', $period);
        $evaluations = $this->evaluations($filters)->whereBetween('evaluated_at', $period);
        $decisions = $this->decisions($filters)->whereBetween('decided_at', $period);
        $support = $this->support($filters)->whereBetween('created_at', $period);
        $permanentCount = $filters['domain'] === 'daily' ? 0 : (clone $permanent)->count();
        $dailyCount = $filters['domain'] === 'permanent' ? 0 : (clone $daily)->count();
        $supportCount = (clone $support)->count();
        $supportCompleted = (clone $support)->where('status', 'completed')->count();

        $analytics['kpis'] = array_merge($analytics['kpis'] ?? [], [
            'filtered_registrations' => $permanentCount + $dailyCount,
            'policy_evaluations' => (clone $evaluations)->count(),
            'policy_decisions' => (clone $decisions)->count(),
            'support_operations' => $analytics['operational_metrics']['total_due'] ?? $supportCount,
            'support_completed' => $analytics['operational_metrics']['completed_in_period'] ?? $supportCompleted,
        ]);
        $analytics['charts'] = $this->charts($filters, $from, $to, $permanentCount, $dailyCount, $support);
        $analytics['report_scope'] = ['period_metrics' => ['filtered_registrations', 'policy_evaluations', 'policy_decisions', 'support_operations', 'support_completed'], 'snapshot_metrics' => ['inventory', 'staff', 'organizations']];

        $beneficiaryRows = $filters['domain'] === 'daily' ? collect() : (clone $permanent)->with('category')->orderBy('created_at')->orderBy('id')->get();
        $scheduled = Distribution::whereBetween('scheduled_at', $period)->orderBy('scheduled_at')->get();
        $received = Distribution::whereBetween('delivered_at', $period)->where('status', 'delivered')->orderBy('delivered_at')->get();
        $group = fn ($rows, $field) => $rows->groupBy(fn ($row) => $row->{$field} ?? 'غير مسجل')->map->count()->sortDesc()->all();
        $breakdowns = [];
        foreach (['status', 'beneficiary_type', 'nationality', 'city', 'district', 'family_status', 'family_members_count', 'housing_type', 'profession', 'priority'] as $field) {
            $breakdowns[$field] = $group($beneficiaryRows, $field);
        }
        $quality = [
            'missing_district' => $beneficiaryRows->filter(fn ($row) => ! $row->district)->count(),
            'missing_category' => $beneficiaryRows->whereNull('category_id')->count(),
            'missing_birth_date' => $beneficiaryRows->whereNull('date_of_birth')->count(),
            'negative_net_income' => $beneficiaryRows->filter(fn ($row) => $row->net_income < 0)->count(),
            'delivered_without_date' => Distribution::where('status', 'delivered')->whereNull('delivered_at')->count(),
        ];
        $categoryVariants = Category::whereIn('name', ['ذوي الاحتياجات الخاصة', 'ذوو الاحتياجات الخاصة'])->get(['id', 'name']);
        // Retain the established legacy completion indicator as an explicitly
        // labelled compatibility metric; the authoritative support KPI above is separate.
        $completion = $scheduled->count() ? round(100 * $scheduled->where('status', 'delivered')->count() / $scheduled->count(), 1) : null;
        $previousEnd = $from->copy()->subMicrosecond();
        $previousStart = $from->copy()->subDays($from->copy()->startOfDay()->diffInDays($to->copy()->startOfDay()) + 1);
        $previous = $this->beneficiaries($filters)->whereBetween('created_at', [$previousStart, $previousEnd])->count();
        $growth = $previous ? round(100 * ($permanentCount - $previous) / $previous, 1) : null;
        $receivedPeople = $received->pluck('beneficiary_id')->unique()->count();
        $renters = $beneficiaryRows->filter(fn ($row) => $row->housing_type === 'rent' && $row->total_income > 0);
        $complete = $beneficiaryRows->filter(fn ($row) => $row->district && $row->category_id && $row->date_of_birth)->count();
        $stockTotal = InventoryItem::count() + DailyInventoryItem::count();
        $stockLow = InventoryItem::whereColumn('current_quantity', '<=', 'min_threshold')->count() + DailyInventoryItem::whereColumn('current_quantity', '<=', 'min_threshold')->count();
        $indicators = [
            ['label' => 'نمو التسجيل', 'value' => $growth, 'unit' => '%', 'scope' => 'التسجيلات الدائمة المطابقة مقارنة بفترة مساوية', 'formula' => '(الحالي − السابق) ÷ السابق × 100', 'note' => $previous ? 'الفترة السابقة: '.$previous.' تسجيل.' : 'لا يوجد مقام صالح في الفترة السابقة.'],
            ['label' => 'إكمال الجدولة القديمة', 'value' => $completion, 'unit' => '%', 'scope' => 'سجل التوزيع القديم المجدول خلال الفترة', 'formula' => 'المسلّمة ÷ جميع العمليات المجدولة × 100', 'note' => 'مؤشر توافق قديم معزول عن محرك الدعم الموحد.'],
            ['label' => 'عمليات الدعم الملغاة', 'value' => (clone $support)->where('status', 'cancelled')->count(), 'unit' => 'عملية', 'scope' => 'عمليات محرك الدعم المنشأة خلال الفترة', 'formula' => 'عدد العمليات ذات الحالة cancelled', 'note' => 'تعرض خارج قمع التقدم ولا تُعامل كمرحلة مكتملة.'],
            ['label' => 'متوسط مرات الاستلام القديم', 'value' => $receivedPeople ? round($received->count() / $receivedPeople, 2) : null, 'unit' => 'عملية / مستفيد', 'scope' => 'سجل التوزيع القديم خلال الفترة', 'formula' => 'عمليات الاستلام ÷ المستفيدين الفريدين', 'note' => 'مؤشر توافق قديم معزول.'],
            ['label' => 'عبء الإيجار على الدخل', 'value' => $renters->count() ? round($renters->avg(fn ($row) => 100 * $row->monthly_rent / $row->total_income), 1) : null, 'unit' => '%', 'scope' => 'التسجيلات المطابقة خلال الفترة', 'formula' => 'متوسط (الإيجار ÷ الدخل × 100)', 'note' => 'حجم العينة '.$renters->count().'.'],
            ['label' => 'اكتمال بيانات التحليل', 'value' => $beneficiaryRows->count() ? round(100 * $complete / $beneficiaryRows->count(), 1) : null, 'unit' => '%', 'scope' => 'التسجيلات المطابقة خلال الفترة', 'formula' => 'اكتمال الحي والفئة وتاريخ الميلاد ÷ المطابق', 'note' => 'مؤشر جودة، وليس قرار أهلية.'],
            ['label' => 'نسبة أصناف المخزون المنخفض', 'value' => $stockTotal ? round(100 * $stockLow / $stockTotal, 1) : null, 'unit' => '%', 'scope' => 'لقطتان منفصلتان للمخزون العام واليومي', 'formula' => 'الأصناف المنخفضة ÷ مجموع الأصناف', 'note' => 'لا تُجمع الكميات بين المجالين.'],
        ];
        $districts = $beneficiaryRows->groupBy(fn ($row) => $row->district ?: 'غير مسجل')->map->count()->sortDesc();
        $topDistricts = $districts->take(8)->all();
        if ($districts->count() > 8) {
            $topDistricts['أحياء أخرى'] = $districts->slice(8)->sum();
        }
        $timeline = $analytics['charts']['line_chart']['data'];
        $insights = [
            'بلغ عدد التسجيلات المطابقة خلال الفترة '.($permanentCount + $dailyCount).'.',
            'أنشأ محرك الدعم الموحد '.$supportCount.' عملية مطابقة، اكتمل منها '.$supportCompleted.'.',
            'سجّل محرك السياسات '.(clone $evaluations)->count().' تقييماً غير قابل للتعديل خلال الفترة.',
            'أصناف المخزون المنخفض حالياً: '.$stockLow.'.',
        ];
        $datasets = $this->datasets($filters, $period, $permanent, $daily, $evaluations, $decisions, $support, $scheduled, $received);
        $datasets['nationality_analysis'] = $this->nationalityExportRows($analytics['nationality_analysis']);

        return compact('analytics', 'filters', 'breakdowns', 'quality', 'categoryVariants', 'completion', 'insights', 'datasets', 'indicators', 'topDistricts', 'timeline') + [
            'detail' => $this->detail($filters, $period, $paginate),
            'generated_at' => now()->format('Y-m-d H:i:s T'), 'generated_by' => $request->user()?->full_name ?? 'System',
            'finance' => ['total_income' => $beneficiaryRows->sum('total_income'), 'monthly_rent' => $beneficiaryRows->sum('monthly_rent'), 'net_income' => $beneficiaryRows->sum('net_income'), 'average_income' => $beneficiaryRows->avg('total_income')],
            'policy_finance' => [
                'gross_counted_income' => (float) (clone $evaluations)->sum('gross_counted_income'),
                'monthly_rent' => (float) (clone $evaluations)->sum('monthly_rent'),
                'adjusted_net_household_income' => (float) (clone $evaluations)->sum('adjusted_net_household_income'),
                'net_income_per_capita' => (float) (clone $evaluations)->sum('net_income_per_capita'),
            ],
            'received_operations' => $received->count(), 'received_beneficiaries' => $receivedPeople,
            'scheduled_statuses' => $group($scheduled, 'status'), 'support_statuses' => $group((clone $support)->get(), 'status'),
            'policy_outcomes' => $group((clone $evaluations)->get(), 'eligibility_decision'),
            'audit_actions' => $group(AuditLog::whereBetween('created_at', $period)->get(['action']), 'action'),
            'notifications' => ['total' => Notification::whereBetween('created_at', $period)->count(), 'unread' => Notification::whereBetween('created_at', $period)->whereNull('read_at')->count()],
            'users_active' => User::where('is_active', true)->count(), 'daily_snapshot_count' => DailyBeneficiary::count(),
        ];
    }

    private function filters(Request $request): array
    {
        return $request->validate([
            'domain' => 'nullable|in:all,permanent,daily', 'report_dataset' => 'nullable|in:'.implode(',', self::DATASETS),
            'beneficiary_type' => 'nullable|in:citizen,resident', 'status' => 'nullable|string|max:40',
            'district' => 'nullable|string|max:150', 'policy_outcome' => 'nullable|string|max:40', 'need_level' => 'nullable|string|max:60',
            'support_status' => 'nullable|in:draft,approved,reserved,ready,in_delivery,completed,cancelled', 'fulfillment_method' => 'nullable|in:pickup,delivery',
            'search' => 'nullable|string|max:120', 'page' => 'nullable|integer|min:1', 'per_page' => 'nullable|integer|min:5|max:100',
            'sort' => 'nullable|in:created_at,evaluated_at,decided_at,scheduled_at,support_date,status,full_name', 'direction' => 'nullable|in:asc,desc',
        ]) + ['domain' => 'all', 'report_dataset' => 'beneficiaries', 'page' => 1, 'per_page' => 25, 'direction' => 'desc'];
    }

    private function beneficiaries(array $f): Builder
    {
        return Beneficiary::query()->when($f['beneficiary_type'] ?? null, fn ($q, $v) => $q->where('beneficiary_type', $v))->when($f['status'] ?? null, fn ($q, $v) => $q->where('status', $v))->when($f['district'] ?? null, fn ($q, $v) => $q->where('district', $v))->when($f['search'] ?? null, fn ($q, $v) => $q->where(fn ($n) => $n->where('full_name', 'like', '%'.$v.'%')->orWhere('district', 'like', '%'.$v.'%')));
    }

    private function daily(array $f): Builder
    {
        return DailyBeneficiary::query()->when($f['status'] ?? null, fn ($q, $v) => $q->where('status', $v))->when($f['district'] ?? null, fn ($q, $v) => $q->where('district', $v))->when($f['search'] ?? null, fn ($q, $v) => $q->where(fn ($n) => $n->where('full_name', 'like', '%'.$v.'%')->orWhere('district', 'like', '%'.$v.'%')));
    }

    private function evaluations(array $f): Builder
    {
        return BeneficiaryPolicyEvaluation::query()->when($f['policy_outcome'] ?? null, fn ($q, $v) => $q->where('eligibility_decision', $v))->when($f['need_level'] ?? null, fn ($q, $v) => $q->where('need_level_snapshot->level', $v));
    }

    private function decisions(array $f): Builder
    {
        return PolicyDecision::query()->when($f['policy_outcome'] ?? null, fn ($q, $v) => $q->where('decision', $v));
    }

    private function support(array $f): Builder
    {
        return SupportDistribution::query()->when($f['support_status'] ?? null, fn ($q, $v) => $q->where('status', $v))->when($f['fulfillment_method'] ?? null, fn ($q, $v) => $q->where('fulfillment_method', $v))->when($f['search'] ?? null, fn ($q, $v) => $q->where('recipient_name', 'like', '%'.$v.'%'));
    }

    private function charts(array $f, Carbon $from, Carbon $to, int $permanent, int $daily, Builder $support): array
    {
        $line = [];
        $cursor = $from->copy()->startOfMonth();
        while ($cursor->lte($to)) {
            $bin = [$cursor->copy()->max($from), $cursor->copy()->endOfMonth()->min($to)];
            $completed = $this->support($f)->where('status', 'completed')->whereBetween('completed_at', $bin)->count();
            $line[] = ['label' => $cursor->format('Y-m'), 'registrations' => ($f['domain'] === 'daily' ? 0 : $this->beneficiaries($f)->whereBetween('created_at', $bin)->count()) + ($f['domain'] === 'permanent' ? 0 : $this->daily($f)->whereBetween('created_at', $bin)->count()), 'distributions' => $completed, 'receipts' => $completed, 'support_completed' => $completed];
            $cursor->addMonth();
        }
        $ranks = ['draft' => 0, 'approved' => 1, 'reserved' => 2, 'ready' => 3, 'in_delivery' => 4, 'completed' => 5];
        $statuses = (clone $support)->pluck('status');
        $stages = collect([['أنشئت', 0], ['اعتمدت', 1], ['حُجز مخزونها', 2], ['جاهزة', 3], ['اكتملت', 5]])->map(function ($stage) use ($statuses, $ranks) {
            $count = $statuses->filter(fn ($status) => isset($ranks[$status]) && $ranks[$status] >= $stage[1])->count();

            return ['stage' => $stage[0], 'count' => $count, 'percentage' => $statuses->count() ? round(100 * $count / $statuses->count(), 1) : 0];
        })->all();
        $domains = [['label' => 'دائمون', 'count' => $permanent, 'color' => '#355B30'], ['label' => 'يوميون', 'count' => $daily, 'color' => '#C9A24A']];

        return ['column_chart' => ['title' => 'التسجيلات المطابقة حسب المجال — خلال الفترة', 'data' => $domains], 'line_chart' => ['title' => 'التسجيل والدعم المكتمل عبر الزمن', 'data' => $line], 'funnel_chart' => ['title' => 'تقدم عمليات محرك الدعم المنشأة خلال الفترة', 'stages' => $stages], 'pie_chart' => ['title' => 'نسبة التسجيل حسب المجال — خلال الفترة', 'data' => $domains, 'secondary_data' => []]];
    }

    private function datasets(array $f, array $period, Builder $permanent, Builder $daily, Builder $evaluations, Builder $decisions, Builder $support, $scheduled, $received): array
    {
        $permanentColumns = ['id', 'full_name', 'beneficiary_type', 'status', 'category_id', 'city', 'district', 'nationality', 'family_members_count', 'housing_type', 'monthly_salary', 'total_income', 'monthly_rent', 'net_income', 'created_at'];

        return [
            'beneficiaries_snapshot' => $f['domain'] === 'daily' ? [] : (clone $permanent)->orderBy('created_at')->orderBy('id')->get($permanentColumns)->toArray(),
            'registrations_period' => $f['domain'] === 'daily' ? [] : (clone $permanent)->get(['id', 'full_name', 'created_at'])->toArray(),
            'daily_beneficiaries' => $f['domain'] === 'permanent' ? [] : (clone $daily)->orderBy('created_at')->orderBy('id')->get(['id', 'full_name', 'district', 'category_name', 'status', 'total_received_count', 'created_at'])->toArray(),
            'policy_evaluations' => (clone $evaluations)->orderBy('evaluated_at')->get(['id', 'beneficiary_id', 'policy_version_id', 'evaluation_status', 'eligibility_decision', 'income_category', 'score_category', 'policy_score', 'evaluated_at'])->toArray(),
            'policy_decisions' => (clone $decisions)->orderBy('decided_at')->get(['id', 'evaluation_id', 'policy_version_id', 'decision', 'stable_reason_code', 'decided_at'])->toArray(),
            'support_distributions' => (clone $support)->orderBy('created_at')->get(['id', 'recipient_type', 'recipient_name', 'fulfillment_method', 'status', 'support_date', 'completed_at', 'created_at'])->toArray(),
            'scheduled_period' => $scheduled->map->only(['id', 'beneficiary_id', 'basket_id', 'status', 'scheduled_at', 'delivered_at', 'driver_id'])->all(),
            'received_period' => $received->map->only(['id', 'beneficiary_id', 'basket_id', 'status', 'scheduled_at', 'delivered_at'])->all(),
            'daily_activity_period' => DailyReceivingTransaction::whereBetween('receiving_date', $period)->get(['id', 'daily_beneficiary_id', 'quantity', 'basket_type_name', 'receiving_date', 'status'])->toArray(),
            'main_stock_snapshot' => InventoryItem::get(['id', 'name', 'unit', 'current_quantity', 'min_threshold'])->toArray(),
            'daily_stock_snapshot' => DailyInventoryItem::get(['id', 'name', 'unit', 'current_quantity', 'reserved_quantity', 'min_threshold', 'expiry_date', 'status'])->toArray(),
            'main_movements_period' => InventoryMovement::whereBetween('created_at', $period)->get(['id', 'inventory_item_id', 'type', 'quantity', 'reason', 'created_at'])->toArray(),
            'daily_movements_period' => DailyInventoryMovement::whereBetween('created_at', $period)->get(['id', 'daily_inventory_item_id', 'type', 'quantity', 'created_at'])->toArray(),
            'organizations_snapshot' => Organization::get(['id', 'name', 'code', 'status', 'created_at'])->toArray(), 'staff_snapshot' => Staff::get(['id', 'name', 'department', 'job_title', 'status', 'hire_date'])->toArray(),
        ];
    }

    private function detail(array $f, array $period, bool $paginate): array
    {
        $dataset = $f['report_dataset'];
        $query = match ($dataset) {
            'daily_beneficiaries' => $this->daily($f)->whereBetween('created_at', $period)->when($f['domain'] === 'permanent', fn ($q) => $q->whereRaw('1 = 0'))->select(['id', 'full_name', 'district', 'category_name', 'status', 'total_received_count', 'created_at']),
            'policy_evaluations' => $this->evaluations($f)->whereBetween('evaluated_at', $period)->select(['id', 'beneficiary_id', 'policy_version_id', 'evaluation_status', 'eligibility_decision', 'income_category', 'score_category', 'policy_score', 'evaluated_at']),
            'policy_decisions' => $this->decisions($f)->whereBetween('decided_at', $period)->select(['id', 'evaluation_id', 'policy_version_id', 'decision', 'stable_reason_code', 'decided_at']),
            'support_distributions' => $this->support($f)->whereBetween('created_at', $period)->select(['id', 'recipient_type', 'recipient_name', 'fulfillment_method', 'status', 'support_date', 'completed_at', 'created_at']),
            'legacy_distributions' => Distribution::whereBetween('scheduled_at', $period)->select(['id', 'beneficiary_id', 'basket_id', 'status', 'scheduled_at', 'delivered_at']),
            'main_inventory_movements' => InventoryMovement::whereBetween('created_at', $period)->select(['id', 'inventory_item_id', 'type', 'quantity', 'reason', 'created_at']),
            'daily_inventory_movements' => DailyInventoryMovement::whereBetween('created_at', $period)->select(['id', 'daily_inventory_item_id', 'type', 'quantity', 'created_at']),
            default => $this->beneficiaries($f)->whereBetween('created_at', $period)->when($f['domain'] === 'daily', fn ($q) => $q->whereRaw('1 = 0'))->select(['id', 'full_name', 'beneficiary_type', 'status', 'category_id', 'city', 'district', 'nationality', 'family_members_count', 'housing_type', 'created_at']),
        };
        $defaultSort = match ($dataset) {
            'policy_evaluations' => 'evaluated_at', 'policy_decisions' => 'decided_at', 'legacy_distributions' => 'scheduled_at', default => 'created_at'
        };
        $allowed = ['created_at', 'evaluated_at', 'decided_at', 'scheduled_at', 'support_date', 'status', 'full_name'];
        $sort = in_array($f['sort'] ?? '', $allowed, true) && in_array($f['sort'], $query->getQuery()->columns ?? [], true) ? $f['sort'] : $defaultSort;
        $query->orderBy($sort, $f['direction'])->orderBy('id', $f['direction']);
        $total = (clone $query)->count();
        $rows = $paginate ? $query->forPage($f['page'], $f['per_page'])->get()->toArray() : $query->get()->toArray();

        return ['dataset' => $dataset, 'data' => $rows, 'total' => $total, 'page' => $paginate ? $f['page'] : 1, 'per_page' => $paginate ? $f['per_page'] : max(1, $total), 'last_page' => $paginate ? max(1, (int) ceil($total / $f['per_page'])) : 1];
    }

    /**
     * Unique nationality populations for the chart, table, totals, Excel sheet, and PDF.
     * Registered uses created_at. Active is an undated snapshot. Served uses one completed receipt per person.
     */
    public function nationalityAnalysis(Request $request, Carbon $from, Carbon $to): array
    {
        $scope = $this->nationalityScope($request);
        $domain = $scope['domain'];
        $from = $from->copy();
        $to = $to->copy();
        $includePermanent = $domain !== 'daily';
        $includeDaily = $domain !== 'permanent';
        $permanent = [
            'registered' => $includePermanent ? $this->countsByNationality($this->nationalityBeneficiaries($scope)->whereBetween('created_at', [$from, $to])->get(['id', 'nationality'])) : [],
            'active' => $includePermanent ? $this->countsByNationality($this->nationalityBeneficiaries($scope)->where('status', 'active')->whereNull('archived_at')->get(['id', 'nationality'])) : [],
            'served' => $includePermanent ? $this->countsByNationality($this->nationalityBeneficiaries($scope)->whereIn('id', $this->servedPermanentIds($from, $to))->get(['id', 'nationality'])) : [],
        ];
        $daily = [
            'registered' => $includeDaily ? $this->countsByNationality($this->nationalityDaily($scope)->whereBetween('created_at', [$from, $to])->get(['id', 'nationality'])) : [],
            'active' => $includeDaily ? $this->countsByNationality($this->nationalityDaily($scope)->where('status', 'active')->get(['id', 'nationality'])) : [],
            'served' => $includeDaily ? $this->countsByNationality($this->nationalityDaily($scope)->whereIn('id', $this->servedDailyIds($from, $to))->get(['id', 'nationality'])) : [],
        ];
        $populations = [
            'registered' => ['label' => 'مسجلون', 'date_field' => 'created_at', 'period_filtered' => true] + $this->nationalityPopulation($permanent['registered'], $daily['registered'], $includePermanent, $includeDaily),
            'active' => ['label' => 'نشطون', 'date_field' => null, 'period_filtered' => false] + $this->nationalityPopulation($permanent['active'], $daily['active'], $includePermanent, $includeDaily),
            'served' => ['label' => 'مخدومون', 'date_field' => ['permanent' => 'support_distributions.completed_at', 'daily' => 'daily_receiving_transactions.receiving_date'], 'period_filtered' => true] + $this->nationalityPopulation($permanent['served'], $daily['served'], $includePermanent, $includeDaily),
        ];

        return [
            'domain' => $domain,
            'period' => ['start_date' => $from->toDateString(), 'end_date' => $to->toDateString()],
            'missing' => ['key' => 'missing', 'label' => 'غير مسجلة'],
            'populations' => $populations,
            'chart' => $this->nationalityChart($populations),
        ];
    }

    private function nationalityScope(Request $request): array
    {
        $domain = $request->input('domain', 'all');
        $type = $request->input('beneficiary_type');

        return [
            'domain' => in_array($domain, ['all', 'permanent', 'daily'], true) ? $domain : 'all',
            'beneficiary_type' => in_array($type, ['citizen', 'resident'], true) ? $type : null,
            'status' => $request->filled('status') ? mb_substr((string) $request->input('status'), 0, 40) : null,
            'district' => $request->filled('district') ? mb_substr((string) $request->input('district'), 0, 150) : null,
            'search' => $request->filled('search') ? mb_substr((string) $request->input('search'), 0, 120) : null,
        ];
    }

    private function nationalityBeneficiaries(array $scope): Builder
    {
        return $this->beneficiaries($scope)
            ->where(fn ($query) => $query->where('is_employee', false)->orWhereNull('is_employee'))
            ->where(fn ($query) => $query->where('priority', '!=', 'employee')->orWhereNull('priority'));
    }

    private function nationalityDaily(array $scope): Builder
    {
        return $this->daily($scope)->when($scope['beneficiary_type'] ?? null, fn ($query, $type) => $query->where('beneficiary_type', $type));
    }

    private function servedPermanentIds(Carbon $from, Carbon $to)
    {
        return SupportDistribution::query()
            ->where('recipient_type', 'beneficiary')
            ->where('status', 'completed')
            ->whereBetween('completed_at', [$from, $to])
            ->whereNotNull('beneficiary_id')
            ->whereExists(function ($query) {
                $query->selectRaw('1')
                    ->from('support_receipts')
                    ->whereColumn('support_receipts.support_distribution_id', 'support_distributions.id');
            })
            ->distinct()
            ->pluck('beneficiary_id');
    }

    private function servedDailyIds(Carbon $from, Carbon $to)
    {
        return DailyReceivingTransaction::query()
            ->where('status', 'received')
            ->whereBetween('receiving_date', [$from, $to])
            ->distinct()
            ->pluck('daily_beneficiary_id');
    }

    private function countsByNationality($rows): array
    {
        $counts = [];
        $seen = [];
        foreach ($rows as $row) {
            $id = (string) $row->id;
            if (isset($seen[$id])) {
                continue;
            }
            $seen[$id] = true;
            $key = $this->nationalityKey($row->nationality);
            $counts[$key] = ($counts[$key] ?? 0) + 1;
        }

        return $counts;
    }

    private function nationalityKey(mixed $value): string
    {
        if (! is_string($value) && ! is_numeric($value)) {
            return 'missing';
        }
        $trimmed = trim((string) $value);

        return $trimmed === '' ? 'missing' : $trimmed;
    }

    private function nationalityPopulation(array $permanentCounts, array $dailyCounts, bool $includePermanent, bool $includeDaily): array
    {
        $keys = ['missing'];
        if ($includePermanent) {
            $keys = array_merge($keys, array_keys($permanentCounts));
        }
        if ($includeDaily) {
            $keys = array_merge($keys, array_keys($dailyCounts));
        }
        $buckets = [];
        foreach (array_values(array_unique($keys)) as $key) {
            $bucket = [
                'key' => $key,
                'label' => $key === 'missing' ? 'غير مسجلة' : $key,
                'count' => ($includePermanent ? ($permanentCounts[$key] ?? 0) : 0) + ($includeDaily ? ($dailyCounts[$key] ?? 0) : 0),
            ];
            if ($includePermanent) {
                $bucket['permanent'] = $permanentCounts[$key] ?? 0;
            }
            if ($includeDaily) {
                $bucket['daily'] = $dailyCounts[$key] ?? 0;
            }
            $buckets[] = $bucket;
        }
        usort($buckets, function (array $left, array $right): int {
            if ($left['key'] === 'missing') {
                return 1;
            }
            if ($right['key'] === 'missing') {
                return -1;
            }

            return $right['count'] <=> $left['count'] ?: strcmp($left['label'], $right['label']);
        });

        return ['total' => array_sum(array_column($buckets, 'count')), 'buckets' => $buckets];
    }

    private function nationalityChart(array $populations): array
    {
        $labels = [];
        foreach ($populations as $population) {
            foreach ($population['buckets'] as $bucket) {
                if ($bucket['key'] !== 'missing') {
                    $labels[$bucket['key']] = $bucket['label'];
                }
            }
        }
        $labels['missing'] = 'غير مسجلة';
        $categories = [];
        foreach ($labels as $key => $label) {
            $categories[] = ['key' => $key, 'label' => $label];
        }
        $series = [];
        foreach ($populations as $key => $population) {
            $counts = [];
            foreach ($population['buckets'] as $bucket) {
                $counts[$bucket['key']] = $bucket['count'];
            }
            $data = [];
            foreach (array_keys($labels) as $category) {
                $data[] = $counts[$category] ?? 0;
            }
            $series[] = ['key' => $key, 'label' => $population['label'], 'data' => $data];
        }

        return ['categories' => $categories, 'series' => $series];
    }

    private function nationalityExportRows(array $analysis): array
    {
        $rows = [];
        foreach ($analysis['populations'] as $population => $payload) {
            foreach ($payload['buckets'] as $bucket) {
                $row = ['population' => $population, 'key' => $bucket['key'], 'label' => $bucket['label'], 'count' => $bucket['count']];
                if (array_key_exists('permanent', $bucket)) {
                    $row['permanent'] = $bucket['permanent'];
                }
                if (array_key_exists('daily', $bucket)) {
                    $row['daily'] = $bucket['daily'];
                }
                $rows[] = $row;
            }
        }

        return $rows;
    }
}
