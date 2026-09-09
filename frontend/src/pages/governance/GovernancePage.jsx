import { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import MainLayout from "../../components/layout/MainLayout";
import PageHeader from "../../components/ui/PageHeader";
import Button from "../../components/ui/Button";
import Toast from "../../components/ui/Toast";
import { getAnalytics } from "../../api/dailyBeneficiaries";
import { getDocumentPdfUrl } from "../../utils/documentUrl";
import {
  ShieldCheck,
  BarChart3,
  TrendingUp,
  Users,
  Package,
  FileSpreadsheet,
  Download,
  Calendar,
  Filter,
  CheckCircle2,
  Clock,
  Building2,
  UserCheck,
  AlertTriangle,
  ArrowUpDown,
  Printer,
  Truck,
  Briefcase,
  MapPin,
  Layers,
  ChevronLeft,
  Search,
} from "lucide-react";

export default function GovernancePage() {
  // Date Filtering State
  const [periodType, setPeriodType] = useState("weekly"); // daily, weekly, monthly, yearly, custom
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Analytics Data & Loading
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  // Active View Tab in Governance Dashboard
  // 'overview' | 'beneficiaries' | 'daily' | 'staff' | 'organizations' | 'neighborhoods' | 'inventory' | 'delivery'
  const [activeTab, setActiveTab] = useState("overview");

  // Search filter inside sub-tables
  const [tableSearch, setTableSearch] = useState("");

  // Toast & Validation Error
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const [dateRangeError, setDateRangeError] = useState("");

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const params = {
        period_type: periodType,
        date: periodType === "daily" ? selectedDate : undefined,
        start_date: periodType === "weekly" || periodType === "custom" ? startDate : undefined,
        end_date: periodType === "weekly" || periodType === "custom" ? endDate : undefined,
        month: periodType === "monthly" ? selectedMonth : undefined,
        year: periodType === "monthly" || periodType === "yearly" ? selectedYear : undefined,
      };

      const res = await getAnalytics(params);
      if (res.data?.success) {
        setAnalytics(res.data);
      }
    } catch (err) {
      console.error(err);
      setToast({ show: true, message: "فشل في تحميل بيانات الحوكمة والتحليلات", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [periodType, selectedDate, startDate, endDate, selectedMonth, selectedYear]);

  // Handle Export to Excel
  const handleExportExcel = () => {
    if (!analytics) return;

    const wb = XLSX.utils.book_new();

    // 1. Sheet: KPIs Summary
    const kpiData = [
      { "المؤشر": "إجمالي المستفيدين المسجلين (عام + يومي)", "القيمة": analytics.kpis?.grand_total_beneficiaries || 0 },
      { "المؤشر": "إجمالي المستفيدين الذين استلموا مساعدات", "القيمة": analytics.kpis?.grand_total_served || 0 },
      { "المؤشر": "إجمالي السلال الموزعة بالكامل", "القيمة": analytics.kpis?.grand_total_baskets || 0 },
      { "المؤشر": "المستفيدون العامون", "القيمة": analytics.beneficiaries?.total || 0 },
      { "المؤشر": "المستفيدون العامون الذين استلموا", "القيمة": analytics.beneficiaries?.received_count || 0 },
      { "المؤشر": "المستفيدون العامون الذين لم يستلموا", "القيمة": analytics.beneficiaries?.not_received_count || 0 },
      { "المؤشر": "المستفيدون اليوميون", "القيمة": analytics.daily_beneficiaries?.total || 0 },
      { "المؤشر": "المستفيدون اليوميون الذين استلموا", "القيمة": analytics.daily_beneficiaries?.received_count || 0 },
      { "المؤشر": "عمليات الاستلام اليومي", "القيمة": analytics.daily_beneficiaries?.transactions_count || 0 },
      { "المؤشر": "سلال المستفيدين اليوميين", "القيمة": analytics.daily_beneficiaries?.baskets_distributed || 0 },
      { "المؤشر": "عدد الأسر المستفيدة", "القيمة": analytics.beneficiaries?.families_count || 0 },
      { "المؤشر": "عدد الأفراد المستفيدين", "القيمة": analytics.beneficiaries?.individuals_count || 0 },
    ];
    const wsKpi = XLSX.utils.json_to_sheet(kpiData);
    wsKpi["!dir"] = "rtl";
    XLSX.utils.book_append_sheet(wb, wsKpi, "المؤشرات الإجمالية");

    // 2. Sheet: Neighborhoods
    if (analytics.neighborhoods?.list?.length > 0) {
      const nhRows = analytics.neighborhoods.list.map((nh, i) => ({
        "#": i + 1,
        "الحي السكني": nh.neighborhood,
        "المستفيدون العامون": nh.general_beneficiaries,
        "المستفيدون اليوميون": nh.daily_beneficiaries,
        "إجمالي المستفيدين": nh.total_beneficiaries,
        "الأسر المتعففة": nh.families_count,
        "السلال الموزعة": nh.baskets_distributed,
        "الجهات الشريكة": nh.organizations_count,
      }));
      const wsNh = XLSX.utils.json_to_sheet(nhRows);
      wsNh["!dir"] = "rtl";
      XLSX.utils.book_append_sheet(wb, wsNh, "تحليلات الأحياء");
    }

    // 3. Sheet: Organizations
    if (analytics.organizations?.list?.length > 0) {
      const orgRows = analytics.organizations.list.map((org, i) => ({
        "#": i + 1,
        "اسم الجهة / المندوب": org.organization_name,
        "الحي": org.neighborhood,
        "الجوال": org.phone,
        "المستفيدون التابعون": org.beneficiaries_count,
        "الأسر التابعة": org.families_count,
        "السلال المستلمة": org.baskets_received,
      }));
      const wsOrg = XLSX.utils.json_to_sheet(orgRows);
      wsOrg["!dir"] = "rtl";
      XLSX.utils.book_append_sheet(wb, wsOrg, "الجهات ومندوبو الأحياء");
    }

    // 4. Sheet: Drivers
    if (analytics.delivery?.drivers?.length > 0) {
      const drvRows = analytics.delivery.drivers.map((drv, i) => ({
        "#": i + 1,
        "اسم السائق": drv.name,
        "الجوال": drv.phone,
        "إجمالي التوصيلات": drv.total_deliveries,
        "التوصيلات المكتملة": drv.completed_deliveries,
        "المستفيدون المخدومون": drv.beneficiaries_served,
        "نسبة النجاح": `${drv.success_rate}%`,
      }));
      const wsDrv = XLSX.utils.json_to_sheet(drvRows);
      wsDrv["!dir"] = "rtl";
      XLSX.utils.book_append_sheet(wb, wsDrv, "أداء التوصيل والسائقين");
    }

    XLSX.writeFile(wb, `تقرير_الحوكمة_والتحليلات_${analytics.period?.start_date}_${analytics.period?.end_date}.xlsx`);
    setToast({ show: true, message: "تم تصدير ملف الإكسل الشامل بنجاح", type: "success" });
  };

  // PDF Export URLs
  const pdfComprehensiveUrl = useMemo(() => {
    const params = new URLSearchParams({
      period_type: periodType,
      start_date: startDate,
      end_date: endDate,
      date: selectedDate,
      month: selectedMonth,
      year: selectedYear,
    });
    return getDocumentPdfUrl(`/reports/comprehensive/pdf?${params.toString()}`);
  }, [periodType, startDate, endDate, selectedDate, selectedMonth, selectedYear]);

  const pdfDailyUrl = useMemo(() => {
    return getDocumentPdfUrl(`/reports/daily/pdf?date=${selectedDate}`);
  }, [selectedDate]);

  const handleGenerateReport = (e) => {
    if (e) e.preventDefault();
    if (!startDate || !endDate) {
      setDateRangeError("يرجى اختيار تاريخ البداية وتاريخ النهاية.");
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      setDateRangeError("خطأ في النطاق الزمني: تاريخ البداية لا يمكن أن يكون بعد تاريخ النهاية.");
      return;
    }
    setDateRangeError("");
    setPeriodType("custom");
    fetchAnalytics();
  };

  return (
    <MainLayout>
      <div className="space-y-6" dir="rtl">
        {/* Page Header with Official Actions */}
        <PageHeader
          title="منظومة الحوكمة والتحليلات الشاملة"
          subtitle="رصد استراتيجي وتحليلي لأداء العمليات والمستفيدين العامين واليوميين والمخزون واللوجستيات"
          badge="الحوكمة والامتثال"
          breadcrumbs={[{ label: "الحوكمة والتقارير" }]}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                icon={FileSpreadsheet}
                onClick={handleExportExcel}
              >
                تصدير إكسل (Excel)
              </Button>

              <a
                href={pdfDailyUrl}
                target="_blank"
                rel="noreferrer"
              >
                <Button variant="outline" size="sm" icon={Printer}>
                  التقرير اليومي (PDF)
                </Button>
              </a>

              <a
                href={pdfComprehensiveUrl}
                target="_blank"
                rel="noreferrer"
              >
                <Button variant="secondary" size="sm" icon={Download}>
                  التقرير الشامل (PDF)
                </Button>
              </a>
            </div>
          }
        />

        {/* Date Range Selector Box */}
        <div className="bg-white border border-[#E5E2D9] rounded-2xl p-4 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5 bg-white p-1 rounded-lg border border-[#E5E2D9] text-xs">
              <button
                onClick={() => setPeriodType("daily")}
                className={`px-3 py-1.5 rounded-md font-bold transition-colors ${
                  periodType === "daily" ? "bg-[#3F6B3A] text-white shadow-xs" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                يومي
              </button>
              <button
                onClick={() => setPeriodType("weekly")}
                className={`px-3 py-1.5 rounded-md font-bold transition-colors ${
                  periodType === "weekly" ? "bg-[#3F6B3A] text-white shadow-xs" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                أسبوعي
              </button>
              <button
                onClick={() => setPeriodType("monthly")}
                className={`px-3 py-1.5 rounded-md font-bold transition-colors ${
                  periodType === "monthly" ? "bg-[#3F6B3A] text-white shadow-xs" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                شهري
              </button>
              <button
                onClick={() => setPeriodType("yearly")}
                className={`px-3 py-1.5 rounded-md font-bold transition-colors ${
                  periodType === "yearly" ? "bg-[#3F6B3A] text-white shadow-xs" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                سنوي
              </button>
              <button
                onClick={() => setPeriodType("custom")}
                className={`px-3 py-1.5 rounded-md font-bold transition-colors ${
                  periodType === "custom" ? "bg-[#3F6B3A] text-white shadow-xs" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                نطاق مخصص
              </button>
            </div>

            {/* Dynamic Date Inputs based on periodType */}
            <div className="flex items-center gap-2 text-xs">
              {periodType === "daily" && (
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500">حدد اليوم:</span>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-[#E5E2D9] rounded-lg text-xs focus:outline-none focus:border-[#3F6B3A]"
                  />
                </div>
              )}

              {(periodType === "weekly" || periodType === "custom") && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-slate-600 font-bold">من تاريخ:</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setDateRangeError("");
                    }}
                    className="px-2.5 py-1.5 bg-white border border-[#E5E2D9] rounded-lg text-xs font-mono focus:border-[#3F6B3A] focus:outline-none"
                  />
                  <span className="text-slate-600 font-bold">إلى تاريخ:</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setDateRangeError("");
                    }}
                    className="px-2.5 py-1.5 bg-white border border-[#E5E2D9] rounded-lg text-xs font-mono focus:border-[#3F6B3A] focus:outline-none"
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    icon={BarChart3}
                    onClick={handleGenerateReport}
                  >
                    توليد التقرير
                  </Button>
                </div>
              )}

              {periodType === "monthly" && (
                <div className="flex items-center gap-2">
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    className="px-3 py-1.5 bg-white border border-[#E5E2D9] rounded-lg text-xs"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                      <option key={m} value={m}>شهر {m}</option>
                    ))}
                  </select>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="px-3 py-1.5 bg-white border border-[#E5E2D9] rounded-lg text-xs"
                  >
                    {[2025, 2026, 2027].map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              )}

              {periodType === "yearly" && (
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500">السنة المالية:</span>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="px-3 py-1.5 bg-white border border-[#E5E2D9] rounded-lg text-xs font-bold"
                  >
                    {[2025, 2026, 2027].map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              )}

              <span className="hidden sm:inline-block px-3 py-1.5 bg-[#F5EDDA] text-[#8C6C26] rounded-lg font-bold">
                {analytics?.period?.label || "الفترة النشطة"}
              </span>
            </div>
          </div>

          {dateRangeError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-bold flex items-center gap-2 animate-shake">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{dateRangeError}</span>
            </div>
          )}

          {analytics?.period && (
            <div className="p-3 bg-[#FAF8F5] border border-[#E5E2D9] rounded-xl flex flex-wrap items-center justify-between text-xs gap-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#C9A24A]" />
                <span className="text-gray-600 font-medium">فترة التقرير الحالية:</span>
                <strong className="text-gray-900 font-mono">
                  من {analytics.period.start_date} إلى {analytics.period.end_date}
                </strong>
                <span className="text-[11px] text-gray-500">({analytics.period.label})</span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={pdfComprehensiveUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 bg-white border border-[#E5E2D9] hover:bg-[#FAF8F5] rounded-lg text-xs font-bold text-[#3F6B3A] flex items-center gap-1 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>تصدير تقرير الفترة (PDF)</span>
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Dashboard Navigation Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-[#E5E2D9] text-xs font-bold">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2.5 rounded-t-lg transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === "overview"
                ? "border-[#3F6B3A] text-[#3F6B3A] bg-white"
                : "border-transparent text-slate-600 hover:text-slate-800"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            نظرة عامة والمؤشرات
          </button>

          <button
            onClick={() => setActiveTab("beneficiaries")}
            className={`px-4 py-2.5 rounded-t-lg transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === "beneficiaries"
                ? "border-[#3F6B3A] text-[#3F6B3A] bg-white"
                : "border-transparent text-slate-600 hover:text-slate-800"
            }`}
          >
            <Users className="w-4 h-4" />
            تحليلات المستفيدين العامين
          </button>

          <button
            onClick={() => setActiveTab("daily")}
            className={`px-4 py-2.5 rounded-t-lg transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === "daily"
                ? "border-[#3F6B3A] text-[#3F6B3A] bg-white"
                : "border-transparent text-slate-600 hover:text-slate-800"
            }`}
          >
            <UserCheck className="w-4 h-4" />
            تحليلات المستفيدين اليوميين
          </button>

          <button
            onClick={() => setActiveTab("inventory")}
            className={`px-4 py-2.5 rounded-t-lg transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === "inventory"
                ? "border-[#3F6B3A] text-[#3F6B3A] bg-white"
                : "border-transparent text-slate-600 hover:text-slate-800"
            }`}
          >
            <Package className="w-4 h-4" />
            مقارنة المخزون والصلاحيات
          </button>

          <button
            onClick={() => setActiveTab("neighborhoods")}
            className={`px-4 py-2.5 rounded-t-lg transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === "neighborhoods"
                ? "border-[#3F6B3A] text-[#3F6B3A] bg-white"
                : "border-transparent text-slate-600 hover:text-slate-800"
            }`}
          >
            <MapPin className="w-4 h-4" />
            مصفوفة الأحياء السكنية
          </button>

          <button
            onClick={() => setActiveTab("organizations")}
            className={`px-4 py-2.5 rounded-t-lg transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === "organizations"
                ? "border-[#3F6B3A] text-[#3F6B3A] bg-white"
                : "border-transparent text-slate-600 hover:text-slate-800"
            }`}
          >
            <Building2 className="w-4 h-4" />
            الجهات والمنظمات
          </button>

          <button
            onClick={() => setActiveTab("delivery")}
            className={`px-4 py-2.5 rounded-t-lg transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === "delivery"
                ? "border-[#3F6B3A] text-[#3F6B3A] bg-white"
                : "border-transparent text-slate-600 hover:text-slate-800"
            }`}
          >
            <Truck className="w-4 h-4" />
            التوصيل واللوجستيات
          </button>

          <button
            onClick={() => setActiveTab("staff")}
            className={`px-4 py-2.5 rounded-t-lg transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === "staff"
                ? "border-[#3F6B3A] text-[#3F6B3A] bg-white"
                : "border-transparent text-slate-600 hover:text-slate-800"
            }`}
          >
            <Briefcase className="w-4 h-4" />
            دعم الموظفين
          </button>
        </div>

        {loading ? (
          <div className="py-20 text-center text-slate-400">
            <div className="w-10 h-10 border-4 border-[#3F6B3A] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            جاري تجميع وحساب المؤشرات الإحصائية المعتمدة...
          </div>
        ) : !analytics ? (
          <div className="py-20 text-center text-slate-400">لا تتوفر بيانات للفترة المحددة.</div>
        ) : (
          <>
            {/* ══════════════════════════════════════════════════════════════════ */}
            {/* VIEW 1: OVERVIEW TAB                                              */}
            {/* ══════════════════════════════════════════════════════════════════ */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                {/* Grand Summary KPIs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white border border-[#E5E2D9] rounded-xl p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 font-semibold">إجمالي المستفيدين المسجلين</span>
                      <span className="p-2 bg-[#3F6B3A]/10 text-[#3F6B3A] rounded-lg">
                        <Users className="w-5 h-5" />
                      </span>
                    </div>
                    <div className="text-2xl font-bold text-slate-800 mt-2">
                      {analytics.kpis?.grand_total_beneficiaries || 0}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 flex justify-between">
                      <span>عام: {analytics.beneficiaries?.total || 0}</span>
                      <span>يومي: {analytics.daily_beneficiaries?.total || 0}</span>
                    </div>
                  </div>

                  <div className="bg-white border border-[#E5E2D9] rounded-xl p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 font-semibold">المستفيدون المستلمون في الفترة</span>
                      <span className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                        <CheckCircle2 className="w-5 h-5" />
                      </span>
                    </div>
                    <div className="text-2xl font-bold text-blue-700 mt-2">
                      {analytics.kpis?.grand_total_served || 0}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 flex justify-between">
                      <span>عام: {analytics.beneficiaries?.received_count || 0}</span>
                      <span>يومي: {analytics.daily_beneficiaries?.received_count || 0}</span>
                    </div>
                  </div>

                  <div className="bg-white border border-[#E5E2D9] rounded-xl p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 font-semibold">إجمالي السلال الموزعة</span>
                      <span className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                        <Package className="w-5 h-5" />
                      </span>
                    </div>
                    <div className="text-2xl font-bold text-amber-700 mt-2">
                      {analytics.kpis?.grand_total_baskets || 0}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 flex justify-between">
                      <span>توزيع عام: {analytics.beneficiaries?.baskets_distributed || 0}</span>
                      <span>يومي: {analytics.daily_beneficiaries?.baskets_distributed || 0}</span>
                    </div>
                  </div>

                  <div className="bg-white border border-[#E5E2D9] rounded-xl p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 font-semibold">عمليات الاستلام اليومي</span>
                      <span className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                        <TrendingUp className="w-5 h-5" />
                      </span>
                    </div>
                    <div className="text-2xl font-bold text-emerald-800 mt-2">
                      {analytics.daily_beneficiaries?.transactions_count || 0}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      سند استلام فوري موثق
                    </div>
                  </div>
                </div>

                {/* Two Column Grid: Categories Breakdown & Neighborhood Highlights */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Categories Breakdown */}
                  <div className="bg-white border border-[#E5E2D9] rounded-xl shadow-sm p-5 space-y-4">
                    <h3 className="font-bold text-slate-800 text-sm flex items-center justify-between pb-3 border-b">
                      <span className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-[#3F6B3A]" />
                        توزيع المستفيدين العامين حسب الفئات
                      </span>
                      <span className="text-xs text-slate-400">إجمالي الفئات</span>
                    </h3>

                    <div className="space-y-3">
                      {analytics.beneficiaries?.categories?.map((cat) => (
                        <div key={cat.id} className="space-y-1 text-xs">
                          <div className="flex justify-between font-semibold">
                            <span className="text-slate-700">{cat.name}</span>
                            <span className="text-slate-500">
                              {cat.total_beneficiaries} مستفيد (استلم منهم:{" "}
                              <strong className="text-[#3F6B3A]">{cat.received_count}</strong>)
                            </span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#3F6B3A] rounded-full transition-all"
                              style={{
                                width: `${
                                  cat.total_beneficiaries > 0
                                    ? Math.min(100, Math.round((cat.received_count / cat.total_beneficiaries) * 100))
                                    : 0
                                }%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Daily Beneficiaries Baskets Breakdown */}
                  <div className="bg-white border border-[#E5E2D9] rounded-xl shadow-sm p-5 space-y-4">
                    <h3 className="font-bold text-slate-800 text-sm flex items-center justify-between pb-3 border-b">
                      <span className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-[#C9A24A]" />
                        سلال المستفيدين اليوميين المصروفة في الفترة
                      </span>
                      <span className="text-xs text-slate-400">حسب نوع السلة</span>
                    </h3>

                    <div className="space-y-3">
                      {analytics.daily_beneficiaries?.by_basket_type?.length === 0 ? (
                        <p className="text-center py-8 text-xs text-slate-400">
                          لا توجد سلال يومية مصروفة خلال هذه الفترة.
                        </p>
                      ) : (
                        analytics.daily_beneficiaries?.by_basket_type?.map((b) => (
                          <div key={b.basket_type_name} className="p-3 bg-slate-50 rounded-lg flex items-center justify-between text-xs">
                            <div>
                              <strong className="text-slate-800 block">{b.basket_type_name}</strong>
                              <span className="text-[11px] text-slate-400 mt-0.5 block">
                                عدد مرات التسليم: {b.transactions_count}
                              </span>
                            </div>
                            <span className="px-3 py-1 bg-[#EBF4EA] text-[#2E5A27] rounded-full font-bold text-xs">
                              {b.total_quantity} سلة
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Expiry Tracking Alert Bar */}
                {analytics.inventory?.expiry_alerts?.expired_count > 0 || analytics.inventory?.expiry_alerts?.in_7_days_count > 0 ? (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-xs space-y-1">
                      <strong className="text-amber-800 font-bold block">
                        تنبيهات سلامة وجودة المخزون الغذائي:
                      </strong>
                      <p className="text-slate-700">
                        يوجد <strong>{analytics.inventory.expiry_alerts.expired_count}</strong> أصناف منتهية الصلاحية بمستودع اليوميين، و{" "}
                        <strong>{analytics.inventory.expiry_alerts.in_7_days_count}</strong> أصناف تنتهي صلاحيتها خلال الـ 7 أيام القادمة. يرجى مراجعة تبويب "مقارنة المخزون والصلاحيات".
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════ */}
            {/* VIEW 2: BENEFICIARIES TAB                                         */}
            {/* ══════════════════════════════════════════════════════════════════ */}
            {activeTab === "beneficiaries" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="bg-white border p-4 rounded-xl shadow-sm text-center">
                    <span className="text-xs text-slate-500 block">إجمالي المستفيدين المسجلين</span>
                    <strong className="text-2xl font-bold text-slate-800">{analytics.beneficiaries?.total || 0}</strong>
                  </div>
                  <div className="bg-white border p-4 rounded-xl shadow-sm text-center">
                    <span className="text-xs text-slate-500 block">استلموا مساعدات في الفترة</span>
                    <strong className="text-2xl font-bold text-emerald-700">{analytics.beneficiaries?.received_count || 0}</strong>
                  </div>
                  <div className="bg-white border p-4 rounded-xl shadow-sm text-center">
                    <span className="text-xs text-slate-500 block">لم يستلموا في الفترة</span>
                    <strong className="text-2xl font-bold text-amber-700">{analytics.beneficiaries?.not_received_count || 0}</strong>
                  </div>
                  <div className="bg-white border p-4 rounded-xl shadow-sm text-center">
                    <span className="text-xs text-slate-500 block">عدد الأسر المتعففة</span>
                    <strong className="text-2xl font-bold text-blue-700">{analytics.beneficiaries?.families_count || 0}</strong>
                  </div>
                </div>

                <div className="bg-white border rounded-xl shadow-sm p-5 space-y-4">
                  <h3 className="font-bold text-slate-800 text-sm pb-2 border-b">
                    توزيع المستفيدين العامين ونسب الاستلام حسب الفئات
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-700 font-bold border-b">
                          <th className="py-2.5 px-3">الفئة المستهدفة</th>
                          <th className="py-2.5 px-3 text-center">إجمالي المسجلين</th>
                          <th className="py-2.5 px-3 text-center">الذين استلموا</th>
                          <th className="py-2.5 px-3 text-center">الذين لم يستلموا</th>
                          <th className="py-2.5 px-3 text-center">نسبة التغطية</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {analytics.beneficiaries?.categories?.map((cat) => {
                          const coverage = cat.total_beneficiaries > 0 ? Math.round((cat.received_count / cat.total_beneficiaries) * 100) : 0;
                          return (
                            <tr key={cat.id} className="hover:bg-slate-50">
                              <td className="py-2.5 px-3 font-bold text-slate-800">{cat.name}</td>
                              <td className="py-2.5 px-3 text-center font-semibold">{cat.total_beneficiaries}</td>
                              <td className="py-2.5 px-3 text-center text-emerald-700 font-bold">{cat.received_count}</td>
                              <td className="py-2.5 px-3 text-center text-slate-500">{cat.total_beneficiaries - cat.received_count}</td>
                              <td className="py-2.5 px-3 text-center">
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#EBF4EA] text-[#2E5A27]">
                                  {coverage}%
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════ */}
            {/* VIEW 3: DAILY BENEFICIARIES TAB                                   */}
            {/* ══════════════════════════════════════════════════════════════════ */}
            {activeTab === "daily" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="bg-white border p-4 rounded-xl shadow-sm text-center">
                    <span className="text-xs text-slate-500 block">إجمالي المستفيدين اليوميين</span>
                    <strong className="text-2xl font-bold text-slate-800">{analytics.daily_beneficiaries?.total || 0}</strong>
                  </div>
                  <div className="bg-white border p-4 rounded-xl shadow-sm text-center">
                    <span className="text-xs text-slate-500 block">استلموا في الفترة</span>
                    <strong className="text-2xl font-bold text-emerald-700">{analytics.daily_beneficiaries?.received_count || 0}</strong>
                  </div>
                  <div className="bg-white border p-4 rounded-xl shadow-sm text-center">
                    <span className="text-xs text-slate-500 block">السلال المصروفة لهم</span>
                    <strong className="text-2xl font-bold text-amber-700">{analytics.daily_beneficiaries?.baskets_distributed || 0}</strong>
                  </div>
                  <div className="bg-white border p-4 rounded-xl shadow-sm text-center">
                    <span className="text-xs text-slate-500 block">عمليات الاستلام المنفذة</span>
                    <strong className="text-2xl font-bold text-blue-700">{analytics.daily_beneficiaries?.transactions_count || 0}</strong>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* By Basket Type */}
                  <div className="bg-white border rounded-xl shadow-sm p-5 space-y-4">
                    <h3 className="font-bold text-slate-800 text-sm pb-2 border-b">
                      توزيع السلال اليومية حسب الصنف
                    </h3>
                    <div className="space-y-2.5">
                      {analytics.daily_beneficiaries?.by_basket_type?.map((b) => (
                        <div key={b.basket_type_name} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg text-xs">
                          <span className="font-bold text-slate-800">{b.basket_type_name}</span>
                          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded font-bold">
                            {b.total_quantity} سلة
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* By District */}
                  <div className="bg-white border rounded-xl shadow-sm p-5 space-y-4">
                    <h3 className="font-bold text-slate-800 text-sm pb-2 border-b">
                      توزيع المستفيدين اليوميين حسب الأحياء
                    </h3>
                    <div className="space-y-2.5 max-h-72 overflow-y-auto">
                      {analytics.daily_beneficiaries?.by_district?.map((d) => (
                        <div key={d.district} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg text-xs">
                          <span className="text-slate-700 font-semibold">{d.district}</span>
                          <span className="font-mono font-bold text-slate-800">{d.total_count} مستفيد</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════ */}
            {/* VIEW 4: INVENTORY COMPARISON TAB                                  */}
            {/* ══════════════════════════════════════════════════════════════════ */}
            {activeTab === "inventory" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Main Warehouse Card */}
                  <div className="bg-white border rounded-xl shadow-sm p-5 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b">
                      <div className="flex items-center gap-2">
                        <Package className="w-5 h-5 text-[#3F6B3A]" />
                        <h3 className="font-bold text-slate-800 text-base">المستودع المركزي العام</h3>
                      </div>
                      <span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                        {analytics.inventory?.main?.total_items || 0} أصناف
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 bg-slate-50 rounded-lg text-center">
                        <span className="text-slate-400 block">الرصيد المتاح الحالي</span>
                        <strong className="text-lg font-bold text-slate-800 mt-1 block">
                          {analytics.inventory?.main?.total_quantity || 0}
                        </strong>
                      </div>
                      <div className="p-3 bg-emerald-50 text-emerald-800 rounded-lg text-center">
                        <span className="text-emerald-600 block">التوريد في الفترة (+)</span>
                        <strong className="text-lg font-bold mt-1 block">
                          +{analytics.inventory?.main?.stock_in || 0}
                        </strong>
                      </div>
                      <div className="p-3 bg-amber-50 text-amber-800 rounded-lg text-center">
                        <span className="text-amber-600 block">المنصرف والموزع (-)</span>
                        <strong className="text-lg font-bold mt-1 block">
                          -{analytics.inventory?.main?.stock_out || 0}
                        </strong>
                      </div>
                      <div className="p-3 bg-red-50 text-red-800 rounded-lg text-center">
                        <span className="text-red-600 block">أصناف قاربت النفاد</span>
                        <strong className="text-lg font-bold mt-1 block">
                          {analytics.inventory?.main?.low_stock_count || 0}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Daily Beneficiaries Inventory Card */}
                  <div className="bg-white border rounded-xl shadow-sm p-5 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b">
                      <div className="flex items-center gap-2">
                        <Package className="w-5 h-5 text-[#C9A24A]" />
                        <h3 className="font-bold text-slate-800 text-base">مستودع المستفيدين اليوميين</h3>
                      </div>
                      <span className="text-xs bg-[#F5EDDA] text-[#8C6C26] px-2 py-0.5 rounded font-bold">
                        {analytics.inventory?.daily?.total_items || 0} أصناف
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 bg-slate-50 rounded-lg text-center">
                        <span className="text-slate-400 block">الرصيد المتاح الحالي</span>
                        <strong className="text-lg font-bold text-[#2E5A27] mt-1 block">
                          {analytics.inventory?.daily?.total_quantity || 0}
                        </strong>
                      </div>
                      <div className="p-3 bg-emerald-50 text-emerald-800 rounded-lg text-center">
                        <span className="text-emerald-600 block">التوريد في الفترة (+)</span>
                        <strong className="text-lg font-bold mt-1 block">
                          +{analytics.inventory?.daily?.stock_in || 0}
                        </strong>
                      </div>
                      <div className="p-3 bg-amber-50 text-amber-800 rounded-lg text-center">
                        <span className="text-amber-600 block">المنصرف لليوميين (-)</span>
                        <strong className="text-lg font-bold mt-1 block">
                          -{analytics.inventory?.daily?.stock_out || 0}
                        </strong>
                      </div>
                      <div className="p-3 bg-red-50 text-red-800 rounded-lg text-center">
                        <span className="text-red-600 block">أصناف قاربت النفاد</span>
                        <strong className="text-lg font-bold mt-1 block">
                          {analytics.inventory?.daily?.low_stock_count || 0}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expiry Tracking Section (<= 7, <= 30, <= 60 days) */}
                <div className="bg-white border rounded-xl shadow-sm p-5 space-y-4">
                  <h3 className="font-bold text-slate-800 text-sm pb-2 border-b flex items-center justify-between">
                    <span>مصفوفة تتبع تواريخ الصلاحية (مستودع اليوميين)</span>
                    <span className="text-xs text-slate-400">فحص آلي يومي</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-center">
                      <span className="text-red-600 block font-semibold">منتهية الصلاحية</span>
                      <strong className="text-xl font-bold text-red-700 mt-1 block">
                        {analytics.inventory?.expiry_alerts?.expired_count || 0}
                      </strong>
                    </div>
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-center">
                      <span className="text-amber-700 block font-semibold">تنتهي خلال 7 أيام</span>
                      <strong className="text-xl font-bold text-amber-800 mt-1 block">
                        {analytics.inventory?.expiry_alerts?.in_7_days_count || 0}
                      </strong>
                    </div>
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
                      <span className="text-yellow-700 block font-semibold">تنتهي خلال 30 يوماً</span>
                      <strong className="text-xl font-bold text-yellow-800 mt-1 block">
                        {analytics.inventory?.expiry_alerts?.in_30_days_count || 0}
                      </strong>
                    </div>
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-center">
                      <span className="text-blue-700 block font-semibold">تنتهي خلال 60 يوماً</span>
                      <strong className="text-xl font-bold text-blue-800 mt-1 block">
                        {analytics.inventory?.expiry_alerts?.in_60_days_count || 0}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════ */}
            {/* VIEW 5: NEIGHBORHOODS TAB                                         */}
            {/* ══════════════════════════════════════════════════════════════════ */}
            {activeTab === "neighborhoods" && (
              <div className="bg-white border rounded-xl shadow-sm overflow-hidden space-y-4">
                <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">مصفوفة تغطية الأحياء السكنية</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      إحصاءات شاملة لتوزيع المساعدات وعدد المستفيدين والأسر في كل حي
                    </p>
                  </div>
                  <input
                    type="text"
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    placeholder="ابحث باسم الحي..."
                    className="px-3 py-1.5 border rounded-lg text-xs w-full sm:w-64"
                  />
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-700 font-bold border-b">
                        <th className="py-3 px-4">#</th>
                        <th className="py-3 px-4">اسم الحي</th>
                        <th className="py-3 px-4 text-center">المستفيدون العامون</th>
                        <th className="py-3 px-4 text-center">المستفيدون اليوميون</th>
                        <th className="py-3 px-4 text-center">إجمالي المستفيدين</th>
                        <th className="py-3 px-4 text-center">الأسر المتعففة</th>
                        <th className="py-3 px-4 text-center">السلال الموزعة</th>
                        <th className="py-3 px-4 text-center">الجهات الشريكة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {analytics.neighborhoods?.list
                        ?.filter((nh) => nh.neighborhood.includes(tableSearch))
                        .map((nh, i) => (
                          <tr key={nh.neighborhood} className="hover:bg-slate-50">
                            <td className="py-3 px-4 text-slate-400">{i + 1}</td>
                            <td className="py-3 px-4 font-bold text-slate-800">{nh.neighborhood}</td>
                            <td className="py-3 px-4 text-center">{nh.general_beneficiaries}</td>
                            <td className="py-3 px-4 text-center">{nh.daily_beneficiaries}</td>
                            <td className="py-3 px-4 text-center font-bold text-[#3F6B3A]">{nh.total_beneficiaries}</td>
                            <td className="py-3 px-4 text-center">{nh.families_count}</td>
                            <td className="py-3 px-4 text-center">
                              <span className="px-2 py-0.5 bg-[#EBF4EA] text-[#2E5A27] font-bold rounded">
                                {nh.baskets_distributed}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center text-slate-600">{nh.organizations_count}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════ */}
            {/* VIEW 6: ORGANIZATIONS TAB                                         */}
            {/* ══════════════════════════════════════════════════════════════════ */}
            {activeTab === "organizations" && (
              <div className="bg-white border rounded-xl shadow-sm overflow-hidden space-y-4">
                <div className="p-4 border-b flex items-center justify-between">
                  <h3 className="font-bold text-slate-800 text-sm">الجهات المستفيدة ومندوبو الأحياء</h3>
                  <span className="text-xs text-slate-500">
                    إجمالي الجهات: <strong>{analytics.organizations?.total || 0}</strong>
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-700 font-bold border-b">
                        <th className="py-3 px-4">اسم الجهة / المندوب</th>
                        <th className="py-3 px-4">الحي التابع</th>
                        <th className="py-3 px-4">رقم الجوال</th>
                        <th className="py-3 px-4 text-center">المستفيدون التابعون</th>
                        <th className="py-3 px-4 text-center">الأسر التابعة</th>
                        <th className="py-3 px-4 text-center">السلال المستلمة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {analytics.organizations?.list?.map((org) => (
                        <tr key={org.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-bold text-slate-800">{org.organization_name}</td>
                          <td className="py-3 px-4 text-slate-600">{org.neighborhood}</td>
                          <td className="py-3 px-4 font-mono text-slate-600" dir="ltr">{org.phone}</td>
                          <td className="py-3 px-4 text-center font-semibold">{org.beneficiaries_count}</td>
                          <td className="py-3 px-4 text-center font-semibold">{org.families_count}</td>
                          <td className="py-3 px-4 text-center font-bold text-[#8C6C26]">
                            <span className="px-2.5 py-0.5 bg-[#F5EDDA] rounded">
                              {org.baskets_received} سلة
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════ */}
            {/* VIEW 7: DELIVERY TAB                                              */}
            {/* ══════════════════════════════════════════════════════════════════ */}
            {activeTab === "delivery" && (
              <div className="bg-white border rounded-xl shadow-sm overflow-hidden space-y-4">
                <div className="p-4 border-b flex items-center justify-between">
                  <h3 className="font-bold text-slate-800 text-sm">أداء أسطول وسائقي التوصيل</h3>
                  <span className="text-xs text-slate-500">
                    إجمالي التوصيلات: <strong>{analytics.delivery?.total_deliveries || 0}</strong>
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-700 font-bold border-b">
                        <th className="py-3 px-4">اسم السائق</th>
                        <th className="py-3 px-4">رقم الجوال</th>
                        <th className="py-3 px-4 text-center">إجمالي التوصيلات</th>
                        <th className="py-3 px-4 text-center">المكتملة</th>
                        <th className="py-3 px-4 text-center">المستفيدون المخدومون</th>
                        <th className="py-3 px-4 text-center">نسبة الإنجاز</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {analytics.delivery?.drivers?.map((drv) => (
                        <tr key={drv.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-bold text-slate-800">{drv.name}</td>
                          <td className="py-3 px-4 font-mono text-slate-600" dir="ltr">{drv.phone}</td>
                          <td className="py-3 px-4 text-center font-semibold">{drv.total_deliveries}</td>
                          <td className="py-3 px-4 text-center font-bold text-emerald-700">{drv.completed_deliveries}</td>
                          <td className="py-3 px-4 text-center text-slate-700">{drv.beneficiaries_served}</td>
                          <td className="py-3 px-4 text-center">
                            <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {drv.success_rate}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════ */}
            {/* VIEW 8: STAFF TAB                                                 */}
            {/* ══════════════════════════════════════════════════════════════════ */}
            {activeTab === "staff" && (
              <div className="bg-white border rounded-xl shadow-sm p-6 space-y-4">
                <h3 className="font-bold text-slate-800 text-sm pb-2 border-b">
                  إحصاءات دعم موظفي الجمعية
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                  <div className="p-4 bg-slate-50 rounded-xl border">
                    <span className="text-xs text-slate-500 block">إجمالي موظفي الجمعية</span>
                    <strong className="text-2xl font-bold text-slate-800 mt-1 block">
                      {analytics.staff?.total || 0}
                    </strong>
                  </div>
                  <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                    <span className="text-xs text-emerald-700 block">موظفون استلموا سلال</span>
                    <strong className="text-2xl font-bold text-emerald-800 mt-1 block">
                      {analytics.staff?.received_count || 0}
                    </strong>
                  </div>
                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                    <span className="text-xs text-amber-700 block">إجمالي السلال المخصصة</span>
                    <strong className="text-2xl font-bold text-amber-800 mt-1 block">
                      {analytics.staff?.baskets_distributed || 0}
                    </strong>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Toast Notification */}
        <Toast
          show={toast.show}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ ...toast, show: false })}
        />
      </div>
    </MainLayout>
  );
}
