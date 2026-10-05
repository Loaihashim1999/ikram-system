<?php
namespace App\Services;

use App\Http\Controllers\AnalyticsController;
use App\Models\{Beneficiary, Category, Distribution, DailyBeneficiary, DailyReceivingTransaction, InventoryItem, InventoryMovement, DailyInventoryItem, DailyInventoryMovement, Organization, Staff, AuditLog, Notification, User};
use Illuminate\Http\Request;

class GovernanceReportService
{
    public function build(Request $request): array
    {
        $response = app(AnalyticsController::class)->index($request);
        abort_if($response->getStatusCode() !== 200, 422, 'Invalid reporting period');
        $analytics = $response->getData(true);
        $start = $analytics['period']['start_date'].' 00:00:00';
        $end = $analytics['period']['end_date'].' 23:59:59.999999';
        $period = [$start, $end];
        $beneficiaries = Beneficiary::with('category')->get();
        $scheduled = Distribution::whereBetween('scheduled_at', $period)->get();
        $received = Distribution::whereBetween('delivered_at', $period)->where('status', 'delivered')->get();
        $group = fn($rows, $field) => $rows->groupBy(fn($r) => $r->{$field} ?? 'غير مسجل')->map->count()->sortDesc()->all();
        $breakdowns = [];
        foreach (['status', 'beneficiary_type', 'nationality', 'city', 'district', 'family_status', 'family_members_count', 'housing_type', 'profession', 'priority'] as $field) {
            $breakdowns[$field] = $group($beneficiaries, $field);
        }
        $quality = [
            'missing_district' => $beneficiaries->filter(fn($b) => !$b->district)->count(),
            'missing_category' => $beneficiaries->whereNull('category_id')->count(),
            'missing_birth_date' => $beneficiaries->whereNull('date_of_birth')->count(),
            'negative_net_income' => $beneficiaries->filter(fn($b) => $b->net_income < 0)->count(),
            'delivered_without_date' => Distribution::where('status', 'delivered')->whereNull('delivered_at')->count(),
        ];
        $categoryVariants = Category::whereIn('name', ['ذوي الاحتياجات الخاصة', 'ذوو الاحتياجات الخاصة'])->get(['id', 'name']);
        $completion = $scheduled->count() ? round(100 * $scheduled->where('status', 'delivered')->count() / $scheduled->count(), 1) : null;
        $from = \Carbon\Carbon::parse($start);
        $to = \Carbon\Carbon::parse($end);
        $days = (int) $from->copy()->startOfDay()->diffInDays($to->copy()->startOfDay()) + 1;
        $previousEnd = $from->copy()->subMicrosecond();
        $previousStart = $from->copy()->subDays($days);
        $previousRegistrations = Beneficiary::whereBetween('created_at', [$previousStart, $previousEnd])->count();
        $currentRegistrations = $analytics['beneficiaries']['registered_in_period'];
        $growth = $previousRegistrations > 0 ? round(100 * ($currentRegistrations - $previousRegistrations) / $previousRegistrations, 1) : null;
        $receivedPeople = $received->pluck('beneficiary_id')->unique()->count();
        $open = $scheduled->where('status', 'scheduled');
        $overdue = $open->filter(fn($d) => $d->scheduled_at->lt(now()))->count();
        $totalStockItems = $analytics['inventory']['main']['total_items'] + $analytics['inventory']['daily']['total_items'];
        $lowStockItems = $analytics['inventory']['main']['low_stock_count'] + $analytics['inventory']['daily']['low_stock_count'];
        $rentersWithIncome = $beneficiaries->filter(fn($b) => $b->housing_type === 'rent' && $b->total_income > 0);
        $rentBurden = $rentersWithIncome->count() ? round($rentersWithIncome->avg(fn($b) => 100 * $b->monthly_rent / $b->total_income), 1) : null;
        $completeCount = $beneficiaries->filter(fn($b) => $b->district && $b->category_id && $b->date_of_birth)->count();
        $indicators = [
            ['label'=>'نمو التسجيل', 'value'=>$growth, 'unit'=>'%', 'scope'=>'الفترة مقارنة بالفترة السابقة المساوية لها', 'formula'=>'(التسجيل الحالي − السابق) ÷ السابق × 100', 'note'=>$previousRegistrations ? 'المقارنة مع '.$previousRegistrations.' تسجيل في الفترة السابقة.' : 'لا توجد تسجيلات في فترة المقارنة؛ لا يمكن حساب نسبة نمو.'],
            ['label'=>'نسبة إكمال الجدولة', 'value'=>$completion, 'unit'=>'%', 'scope'=>'المجدول خلال الفترة وحالته الحالية', 'formula'=>'عمليات الجدولة المسلمة ÷ جميع العمليات المجدولة × 100', 'note'=>'يشمل المقام الإلغاء وعدم الحضور؛ ليست نسبة تسليم تاريخية عند نهاية الفترة.'],
            ['label'=>'العمليات المتأخرة', 'value'=>$overdue, 'unit'=>'عملية', 'scope'=>'مجدولة خلال الفترة وغير مسلمة حتى الآن', 'formula'=>'عدد الحالات scheduled التي تجاوز موعدها وقت الإنشاء', 'note'=>'مؤشر لمراجعة الأعمال المعلقة وليس حكماً على سبب التأخير.'],
            ['label'=>'متوسط مرات الاستلام', 'value'=>$receivedPeople ? round($received->count()/$receivedPeople,2) : null, 'unit'=>'عملية / مستفيد', 'scope'=>'عمليات مسلمة فعلياً خلال الفترة', 'formula'=>'عمليات الاستلام ÷ المستفيدين الفريدين المستلمين', 'note'=>'لا يشمل المستفيدين اليوميين منعاً لخلط السجلين أو تكرار الأفراد.'],
            ['label'=>'عبء الإيجار على الدخل', 'value'=>$rentBurden, 'unit'=>'%', 'scope'=>'لقطة حالية للمستأجرين ذوي الدخل الموجب', 'formula'=>'متوسط (الإيجار الشهري ÷ الدخل الشهري × 100)', 'note'=>'حجم العينة '.$rentersWithIncome->count().'؛ يستبعد الدخل الصفري والمفقود.'],
            ['label'=>'اكتمال بيانات التحليل', 'value'=>$beneficiaries->count() ? round(100*$completeCount/$beneficiaries->count(),1) : null, 'unit'=>'%', 'scope'=>'جميع المستفيدين حالياً', 'formula'=>'سجلات تحتوي الحي والفئة وتاريخ الميلاد ÷ السجلات × 100', 'note'=>'مؤشر جودة لهذه الحقول الثلاثة فقط؛ لا يقرر أهلية المستفيد.'],
            ['label'=>'نسبة أصناف المخزون المنخفض', 'value'=>$totalStockItems ? round(100*$lowStockItems/$totalStockItems,1) : null, 'unit'=>'%', 'scope'=>'لقطة حالية للمخزون العام واليومي', 'formula'=>'أصناف عند حدها الأدنى أو أدناه ÷ جميع الأصناف × 100', 'note'=>'النسبة بعدد الأصناف، ولا تجمع وحدات مخزون مختلفة.'],
        ];
        $districtDemand = $beneficiaries->groupBy(fn($b) => $b->district ?: 'غير مسجل')->map->count()->sortDesc();
        $topDistricts = $districtDemand->take(8)->all();
        if ($districtDemand->count() > 8) $topDistricts['أحياء أخرى'] = $districtDemand->slice(8)->sum();
        $timeline = [];
        $cursor = $from->copy()->startOfMonth();
        while ($cursor->lte($to)) {
            $bin = [$cursor->copy()->max($from), $cursor->copy()->endOfMonth()->min($to)];
            $timeline[] = ['label'=>$cursor->format('Y-m'), 'registrations'=>Beneficiary::whereBetween('created_at',$bin)->count(), 'receipts'=>Distribution::where('status','delivered')->whereBetween('delivered_at',$bin)->count()];
            $cursor->addMonth();
        }
        $insights = [
            'تم تسجيل '.$analytics['beneficiaries']['registered_in_period'].' مستفيد خلال الفترة المحددة.',
            $completion === null ? 'لا توجد توزيعات مجدولة في الفترة لحساب نسبة الإكمال.' : 'نسبة الإكمال الحالية للتوزيعات المجدولة خلال الفترة: '.$completion.'%.',
            'سجلات المستفيدين التي تفتقد الحي: '.$quality['missing_district'].'.',
            'أصناف المخزون المنخفض حالياً: '.($analytics['inventory']['main']['low_stock_count'] + $analytics['inventory']['daily']['low_stock_count']).'.',
        ];
        if ($growth !== null) $insights[] = 'تغير التسجيل بنسبة '.$growth.'% مقارنة بالفترة السابقة المساوية.';
        $insights[] = 'عمليات الجدولة المتأخرة حالياً ضمن الفترة: '.$overdue.'.';
        // Explicit export columns exclude credentials, encrypted banking data, OCR and document paths.
        $datasets = [
            'beneficiaries_snapshot' => $beneficiaries->map(fn($b) => collect($b->toArray())->only(['id','full_name','beneficiary_type','status','category_id','city','district','nationality','family_members_count','housing_type','monthly_salary','total_income','monthly_rent','net_income','created_at'])->all())->all(),
            'registrations_period' => $beneficiaries->filter(fn($b) => $b->created_at->betweenIncluded($start, $end))->map->only(['id','full_name','created_at'])->values()->all(),
            'scheduled_period' => $scheduled->map->only(['id','beneficiary_id','basket_id','status','scheduled_at','delivered_at','driver_id'])->all(),
            'received_period' => $received->map->only(['id','beneficiary_id','basket_id','status','scheduled_at','delivered_at'])->all(),
            'daily_activity_period' => DailyReceivingTransaction::whereBetween('receiving_date', $period)->get(['id','daily_beneficiary_id','quantity','basket_type_name','receiving_date','status'])->toArray(),
            'main_stock_snapshot' => InventoryItem::get(['id','name','unit','current_quantity','min_threshold'])->toArray(),
            'daily_stock_snapshot' => DailyInventoryItem::get(['id','name','unit','current_quantity','reserved_quantity','min_threshold','expiry_date','status'])->toArray(),
            'main_movements_period' => InventoryMovement::whereBetween('created_at', $period)->get(['id','inventory_item_id','type','quantity','reason','created_at'])->toArray(),
            'daily_movements_period' => DailyInventoryMovement::whereBetween('created_at', $period)->get()->map->only(['id','daily_inventory_item_id','type','quantity','created_at'])->all(),
            'organizations_snapshot' => Organization::get(['id','name','code','status','created_at'])->toArray(),
            'staff_snapshot' => Staff::get(['id','name','department','job_title','status','hire_date'])->toArray(),
        ];
        return compact('analytics', 'breakdowns', 'quality', 'categoryVariants', 'completion', 'insights', 'datasets', 'indicators', 'topDistricts', 'timeline') + [
            'generated_at' => now()->format('Y-m-d H:i:s T'),
            'generated_by' => $request->user()?->full_name ?? 'System',
            'finance' => ['total_income' => $beneficiaries->sum('total_income'), 'monthly_rent' => $beneficiaries->sum('monthly_rent'), 'net_income' => $beneficiaries->sum('net_income'), 'average_income' => $beneficiaries->avg('total_income')],
            'received_operations' => $received->count(),
            'received_beneficiaries' => $received->pluck('beneficiary_id')->unique()->count(),
            'scheduled_statuses' => $group($scheduled, 'status'),
            'audit_actions' => $group(AuditLog::whereBetween('created_at', $period)->get(['action']), 'action'),
            'notifications' => ['total' => Notification::whereBetween('created_at', $period)->count(), 'unread' => Notification::whereBetween('created_at', $period)->whereNull('read_at')->count()],
            'users_active' => User::where('is_active', true)->count(),
            'daily_snapshot_count' => DailyBeneficiary::count(),
        ];
    }
}
