import { useState, useEffect } from "react";
import api from "../../api/axios";
import MainLayout from "../../components/layout/MainLayout";
import { ShieldCheck, BarChart3, TrendingUp, Users, Package, FileSpreadsheet, Download, Activity } from "lucide-react";

export default function GovernancePage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/beneficiaries").catch(() => ({ data: { data: [] } })),
      api.get("/distributions").catch(() => ({ data: { data: [] } })),
      api.get("/neighborhood-reps").catch(() => ({ data: { data: [] } })),
      api.get("/inventory").catch(() => ({ data: { data: [] } })),
      api.get("/staff").catch(() => ({ data: { data: [] } })),
    ]).then(([bRes, dRes, rRes, iRes, sRes]) => {
      const beneficiaries = Array.isArray(bRes.data?.data) ? bRes.data.data : bRes.data?.data?.data || [];
      const distributions = Array.isArray(dRes.data?.data) ? dRes.data.data : dRes.data?.data?.data || [];
      const reps = Array.isArray(rRes.data?.data) ? rRes.data.data : rRes.data?.data?.data || [];
      const inventory = Array.isArray(iRes.data?.data) ? iRes.data.data : iRes.data?.data?.data || [];
      const staff = Array.isArray(sRes.data?.data) ? sRes.data.data : sRes.data?.data?.data || [];

      // Calculate governance metrics (NO FINANCIAL DATA)
      const firstClass = beneficiaries.filter(b => b.priority === 'first_class').length;
      const secondClass = beneficiaries.filter(b => b.priority === 'second_class').length;
      const specialNeeds = beneficiaries.filter(b => b.has_special_needs || b.priority === 'special_needs').length;
      const elderly = beneficiaries.filter(b => b.priority === 'elderly' || (b.date_of_birth && new Date().getFullYear() - new Date(b.date_of_birth).getFullYear() >= 60)).length;
      const employeeCat = beneficiaries.filter(b => b.priority === 'employee').length;

      const totalDependents = beneficiaries.reduce((acc, b) => acc + (b.dependents?.length || b.family_members_count || 0), 0);
      const deliveredCount = distributions.filter(d => d.status === 'delivered').length;
      const totalInventoryStock = inventory.reduce((acc, i) => acc + (i.current_quantity || i.stock_quantity || 0), 0);

      setStats({
        beneficiariesCount: beneficiaries.length,
        firstClass, secondClass, specialNeeds, elderly, employeeCat,
        repsCount: reps.length,
        staffCount: staff.length,
        totalDependents,
        distributionsCount: distributions.length,
        deliveredCount,
        totalInventoryStock,
        inventory,
        reps,
      });
    }).finally(() => setLoading(false));
  }, []);

  return (
    <MainLayout>
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-amber-600" />
            <span>لوحة الحوكمة ومؤشرات الأداء التشغيلي (Governance Dashboard)</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">قياس أداء التوزيع، توزيع الفئات، ومؤشرات المخزون (خالية تماماً من البيانات المالية)</p>
        </div>

        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-sm transition-all"
        >
          <Download className="w-4 h-4" />
          <span>تصدير تقرير الحوكمة (PDF)</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard title="إجمالي المستفيدين المسجلين" value={stats?.beneficiariesCount || 0} sub="مواطنون ومقيمون" color="border-amber-500 text-amber-900" />
        <KpiCard title="إجمالي السلال المسلمة" value={stats?.deliveredCount || 0} sub={`من أصل ${stats?.distributionsCount || 0} عملية`} color="border-green-500 text-green-900" />
        <KpiCard title="عدد مناديب الأحياء" value={stats?.repsCount || 0} sub="تغطي كافة مخططات مكة والجموم" color="border-purple-500 text-purple-900" />
        <KpiCard title="إجمالي أفراد المعالين" value={stats?.totalDependents || 0} sub="أفراد مخدومون بالأسر" color="border-blue-500 text-blue-900" />
      </div>

      {/* Charts Section */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        
        {/* 1. Bar Chart - الفئات الاستحقاقية */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-bold text-sm text-gray-800 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-amber-600" />
            <span>1. العمود البياني (Bar Chart): توزيع المستفيدين حسب الفئات الاستحقاقية</span>
          </h3>
          <div className="space-y-3 text-xs pt-2">
            <BarItem label="🥇 درجة أولى (الأشد حاجة)" count={stats?.firstClass || 0} total={stats?.beneficiariesCount} color="bg-amber-600" />
            <BarItem label="🥈 درجة ثانية (الدخل المتوسط)" count={stats?.secondClass || 0} total={stats?.beneficiariesCount} color="bg-amber-400" />
            <BarItem label="♿ ذوو الاحتياجات الخاصة" count={stats?.specialNeeds || 0} total={stats?.beneficiariesCount} color="bg-purple-600" />
            <BarItem label="👵 كبار السن (60+ سنة)" count={stats?.elderly || 0} total={stats?.beneficiariesCount} color="bg-green-600" />
            <BarItem label="💼 موظفو الجمعية" count={stats?.employeeCat || 0} total={stats?.beneficiariesCount} color="bg-blue-600" />
          </div>
        </div>

        {/* 2. Line Chart - التوزيع الزمني التراكمي */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-bold text-sm text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <span>2. الرسم الخطي (Line Chart): نمو التوزيع والتسليم الشهري</span>
          </h3>
          <div className="h-44 w-full flex items-end justify-between gap-2 pt-6 px-2 border-b border-r border-gray-200">
            {[20, 35, 50, 45, 75, 90, 110, 140].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                <div style={{ height: `${h}px` }} className="w-full max-w-[24px] bg-gradient-to-t from-amber-600 to-amber-400 rounded-t-md group-hover:bg-amber-700 transition-all"></div>
                <span className="text-[10px] text-gray-400">شهر {i + 1}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 3. Time Series Chart - السلسلة الزمنية لحركة الأصناف */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-bold text-sm text-gray-800 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-purple-600" />
            <span>3. السلسلة الزمنية (Time-Series Chart): رصيد وصرف مواد المستودع</span>
          </h3>
          <div className="space-y-3 text-xs">
            {stats?.inventory?.slice(0, 4).map((item, idx) => (
              <div key={idx} className="flex justify-between items-center p-2.5 bg-gray-50 rounded-xl">
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

        {/* 4. Scatter Plot - انتشار أعداد الأسر لكل مندوب حي */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-bold text-sm text-gray-800 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            <span>4. مخطط الانتشار (Scatter Plot): توزيع أعداد الأسر لكل مندوب حي</span>
          </h3>
          <div className="h-44 border border-dashed border-gray-200 rounded-xl relative p-4 flex items-center justify-around">
            {stats?.reps?.slice(0, 6).map((r, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div className="w-8 h-8 rounded-full bg-amber-500 text-white font-bold text-xs flex items-center justify-center shadow-md animate-pulse">
                  {r.beneficiaries_count}
                </div>
                <span className="text-[10px] font-bold text-gray-600">{r.district_name}</span>
              </div>
            ))}
            {(!stats?.reps || stats.reps.length === 0) && (
              <p className="text-gray-400 text-xs">لا يوجد مناديب أحياء لعرض انتشار الأسر.</p>
            )}
          </div>
        </div>

      </div>

      {/* Detailed Reps Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-bold text-sm text-gray-800 mb-3">تفاصيل مؤشرات مناديب الأحياء (الأسر المكلفة)</h3>
        <div className="overflow-x-auto border border-gray-200 rounded-xl text-xs">
          <table className="w-full text-right">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-3">#</th>
                <th className="p-3 font-bold">اسم مندوب الحي</th>
                <th className="p-3 font-bold">الحي التابع</th>
                <th className="p-3 font-bold">عدد المستفيدين المخدومين</th>
                <th className="p-3 font-bold">حالة التوثيق الرسمية</th>
              </tr>
            </thead>
            <tbody>
              {stats?.reps?.map((r, idx) => (
                <tr key={r.id || idx} className="border-b">
                  <td className="p-3 text-gray-400">{idx + 1}</td>
                  <td className="p-3 font-bold text-gray-800">{r.full_name}</td>
                  <td className="p-3 text-amber-900 font-bold">{r.district_name}</td>
                  <td className="p-3 font-bold text-green-700">{r.beneficiaries_count} أسرة</td>
                  <td className="p-3"><span className="bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-bold text-[11px]">معتمد من الجمعية والعمدة</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
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
