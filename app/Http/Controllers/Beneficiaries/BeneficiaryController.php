<?php

namespace App\Http\Controllers\Beneficiaries;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Beneficiary;
use App\Models\Category;
use App\Models\Dependent;
use App\Models\SupportDistribution;
use App\Models\User;
use App\Services\BeneficiaryPolicy\PolicyRegistrationEvaluationService;
use App\Services\FinancialCalculationService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Shared\Date as SpreadsheetDate;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

class BeneficiaryController extends Controller
{
    /** Unified, server-paginated query surface for permanent and daily domains. */
    public function unifiedIndex(Request $request): JsonResponse
    {
        $tab = $request->input('tab', 'all');
        abort_unless(in_array($tab, ['all', 'permanent', 'daily'], true), 422);
        $this->authorizeUnifiedTab($request, $tab);

        $union = $this->unifiedQuery($request, $tab);
        $perPage = min(max((int) $request->input('per_page', 25), 1), 100);
        $page = max((int) $request->input('page', 1), 1);
        $total = DB::query()->fromSub($union, 'unified_beneficiaries')->count();
        $pageQuery = DB::query()->fromSub($union, 'unified_beneficiaries');
        $this->applyUnifiedSort($pageQuery, $request);
        $rows = $this->attachLatestCompletedReceipts($pageQuery->forPage($page, $perPage)->get());

        return response()->json(['success' => true, 'data' => [
            'current_page' => $page, 'data' => $rows, 'from' => $total ? (($page - 1) * $perPage) + 1 : null,
            'last_page' => max((int) ceil($total / $perPage), 1), 'per_page' => $perPage,
            'to' => $total ? min($page * $perPage, $total) : null, 'total' => $total,
        ]]);
    }

    /** Export the complete filtered match set without exposing identity secrets. */
    public function unifiedExport(Request $request)
    {
        $tab = $request->input('tab', 'all');
        abort_unless(in_array($tab, ['all', 'permanent', 'daily'], true), 422);
        $this->authorizeUnifiedTab($request, $tab, true);
        $exportQuery = DB::query()->fromSub($this->unifiedQuery($request, $tab), 'unified_beneficiaries');
        $this->applyUnifiedSort($exportQuery, $request);
        $rows = $exportQuery->get();

        $spreadsheet = new Spreadsheet;
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('المستفيدون');
        $headers = ['المصدر', 'الاسم', 'النوع', 'المدينة', 'الحي', 'الحالة', 'تاريخ التسجيل'];
        foreach ($headers as $column => $header) {
            $sheet->setCellValueExplicit(Coordinate::stringFromColumnIndex($column + 1).'1', $header, DataType::TYPE_STRING);
        }
        foreach ($rows as $index => $row) {
            $excelRow = $index + 2;
            $values = [($row->source === 'daily' ? 'يومي' : 'دائم'), $row->full_name, $row->beneficiary_type,
                $row->city, $row->district, $row->status];
            foreach ($values as $column => $value) {
                $sheet->setCellValueExplicit(
                    Coordinate::stringFromColumnIndex($column + 1).$excelRow,
                    $value === null ? '' : (string) $value,
                    DataType::TYPE_STRING,
                );
            }
            if ($row->created_at) {
                $dateCell = 'G'.$excelRow;
                $sheet->setCellValue($dateCell, SpreadsheetDate::PHPToExcel(Carbon::parse($row->created_at)));
                $sheet->getStyle($dateCell)->getNumberFormat()->setFormatCode('yyyy-mm-dd');
            }
        }

        return response()->streamDownload(function () use ($spreadsheet) {
            (new Xlsx($spreadsheet))->save('php://output');
        }, 'ikram-beneficiaries.xlsx', ['Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
    }

    private function authorizeUnifiedTab(Request $request, string $tab, bool $export = false): void
    {
        $user = $request->user();
        if (! $user || $user->role === 'admin') {
            return;
        }
        $permissions = $user->permissions ?? [];
        foreach (array_filter([
            in_array($tab, ['all', 'permanent'], true) ? 'beneficiaries' : null,
            in_array($tab, ['all', 'daily'], true) ? 'daily_beneficiaries' : null,
        ]) as $module) {
            abort_unless(($permissions[$module]['view'] ?? false) === true, 403);
            if ($export) {
                abort_unless(($permissions[$module]['export'] ?? false) === true, 403);
            }
        }
    }

    private function applyUnifiedSort($query, Request $request): void
    {
        $sort = (string) $request->input('sort', 'created_at');
        $allowed = ['full_name', 'created_at', 'district', 'beneficiary_type', 'completed_receipt_count', 'latest_completed_at'];
        if (! in_array($sort, $allowed, true)) {
            $sort = 'created_at';
        }
        $direction = strtolower((string) $request->input('direction', 'desc')) === 'asc' ? 'asc' : 'desc';
        $query->orderBy($sort, $direction)->orderBy('id', 'desc');
    }

    private function completedSupportReceiptsByBeneficiary()
    {
        return DB::table('support_distributions as d')
            ->join('support_receipts as r', 'r.support_distribution_id', '=', 'd.id')
            ->where('d.status', 'completed')
            ->where('d.recipient_type', 'beneficiary')
            ->whereNotNull('d.beneficiary_id')
            ->groupBy('d.beneficiary_id')
            ->select([
                'd.beneficiary_id',
                DB::raw('COUNT(r.id) as completed_receipt_count'),
                DB::raw('MAX(d.completed_at) as latest_completed_at'),
            ]);
    }

    private function completedDailyReceiptsByBeneficiary()
    {
        return DB::table('daily_receiving_transactions')
            ->where('status', 'received')
            ->groupBy('daily_beneficiary_id')
            ->select([
                'daily_beneficiary_id',
                DB::raw('COUNT(id) as completed_receipt_count'),
                DB::raw('MAX(receiving_date) as latest_completed_at'),
            ]);
    }

    private function unifiedQuery(Request $request, string $tab)
    {
        if ($request->filled('beneficiary_type') && ! in_array($request->input('beneficiary_type'), ['citizen', 'resident'], true)) {
            throw ValidationException::withMessages([
                'beneficiary_type' => ['صفة المستفيد يجب أن تكون مواطن أو مقيم.'],
            ]);
        }

        $permanent = DB::table('beneficiaries')
            ->leftJoinSub($this->completedSupportReceiptsByBeneficiary(), 'completed_receipts', function ($join) {
                $join->on('beneficiaries.id', '=', 'completed_receipts.beneficiary_id');
            })
            ->select([
                'beneficiaries.id',
                'beneficiaries.full_name',
                'beneficiaries.beneficiary_type',
                'beneficiaries.phone',
                'beneficiaries.street as address',
                'beneficiaries.district',
                'beneficiaries.family_status',
                'beneficiaries.nationality',
                'beneficiaries.city',
                'beneficiaries.status',
                'beneficiaries.priority',
                'beneficiaries.created_at',
                DB::raw("'permanent' as source"),
                'beneficiaries.archived_at',
                DB::raw('COALESCE(completed_receipts.completed_receipt_count, 0) as completed_receipt_count'),
                'completed_receipts.latest_completed_at',
            ])
            ->where(fn ($q) => $q->where('beneficiaries.is_employee', false)->orWhereNull('beneficiaries.is_employee'))
            ->where(fn ($q) => $q->where('beneficiaries.priority', '!=', 'employee')->orWhereNull('beneficiaries.priority'));
        $request->input('archived') === 'only'
            ? $permanent->whereNotNull('beneficiaries.archived_at')
            : $permanent->whereNull('beneficiaries.archived_at');
        $daily = DB::table('daily_beneficiaries')
            ->leftJoinSub($this->completedDailyReceiptsByBeneficiary(), 'daily_completed_receipts', function ($join) {
                $join->on('daily_beneficiaries.id', '=', 'daily_completed_receipts.daily_beneficiary_id');
            })
            ->select([
                'daily_beneficiaries.id',
                'daily_beneficiaries.full_name',
                'daily_beneficiaries.beneficiary_type',
                'daily_beneficiaries.phone',
                DB::raw('NULL as address'),
                'daily_beneficiaries.district',
                DB::raw('NULL as family_status'),
                'daily_beneficiaries.nationality',
                DB::raw('NULL as city'),
                'daily_beneficiaries.status',
                DB::raw('NULL as priority'),
                'daily_beneficiaries.created_at',
                DB::raw("'daily' as source"),
                DB::raw('NULL as archived_at'),
                DB::raw('COALESCE(daily_completed_receipts.completed_receipt_count, 0) as completed_receipt_count'),
                'daily_completed_receipts.latest_completed_at',
            ])
            ->whereNull('daily_beneficiaries.deleted_at');
        if ($request->input('archived') === 'only') {
            $daily->whereRaw('1 = 0');
        }
        $queries = $tab === 'permanent'
            ? [['domain' => 'permanent', 'query' => $permanent]]
            : ($tab === 'daily'
                ? [['domain' => 'daily', 'query' => $daily]]
                : [['domain' => 'permanent', 'query' => $permanent], ['domain' => 'daily', 'query' => $daily]]);
        foreach ($queries as $entry) {
            $domain = $entry['domain'];
            $query = $entry['query'];
            if ($request->filled('search')) {
                $term = trim($request->input('search'));
                $query->where(fn ($q) => $q->where('full_name', 'like', "%{$term}%")->orWhere('national_id', 'like', "%{$term}%")->orWhere('phone', 'like', "%{$term}%"));
            }
            if ($request->filled('status')) {
                $query->where('status', $request->input('status'));
            }
            if ($request->filled('district')) {
                $query->where('district', $request->input('district'));
            }
            if ($request->filled('city')) {
                $domain === 'permanent' ? $query->where('city', $request->input('city')) : $query->whereRaw('1 = 0');
            }
            if ($request->filled('priority')) {
                $domain === 'permanent' ? $query->where('priority', $request->input('priority')) : $query->whereRaw('1 = 0');
            }
            if ($request->filled('beneficiary_type')) {
                $query->where('beneficiary_type', $request->input('beneficiary_type'));
            }
            if ($request->filled('family_status')) {
                $domain === 'permanent'
                    ? $query->where('family_status', $request->input('family_status'))
                    : $query->whereRaw('1 = 0');
            }
            if ($request->filled('nationality')) {
                $query->whereRaw('TRIM(nationality) = ?', [trim((string) $request->input('nationality'))]);
            }
            if ((string) $request->input('nationality_missing') === '1') {
                $query->where(function ($inner) {
                    $inner->whereNull('nationality')->orWhereRaw("TRIM(nationality) = ''");
                });
            }
            if ($request->filled('date_from')) {
                $query->whereDate('created_at', '>=', $request->input('date_from'));
            }
            if ($request->filled('date_to')) {
                $query->whereDate('created_at', '<=', $request->input('date_to'));
            }
        }
        $result = array_shift($queries)['query'];
        foreach ($queries as $entry) {
            $result->unionAll($entry['query']);
        }

        return $result;
    }

    private function attachLatestCompletedReceipts($rows)
    {
        $permanentIds = [];
        $dailyIds = [];
        foreach ($rows as $row) {
            $row->completed_receipt_count = (int) $row->completed_receipt_count;
            $row->latest_completed_receipt = null;
            if ($row->completed_receipt_count < 1) {
                continue;
            }
            if ($row->source === 'daily') {
                $dailyIds[] = $row->id;
            } else {
                $permanentIds[] = $row->id;
            }
        }

        $permanent = $this->latestPermanentReceiptSummaries($permanentIds);
        $daily = $this->latestDailyReceiptSummaries($dailyIds);
        foreach ($rows as $row) {
            if ($row->completed_receipt_count < 1) {
                continue;
            }
            $row->latest_completed_receipt = $row->source === 'daily'
                ? ($daily[$row->id] ?? null)
                : ($permanent[$row->id] ?? null);
        }

        return $rows;
    }

    private function latestPermanentReceiptSummaries(array $ids): array
    {
        if ($ids === []) {
            return [];
        }

        $items = DB::table('support_distributions as d')
            ->join('support_receipts as r', 'r.support_distribution_id', '=', 'd.id')
            ->leftJoin('support_distribution_items as i', 'i.support_distribution_id', '=', 'd.id')
            ->leftJoin('inventory_items as inv', 'inv.id', '=', 'i.inventory_item_id')
            ->where('d.status', 'completed')
            ->where('d.recipient_type', 'beneficiary')
            ->whereIn('d.beneficiary_id', $ids)
            ->get([
                'd.beneficiary_id',
                'd.id as distribution_id',
                'd.completed_at',
                'inv.name as item_name',
                'i.fulfilled_quantity',
                'i.unit_snapshot',
            ]);

        $grouped = [];
        foreach ($items as $item) {
            $grouped[$item->beneficiary_id][] = $item;
        }

        $summaries = [];
        foreach ($grouped as $beneficiaryId => $group) {
            usort($group, function ($left, $right) {
                $byTime = strcmp((string) $right->completed_at, (string) $left->completed_at);
                if ($byTime !== 0) {
                    return $byTime;
                }

                return strcmp((string) $right->distribution_id, (string) $left->distribution_id);
            });
            $winnerId = $group[0]->distribution_id;
            $winnerItems = array_values(array_filter($group, fn ($item) => $item->distribution_id === $winnerId));
            $summaries[$beneficiaryId] = [
                'id' => $winnerId,
                'completed_at' => Carbon::parse($group[0]->completed_at)->toIso8601String(),
                'summary' => $this->formatPermanentReceiptSummary($winnerItems),
            ];
        }

        return $summaries;
    }

    private function formatPermanentReceiptSummary(array $items): string
    {
        $parts = [];
        foreach ($items as $item) {
            $quantity = $item->fulfilled_quantity;
            $quantityText = $quantity === null || $quantity === ''
                ? ''
                : rtrim(rtrim((string) $quantity, '0'), '.');
            $bits = array_filter([
                trim((string) ($item->item_name ?? '')),
                $quantityText,
                trim((string) ($item->unit_snapshot ?? '')),
            ], fn ($bit) => $bit !== '');
            if ($bits !== []) {
                $parts[] = implode(' ', $bits);
            }
        }

        return implode('؛ ', $parts);
    }

    private function latestDailyReceiptSummaries(array $ids): array
    {
        if ($ids === []) {
            return [];
        }

        $transactions = DB::table('daily_receiving_transactions')
            ->where('status', 'received')
            ->whereIn('daily_beneficiary_id', $ids)
            ->orderByDesc('receiving_date')
            ->orderByDesc('id')
            ->get(['id', 'daily_beneficiary_id', 'receiving_date', 'basket_type_name', 'quantity']);

        $summaries = [];
        foreach ($transactions as $transaction) {
            if (isset($summaries[$transaction->daily_beneficiary_id])) {
                continue;
            }
            $summaries[$transaction->daily_beneficiary_id] = [
                'id' => $transaction->id,
                'completed_at' => Carbon::parse($transaction->receiving_date)->toIso8601String(),
                'summary' => trim($transaction->basket_type_name.' '.$transaction->quantity),
            ];
        }

        return $summaries;
    }

    // ─── Index ───────────────────────────────────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        $query = Beneficiary::with(['dependents', 'distributions']);
        $request->input('archived') === 'only' ? $query->whereNotNull('archived_at') : $query->whereNull('archived_at');

        // Filter employees vs regular beneficiaries
        if ($request->input('type') === 'employee' || $request->input('priority') === 'employee') {
            $query->where(fn ($q) => $q->where('is_employee', true)->orWhere('priority', 'employee'));
        } else {
            $query->where(fn ($q) => $q->where('is_employee', false)->orWhereNull('is_employee'))
                ->where(fn ($q) => $q->where('priority', '!=', 'employee')->orWhereNull('priority'));
        }

        if ($request->filled('type') && ! in_array($request->type, ['employee', 'all'])) {
            $query->where('beneficiary_type', $request->type);
        }
        if ($request->filled('beneficiary_type') && $request->beneficiary_type !== 'all') {
            $query->where('beneficiary_type', $request->beneficiary_type);
        }
        if ($request->filled('city') && $request->city !== 'all') {
            $query->where('city', 'like', "%{$request->city}%");
        }
        if ($request->filled('district') && $request->district !== 'all') {
            $query->where('district', 'like', "%{$request->district}%");
        }
        if ($request->filled('priority') && $request->priority !== 'all') {
            $query->where('priority', $request->priority);
        }
        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }
        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(fn ($q) => $q->where('full_name', 'like', "%{$s}%")
                ->orWhere('national_id', 'like', "%{$s}%")
                ->orWhere('phone', 'like', "%{$s}%")
            );
        }

        $perPage = intval($request->input('per_page', 500));
        if ($perPage <= 0 || $request->boolean('all')) {
            return response()->json(['data' => $query->latest()->get()]);
        }

        return response()->json(['data' => $query->latest()->paginate($perPage)]);
    }

    // ─── Store ───────────────────────────────────────────────────────────────

    public function store(Request $request): JsonResponse
    {
        try {
            $request->validate(['reviewed_confirmation' => 'required|accepted']);
            $this->normalizeInputs($request);
            $this->applyDerivedClassification($request);

            $validated = $request->validate($this->rules(), $this->messages());
            $validated = $this->sanitizeFinancialSources($validated);

            // POLICY-B: preserve the raw direct monthly rent input. The legacy flow
            // overwrites monthly_rent with its computed preview below; the authoritative
            // policy calculator reads this trusted input column instead of the clobbered
            // preview (rent normalization must never trust the executed legacy value).
            $validated['confirmed_at'] = now();
            $validated['confirmed_by'] = $request->user()->id;
            $validated['monthly_rent_direct_input'] = $validated['monthly_rent'] ?? null;

            if (empty($validated['full_name']) && ! empty($request->input('name'))) {
                $validated['full_name'] = $request->input('name');
            }

            if (! empty($request->input('iban'))) {
                $validated['iban_encrypted'] = Crypt::encryptString($request->input('iban'));
            }

            if (empty($validated['created_by'])) {
                $validated['created_by'] = $request->user()?->id ?? User::first()?->id;
            }

            // احتساب البيانات المالية والتصنيف الاستحقاقي عبر FinancialCalculationService
            $calcService = app(FinancialCalculationService::class);
            $financials = $calcService->calculate($validated);

            $validated['total_income'] = $financials['total_income'];
            $validated['monthly_rent'] = $financials['monthly_rent'];
            $validated['net_income'] = $financials['net_income'];
            $validated['priority'] = $financials['priority'];
            $validated['category_id'] = $financials['category_id'];

            $validated = array_merge($validated, $this->handleUploads($request));

            // حفظ المستفيد والتابعين داخل معاملة قاعدة بيانات متكاملة
            $beneficiary = DB::transaction(function () use ($validated, $request) {
                $b = Beneficiary::create($validated);
                $this->storeDependentsFromRequest($request, $b);
                AuditLog::create(['user_id' => $request->user()->id, 'action' => 'BENEFICIARY_REGISTRATION_CONFIRMED',
                    'target_table' => 'beneficiaries', 'target_id' => $b->id, 'details' => []]);

                // POLICY-E4: explicit future-beneficiary policy application. Runs
                // only after the registration row (and its dependents) exist and
                // NEVER breaks a valid registration: a recoverable evaluation
                // failure is recorded for follow-up inside the service.
                app(PolicyRegistrationEvaluationService::class)->evaluateNewBeneficiary(
                    $b,
                    $request->user()?->id ?? $validated['created_by'] ?? null,
                );

                return $b;
            });

            // تسجيل العملية في سجل التدقيق
            \Log::info('Beneficiary registered.', [
                'beneficiary_id' => $beneficiary->id,
                'created_by' => $validated['created_by'],
            ]);

            return response()->json([
                'success' => true,
                'message' => 'تمت إضافة وحفظ المستفيد والبيانات الأسرية بنجاح.',
                'data' => $beneficiary->load('dependents'),
            ], 201);
        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'خطأ في التحقق من البيانات المطلوبة',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            \Log::error('Beneficiary registration failed.', ['exception' => $e::class]);

            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ أثناء حفظ البيانات: '.$e->getMessage(),
                'error' => config('app.debug') ? $e->getMessage() : 'خطأ في الخادم',
            ], 500);
        }
    }

    private function storeDependentsFromRequest(Request $request, Beneficiary $beneficiary): void
    {
        $dependents = $request->input('dependents', []);

        if (empty($dependents) || ! is_array($dependents)) {
            return;
        }

        foreach ($dependents as $dep) {
            if (! empty($dep['name'])) {
                $beneficiary->dependents()->create([
                    'name' => $dep['name'],
                    'relationship' => $dep['relationship'] ?? null,
                    'date_of_birth' => $dep['date_of_birth'] ?? null,
                ]);
            }
        }
    }

    // ─── Auto-classify helper ─────────────────────────────────────────────────

    private function classifyPriority(array $data): string
    {
        if (! empty($data['is_employee'])) {
            return 'employee';
        }

        if (! empty($data['has_special_needs']) || ! empty($data['is_special_needs'])) {
            return 'special_needs';
        }

        if (! empty($data['date_of_birth'])) {
            try {
                $dob = Carbon::parse($data['date_of_birth']);
                $elderlyAge = (int) (DB::table('settings')->where('key', 'elderly_min_age')->value('value') ?? 60);
                if ($dob->age >= $elderlyAge) {
                    return 'elderly';
                }
            } catch (\Throwable) {
            }
        }

        $income =
            (float) ($data['monthly_salary'] ?? 0) +
            (float) ($data['citizen_account_amount'] ?? 0) +
            (float) ($data['social_security_amount'] ?? 0) +
            (float) ($data['retirement_pension'] ?? 0) +
            (float) ($data['family_support'] ?? 0);

        $firstMax = (float) (DB::table('settings')->where('key', 'first_class_max_income')->value('value') ?? 3000);
        $secondMax = (float) (DB::table('settings')->where('key', 'second_class_max_income')->value('value') ?? 6000);

        if ($income <= $firstMax) {
            return 'first_class';
        }
        if ($income <= $secondMax) {
            return 'second_class';
        }

        return 'second_class';
    }

    private function getCategoryIdForPriority(string $priority): ?string
    {
        $map = [
            'first_class' => 'درجة أولى',
            'second_class' => 'درجة ثانية',
            'special_needs' => 'ذوي الاحتياجات الخاصة',
            'elderly' => 'كبار السن',
            'employee' => 'عامل بالجمعية',
        ];

        $name = $map[$priority] ?? 'درجة أولى';
        $category = Category::where('name', 'like', "%{$name}%")->first();
        if (! $category) {
            $category = Category::firstOrCreate(
                ['name' => $name],
                ['description' => 'فئة تلقائية بالنظام', 'basket_entitlement_per_period' => 1]
            );
        }

        return $category?->id;
    }

    // ─── Show ─────────────────────────────────────────────────────────────────

    public function show(Beneficiary $beneficiary): JsonResponse
    {
        return response()->json([
            'data' => $beneficiary->load(['dependents', 'distributions.basket']),
        ]);
    }

    // ─── Update ──────────────────────────────────────────────────────────────

    public function update(Request $request, Beneficiary $beneficiary): JsonResponse
    {
        try {
            $this->normalizeInputs($request);
            $this->applyDerivedClassification($request, $beneficiary);

            $rules = $this->rules($beneficiary->id);
            $validated = $request->validate($rules, $this->messages());
            $validated = $this->sanitizeFinancialSources($validated, $beneficiary);

            // POLICY-B: capture the raw direct monthly rent input when the request
            // explicitly provides it (additive; legacy preview flow is untouched).
            if ($request->exists('monthly_rent')) {
                $validated['monthly_rent_direct_input'] = $request->input('monthly_rent');
            }

            if (! empty($request->input('iban'))) {
                $validated['iban_encrypted'] = Crypt::encryptString($request->input('iban'));
            }

            $validated = array_merge($validated, $this->handleUploads($request, $beneficiary));

            // احتساب البيانات المالية والتصنيف الاستحقاقي
            $mergedForCalc = array_merge($beneficiary->toArray(), $validated);
            $calcService = app(FinancialCalculationService::class);
            $financials = $calcService->calculate($mergedForCalc);

            $validated['total_income'] = $financials['total_income'];
            $validated['monthly_rent'] = $financials['monthly_rent'];
            $validated['net_income'] = $financials['net_income'];
            $validated['priority'] = $financials['priority'];
            $validated['category_id'] = $financials['category_id'];

            DB::transaction(function () use ($beneficiary, $validated, $request) {
                $beneficiary->update($validated);

                if ($request->has('dependents') && is_array($request->input('dependents'))) {
                    $newDependents = array_filter($request->input('dependents'), fn ($d) => ! empty($d['name']));
                    // Only update/replace if valid dependents list is passed
                    $beneficiary->dependents()->delete();
                    foreach ($newDependents as $dep) {
                        $beneficiary->dependents()->create([
                            'name' => $dep['name'],
                            'relationship' => $dep['relationship'] ?? null,
                            'date_of_birth' => $dep['date_of_birth'] ?? null,
                        ]);
                    }
                }
            });

            \Log::info('Beneficiary updated.', ['beneficiary_id' => $beneficiary->id]);

            return response()->json([
                'success' => true,
                'message' => 'تم تعديل بيانات المستفيد بنجاح.',
                'data' => $beneficiary->fresh()->load('dependents'),
            ]);
        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'خطأ في التحقق من البيانات أثناء التعديل',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'تعذر تعديل المستفيد: '.$e->getMessage(),
            ], 500);
        }
    }

    // ─── Destroy ─────────────────────────────────────────────────────────────

    public function destroy(Request $request, Beneficiary $beneficiary): JsonResponse
    {
        $data = $request->validate(['archive_reason' => 'nullable|string|max:500']);

        return DB::transaction(function () use ($request, $beneficiary, $data) {
            $record = Beneficiary::whereKey($beneficiary->id)->lockForUpdate()->firstOrFail();
            if (! $record->archived_at) {
                $record->update(['archived_at' => now(), 'archived_by' => $request->user()->id,
                    'archive_reason' => $data['archive_reason'] ?? null]);
                AuditLog::create(['user_id' => $request->user()->id, 'action' => 'BENEFICIARY_ARCHIVED',
                    'target_table' => 'beneficiaries', 'target_id' => $record->id, 'details' => []]);
            }

            return response()->json(['success' => true, 'message' => 'تمت أرشفة المستفيد مع حفظ سجلاته.', 'data' => $record]);
        });
    }

    public function supportHistory(Request $request, Beneficiary $beneficiary): JsonResponse
    {
        abort_unless($request->user()->role === 'admin' || ($request->user()->permissions['support']['view'] ?? false) === true, 403);

        return response()->json(['data' => SupportDistribution::with('items')->where('beneficiary_id', $beneficiary->id)->latest()->get()]);
    }

    public function restore(Request $request, Beneficiary $beneficiary): JsonResponse
    {
        return DB::transaction(function () use ($request, $beneficiary) {
            $record = Beneficiary::whereKey($beneficiary->id)->lockForUpdate()->firstOrFail();
            if ($record->archived_at) {
                $record->update(['archived_at' => null, 'archived_by' => null, 'archive_reason' => null]);
                AuditLog::create(['user_id' => $request->user()->id, 'action' => 'BENEFICIARY_RESTORED',
                    'target_table' => 'beneficiaries', 'target_id' => $record->id, 'details' => []]);
            }

            return response()->json(['success' => true, 'data' => $record]);
        });
    }

    // ─── Dependents ──────────────────────────────────────────────────────────

    public function storeDependent(Request $request, Beneficiary $beneficiary): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'relationship' => 'nullable|string|max:100',
            'date_of_birth' => 'nullable|date',
        ]);

        $dep = $beneficiary->dependents()->create($data);

        return response()->json(['success' => true, 'data' => $dep], 201);
    }

    public function destroyDependent(Beneficiary $beneficiary, Dependent $dependent): JsonResponse
    {
        $beneficiary->dependents()->findOrFail($dependent->id)->delete();

        return response()->json(['success' => true, 'message' => 'تم حذف المعال.']);
    }

    // ─── Check National ID ───────────────────────────────────────────────────

    public function checkNationalId($nationalId): JsonResponse
    {
        $exists = Beneficiary::where('national_id', $nationalId)->exists();

        return response()->json([
            'success' => true,
            'exists' => $exists,
            'available' => ! $exists,
            'message' => $exists ? 'رقم الهوية مسجل مسبقاً' : 'رقم الهوية متاح',
        ]);
    }

    // ─── Extract OCR ─────────────────────────────────────────────────────────

    public function extractOcrData(Request $request): JsonResponse
    {
        $request->validate([
            'image' => 'required|file|image|max:10240',
            'type' => 'nullable|string',
        ]);

        return response()->json([
            'success' => true,
            'data' => [
                'full_name' => null,
                'national_id' => null,
                'date_of_birth' => null,
                'place_of_birth' => null,
                'nationality' => null,
            ],
        ]);
    }

    // ─── Excel Import ────────────────────────────────────────────────────────

    public function importExcel(Request $request): JsonResponse
    {
        $request->validate(['reviewed_confirmation' => 'required|accepted']);

        return response()->json([
            'success' => false,
            'message' => 'استيراد المستفيدين يتم عبر الاستيراد المرن فقط.',
        ], 422);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private function normalizeInputs(Request $request): void
    {
        $merge = [];
        if (empty($request->input('full_name')) && ! empty($request->input('name'))) {
            $merge['full_name'] = $request->input('name');
        }
        if (empty($request->input('beneficiary_type')) && ! empty($request->input('type'))) {
            $merge['beneficiary_type'] = $request->input('type');
        }
        if (empty($request->input('working_members_count')) && $request->has('working_count')) {
            $merge['working_members_count'] = $request->input('working_count');
        }
        if (empty($request->input('non_working_children_count')) && $request->has('non_working_children')) {
            $merge['non_working_children_count'] = $request->input('non_working_children');
        }
        if (empty($request->input('social_security_amount')) && $request->has('social_security')) {
            $merge['social_security_amount'] = $request->input('social_security');
        }
        if (empty($request->input('citizen_account_amount')) && $request->has('citizen_account')) {
            $merge['citizen_account_amount'] = $request->input('citizen_account');
        }

        $numericFields = [
            'family_members_count', 'wives_count', 'working_members_count',
            'non_working_children_count', 'annual_rent_amount', 'monthly_salary',
            'citizen_account_amount', 'social_security_amount', 'retirement_pension',
            'family_support',
        ];
        foreach ($numericFields as $f) {
            if ($request->has($f) && ($request->input($f) === '' || $request->input($f) === 'null')) {
                $merge[$f] = null;
            }
        }

        if (count($merge) > 0) {
            $request->merge($merge);
        }
    }

    private function applyDerivedClassification(Request $request, ?Beneficiary $existing = null): void
    {
        $classification = Beneficiary::classificationFromNationality(
            $request->input('nationality'),
            $request->input('beneficiary_type'),
            $request->input('type'),
        );
        if ($existing !== null && $classification['nationality'] !== trim((string) $existing->nationality)) {
            $request->validate(['reviewed_confirmation' => 'required|accepted']);
        }
        $request->merge($classification);
    }

    private function rules(?string $ignoreId = null): array
    {
        return [
            // ─── البيانات الأساسية الإلزامية (Basic Information) ───
            'full_name' => 'required|string|max:150',
            'national_id' => [
                'required',
                'string',
                'max:20',
                $ignoreId ? Rule::unique('beneficiaries', 'national_id')->ignore($ignoreId) : 'unique:beneficiaries,national_id',
            ],
            'phone' => 'required|string|max:20',
            'beneficiary_type' => 'required|in:citizen,resident',
            'city' => 'required|string|max:100',
            'district' => 'required|string|max:100',
            'street' => 'required|string|max:150',
            'nationality' => 'required|string|max:100',
            'date_of_birth' => 'required|date|before_or_equal:today',
            'place_of_birth' => 'nullable|string|max:100',
            'profession' => 'nullable|string|max:100',

            // ─── بيانات الأسرة والسكن الإلزامية (Family Information) ───
            'family_status' => 'required|string|max:50',
            'family_members_count' => 'required|integer|min:1',
            'housing_type' => 'required|in:rent,own,charitable_housing',
            'annual_rent_amount' => 'required_if:housing_type,rent|nullable|numeric|min:0',
            'monthly_rent' => 'nullable|numeric|min:0',
            'wives_count' => 'nullable|integer|min:0|max:4',
            'working_members_count' => 'nullable|integer|min:0',
            'non_working_children_count' => 'nullable|integer|min:0',
            'father_status' => 'nullable|string',
            'mother_status' => 'nullable|string',
            'owns_house' => 'nullable|boolean',

            // ─── الفئة والحالة ───
            'status' => 'nullable|in:active,suspended,under_review',
            'priority' => 'nullable|in:first_class,second_class,special_needs,elderly,employee',
            'category_id' => 'nullable|uuid',
            'has_special_needs' => 'nullable|boolean',
            'is_special_needs' => 'nullable|boolean',
            'is_elderly' => 'nullable|boolean',
            'is_employee' => 'nullable|boolean',

            // ─── البيانات المالية (Financial Information) ───
            'income_sources' => 'nullable|array',
            'income_sources.*' => 'string|in:salary,retirement,citizen_account,social_security,family_support',
            'monthly_salary' => 'nullable|numeric|min:0',
            'citizen_account_amount' => 'nullable|numeric|min:0',
            'social_security_amount' => 'nullable|numeric|min:0',
            'retirement_pension' => 'nullable|numeric|min:0',
            'family_support' => 'nullable|numeric|min:0',
            'bank_name' => 'nullable|string|max:100',
            'iban' => 'nullable|string|max:34',

            // ─── المعالون وأفراد الأسرة ───
            'dependents' => 'nullable|array',
            'dependents.*.name' => 'required|string|max:255',
            'dependents.*.relationship' => 'nullable|string|max:100',
            'dependents.*.date_of_birth' => 'nullable|date',

            // ─── الملفات المرفوعة ───
            'national_id_image' => 'nullable|file|image|max:5120',
            'residence_id_image' => 'nullable|file|image|max:5120',
            'citizen_account_image' => 'nullable|file|image|max:5120',
            'social_security_image' => 'nullable|file|image|max:5120',
            'pension_certificate_image' => 'nullable|file|mimes:pdf,jpg,jpeg,png|max:5120',
            'national_address_image' => 'nullable|file|image|max:5120',
            'rental_contract_image' => 'nullable|file|mimes:pdf,jpg,jpeg,png|max:5120',
            'electricity_bill_image' => 'nullable|file|image|max:5120',
            'salary_certificate' => 'nullable|file|mimes:pdf,jpg,jpeg,png|max:5120',
        ];
    }

    private function messages(): array
    {
        return [
            // البيانات الأساسية
            'full_name.required' => 'اسم المستفيد الكامل مطلوب.',
            'national_id.required' => 'رقم الهوية الوطنية أو الإقامة مطلوب.',
            'national_id.unique' => 'رقم الهوية/الإقامة مسجل مسبقاً في النظام.',
            'phone.required' => 'رقم الجوال مطلوب للتواصل.',
            'beneficiary_type.required' => 'يرجى تحديد صفة المستفيد (مواطن / مقيم).',
            'beneficiary_type.in' => 'صفة المستفيد يجب أن تكون مواطن أو مقيم.',
            'city.required' => 'المدينة مطلوبة.',
            'district.required' => 'الحي السكني مطلوب.',
            'street.required' => 'الشارع أو العنوان التفصيلي مطلوب.',
            'nationality.required' => 'الجنسية مطلوبة.',
            'date_of_birth.required' => 'تاريخ الميلاد مطلوب.',
            'date_of_birth.date' => 'تاريخ الميلاد غير صالح.',
            'date_of_birth.before_or_equal' => 'تاريخ الميلاد لا يمكن أن يكون في المستقبل.',

            // بيانات الأسرة والسكن
            'family_status.required' => 'الحالة الأسرية مطلوبة.',
            'family_members_count.required' => 'عدد أفراد الأسرة مطلوب.',
            'family_members_count.min' => 'عدد أفراد الأسرة يجب أن يكون 1 على الأقل.',
            'housing_type.required' => 'يرجى تحديد نوع السكن.',
            'housing_type.in' => 'نوع السكن المحدد غير صالح.',
            'annual_rent_amount.required_if' => 'قيمة الإيجار السنوي مطلوبة عند اختيار نوع السكن إيجار.',
            'annual_rent_amount.min' => 'قيمة الإيجار لا يمكن أن تكون بالسالب.',
            'monthly_salary.min' => 'الراتب الشهري لا يمكن أن يكون قيمة سالبة.',
            'citizen_account_amount.min' => 'مبلغ حساب المواطن لا يمكن أن يكون سالباً.',
            'social_security_amount.min' => 'مبلغ الضمان الاجتماعي لا يمكن أن يكون سالباً.',
            'retirement_pension.min' => 'معاش التقاعد لا يمكن أن يكون سالباً.',
            'family_support.min' => 'دعم الأسرة لا يمكن أن يكون سالباً.',
        ];
    }

    private function sanitizeFinancialSources(array $validated, ?Beneficiary $existing = null): array
    {
        $type = $validated['beneficiary_type'] ?? $existing?->beneficiary_type;
        if (! in_array($type, ['citizen', 'resident'], true)) {
            throw ValidationException::withMessages([
                'nationality' => ['الجنسية مطلوبة.'],
            ]);
        }
        $allowed = $type === 'resident'
            ? ['salary', 'family_support']
            : ['salary', 'retirement', 'citizen_account', 'social_security', 'family_support'];
        $sources = array_values(array_intersect($allowed, $validated['income_sources'] ?? []));
        $validated['income_sources'] = $sources;

        foreach ([
            'salary' => 'monthly_salary',
            'retirement' => 'retirement_pension',
            'citizen_account' => 'citizen_account_amount',
            'social_security' => 'social_security_amount',
            'family_support' => 'family_support',
        ] as $source => $field) {
            if (! in_array($source, $sources, true)) {
                $validated[$field] = 0;
            }
        }

        return $validated;
    }

    private function handleUploads(Request $request, ?Beneficiary $existing = null): array
    {
        $fields = [
            'national_id_image' => 'national_id_image_url',
            'residence_id_image' => 'residence_id_image_url',
            'citizen_account_image' => 'citizen_account_image_url',
            'social_security_image' => 'social_security_image_url',
            'pension_certificate_image' => 'pension_certificate_image_url',
            'national_address_image' => 'national_address_image_url',
            'rental_contract_image' => 'rental_contract_image_url',
            'electricity_bill_image' => 'electricity_bill_image_url',
            'salary_certificate' => 'salary_certificate_url',
        ];

        $result = [];
        foreach ($fields as $input => $column) {
            if ($request->hasFile($input)) {
                if ($existing && $existing->{$column}) {
                    Storage::disk('public')->delete($existing->getRawOriginal($column));
                }
                $result[$column] = $request->file($input)->store('beneficiaries', 'public');
            }
        }

        return $result;
    }

    private function deleteUploads(Beneficiary $beneficiary): void
    {
        $columns = [
            'national_id_image_url', 'residence_id_image_url',
            'citizen_account_image_url', 'social_security_image_url',
            'pension_certificate_image_url', 'national_address_image_url',
            'rental_contract_image_url', 'electricity_bill_image_url',
            'salary_certificate_url',
        ];
        foreach ($columns as $col) {
            if ($beneficiary->{$col}) {
                Storage::disk('public')->delete($beneficiary->getRawOriginal($col));
            }
        }
    }
}
