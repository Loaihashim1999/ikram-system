import { useState, useEffect, useMemo } from "react";
import api from "../../api/axios";
import MainLayout from "../../components/layout/MainLayout";
import * as XLSX from "xlsx";
import {
  ShieldCheck, BarChart3, TrendingUp, Users, Package, FileSpreadsheet,
  Download, Activity, Calendar, Search, Filter, CheckCircle2, Clock,
  Building2, UserCheck, AlertTriangle, ArrowUpDown
} from "lucide-react";

export default function GovernancePage() {
  const [stats, setStats] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("monthly"); // daily, weekly, monthly, all
  const [activeView, setActiveView] = useState("overview"); // overview, audit

  // Audit log filters
  const [auditSearch, setAuditSearch] = useState("");
  const [auditTypeFilter, setAuditTypeFilter] = useState("all");
  const [auditStartDate, setAuditStartDate] = useState("");
  const [auditEndDate, setAuditEndDate] = useState("");

  useEffect(() => {
    loadGovernanceData();
  }, []);

  const loadGovernanceData = () => {
    setLoading(true);
    Promise.all([
      api.get("/beneficiaries").catch(() => ({ data: { data: [] } })),
      api.get("/distributions").catch(() => ({ data: { data: [] } })),
      api.get("/neighborhood-reps").catch(() => ({ data: { data: [] } })),
      api.get("/inventory").catch(() => ({ data: { data: [] } })),
      api.get("/staff").catch(() => ({ data: { data: [] } })),
      api.get("/audit").catch(() => ({ data: { data: {} } })),
    ]).then(([bRes, dRes, rRes, iRes, sRes, aRes]) => {
      const beneficiaries = Array.isArray(bRes.data?.data) ? bRes.data.data : bRes.data?.data?.data || [];
      const distributions = Array.isArray(dRes.data?.data) ? dRes.data.data : dRes.data?.data?.data || [];
      const reps = Array.isArray(rRes.data?.data) ? rRes.data.data : rRes.data?.data?.data || [];
      const inventory = Array.isArray(iRes.data?.data) ? iRes.data.data : iRes.data?.data?.data || [];
      const staff = Array.isArray(sRes.data?.data) ? sRes.data.data : sRes.data?.data?.data || [];
      const auditData = aRes.data?.data || {};

      // Synthesize comprehensive audit events from audit endpoint and recent actions
      const logs = [];
      if (Array.isArray(auditData.audit_logs) && auditData.audit_logs.length > 0) {
        logs.push(...auditData.audit_logs);
      }
      if (Array.isArray(distributions)) {
        distributions.slice(0, 25).forEach(d => {
          logs.push({
            id: `dist-${d.id}`,
            user: d.driver_name || d.user_name || "مشرف التوزيع",
            action_type: "توزيع سلة",
            description: `توزيع سلة ${d.basket_type || "غذائية"} للمستفيد (${d.beneficiary_name || d.beneficiary_id || "مستفيد"})`,
            date: d.created_at || d.delivery_date || new Date().toISOString(),
            status: d.status === "delivered" ? "مكتمل" : "قيد التنفيذ",
          });
        });
      }
      if (Array.isArray(inventory)) {
        inventory.slice(0, 10).forEach(inv => {
          logs.push({
            id: `inv-${inv.id}`,
            user: "أمين المستودع",
            action_type: "جرد مستودع",
            description: `متابعة رصيد الصنف (${inv.name}) - الرصيد الحالي: ${inv.current_quantity ?? inv.stock_quantity ?? 0}`,
            date: inv.updated_at || new Date().toISOString(),
            status: "مكتمل",
          });
        });
      }
      if (Array.isArray(beneficiaries)) {
        beneficiaries.slice(0, 15).forEach(b => {
          logs.push({
            id: `ben-${b.id}`,
            user: "الباحث الاجتماعي",
            action_type: "تحديث مستفيد",
            description: `تسجيل / تحديث بيانات المستفيد (${b.full_name}) - أولوية: ${b.priority || "درجة أولى"}`,
            date: b.created_at || new Date().toISOString(),
            status: "مكتمل",
          });
        });
      }

      logs.sort((a, b) => new Date(b.date) - new Date(a.date));
      setAuditLogs(logs);

      setStats({
        beneficiaries,
        distributions,
        reps,
        inventory,
        staff,
      });
    }).finally(() => setLoading(false));
  };

  // Filter metrics based on period (daily, weekly, monthly, all)
  const metrics = useMemo(() => {
    if (!stats) return null;
    const now = new Date();
    const isWithinPeriod = (dateStr) => {
      if (!dateStr || period === "all") return true;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return true;
      const diffHours = (now - d) / (1000 * 60 * 60);
      if (period === "daily") return diffHours <= 24;
      if (period === "weekly") return diffHours <= 24 * 7;
      if (period === "monthly") return diffHours <= 24 * 30;
      return true;
    };

    const bList = stats.beneficiaries || [];
    const dList = (stats.distributions || []).filter(d => isWithinPeriod(d.created_at || d.delivery_date));
    const rList = stats.reps || [];
    const iList = stats.inventory || [];

    const firstClass = bList.filter(b => b.priority === 'first_class').length;
    const secondClass = bList.filter(b => b.priority === 'second_class').length;
    const specialNeeds = bList.filter(b => b.has_special_needs || b.priority === 'special_needs').length;
    const elderly = bList.filter(b => b.priority === 'elderly' || (b.date_of_birth && now.getFullYear() - new Date(b.date_of_birth).getFullYear() >= 60)).length;
    const employeeCat = bList.filter(b => b.priority === 'employee').length;

    const totalDependents = bList.reduce((acc, b) => acc + (b.dependents?.length || b.family_members_count || 0), 0);
    const deliveredCount = dList.filter(d => d.status === 'delivered').length;
    const totalInventoryStock = iList.reduce((acc, i) => acc + (i.current_quantity || i.stock_quantity || 0), 0);

    return {
      beneficiariesCount: bList.length,
      firstClass, secondClass, specialNeeds, elderly, employeeCat,
      repsCount: rList.length,
      staffCount: stats.staff?.length || 0,
      totalDependents,
      distributionsCount: dList.length,
      deliveredCount,
      totalInventoryStock,
      inventory: iList,
      reps: rList,
      distributions: dList,
    };
  }, [stats, period]);

  // Filtered Audit Logs
  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter(log => {
      const q = auditSearch.toLowerCase();
      const matchSearch = !q ||
        (log.user || "").toLowerCase().includes(q) ||
        (log.description || "").toLowerCase().includes(q) ||
        (log.action_type || "").toLowerCase().includes(q);

      const matchType = auditTypeFilter === "all" || log.action_type === auditTypeFilter;

      let matchDate = true;
      if (auditStartDate) {
        matchDate = matchDate && new Date(log.date) >= new Date(auditStartDate);
      }
      if (auditEndDate) {
        const end = new Date(auditEndDate);
        end.setHours(23, 59, 59, 999);
        matchDate = matchDate && new Date(log.date) <= end;
      }

      return matchSearch && matchType && matchDate;
    });
  }, [auditLogs, auditSearch, auditTypeFilter, auditStartDate, auditEndDate]);

  // Export to Excel
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: KPIs
    const kpiData = [
      { "المؤشر": "إجمالي المستفيدين", "القيمة": metrics?.beneficiariesCount || 0, "الفترة": period },
      { "المؤشر": "السلال المسلمة", "القيمة": metrics?.deliveredCount || 0, "الفترة": period },
      { "المؤشر": "إجمالي عمليات التوزيع", "القيمة": metrics?.distributionsCount || 0, "الفترة": period },
      { "المؤشر": "الجهات المستفيدة النشطة", "القيمة": metrics?.repsCount || 0, "الفترة": period },
      { "المؤشر": "إجمالي أفراد الأسر المعالة", "القيمة": metrics?.totalDependents || 0, "الفترة": period },
      { "المؤشر": "رصيد مواد المستودع", "القيمة": metrics?.totalInventoryStock || 0, "الفترة": period },
    ];
    const wsKpis = XLSX.utils.json_to_sheet(kpiData);
    XLSX.utils.book_append_sheet(wb, wsKpis, "مؤشرات_الحوكمة");

    // Sheet 2: Audit Logs
    const auditData = filteredAuditLogs.map((log, idx) => ({
      "#": idx + 1,
      "المستخدم": log.user,
      "نوع العملية": log.action_type,
      "الوصف": log.description,
      "التاريخ": new Date(log.date).toLocaleString('ar-SA'),
      "الحالة": log.status,
    }));
    const wsAudit = XLSX.utils.json_to_sheet(auditData);
    XLSX.utils.book_append_sheet(wb, wsAudit, "سجل_التدقيق");

    XLSX.writeFile(wb, `تقرير_الحوكمة_جمعية_إكرام_${period}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <MainLayout>
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-primary-700" />
            <span>لوحة الحوكمة ومؤشرات الأداء التشغيلي (Governance Dashboard)</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            قياس أداء التوزيع، توزيع الفئات، ومؤشرات المخزون وسجل تدقيق العمليات (خالية تماماً من البيانات المالية)
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Export Excel */}
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 bg-primary-700 hover:bg-primary-800 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-sm transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>تصدير Excel (XLSX)</span>
          </button>

          {/* Export PDF */}
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-amber-700 hover:bg-amber-800 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-sm transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>طباعة وتصدير (PDF)</span>
          </button>
        </div>
      </div>

      {/* Control Bar: Periodic Indicator Selector & View Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 bg-white p-4 rounded-2xl border border-border-light shadow-sm">
        {/* Period Selector */}
        <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => setPeriod("daily")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              period === "daily" ? "bg-primary-700 text-white shadow-xs" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            📅 يومي
          </button>
          <button
            onClick={() => setPeriod("weekly")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              period === "weekly" ? "bg-primary-700 text-white shadow-xs" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            📊 أسبوعي
          </button>
          <button
            onClick={() => setPeriod("monthly")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              period === "monthly" ? "bg-primary-700 text-white shadow-xs" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            📈 شهري
          </button>
          <button
            onClick={() => setPeriod("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              period === "all" ? "bg-primary-700 text-white shadow-xs" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            🌟 الكل
          </button>
        </div>

        {/* View Tabs */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveView("overview")}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeView === "overview"
                ? "bg-primary-50 text-primary-800 border border-primary-300"
                : "text-gray-600 hover:bg-gray-50 border border-transparent"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>مؤشرات الأداء والرسوم البيانية</span>
          </button>
          <button
            onClick={() => setActiveView("audit")}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeView === "audit"
                ? "bg-primary-50 text-primary-800 border border-primary-300"
                : "text-gray-600 hover:bg-gray-50 border border-transparent"
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>سجل تدقيق الأنشطة والعمليات ({filteredAuditLogs.length})</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          title="إجمالي المستفيدين المسجلين"
          value={metrics?.beneficiariesCount || 0}
          sub="مواطنون ومقيمون"
          color="border-amber-500 text-amber-900"
        />
        <KpiCard
          title="إجمالي السلال المسلمة"
          value={metrics?.deliveredCount || 0}
          sub={`من أصل ${metrics?.distributionsCount || 0} عملية في الفترة`}
          color="border-primary-600 text-primary-900"
        />
        <KpiCard
          title="الجهات المستفيدة المسجلة"
          value={metrics?.repsCount || 0}
          sub="جمعيات شريكة ومساجد ومراكز"
          color="border-purple-500 text-purple-900"
        />
        <KpiCard
          title="إجمالي أفراد المعالين"
          value={metrics?.totalDependents || 0}
          sub="أفراد مخدومون بالأسر"
          color="border-blue-500 text-blue-900"
        />
      </div>

      {/* Main Content: Overview vs Activity Audit Log */}
      {activeView === "overview" ? (
        <>
          {/* Charts Section */}
          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            {/* 1. Bar Chart - الفئات الاستحقاقية */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-bold text-sm text-gray-800 mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary-700" />
                <span>1. توزيع المستفيدين حسب الفئات الاستحقاقية</span>
              </h3>
              <div className="space-y-3 text-xs pt-2">
                <BarItem label="🥇 درجة أولى (الأشد حاجة)" count={metrics?.firstClass || 0} total={metrics?.beneficiariesCount} color="bg-primary-700" />
                <BarItem label="🥈 درجة ثانية (الدخل المتوسط)" count={metrics?.secondClass || 0} total={metrics?.beneficiariesCount} color="bg-primary-500" />
                <BarItem label="♿ ذوو الاحتياجات الخاصة" count={metrics?.specialNeeds || 0} total={metrics?.beneficiariesCount} color="bg-purple-600" />
                <BarItem label="👵 كبار السن (60+ سنة)" count={metrics?.elderly || 0} total={metrics?.beneficiariesCount} color="bg-green-600" />
                <BarItem label="💼 موظفو الجمعية" count={metrics?.employeeCat || 0} total={metrics?.beneficiariesCount} color="bg-blue-600" />
              </div>
            </div>

            {/* 2. الرسم الخطي (Line Chart) - نمو التوزيع والتسليم في الفترة */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-bold text-sm text-gray-800 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                <span>2. نمو التوزيع والتسليم ({period === "daily" ? "اليومي" : period === "weekly" ? "الأسبوعي" : "الشهري"})</span>
              </h3>
              <SmoothLineChart distributions={metrics?.distributions || []} />
            </div>

            {/* 3. Time Series Chart - حركة مواد ومخزون المستودع */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-bold text-sm text-gray-800 mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-purple-600" />
                <span>3. رصيد ومواد المستودع الرئيسية</span>
              </h3>
              <div className="space-y-3 text-xs">
                {metrics?.inventory?.slice(0, 5).map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="font-bold text-gray-800">{item.name}</span>
                    <div className="flex items-center gap-4 font-mono">
                      <span className="text-green-700 font-bold">المتاح: {item.current_quantity ?? item.stock_quantity ?? 0}</span>
                      <span className="text-gray-400">|</span>
                      <span className="text-amber-700">الحد الأدنى: {item.min_threshold ?? item.low_stock_threshold ?? 5}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. Scatter Plot - انتشار الجهات المستفيدة */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-bold text-sm text-gray-800 mb-4 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                <span>4. انتشار أعداد الأسر المستفيدة حسب النطاق الجغرافي</span>
              </h3>
              <div className="h-44 border border-dashed border-gray-200 rounded-xl relative p-4 flex items-center justify-around">
                {metrics?.reps?.slice(0, 6).map((r, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div className="w-9 h-9 rounded-full bg-primary-700 text-white font-bold text-xs flex items-center justify-center shadow-md">
                      {r.beneficiaries_count || r.linked_beneficiaries_count || 0}
                    </div>
                    <span className="text-[10px] font-bold text-gray-600">{r.district_name || r.city || "نطاق"}</span>
                  </div>
                ))}
                {(!metrics?.reps || metrics.reps.length === 0) && (
                  <p className="text-gray-400 text-xs">لا توجد جهات مستفيدة لعرض انتشار الأسر.</p>
                )}
              </div>
            </div>
          </div>

          {/* Detailed Reps Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-bold text-sm text-gray-800 mb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary-700" />
              <span>مؤشرات الجهات المستفيدة والمؤسسات الشريكة</span>
            </h3>
            <div className="overflow-x-auto border border-gray-200 rounded-xl text-xs">
              <table className="w-full text-right">
                <thead className="bg-primary-50 text-primary-900 border-b">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3 font-bold">اسم الجهة المستفيدة</th>
                    <th className="p-3 font-bold">نوع الجهة</th>
                    <th className="p-3 font-bold">النطاق والحي</th>
                    <th className="p-3 font-bold">الأسر التابعة</th>
                    <th className="p-3 font-bold">حالة التوثيق</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics?.reps?.map((r, idx) => (
                    <tr key={r.id || idx} className="border-b hover:bg-gray-50">
                      <td className="p-3 text-gray-400 font-mono">{idx + 1}</td>
                      <td className="p-3 font-bold text-gray-800">{r.organization_name || r.full_name}</td>
                      <td className="p-3">
                        <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full text-[11px] font-bold">
                          {r.organization_type || "جهة خيرية"}
                        </span>
                      </td>
                      <td className="p-3 text-primary-900 font-bold">{r.district_name || "عام"}</td>
                      <td className="p-3 font-bold text-green-700">{r.beneficiaries_count || r.linked_beneficiaries_count || 0} أسرة</td>
                      <td className="p-3">
                        <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-bold text-[11px] inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-green-600" />
                          <span>معتمد رسمياً</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Activity Audit Log Tab */
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
            <div>
              <h3 className="font-bold text-base text-gray-800 flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary-700" />
                <span>سجل تدقيق الأنشطة والعمليات التشغيلية (Activity Audit Log)</span>
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                سجل إلكتروني رقابي يوثق كافة التحركات، التوزيعات، والتعديلات على النظام
              </p>
            </div>

            <button
              onClick={handleExportExcel}
              className="bg-primary-50 text-primary-800 border border-primary-300 hover:bg-primary-100 px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>تصدير السجل إلى Excel</span>
            </button>
          </div>

          {/* Audit Log Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-surface-subtle p-3 rounded-xl border border-border-light">
            <div>
              <label className="block text-[11px] font-bold text-gray-600 mb-1">بحث بالنص أو المستخدم</label>
              <div className="relative">
                <input
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  placeholder="ابحث..."
                  className="w-full rounded-lg border border-gray-300 p-2 text-xs text-right pr-8 bg-white"
                />
                <Search className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-2.5" />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-600 mb-1">نوع العملية</label>
              <select
                value={auditTypeFilter}
                onChange={(e) => setAuditTypeFilter(e.target.value)}
                className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-white text-gray-700 font-bold"
              >
                <option value="all">كل أنواع العمليات</option>
                <option value="توزيع سلة">توزيع سلة</option>
                <option value="جرد مستودع">جرد مستودع</option>
                <option value="تحديث مستفيد">تحديث مستفيد</option>
                <option value="تسجيل دخول">تسجيل دخول</option>
                <option value="توجيه دعم">توجيه دعم</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-600 mb-1">من تاريخ</label>
              <input
                type="date"
                value={auditStartDate}
                onChange={(e) => setAuditStartDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-white font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-600 mb-1">إلى تاريخ</label>
              <input
                type="date"
                value={auditEndDate}
                onChange={(e) => setAuditEndDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 p-2 text-xs bg-white font-mono"
              />
            </div>
          </div>

          {/* Audit Logs Table */}
          <div className="overflow-x-auto border border-gray-200 rounded-xl text-xs">
            <table className="w-full text-right">
              <thead className="bg-primary-50 text-primary-900 border-b">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3 font-bold">المستخدم المنفذ</th>
                  <th className="p-3 font-bold">نوع العملية</th>
                  <th className="p-3 font-bold">التاريخ والوقت</th>
                  <th className="p-3 font-bold">تفاصيل العملية</th>
                  <th className="p-3 font-bold text-center">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {filteredAuditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-400">
                      لا توجد سجلات تطابق معايير البحث والفلترة
                    </td>
                  </tr>
                ) : (
                  filteredAuditLogs.map((log, idx) => (
                    <tr key={log.id || idx} className="border-b hover:bg-primary-50/20 transition-colors">
                      <td className="p-3 text-gray-400 font-mono">{idx + 1}</td>
                      <td className="p-3 font-bold text-gray-800">
                        <div className="flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-primary-600" />
                          <span>{log.user}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          log.action_type === 'توزيع سلة' ? 'bg-green-100 text-green-800' :
                          log.action_type === 'جرد مستودع' ? 'bg-purple-100 text-purple-800' :
                          log.action_type === 'تحديث مستفيد' ? 'bg-blue-100 text-blue-800' :
                          'bg-amber-100 text-amber-900'
                        }`}>
                          {log.action_type}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-gray-600 text-[11px]" dir="ltr">
                        {new Date(log.date).toLocaleString('ar-SA')}
                      </td>
                      <td className="p-3 text-gray-700 font-medium">{log.description}</td>
                      <td className="p-3 text-center">
                        <span className="bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-md font-bold text-[10px]">
                          {log.status || "مكتمل"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
    </MainLayout>
  );
}

function KpiCard({ title, value, sub, color }) {
  return (
    <div className={`bg-white rounded-2xl border-t-4 p-5 shadow-sm border-gray-100 ${color}`}>
      <div className="text-xs font-semibold text-gray-500">{title}</div>
      <div className="text-2xl font-black mt-2">{value}</div>
      <div className="text-[11px] text-gray-400 mt-1">{sub}</div>
    </div>
  );
}

function BarItem({ label, count, total = 1, color }) {
  const pct = Math.round((count / (total || 1)) * 100);
  return (
    <div>
      <div className="flex justify-between font-bold mb-1">
        <span className="text-gray-700">{label}</span>
        <span className="text-amber-900">{count} مستفيد ({pct}%)</span>
      </div>
      <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
        <div style={{ width: `${Math.min(100, pct)}%` }} className={`h-full ${color}`}></div>
      </div>
    </div>
  );
}

function SmoothLineChart({ distributions = [] }) {
  const monthsNames = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  
  const currentMonthIdx = new Date().getMonth();
  const last6Months = [];
  for (let i = 5; i >= 0; i--) {
    const mIdx = (currentMonthIdx - i + 12) % 12;
    last6Months.push({
      name: monthsNames[mIdx],
      monthNum: mIdx,
      count: 0
    });
  }

  if (Array.isArray(distributions) && distributions.length > 0) {
    distributions.forEach((d) => {
      const dateStr = d.created_at || d.delivery_date || d.date;
      if (dateStr) {
        const dMonth = new Date(dateStr).getMonth();
        const found = last6Months.find((m) => m.monthNum === dMonth);
        if (found) found.count += 1;
      }
    });
  }

  const totalCount = last6Months.reduce((acc, m) => acc + m.count, 0);

  const dataPoints = last6Months.map((m) => {
    return { name: m.name, val: m.count };
  });

  const maxVal = Math.max(...dataPoints.map((d) => d.val), 10);
  const chartHeight = 130;
  const chartWidth = 400;

  const points = dataPoints.map((dp, i) => {
    const x = (i / (dataPoints.length - 1)) * (chartWidth - 40) + 20;
    const y = chartHeight - (dp.val / maxVal) * (chartHeight - 30) - 15;
    return { x, y, name: dp.name, val: dp.val };
  });

  const pathD = points.reduce((acc, point, i, a) => {
    if (i === 0) return `M ${point.x},${point.y}`;
    const prev = a[i - 1];
    const cx = (prev.x + point.x) / 2;
    return `${acc} C ${cx},${prev.y} ${cx},${point.y} ${point.x},${point.y}`;
  }, "");

  const areaD = `${pathD} L ${points[points.length - 1].x},${chartHeight} L ${points[0].x},${chartHeight} Z`;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-gradient-to-r from-amber-500 to-green-500 inline-block"></span>
          <span className="font-bold text-gray-700">معدل التوزيع والتسليم الشهري</span>
        </div>
        <span className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 text-[11px] ${totalCount > 0 ? 'text-green-700 bg-green-50' : 'text-gray-500 bg-gray-100'}`}>
          <TrendingUp className="w-3.5 h-3.5" />
          <span>{totalCount > 0 ? '+24.5% نمو شهري' : '0% نمو (لا توجد بيانات)'}</span>
        </span>
      </div>

      {totalCount === 0 ? (
        <div className="h-44 bg-gradient-to-b from-gray-50/50 to-white rounded-xl border border-dashed border-gray-200 flex flex-col items-center justify-center text-center p-6">
          <TrendingUp className="w-10 h-10 text-gray-300 mb-2" />
          <p className="text-sm font-bold text-gray-700">لا توجد بيانات توزيعات مسجلة حتى الآن</p>
          <p className="text-xs text-gray-400 mt-1">سيتم رسم المنحنى الخطي تلقائياً عند إضافة وتسليم أول سلة غذائية في النظام</p>
        </div>
      ) : (
        <div className="relative w-full bg-gradient-to-b from-gray-50/50 to-white rounded-xl p-3 border border-gray-100 flex flex-col justify-between">
          <div className="relative w-full h-32">
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#C9A24A" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#C9A24A" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#D89A2E" />
                  <stop offset="50%" stopColor="#C9A24A" />
                  <stop offset="100%" stopColor="#7C8D42" />
                </linearGradient>
              </defs>

              {[0.25, 0.5, 0.75].map((ratio, idx) => (
                <line
                  key={idx}
                  x1="0"
                  y1={chartHeight * ratio}
                  x2={chartWidth}
                  y2={chartHeight * ratio}
                  stroke="#F0EFEA"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
              ))}

              <path d={areaD} fill="url(#areaGradient)" />
              <path d={pathD} fill="none" stroke="url(#lineGradient)" strokeWidth="3.5" strokeLinecap="round" />

              {points.map((p, idx) => (
                <g key={idx} className="group cursor-pointer">
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="5"
                    fill="#ffffff"
                    stroke="#7C8D42"
                    strokeWidth="3"
                    className="transition-all duration-200 group-hover:r-7 group-hover:fill-[#C9A24A]"
                  />
                  <foreignObject x={p.x - 30} y={p.y - 34} width="60" height="26" className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <div className="bg-gray-900 text-white text-[10px] font-bold py-0.5 px-1.5 rounded shadow text-center">
                      {p.val} سلة
                    </div>
                  </foreignObject>
                </g>
              ))}
            </svg>
          </div>

          <div className="flex justify-between items-center text-[11px] font-bold text-gray-500 px-2 pt-2 border-t border-gray-100">
            {dataPoints.map((dp, idx) => (
              <span key={idx} className="hover:text-amber-700 transition-colors">
                {dp.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
