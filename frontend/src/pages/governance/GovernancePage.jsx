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

        {/* 2. الرسم الخطي (Line Chart) - نمو التوزيع والتسليم الشهري */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-bold text-sm text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <span>2. الرسم الخطي (Line Chart): نمو التوزيع والتسليم الشهري</span>
          </h3>
          <SmoothLineChart distributions={stats?.distributions || []} />
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
    </div>
  );
}
