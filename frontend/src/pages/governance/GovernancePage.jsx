import { useState, useEffect, useMemo } from "react";
import MainLayout from "../../components/layout/MainLayout";
import PageShell from "../../components/ui/PageShell";
import KpiCard from "../../components/ui/KpiCard";
import { displayHeading, displayLabel, displayReason } from "../../utils/displayVocabulary";
import Button from "../../components/ui/Button";
import SearchField from "../../components/ui/SearchField";
import Toast from "../../components/ui/Toast";
import { getAnalytics } from "../../api/dailyBeneficiaries";
import { getDocumentPdfUrl, downloadDocument } from "../../utils/documentUrl";
import { ColumnChart, LineChart, FunnelChart, PieChart } from "./GovernanceCharts";
import { useAuth } from "../../context/AuthContext";
import {
  BarChart3,
  TrendingUp,
  Users,
  Package,
  FileSpreadsheet,
  Download,
  Calendar,
  CheckCircle2,
  Building2,
  UserCheck,
  AlertTriangle,
  Printer,
  Truck,
  Briefcase,
  MapPin,
  Layers,
} from "lucide-react";

const CODE_FIELDS = { status: "status", beneficiary_type: "beneficiary", family_status: "family", housing_type: "housing", priority: "priority", fulfillment_method: "fulfillment", income_category: "financialCategory", score_category: "scoreCategory", eligibility_decision: "status", evaluation_status: "status", decision: "status", recipient_type: "recipient" };
function governanceCell(key, value) {
  if (value == null || value === "") return "—";
  if (key === "stable_reason_code") return displayReason(value);
  if (CODE_FIELDS[key]) return displayLabel(CODE_FIELDS[key], value);
  return String(value);
}

export default function GovernancePage() {
  const { user } = useAuth();
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
  const [inventoryDrilldown, setInventoryDrilldown] = useState(null);
  const [reportDataset, setReportDataset] = useState("beneficiaries");
  const [reportDomain, setReportDomain] = useState("all");
  const [reportStatus, setReportStatus] = useState("");
  const [reportSearch, setReportSearch] = useState("");
  const [reportPage, setReportPage] = useState(1);
  const [reportPerPage, setReportPerPage] = useState(10);

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
        report_dataset: reportDataset,
        domain: reportDomain,
        status: reportStatus || undefined,
        search: reportSearch || undefined,
        page: reportPage,
        per_page: reportPerPage,
      };

      const res = await getAnalytics(params);
      if (res.data?.success) {
        setAnalytics(res.data);
      }
    } catch (err) {
      console.error(err);
      setToast({
        show: true,
        message: err.response?.data?.message || "فشل في تحميل بيانات الحوكمة والتحليلات",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [periodType, selectedDate, startDate, endDate, selectedMonth, selectedYear, reportDataset, reportDomain, reportStatus, reportSearch, reportPage, reportPerPage]);

  // Handle Export to Excel
  const handleExportExcel = async () => {
    try {
      await downloadDocument(pdfComprehensiveUrl.replace('/pdf?', '/excel?'), 'governance-data.xlsx');
      setToast({ show: true, message: 'تم تصدير جميع البيانات المطابقة', type: 'success' });
    } catch (err) {
      setToast({
        show: true,
        message: err.response?.data?.message || 'تعذر تصدير البيانات',
        type: 'error',
      });
    }
  };

  // PDF Export URLs
  const pdfComprehensiveUrl = useMemo(() => {
    const params = new URLSearchParams({ period_type: periodType });
    if (periodType === 'daily') params.set('date', selectedDate);
    if (periodType === 'weekly' || periodType === 'custom') {
      params.set('start_date', startDate);
      params.set('end_date', endDate);
    }
    if (periodType === 'monthly') {
      params.set('month', selectedMonth);
      params.set('year', selectedYear);
    }
    if (periodType === 'yearly') params.set('year', selectedYear);
    params.set('report_dataset', reportDataset);
    params.set('domain', reportDomain);
    if (reportStatus) params.set('status', reportStatus);
    if (reportSearch) params.set('search', reportSearch);
    return getDocumentPdfUrl(`/reports/comprehensive/pdf?${params.toString()}`);
  }, [periodType, startDate, endDate, selectedDate, selectedMonth, selectedYear, reportDataset, reportDomain, reportStatus, reportSearch]);

  const isAdmin = user?.role === "admin";
  const canExcel = isAdmin || user?.permissions?.governance?.export_excel === true;
  const canPdf = isAdmin || user?.permissions?.governance?.export_pdf === true;

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
      <PageShell
        title="منظومة الحوكمة والتحليلات الشاملة"
        description="لقطة المستفيدين الحالية منفصلة عن عمليات الدعم المستحقة خلال الفترة."
        breadcrumbs={[{ label: "الحوكمة والتقارير" }]}
        secondaryActions={
            <div className="flex flex-wrap items-center gap-2">
              {canExcel && <Button variant="outline" size="sm" icon={FileSpreadsheet} onClick={handleExportExcel}>تصدير إكسل</Button>}
              {canPdf && <a href={pdfDailyUrl} target="_blank" rel="noreferrer"><Button variant="outline" size="sm" icon={Printer}>التقرير اليومي</Button></a>}
              {canPdf && <a href={pdfComprehensiveUrl} target="_blank" rel="noreferrer"><Button variant="secondary" size="sm" icon={Download}>التقرير الشامل</Button></a>}
            </div>
        }
      >

        {/* Date Range Selector Box */}
        <div className="ikram-panel p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5 bg-[var(--color-surface)] p-1 rounded-lg border border-[var(--color-border)] text-xs">
              <button
                onClick={() => setPeriodType("daily")}
                className={`px-3 py-1.5 rounded-md font-bold transition-colors ${
                  periodType === "daily" ? "bg-[var(--color-brand-green)] text-white shadow-xs" : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-soft)]"
                }`}
              >
                يومي
              </button>
              <button
                onClick={() => setPeriodType("weekly")}
                className={`px-3 py-1.5 rounded-md font-bold transition-colors ${
                  periodType === "weekly" ? "bg-[var(--color-brand-green)] text-white shadow-xs" : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-soft)]"
                }`}
              >
                أسبوعي
              </button>
              <button
                onClick={() => setPeriodType("monthly")}
                className={`px-3 py-1.5 rounded-md font-bold transition-colors ${
                  periodType === "monthly" ? "bg-[var(--color-brand-green)] text-white shadow-xs" : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-soft)]"
                }`}
              >
                شهري
              </button>
              <button
                onClick={() => setPeriodType("yearly")}
                className={`px-3 py-1.5 rounded-md font-bold transition-colors ${
                  periodType === "yearly" ? "bg-[var(--color-brand-green)] text-white shadow-xs" : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-soft)]"
                }`}
              >
                سنوي
              </button>
              <button
                onClick={() => setPeriodType("custom")}
                className={`px-3 py-1.5 rounded-md font-bold transition-colors ${
                  periodType === "custom" ? "bg-[var(--color-brand-green)] text-white shadow-xs" : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-soft)]"
                }`}
              >
                نطاق مخصص
              </button>
            </div>

            {/* Dynamic Date Inputs based on periodType */}
            <div className="flex items-center gap-2 text-xs">
              {periodType === "daily" && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[var(--color-text-muted)]">حدد اليوم:</span>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="px-3 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-xs focus:outline-none focus:border-[var(--color-brand-green)]"
                  />
                </div>
              )}

              {(periodType === "weekly" || periodType === "custom") && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[var(--color-text-secondary)] font-bold">من تاريخ:</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setDateRangeError("");
                    }}
                    className="px-2.5 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-xs font-mono focus:border-[var(--color-brand-green)] focus:outline-none"
                  />
                  <span className="text-[var(--color-text-secondary)] font-bold">إلى تاريخ:</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setDateRangeError("");
                    }}
                    className="px-2.5 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-xs font-mono focus:border-[var(--color-brand-green)] focus:outline-none"
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
                    className="px-3 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-xs"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                      <option key={m} value={m}>شهر {m}</option>
                    ))}
                  </select>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="px-3 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-xs"
                  >
                    {[2025, 2026, 2027].map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              )}

              {periodType === "yearly" && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[var(--color-text-muted)]">السنة المالية:</span>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="px-3 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-xs font-bold"
                  >
                    {[2025, 2026, 2027].map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              )}

              <span className="hidden sm:inline-block px-3 py-1.5 bg-[var(--color-bg-soft)] text-[#8C6C26] rounded-lg font-bold">
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
            <div className="p-3 bg-[var(--color-bg-soft)] border border-[var(--color-border)] rounded-xl flex flex-wrap items-center justify-between text-xs gap-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[var(--color-brand-gold)]" />
                <span className="text-[var(--color-text-muted)] font-medium">فترة التقرير الحالية:</span>
                <strong className="text-[var(--color-text-primary)] font-mono">
                  من {analytics.period.start_date} إلى {analytics.period.end_date}
                </strong>
                <span className="text-[11px] text-[var(--color-text-muted)]">({analytics.period.label})</span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={pdfComprehensiveUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 bg-[var(--color-surface)] border border-[var(--color-border)] hover:bg-[var(--color-bg-soft)] rounded-lg text-xs font-bold text-[var(--color-brand-green)] flex items-center gap-1 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>تصدير تقرير الفترة (PDF)</span>
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Dashboard Navigation Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-[var(--color-border)] text-xs font-bold">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2.5 rounded-t-lg transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === "overview"
                ? "border-[var(--color-brand-green)] text-[var(--color-brand-green)] bg-[var(--color-surface)]"
                : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            نظرة عامة والمؤشرات
          </button>

          <button
            onClick={() => setActiveTab("beneficiaries")}
            className={`px-4 py-2.5 rounded-t-lg transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === "beneficiaries"
                ? "border-[var(--color-brand-green)] text-[var(--color-brand-green)] bg-[var(--color-surface)]"
                : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            <Users className="w-4 h-4" />
            تحليلات المستفيدين العامين
          </button>

          <button
            onClick={() => setActiveTab("daily")}
            className={`px-4 py-2.5 rounded-t-lg transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === "daily"
                ? "border-[var(--color-brand-green)] text-[var(--color-brand-green)] bg-[var(--color-surface)]"
                : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            <UserCheck className="w-4 h-4" />
            تحليلات المستفيدين اليوميين
          </button>

          <button
            onClick={() => setActiveTab("inventory")}
            className={`px-4 py-2.5 rounded-t-lg transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === "inventory"
                ? "border-[var(--color-brand-green)] text-[var(--color-brand-green)] bg-[var(--color-surface)]"
                : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            <Package className="w-4 h-4" />
            مقارنة المخزون والصلاحيات
          </button>

          <button
            onClick={() => setActiveTab("neighborhoods")}
            className={`px-4 py-2.5 rounded-t-lg transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === "neighborhoods"
                ? "border-[var(--color-brand-green)] text-[var(--color-brand-green)] bg-[var(--color-surface)]"
                : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            <MapPin className="w-4 h-4" />
            مصفوفة الأحياء السكنية
          </button>

          <button
            onClick={() => setActiveTab("organizations")}
            className={`px-4 py-2.5 rounded-t-lg transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === "organizations"
                ? "border-[var(--color-brand-green)] text-[var(--color-brand-green)] bg-[var(--color-surface)]"
                : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            <Building2 className="w-4 h-4" />
            الجهات والمنظمات
          </button>

          <button
            onClick={() => setActiveTab("delivery")}
            className={`px-4 py-2.5 rounded-t-lg transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === "delivery"
                ? "border-[var(--color-brand-green)] text-[var(--color-brand-green)] bg-[var(--color-surface)]"
                : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            <Truck className="w-4 h-4" />
            التوصيل واللوجستيات
          </button>

          <button
            onClick={() => setActiveTab("staff")}
            className={`px-4 py-2.5 rounded-t-lg transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === "staff"
                ? "border-[var(--color-brand-green)] text-[var(--color-brand-green)] bg-[var(--color-surface)]"
                : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            <Briefcase className="w-4 h-4" />
            دعم الموظفين
          </button>
        </div>

        {loading ? (
          <div className="py-20 text-center text-[var(--color-text-muted)]">
            <div className="w-10 h-10 border-4 border-[var(--color-brand-green)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            جاري تجميع وحساب المؤشرات الإحصائية المعتمدة...
          </div>
        ) : !analytics ? (
          <div className="py-20 text-center text-[var(--color-text-muted)]">لا تتوفر بيانات للفترة المحددة.</div>
        ) : (
          <>
            {/* ══════════════════════════════════════════════════════════════════ */}
            {/* VIEW 1: OVERVIEW TAB                                              */}
            {/* ══════════════════════════════════════════════════════════════════ */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                <section className="space-y-3">
                  <h2 className="text-sm font-extrabold">الفترة المحددة: عمليات الدعم</h2>
                  <p className="text-xs text-[var(--color-text-muted)]">من {analytics.period?.start_date} إلى {analytics.period?.end_date}. العمليات المستحقة غير المكتملة ليست عدد كل المسجلين.</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <KpiCard title="العمليات المستحقة" value={analytics.operational_metrics?.total_due || 0} />
                    <KpiCard title="اكتملت حتى نهاية الفترة" value={analytics.operational_metrics?.completed_by_cutoff || 0} />
                    <KpiCard title="اكتملت خلال الفترة" value={analytics.operational_metrics?.completed_in_period || 0} />
                    <KpiCard title="العمليات المستحقة غير المكتملة" value={analytics.operational_metrics?.not_completed || 0} />
                    <KpiCard title="العمليات المتأخرة" value={analytics.operational_metrics?.overdue || 0} />
                    <KpiCard title="المستفيدون المستحقون" value={analytics.operational_metrics?.unique_due_beneficiaries || 0} />
                    <KpiCard title="المستفيدون الذين استلموا" value={analytics.operational_metrics?.unique_completed_beneficiaries || 0} />
                    <KpiCard title="المستفيدون المتبقون" value={analytics.operational_metrics?.unique_not_completed_beneficiaries || 0} />
                  </div>
                </section>
                {/* Grand Summary KPIs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="ikram-panel p-5">
                    <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--color-text-secondary)] font-semibold">لقطة: إجمالي المستفيدين المسجلين</span>
                      <span className="p-2 bg-[var(--color-brand-green)]/10 text-[var(--color-brand-green)] rounded-lg">
                        <Users className="w-5 h-5" />
                      </span>
                    </div>
                    <div className="text-2xl font-bold text-[var(--color-text-primary)] mt-2">
                      {analytics.kpis?.grand_total_beneficiaries || 0}
                    </div>
                    <div className="text-[11px] text-[var(--color-text-muted)] mt-1 flex justify-between">
                      <span>عام: {analytics.beneficiaries?.total || 0}</span>
                      <span>يومي: {analytics.daily_beneficiaries?.total || 0}</span>
                    </div>
                  </div>

                  <div className="ikram-panel p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[var(--color-text-secondary)] font-semibold">الفترة: مستفيدون اكتمل دعمهم</span>
                      <span className="p-2 bg-[var(--color-bg-soft)] text-[var(--color-info)] rounded-lg">
                        <CheckCircle2 className="w-5 h-5" />
                      </span>
                    </div>
                    <div className="text-2xl font-bold text-[var(--color-text-primary)] mt-2">
                      {analytics.operational_metrics?.unique_completed_beneficiaries || 0}
                    </div>
                    <div className="text-[11px] text-[var(--color-text-muted)] mt-1 flex justify-between">
                      <span>عمليات مكتملة: {analytics.operational_metrics?.completed_in_period || 0}</span>
                      <span>يومي: {analytics.daily_beneficiaries?.received_count || 0}</span>
                    </div>
                  </div>

                  <div className="ikram-panel p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[var(--color-text-secondary)] font-semibold">سجل السلال القديم</span>
                      <span className="p-2 bg-[var(--color-bg-soft)] text-[var(--color-brand-gold)] rounded-lg">
                        <Package className="w-5 h-5" />
                      </span>
                    </div>
                    <div className="text-2xl font-bold text-[var(--color-text-primary)] mt-2">
                      {analytics.kpis?.grand_total_baskets || 0}
                    </div>
                    <div className="text-[11px] text-[var(--color-text-muted)] mt-1 flex justify-between">
                      <span>توزيع عام: {analytics.beneficiaries?.baskets_distributed || 0}</span>
                      <span>يومي: {analytics.daily_beneficiaries?.baskets_distributed || 0}</span>
                    </div>
                  </div>

                  <div className="ikram-panel p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[var(--color-text-muted)] font-semibold">عمليات الاستلام اليومي</span>
                      <span className="p-2 bg-[var(--color-bg-soft)] text-[var(--color-brand-green)] rounded-lg">
                        <TrendingUp className="w-5 h-5" />
                      </span>
                    </div>
                    <div className="text-2xl font-bold text-[var(--color-brand-green)] mt-2">
                      {analytics.daily_beneficiaries?.transactions_count || 0}
                    </div>
                    <div className="text-[11px] text-[var(--color-text-muted)] mt-1">
                      سند استلام فوري موثق
                    </div>
                  </div>
                </div>

                {/* ══════════════════════════════════════════════════════════════ */}
                {/* 4 GOVERNANCE CHARTS SECTION (REAL DATA)                       */}
                {/* ══════════════════════════════════════════════════════════════ */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-[var(--color-brand-green)]" />
                      مخططات الحوكمة والتحليلات البيانية المعتمدة (بيانات فعلية من النظام)
                    </h3>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      محدثة وفق النطاق: {analytics.period?.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* 1. Column Chart: فئات الاستحقاق */}
                    <ColumnChart
                      data={analytics.charts?.column_chart?.data}
                      title={analytics.charts?.column_chart?.title}
                    />

                    {/* 2. Line Chart: التطور الزمني للتسجيل والمساعدات */}
                    <LineChart
                      data={analytics.charts?.line_chart?.data}
                      title={analytics.charts?.line_chart?.title}
                    />

                    {/* 3. Funnel Chart: مسار مراحل الاستحقاق والدعم */}
                    <FunnelChart
                      stages={analytics.charts?.funnel_chart?.stages}
                      title={analytics.charts?.funnel_chart?.title}
                    />

                    {/* 4. Pie Chart: التوزيع النسبي (مواطن/مقيم وبنية الأسرة) */}
                    <PieChart
                      data={analytics.charts?.pie_chart?.data}
                      secondaryData={analytics.charts?.pie_chart?.secondary_data}
                      title={analytics.charts?.pie_chart?.title}
                    />
                  </div>

                  {analytics.nationality_analysis?.chart && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-[var(--color-text-primary)]">تحليل الجنسية</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {["registered", "active", "served"].map((key) => {
                          const population = analytics.nationality_analysis.populations?.[key];
                          if (!population) return null;
                          return (
                            <div key={key} className="ikram-panel p-5">
                              <span className="text-xs text-[var(--color-text-muted)] font-semibold">{population.label}</span>
                              <div className="text-2xl font-bold text-[var(--color-text-primary)] mt-2">{population.total ?? 0}</div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {analytics.nationality_analysis.chart.series?.map((series) => (
                          <ColumnChart
                            key={series.key}
                            title={series.label}
                            data={(analytics.nationality_analysis.chart.categories || []).map((category, index) => ({
                              label: category.label,
                              count: Number(series.data?.[index] ?? 0),
                            }))}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <section className="ikram-panel overflow-hidden" data-testid="governance-server-report">
                  <div className="p-5 border-b border-[var(--color-border)] bg-[var(--color-bg-soft)] space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-[var(--color-text-primary)]">سجل التقرير التفصيلي</h3>
                        <p className="text-xs text-[var(--color-text-muted)] mt-1">ترشيح وترقيم من الخادم. تُصدّر الملفات جميع الصفوف المطابقة بصرف النظر عن الصفحة الحالية.</p>
                      </div>
                      <span className="text-xs font-bold text-[var(--color-brand-green)] bg-[#EBF4EA] px-3 py-1 rounded-full">{analytics.detail?.total || 0} سجل مطابق</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                      <label className="text-xs text-[var(--color-text-secondary)]">نوع السجل
                        <select value={reportDataset} onChange={(e) => { setReportDataset(e.target.value); setReportPage(1); }} className="mt-1 w-full border rounded-lg px-3 py-2 bg-[var(--color-surface)]">
                          <option value="beneficiaries">المستفيدون الدائمون</option><option value="daily_beneficiaries">المستفيدون اليوميون</option>
                          <option value="policy_evaluations">تقييمات السياسة</option><option value="policy_decisions">قرارات السياسة</option>
                          <option value="support_distributions">عمليات الدعم</option><option value="legacy_distributions">التوزيع القديم</option>
                          <option value="main_inventory_movements">حركات المخزون العام</option><option value="daily_inventory_movements">حركات مخزون اليوميين</option>
                        </select>
                      </label>
                      <label className="text-xs text-[var(--color-text-secondary)]">المجال
                        <select value={reportDomain} onChange={(e) => { setReportDomain(e.target.value); setReportPage(1); }} className="mt-1 w-full border rounded-lg px-3 py-2 bg-[var(--color-surface)]">
                          <option value="all">الكل</option><option value="permanent">دائم فقط</option><option value="daily">يومي فقط</option>
                        </select>
                      </label>
                      <label className="text-xs text-[var(--color-text-secondary)]">الحالة
                        <input value={reportStatus} onChange={(e) => { setReportStatus(e.target.value); setReportPage(1); }} placeholder="مثال: active" className="mt-1 w-full border rounded-lg px-3 py-2 bg-[var(--color-surface)]" />
                      </label>
                      <SearchField label="بحث التقرير" value={reportSearch} onChange={(e) => { setReportSearch(e.target.value); setReportPage(1); }} placeholder="الاسم أو الحي" />
                      <label className="text-xs text-[var(--color-text-secondary)]">صفوف الصفحة
                        <select value={reportPerPage} onChange={(e) => { setReportPerPage(Number(e.target.value)); setReportPage(1); }} className="mt-1 w-full border rounded-lg px-3 py-2 bg-[var(--color-surface)]">
                          <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option>
                        </select>
                      </label>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="ikram-table whitespace-nowrap">
                      <thead className="bg-[#355B30] text-white"><tr>{Object.keys(analytics.detail?.data?.[0] || {}).map((key) => <th key={key} className="px-3 py-3">{displayHeading(key)}</th>)}</tr></thead>
                      <tbody className="divide-y divide-[var(--color-border)]">
                        {(analytics.detail?.data || []).map((row) => <tr key={row.id} className="hover:bg-[var(--color-bg-soft)]">{Object.keys(analytics.detail?.data?.[0] || {}).map((key) => <td key={key} className="px-3 py-2.5 max-w-64 overflow-hidden text-ellipsis">{governanceCell(key, row[key])}</td>)}</tr>)}
                        {!analytics.detail?.data?.length && <tr><td className="p-8 text-center text-[var(--color-text-muted)]">لا توجد سجلات مطابقة.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                  <div className="p-4 border-t flex items-center justify-between gap-3 text-xs">
                    <Button size="sm" variant="outline" disabled={(analytics.detail?.page || 1) <= 1} onClick={() => setReportPage((p) => Math.max(1, p - 1))}>السابق</Button>
                    <span>صفحة {analytics.detail?.page || 1} من {analytics.detail?.last_page || 1}</span>
                    <Button size="sm" variant="outline" disabled={(analytics.detail?.page || 1) >= (analytics.detail?.last_page || 1)} onClick={() => setReportPage((p) => p + 1)}>التالي</Button>
                  </div>
                </section>

                {/* Two Column Grid: Categories Breakdown & Neighborhood Highlights */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Categories Breakdown */}
                  <div className="ikram-panel p-5 space-y-4">
                    <h3 className="font-bold text-[var(--color-text-primary)] text-sm flex items-center justify-between pb-3 border-b">
                      <span className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-[var(--color-brand-green)]" />
                        توزيع المستفيدين العامين حسب الفئات
                      </span>
                      <span className="text-xs text-[var(--color-text-muted)]">إجمالي الفئات</span>
                    </h3>

                    <div className="space-y-3">
                      {analytics.beneficiaries?.categories?.map((cat) => (
                        <div key={cat.id} className="space-y-1 text-xs">
                          <div className="flex justify-between font-semibold">
                            <span className="text-[var(--color-text-secondary)]">{cat.name}</span>
                            <span className="text-[var(--color-text-muted)]">
                              {cat.total_beneficiaries} مستفيد (استلم منهم:{" "}
                              <strong className="text-[var(--color-brand-green)]">{cat.received_count}</strong>)
                            </span>
                          </div>
                          <div className="w-full h-2 bg-[var(--color-bg-soft)] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[var(--color-brand-green)] rounded-full transition-all"
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
                  <div className="ikram-panel p-5 space-y-4">
                    <h3 className="font-bold text-[var(--color-text-primary)] text-sm flex items-center justify-between pb-3 border-b">
                      <span className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-[var(--color-brand-gold)]" />
                        سلال المستفيدين اليوميين المصروفة في الفترة
                      </span>
                      <span className="text-xs text-[var(--color-text-muted)]">حسب نوع السلة</span>
                    </h3>

                    <div className="space-y-3">
                      {analytics.daily_beneficiaries?.by_basket_type?.length === 0 ? (
                        <p className="text-center py-8 text-xs text-[var(--color-text-muted)]">
                          لا توجد سلال يومية مصروفة خلال هذه الفترة.
                        </p>
                      ) : (
                        analytics.daily_beneficiaries?.by_basket_type?.map((b) => (
                          <div key={b.basket_type_name} className="p-3 bg-[var(--color-bg-soft)] rounded-lg flex items-center justify-between text-xs">
                            <div>
                              <strong className="text-[var(--color-text-primary)] block">{b.basket_type_name}</strong>
                              <span className="text-[11px] text-[var(--color-text-muted)] mt-0.5 block">
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
                {analytics.inventory?.expiry_alerts?.expired_count > 0 || analytics.inventory?.expiry_alerts?.in_5_days_count > 0 ? (
                  <div className="p-4 bg-[var(--color-bg-soft)] border border-[var(--color-border)] rounded-xl flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-[var(--color-brand-gold)] shrink-0 mt-0.5" />
                    <div className="text-xs space-y-1">
                      <strong className="text-[var(--color-text-secondary)] font-bold block">
                        تنبيهات سلامة وجودة المخزون الغذائي:
                      </strong>
                      <p className="text-[var(--color-text-secondary)]">
                        يوجد <strong>{analytics.inventory.expiry_alerts.expired_count}</strong> أصناف منتهية الصلاحية بمستودع اليوميين، و{" "}
                        <strong>{analytics.inventory.expiry_alerts.in_5_days_count}</strong> أصناف تنتهي صلاحيتها خلال الـ 5 أيام القادمة. يرجى مراجعة تبويب "مقارنة المخزون والصلاحيات".
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
                  <div className="bg-[var(--color-surface)] border p-4 rounded-xl shadow-sm text-center">
                    <span className="text-xs text-[var(--color-text-muted)] block">لقطة: إجمالي المستفيدين</span>
                    <strong className="text-2xl font-bold text-[var(--color-text-primary)]">{analytics.beneficiaries?.total || 0}</strong>
                  </div>
                  <div className="bg-[var(--color-surface)] border p-4 rounded-xl shadow-sm text-center">
                    <span className="text-xs text-[var(--color-text-muted)] block">مستفيدون اكتمل دعمهم حتى نهاية الفترة</span>
                    <strong className="text-2xl font-bold text-[var(--color-brand-green)]">{analytics.beneficiaries?.received_count || 0}</strong>
                  </div>
                  <div className="bg-[var(--color-surface)] border p-4 rounded-xl shadow-sm text-center">
                    <span className="text-xs text-[var(--color-text-muted)] block">مستفيدون متبقون من العمليات المستحقة</span>
                    <strong className="text-2xl font-bold text-[var(--color-text-primary)]">{analytics.beneficiaries?.not_received_count || 0}</strong>
                  </div>
                  <div className="bg-[var(--color-surface)] border p-4 rounded-xl shadow-sm text-center">
                    <span className="text-xs text-[var(--color-text-muted)] block">عدد الأسر المتعففة</span>
                    <strong className="text-2xl font-bold text-[var(--color-text-primary)]">{analytics.beneficiaries?.families_count || 0}</strong>
                  </div>
                </div>

                <div className="bg-[var(--color-surface)] border rounded-xl shadow-sm p-5 space-y-4">
                  <h3 className="font-bold text-[var(--color-text-primary)] text-sm pb-2 border-b">
                    توزيع المستفيدين العامين ونسب الاستلام حسب الفئات
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="ikram-table">
                      <thead>
                        <tr className="bg-[var(--color-bg-soft)] text-[var(--color-text-secondary)] font-bold border-b">
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
                            <tr key={cat.id} className="hover:bg-[var(--color-bg-soft)]">
                              <td className="py-2.5 px-3 font-bold text-[var(--color-text-primary)]">{cat.name}</td>
                              <td className="py-2.5 px-3 text-center font-semibold">{cat.total_beneficiaries}</td>
                              <td className="py-2.5 px-3 text-center text-[var(--color-brand-green)] font-bold">{cat.received_count}</td>
                              <td className="py-2.5 px-3 text-center text-[var(--color-text-muted)]">{cat.total_beneficiaries - cat.received_count}</td>
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
                  <div className="bg-[var(--color-surface)] border p-4 rounded-xl shadow-sm text-center">
                    <span className="text-xs text-[var(--color-text-muted)] block">إجمالي المستفيدين اليوميين</span>
                    <strong className="text-2xl font-bold text-[var(--color-text-primary)]">{analytics.daily_beneficiaries?.total || 0}</strong>
                  </div>
                  <div className="bg-[var(--color-surface)] border p-4 rounded-xl shadow-sm text-center">
                    <span className="text-xs text-[var(--color-text-muted)] block">استلموا في الفترة</span>
                    <strong className="text-2xl font-bold text-[var(--color-brand-green)]">{analytics.daily_beneficiaries?.received_count || 0}</strong>
                  </div>
                  <div className="bg-[var(--color-surface)] border p-4 rounded-xl shadow-sm text-center">
                    <span className="text-xs text-[var(--color-text-muted)] block">السلال المصروفة لهم</span>
                    <strong className="text-2xl font-bold text-[var(--color-text-primary)]">{analytics.daily_beneficiaries?.baskets_distributed || 0}</strong>
                  </div>
                  <div className="bg-[var(--color-surface)] border p-4 rounded-xl shadow-sm text-center">
                    <span className="text-xs text-[var(--color-text-muted)] block">عمليات الاستلام المنفذة</span>
                    <strong className="text-2xl font-bold text-[var(--color-text-primary)]">{analytics.daily_beneficiaries?.transactions_count || 0}</strong>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* By Basket Type */}
                  <div className="bg-[var(--color-surface)] border rounded-xl shadow-sm p-5 space-y-4">
                    <h3 className="font-bold text-[var(--color-text-primary)] text-sm pb-2 border-b">
                      توزيع السلال اليومية حسب الصنف
                    </h3>
                    <div className="space-y-2.5">
                      {analytics.daily_beneficiaries?.by_basket_type?.map((b) => (
                        <div key={b.basket_type_name} className="flex items-center justify-between p-3 bg-[var(--color-bg-soft)] rounded-lg text-xs">
                          <span className="font-bold text-[var(--color-text-primary)]">{b.basket_type_name}</span>
                          <span className="px-2.5 py-1 bg-[var(--color-bg-soft)] text-[var(--color-brand-green)] rounded font-bold">
                            {b.total_quantity} سلة
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* By District */}
                  <div className="bg-[var(--color-surface)] border rounded-xl shadow-sm p-5 space-y-4">
                    <h3 className="font-bold text-[var(--color-text-primary)] text-sm pb-2 border-b">
                      توزيع المستفيدين اليوميين حسب الأحياء
                    </h3>
                    <div className="space-y-2.5 max-h-72 overflow-y-auto">
                      {analytics.daily_beneficiaries?.by_district?.map((d) => (
                        <div key={d.district} className="flex items-center justify-between p-2.5 bg-[var(--color-bg-soft)] rounded-lg text-xs">
                          <span className="text-[var(--color-text-secondary)] font-semibold">{d.district}</span>
                          <span className="font-mono font-bold text-[var(--color-text-primary)]">{d.total_count} مستفيد</span>
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
                  <div className="bg-[var(--color-surface)] border rounded-xl shadow-sm p-5 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b">
                      <div className="flex items-center gap-2">
                        <Package className="w-5 h-5 text-[var(--color-brand-green)]" />
                        <h3 className="font-bold text-[var(--color-text-primary)] text-base">المستودع المركزي العام</h3>
                      </div>
                      <span className="text-xs bg-[var(--color-bg-soft)] px-2 py-0.5 rounded text-[var(--color-text-secondary)]">
                        {analytics.inventory?.main?.total_items || 0} أصناف
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 bg-[var(--color-bg-soft)] rounded-lg text-center">
                        <span className="text-[var(--color-text-muted)] block">الرصيد المتاح الحالي</span>
                        <strong className="text-lg font-bold text-[var(--color-text-primary)] mt-1 block">
                          {analytics.inventory?.main?.total_quantity || 0}
                        </strong>
                      </div>
                      <div className="p-3 bg-[var(--color-bg-soft)] text-[var(--color-brand-green)] rounded-lg text-center">
                        <span className="text-[var(--color-brand-green)] block">التوريد في الفترة (+)</span>
                        <strong className="text-lg font-bold mt-1 block">
                          +{analytics.inventory?.main?.stock_in || 0}
                        </strong>
                      </div>
                      <div className="p-3 bg-[var(--color-bg-soft)] text-[var(--color-text-secondary)] rounded-lg text-center">
                        <span className="text-[var(--color-brand-gold)] block">المنصرف والموزع (-)</span>
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
                  <div className="bg-[var(--color-surface)] border rounded-xl shadow-sm p-5 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b">
                      <div className="flex items-center gap-2">
                        <Package className="w-5 h-5 text-[var(--color-brand-gold)]" />
                        <h3 className="font-bold text-[var(--color-text-primary)] text-base">مستودع المستفيدين اليوميين</h3>
                      </div>
                      <span className="text-xs bg-[var(--color-bg-soft)] text-[#8C6C26] px-2 py-0.5 rounded font-bold">
                        {analytics.inventory?.daily?.total_items || 0} أصناف
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 bg-[var(--color-bg-soft)] rounded-lg text-center">
                        <span className="text-[var(--color-text-muted)] block">الرصيد المتاح الحالي</span>
                        <strong className="text-lg font-bold text-[#2E5A27] mt-1 block">
                          {analytics.inventory?.daily?.total_quantity || 0}
                        </strong>
                      </div>
                      <div className="p-3 bg-[var(--color-bg-soft)] text-[var(--color-brand-green)] rounded-lg text-center">
                        <span className="text-[var(--color-brand-green)] block">التوريد في الفترة (+)</span>
                        <strong className="text-lg font-bold mt-1 block">
                          +{analytics.inventory?.daily?.stock_in || 0}
                        </strong>
                      </div>
                      <div className="p-3 bg-[var(--color-bg-soft)] text-[var(--color-text-secondary)] rounded-lg text-center">
                        <span className="text-[var(--color-brand-gold)] block">المنصرف لليوميين (-)</span>
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
                <div className="bg-[var(--color-surface)] border rounded-xl shadow-sm p-5 space-y-4">
                  <h3 className="font-bold text-[var(--color-text-primary)] text-sm pb-2 border-b flex items-center justify-between">
                    <span>مصفوفة تتبع تواريخ الصلاحية (مستودع اليوميين)</span>
                    <span className="text-xs text-[var(--color-text-muted)]">فحص آلي يومي</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                    <button type="button" onClick={() => setInventoryDrilldown("expired")} className="p-3 bg-red-50 border border-red-200 rounded-lg text-center">
                      <span className="text-red-600 block font-semibold">منتهية الصلاحية</span>
                      <strong className="text-xl font-bold text-red-700 mt-1 block">
                        {analytics.inventory?.expiry_alerts?.expired_count || 0}
                      </strong>
                    </button>
                    <button type="button" onClick={() => setInventoryDrilldown("in_5_days")} className="p-3 bg-[var(--color-bg-soft)] border border-[var(--color-border)] rounded-lg text-center">
                      <span className="text-[var(--color-text-primary)] block font-semibold">تنتهي خلال 5 أيام</span>
                      <strong className="text-xl font-bold text-[var(--color-text-secondary)] mt-1 block">
                        {analytics.inventory?.expiry_alerts?.in_5_days_count || 0}
                      </strong>
                    </button>
                    <button type="button" onClick={() => setInventoryDrilldown("in_30_days")} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
                      <span className="text-yellow-700 block font-semibold">تنتهي خلال 30 يوماً</span>
                      <strong className="text-xl font-bold text-yellow-800 mt-1 block">
                        {analytics.inventory?.expiry_alerts?.in_30_days_count || 0}
                      </strong>
                    </button>
                    <button type="button" onClick={() => setInventoryDrilldown("in_60_days")} className="p-3 bg-[var(--color-bg-soft)] border border-[var(--color-border)] rounded-lg text-center">
                      <span className="text-[var(--color-text-primary)] block font-semibold">تنتهي خلال 60 يوماً</span>
                      <strong className="text-xl font-bold text-[var(--color-text-primary)] mt-1 block">
                        {analytics.inventory?.expiry_alerts?.in_60_days_count || 0}
                      </strong>
                    </button>
                  </div>

                  {inventoryDrilldown && (
                    <div className="border rounded-xl overflow-hidden" data-testid="inventory-expiry-drilldown">
                      <div className="flex items-center justify-between bg-[var(--color-bg-soft)] px-4 py-3 border-b">
                        <strong className="text-sm">الأصناف المطابقة للمؤشر المحدد</strong>
                        <button type="button" onClick={() => setInventoryDrilldown(null)} className="text-xs text-[var(--color-text-secondary)] underline">إغلاق</button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="ikram-table">
                          <thead><tr className="border-b"><th className="p-3">الصنف</th><th className="p-3">الكمية</th><th className="p-3">تاريخ الصلاحية</th></tr></thead>
                          <tbody>
                            {(analytics.inventory?.expiry_alerts?.[inventoryDrilldown] || []).map((item) => (
                              <tr key={item.id} className="border-b last:border-0"><td className="p-3 font-semibold">{item.name}</td><td className="p-3">{item.current_quantity} {item.unit}</td><td className="p-3 font-mono">{String(item.expiry_date || "").slice(0, 10)}</td></tr>
                            ))}
                            {(analytics.inventory?.expiry_alerts?.[inventoryDrilldown] || []).length === 0 && <tr><td colSpan="3" className="p-5 text-center text-[var(--color-text-muted)]">لا توجد أصناف مطابقة.</td></tr>}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-[var(--color-surface)] border rounded-xl shadow-sm p-5 space-y-4">
                  <div><h3 className="font-bold text-[var(--color-text-primary)] text-sm">استهلاك الأصناف خلال الفترة المحددة</h3><p className="text-xs text-[var(--color-text-muted)] mt-1">النسبة هي حصة الصنف من إجمالي الكمية المنصرفة في المستودع نفسه خلال الفترة.</p></div>
                  {[['المستودع المركزي', analytics.inventory?.main?.consumption], ['مستودع المستفيدين اليوميين', analytics.inventory?.daily?.consumption]].map(([label, rows]) => (
                    <div key={label} className="border rounded-lg overflow-hidden"><div className="bg-[var(--color-bg-soft)] px-3 py-2 text-xs font-bold">{label}</div><div className="divide-y">
                      {(rows || []).map((row) => <div key={row.id} className="grid grid-cols-3 gap-2 p-3 text-xs"><span className="font-semibold">{row.name}</span><span>{row.quantity} {row.unit}</span><span>{row.share_of_period_outflow}% من المنصرف</span></div>)}
                      {(rows || []).length === 0 && <div className="p-4 text-xs text-center text-[var(--color-text-muted)]">لا توجد حركة صرف في هذه الفترة.</div>}
                    </div></div>
                  ))}
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════ */}
            {/* VIEW 5: NEIGHBORHOODS TAB                                         */}
            {/* ══════════════════════════════════════════════════════════════════ */}
            {activeTab === "neighborhoods" && (
              <div className="bg-[var(--color-surface)] border rounded-xl shadow-sm overflow-hidden space-y-4">
                <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-[var(--color-text-primary)] text-sm">مصفوفة تغطية الأحياء السكنية</h3>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      إحصاءات شاملة لتوزيع المساعدات وعدد المستفيدين والأسر في كل حي
                    </p>
                  </div>
                  <SearchField
                    label="بحث الأحياء"
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    placeholder="ابحث باسم الحي..."
                  />
                </div>

                <div className="overflow-x-auto">
                  <table className="ikram-table">
                    <thead>
                      <tr className="bg-[var(--color-bg-soft)] text-[var(--color-text-secondary)] font-bold border-b">
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
                          <tr key={nh.neighborhood} className="hover:bg-[var(--color-bg-soft)]">
                            <td className="py-3 px-4 text-[var(--color-text-muted)]">{i + 1}</td>
                            <td className="py-3 px-4 font-bold text-[var(--color-text-primary)]">{nh.neighborhood}</td>
                            <td className="py-3 px-4 text-center">{nh.general_beneficiaries}</td>
                            <td className="py-3 px-4 text-center">{nh.daily_beneficiaries}</td>
                            <td className="py-3 px-4 text-center font-bold text-[var(--color-brand-green)]">{nh.total_beneficiaries}</td>
                            <td className="py-3 px-4 text-center">{nh.families_count}</td>
                            <td className="py-3 px-4 text-center">
                              <span className="px-2 py-0.5 bg-[#EBF4EA] text-[#2E5A27] font-bold rounded">
                                {nh.baskets_distributed}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center text-[var(--color-text-secondary)]">{nh.organizations_count}</td>
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
              <div className="bg-[var(--color-surface)] border rounded-xl shadow-sm overflow-hidden space-y-4">
                <div className="p-4 border-b flex items-center justify-between">
                  <h3 className="font-bold text-[var(--color-text-primary)] text-sm">الجهات المستفيدة ومندوبو الأحياء</h3>
                  <span className="text-xs text-[var(--color-text-muted)]">
                    إجمالي الجهات: <strong>{analytics.organizations?.total || 0}</strong>
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="ikram-table">
                    <thead>
                      <tr className="bg-[var(--color-bg-soft)] text-[var(--color-text-secondary)] font-bold border-b">
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
                        <tr key={org.id} className="hover:bg-[var(--color-bg-soft)]">
                          <td className="py-3 px-4 font-bold text-[var(--color-text-primary)]">{org.organization_name}</td>
                          <td className="py-3 px-4 text-[var(--color-text-secondary)]">{org.neighborhood}</td>
                          <td className="py-3 px-4 font-mono text-[var(--color-text-secondary)]" dir="ltr">{org.phone}</td>
                          <td className="py-3 px-4 text-center font-semibold">{org.beneficiaries_count}</td>
                          <td className="py-3 px-4 text-center font-semibold">{org.families_count}</td>
                          <td className="py-3 px-4 text-center font-bold text-[#8C6C26]">
                            <span className="px-2.5 py-0.5 bg-[var(--color-bg-soft)] rounded">
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
              <div className="bg-[var(--color-surface)] border rounded-xl shadow-sm overflow-hidden space-y-4">
                <div className="p-4 border-b flex items-center justify-between">
                  <h3 className="font-bold text-[var(--color-text-primary)] text-sm">أداء أسطول وسائقي التوصيل</h3>
                  <span className="text-xs text-[var(--color-text-muted)]">
                    إجمالي التوصيلات: <strong>{analytics.delivery?.total_deliveries || 0}</strong>
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="ikram-table">
                    <thead>
                      <tr className="bg-[var(--color-bg-soft)] text-[var(--color-text-secondary)] font-bold border-b">
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
                        <tr key={drv.id} className="hover:bg-[var(--color-bg-soft)]">
                          <td className="py-3 px-4 font-bold text-[var(--color-text-primary)]">{drv.name}</td>
                          <td className="py-3 px-4 font-mono text-[var(--color-text-secondary)]" dir="ltr">{drv.phone}</td>
                          <td className="py-3 px-4 text-center font-semibold">{drv.total_deliveries}</td>
                          <td className="py-3 px-4 text-center font-bold text-[var(--color-brand-green)]">{drv.completed_deliveries}</td>
                          <td className="py-3 px-4 text-center text-[var(--color-text-secondary)]">{drv.beneficiaries_served}</td>
                          <td className="py-3 px-4 text-center">
                            <span className="px-2 py-0.5 rounded text-xs font-bold bg-[var(--color-bg-soft)] text-[var(--color-brand-green)] border border-[var(--color-border)]">
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
              <div className="bg-[var(--color-surface)] border rounded-xl shadow-sm p-6 space-y-4">
                <h3 className="font-bold text-[var(--color-text-primary)] text-sm pb-2 border-b">
                  إحصاءات دعم موظفي الجمعية
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                  <div className="p-4 bg-[var(--color-bg-soft)] rounded-xl border">
                    <span className="text-xs text-[var(--color-text-muted)] block">إجمالي موظفي الجمعية</span>
                    <strong className="text-2xl font-bold text-[var(--color-text-primary)] mt-1 block">
                      {analytics.staff?.total || 0}
                    </strong>
                  </div>
                  <div className="p-4 bg-[var(--color-bg-soft)] rounded-xl border border-[var(--color-border)]">
                    <span className="text-xs text-[var(--color-brand-green)] block">موظفون استلموا سلال</span>
                    <strong className="text-2xl font-bold text-[var(--color-brand-green)] mt-1 block">
                      {analytics.staff?.received_count || 0}
                    </strong>
                  </div>
                  <div className="p-4 bg-[var(--color-bg-soft)] rounded-xl border border-[var(--color-border)]">
                    <span className="text-xs text-[var(--color-text-primary)] block">إجمالي السلال المخصصة</span>
                    <strong className="text-2xl font-bold text-[var(--color-text-secondary)] mt-1 block">
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
      </PageShell>
    </MainLayout>
  );
}
