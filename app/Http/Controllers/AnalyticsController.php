<?php

namespace App\Http\Controllers;

use App\Models\Beneficiary;
use App\Models\Category;
use App\Models\DailyBeneficiary;
use App\Models\DailyInventoryItem;
use App\Models\DailyInventoryMovement;
use App\Models\DailyReceivingTransaction;
use App\Models\Distribution;
use App\Models\Driver;
use App\Models\InventoryItem;
use App\Models\InventoryMovement;
use App\Models\NeighborhoodRep;
use App\Models\Staff;
use App\Models\StaffDistribution;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AnalyticsController extends Controller
{
    /**
     * استرجاع كافة المؤشرات والتحليلات الشاملة بناءً على النطاق الزمني المحدد
     */
    public function index(Request $request): JsonResponse
    {
        $periodType = $request->get('period_type', 'custom'); // daily, weekly, monthly, yearly, custom
        $today = Carbon::today();

        // التحقق من صحة تواريخ النطاق الزمني
        if ($request->filled('start_date') && $request->filled('end_date')) {
            try {
                $sTest = Carbon::parse($request->start_date)->startOfDay();
                $eTest = Carbon::parse($request->end_date)->endOfDay();
                if ($sTest->gt($eTest)) {
                    return response()->json([
                        'success' => false,
                        'message' => 'تاريخ البداية لا يمكن أن يكون بعد تاريخ النهاية.',
                    ], 422);
                }
            } catch (\Exception $e) {
                return response()->json([
                    'success' => false,
                    'message' => 'صيغة التاريخ غير صالحة.',
                ], 422);
            }
        }

        // تحديد النطاق الزمني (Start Date & End Date)
        switch ($periodType) {
            case 'daily':
                $startDate = $request->filled('date') ? Carbon::parse($request->date)->startOfDay() : $today->copy()->startOfDay();
                $endDate = $startDate->copy()->endOfDay();
                break;
            case 'weekly':
                if ($request->filled('start_date') && $request->filled('end_date')) {
                    $startDate = Carbon::parse($request->start_date)->startOfDay();
                    $endDate = Carbon::parse($request->end_date)->endOfDay();
                } else {
                    $startDate = $today->copy()->startOfWeek();
                    $endDate = $today->copy()->endOfWeek();
                }
                break;
            case 'monthly':
                $month = $request->get('month', $today->month);
                $year = $request->get('year', $today->year);
                $startDate = Carbon::createFromDate($year, $month, 1)->startOfMonth();
                $endDate = $startDate->copy()->endOfMonth();
                break;
            case 'yearly':
                $year = $request->get('year', $today->year);
                $startDate = Carbon::createFromDate($year, 1, 1)->startOfYear();
                $endDate = Carbon::createFromDate($year, 12, 31)->endOfYear();
                break;
            case 'custom':
            default:
                $startDate = $request->filled('start_date') ? Carbon::parse($request->start_date)->startOfDay() : $today->copy()->subDays(30)->startOfDay();
                $endDate = $request->filled('end_date') ? Carbon::parse($request->end_date)->endOfDay() : $today->copy()->endOfDay();
                break;
        }

        // ══════════════════════════════════════════════════════════════════════
        // 1. تحليلات المستفيدين العامين (Beneficiaries Analytics)
        // ══════════════════════════════════════════════════════════════════════
        $totalBeneficiaries = Beneficiary::count();
        $activeBeneficiaries = Beneficiary::where('status', 'approved')->orWhere('status', 'active')->count();
        $inactiveBeneficiaries = Beneficiary::where('status', 'rejected')->orWhere('status', 'inactive')->count();

        // المستفيدون الذين استلموا مساعدات في هذه الفترة
        $servedBeneficiaryIds = Distribution::whereBetween('scheduled_at', [$startDate, $endDate])
            ->whereIn('status', ['delivered', 'received', 'completed'])
            ->pluck('beneficiary_id')
            ->unique();
        $beneficiariesReceivedCount = $servedBeneficiaryIds->count();
        $beneficiariesNotReceivedCount = max(0, $totalBeneficiaries - $beneficiariesReceivedCount);

        // عدد السلال الموزعة للمستفيدين العامين
        $basketsDistributedGeneral = Distribution::whereBetween('scheduled_at', [$startDate, $endDate])
            ->whereIn('status', ['delivered', 'received', 'completed'])
            ->count();

        // أسر مقابل أفراد
        $familiesCount = Beneficiary::where(function ($q) {
            $q->where('beneficiary_type', 'family')
              ->orWhere('family_members_count', '>', 1);
        })->count();
        $individualsCount = max(0, $totalBeneficiaries - $familiesCount);

        // المسجلون خلال الفترة
        $registeredInPeriod = Beneficiary::whereBetween('created_at', [$startDate, $endDate])->count();

        // التوزيع حسب الفئات
        $categoriesBreakdown = Category::withCount(['beneficiaries'])->get()->map(function ($cat) use ($startDate, $endDate) {
            $receivedCount = Distribution::whereBetween('scheduled_at', [$startDate, $endDate])
                ->whereIn('status', ['delivered', 'received', 'completed'])
                ->whereHas('beneficiary', fn ($q) => $q->where('category_id', $cat->id))
                ->distinct('beneficiary_id')
                ->count('beneficiary_id');

            return [
                'id' => $cat->id,
                'name' => $cat->name,
                'total_beneficiaries' => $cat->beneficiaries_count,
                'received_count' => $receivedCount,
            ];
        });

        // ══════════════════════════════════════════════════════════════════════
        // 2. تحليلات المستفيدين اليوميين (Daily Beneficiaries Analytics)
        // ══════════════════════════════════════════════════════════════════════
        $totalDailyBeneficiaries = DailyBeneficiary::count();
        $activeDailyBeneficiaries = DailyBeneficiary::where('status', 'active')->count();
        $dailyRegisteredInPeriod = DailyBeneficiary::whereBetween('created_at', [$startDate, $endDate])->count();

        // المستفيدون اليوميون الذين استلموا خلال الفترة
        $dailyTxQuery = DailyReceivingTransaction::whereBetween('receiving_date', [$startDate, $endDate])
            ->where('status', 'received');

        $dailyReceivingTransactionsCount = (clone $dailyTxQuery)->count();
        $dailyBasketsDistributed = (clone $dailyTxQuery)->sum('quantity');
        $dailyBeneficiariesReceivedCount = (clone $dailyTxQuery)->distinct('daily_beneficiary_id')->count('daily_beneficiary_id');
        $dailyBeneficiariesNotReceivedCount = max(0, $totalDailyBeneficiaries - $dailyBeneficiariesReceivedCount);

        // توزيع المستفيدين اليوميين حسب السلال
        $dailyByBasketType = (clone $dailyTxQuery)
            ->select('basket_type_name', DB::raw('SUM(quantity) as total_quantity'), DB::raw('COUNT(*) as transactions_count'))
            ->groupBy('basket_type_name')
            ->get();

        // توزيع المستفيدين اليوميين حسب الأحياء
        $dailyByDistrict = DailyBeneficiary::select('district', DB::raw('COUNT(*) as total_count'))
            ->groupBy('district')
            ->orderByDesc('total_count')
            ->get();

        // ══════════════════════════════════════════════════════════════════════
        // 3. تحليلات الموظفين (Employees Analytics)
        // ══════════════════════════════════════════════════════════════════════
        $totalStaff = Staff::count();
        $staffDistQuery = StaffDistribution::whereBetween('created_at', [$startDate, $endDate]);
        $staffReceivedCount = (clone $staffDistQuery)->distinct('staff_member_id')->count('staff_member_id');
        $staffNotReceivedCount = max(0, $totalStaff - $staffReceivedCount);
        $basketsDistributedToStaff = (clone $staffDistQuery)->count();

        // ══════════════════════════════════════════════════════════════════════
        // 4. تحليلات الجهات والمنظمات (Organizations / Neighborhood Reps)
        // ══════════════════════════════════════════════════════════════════════
        $totalOrganizations = NeighborhoodRep::count();
        $organizationsList = NeighborhoodRep::all()->map(function ($rep) use ($startDate, $endDate) {
            // Rep distributions
            $basketsCount = DB::table('rep_distributions')
                ->where('rep_id', $rep->id)
                ->whereBetween('created_at', [$startDate, $endDate])
                ->sum('basket_count') ?: 0;

            $districtName = $rep->district_name;

            // Beneficiaries in rep's neighborhood
            $neighborhoodBeneficiaries = Beneficiary::where('district', $districtName)->count();
            $neighborhoodFamilies = Beneficiary::where('district', $districtName)
                ->where(fn ($q) => $q->where('beneficiary_type', 'family')->orWhere('family_members_count', '>', 1))
                ->count();

            return [
                'id' => $rep->id,
                'name' => $rep->full_name,
                'organization_name' => $rep->full_name,
                'neighborhood' => $districtName,
                'phone' => $rep->phone,
                'status' => $rep->status ?? 'active',
                'baskets_received' => intval($basketsCount),
                'beneficiaries_count' => $neighborhoodBeneficiaries,
                'families_count' => $neighborhoodFamilies,
            ];
        });

        // ══════════════════════════════════════════════════════════════════════
        // 5. تحليلات الأحياء (Neighborhood Analytics)
        // ══════════════════════════════════════════════════════════════════════
        $districtsList = Beneficiary::whereNotNull('district')
            ->distinct()
            ->pluck('district')
            ->merge(DailyBeneficiary::whereNotNull('district')->distinct()->pluck('district'))
            ->unique()
            ->values();

        $neighborhoodsAnalytics = $districtsList->map(function ($district) use ($startDate, $endDate) {
            $generalBeneficiariesCount = Beneficiary::where('district', $district)->count();
            $dailyBeneficiariesCount = DailyBeneficiary::where('district', $district)->count();
            $familiesCount = Beneficiary::where('district', $district)
                ->where(fn ($q) => $q->where('beneficiary_type', 'family')->orWhere('family_members_count', '>', 1))
                ->count();

            $generalBaskets = Distribution::whereBetween('scheduled_at', [$startDate, $endDate])
                ->whereIn('status', ['delivered', 'received', 'completed'])
                ->whereHas('beneficiary', fn ($q) => $q->where('district', $district))
                ->count();

            $dailyBaskets = DailyReceivingTransaction::whereBetween('receiving_date', [$startDate, $endDate])
                ->where('status', 'received')
                ->whereHas('beneficiary', fn ($q) => $q->where('district', $district))
                ->sum('quantity');

            $orgsCount = NeighborhoodRep::where('district_name', $district)->count();

            return [
                'neighborhood' => $district,
                'general_beneficiaries' => $generalBeneficiariesCount,
                'daily_beneficiaries' => $dailyBeneficiariesCount,
                'total_beneficiaries' => $generalBeneficiariesCount + $dailyBeneficiariesCount,
                'families_count' => $familiesCount,
                'baskets_distributed' => intval($generalBaskets + $dailyBaskets),
                'organizations_count' => $orgsCount,
            ];
        })->sortByDesc('total_beneficiaries')->values();

        // ══════════════════════════════════════════════════════════════════════
        // 6. تحليلات المستودعات (Main Inventory vs Daily Beneficiaries Inventory)
        // ══════════════════════════════════════════════════════════════════════
        // Main Inventory
        $mainTotalItems = InventoryItem::count();
        $mainTotalQuantity = InventoryItem::sum('current_quantity');
        $mainStockIn = InventoryMovement::whereBetween('created_at', [$startDate, $endDate])->where('type', 'in')->sum('quantity');
        $mainStockOut = InventoryMovement::whereBetween('created_at', [$startDate, $endDate])->where('type', 'out')->sum('quantity');
        $mainLowStock = InventoryItem::whereColumn('current_quantity', '<=', 'min_threshold')->count();

        // Daily Inventory
        $dailyTotalItems = DailyInventoryItem::count();
        $dailyTotalQuantity = DailyInventoryItem::sum('current_quantity');
        $dailyStockIn = DailyInventoryMovement::whereBetween('created_at', [$startDate, $endDate])->where('type', 'in')->sum('quantity');
        $dailyStockOut = DailyInventoryMovement::whereBetween('created_at', [$startDate, $endDate])->where('type', 'out')->sum('quantity');
        $dailyLowStock = DailyInventoryItem::whereColumn('current_quantity', '<=', 'min_threshold')->count();

        // تتبع الصلاحيات (Expiry Tracking)
        $expiredItems = DailyInventoryItem::whereNotNull('expiry_date')
            ->whereDate('expiry_date', '<', $today)
            ->get(['id', 'name', 'current_quantity', 'expiry_date', 'unit']);

        $expiringIn7Days = DailyInventoryItem::whereNotNull('expiry_date')
            ->whereBetween('expiry_date', [$today, $today->copy()->addDays(7)])
            ->get(['id', 'name', 'current_quantity', 'expiry_date', 'unit']);

        $expiringIn30Days = DailyInventoryItem::whereNotNull('expiry_date')
            ->whereBetween('expiry_date', [$today->copy()->addDays(8), $today->copy()->addDays(30)])
            ->get(['id', 'name', 'current_quantity', 'expiry_date', 'unit']);

        $expiringIn60Days = DailyInventoryItem::whereNotNull('expiry_date')
            ->whereBetween('expiry_date', [$today->copy()->addDays(31), $today->copy()->addDays(60)])
            ->get(['id', 'name', 'current_quantity', 'expiry_date', 'unit']);

        // ══════════════════════════════════════════════════════════════════════
        // 7. تحليلات التوصيل والسائقين (Delivery & Driver Analytics)
        // ══════════════════════════════════════════════════════════════════════
        $totalDeliveries = Distribution::whereBetween('scheduled_at', [$startDate, $endDate])->count();
        $totalDrivers = Driver::count();

        $driversPerformance = Driver::all()->map(function ($driver) use ($startDate, $endDate) {
            $deliveriesQuery = Distribution::where('driver_id', $driver->id)
                ->whereBetween('scheduled_at', [$startDate, $endDate]);

            $total = (clone $deliveriesQuery)->count();
            $delivered = (clone $deliveriesQuery)->whereIn('status', ['delivered', 'received', 'completed'])->count();
            $uniqueBeneficiaries = (clone $deliveriesQuery)->distinct('beneficiary_id')->count('beneficiary_id');

            return [
                'id' => $driver->id,
                'name' => $driver->name,
                'phone' => $driver->phone,
                'status' => $driver->status ?? 'active',
                'total_deliveries' => $total,
                'completed_deliveries' => $delivered,
                'beneficiaries_served' => $uniqueBeneficiaries,
                'success_rate' => $total > 0 ? round(($delivered / $total) * 100, 1) : 100,
            ];
        });

        // ══════════════════════════════════════════════════════════════════════
        // 8. مؤشرات الإجماليات الموحدة (Grand Summary KPIs)
        // ══════════════════════════════════════════════════════════════════════
        $grandTotalBeneficiaries = $totalBeneficiaries + $totalDailyBeneficiaries;
        $grandTotalServed = $beneficiariesReceivedCount + $dailyBeneficiariesReceivedCount;
        $grandTotalBaskets = $basketsDistributedGeneral + $dailyBasketsDistributed + $basketsDistributedToStaff;

        return response()->json([
            'success' => true,
            'period' => [
                'type' => $periodType,
                'start_date' => $startDate->toDateString(),
                'end_date' => $endDate->toDateString(),
                'label' => $this->getPeriodLabel($periodType, $startDate, $endDate),
            ],
            'kpis' => [
                'grand_total_beneficiaries' => $grandTotalBeneficiaries,
                'grand_total_served' => $grandTotalServed,
                'grand_total_baskets' => $grandTotalBaskets,
                'general_beneficiaries' => $totalBeneficiaries,
                'daily_beneficiaries' => $totalDailyBeneficiaries,
                'active_beneficiaries' => $activeBeneficiaries + $activeDailyBeneficiaries,
            ],
            'beneficiaries' => [
                'total' => $totalBeneficiaries,
                'active' => $activeBeneficiaries,
                'inactive' => $inactiveBeneficiaries,
                'received_count' => $beneficiariesReceivedCount,
                'not_received_count' => $beneficiariesNotReceivedCount,
                'baskets_distributed' => $basketsDistributedGeneral,
                'families_count' => $familiesCount,
                'individuals_count' => $individualsCount,
                'registered_in_period' => $registeredInPeriod,
                'categories' => $categoriesBreakdown,
            ],
            'daily_beneficiaries' => [
                'total' => $totalDailyBeneficiaries,
                'active' => $activeDailyBeneficiaries,
                'received_count' => $dailyBeneficiariesReceivedCount,
                'not_received_count' => $dailyBeneficiariesNotReceivedCount,
                'baskets_distributed' => intval($dailyBasketsDistributed),
                'transactions_count' => $dailyReceivingTransactionsCount,
                'registered_in_period' => $dailyRegisteredInPeriod,
                'by_basket_type' => $dailyByBasketType,
                'by_district' => $dailyByDistrict,
            ],
            'staff' => [
                'total' => $totalStaff,
                'received_count' => $staffReceivedCount,
                'not_received_count' => $staffNotReceivedCount,
                'baskets_distributed' => intval($basketsDistributedToStaff),
            ],
            'organizations' => [
                'total' => $totalOrganizations,
                'list' => $organizationsList,
            ],
            'neighborhoods' => [
                'total' => $neighborhoodsAnalytics->count(),
                'list' => $neighborhoodsAnalytics,
            ],
            'inventory' => [
                'main' => [
                    'total_items' => $mainTotalItems,
                    'total_quantity' => intval($mainTotalQuantity),
                    'stock_in' => intval($mainStockIn),
                    'stock_out' => intval($mainStockOut),
                    'low_stock_count' => $mainLowStock,
                ],
                'daily' => [
                    'total_items' => $dailyTotalItems,
                    'total_quantity' => intval($dailyTotalQuantity),
                    'stock_in' => intval($dailyStockIn),
                    'stock_out' => intval($dailyStockOut),
                    'low_stock_count' => $dailyLowStock,
                ],
                'expiry_alerts' => [
                    'expired' => $expiredItems,
                    'expired_count' => $expiredItems->count(),
                    'in_7_days' => $expiringIn7Days,
                    'in_7_days_count' => $expiringIn7Days->count(),
                    'in_30_days' => $expiringIn30Days,
                    'in_30_days_count' => $expiringIn30Days->count(),
                    'in_60_days' => $expiringIn60Days,
                    'in_60_days_count' => $expiringIn60Days->count(),
                ],
            ],
            'delivery' => [
                'total_deliveries' => $totalDeliveries,
                'total_drivers' => $totalDrivers,
                'drivers' => $driversPerformance,
            ],
        ]);
    }

    private function getPeriodLabel(string $type, Carbon $start, Carbon $end): string
    {
        switch ($type) {
            case 'daily':
                return 'تقرير يوم ' . $start->translatedFormat('l d F Y');
            case 'weekly':
                return 'تقرير أسبوعي من ' . $start->format('Y/m/d') . ' إلى ' . $end->format('Y/m/d');
            case 'monthly':
                return 'تقرير شهر ' . $start->translatedFormat('F Y');
            case 'yearly':
                return 'التقرير السنوي لعام ' . $start->format('Y');
            default:
                return 'الفترة من ' . $start->format('Y/m/d') . ' إلى ' . $end->format('Y/m/d');
        }
    }
}
