import { useEffect, useState } from "react";
import MainLayout from "../../components/layout/MainLayout";
import beneficiaryApi from "../../api/beneficiaries";

/* ─── Simple Bar Component ─── */
function Bar({ label, value, max, color = "#C9A24A" }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm mb-1">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="font-bold" style={{ color }}>{value}</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-3">
        <div
          className="h-3 rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

/* ─── Stat Card ─── */
function StatCard({ icon, label, value, sub, color }) {
  return (
    <div className="bg-white rounded-2xl shadow-md p-5 flex items-center gap-4 border border-gray-100">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
        style={{ backgroundColor: color + "22" }}
      >
        {icon}
      </div>
      <div>
        <p className="text-gray-500 text-sm">{label}</p>
        <p className="text-3xl font-black" style={{ color }}>{value ?? "..."}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

/* ─── Main Component ─── */
export default function StatisticsPage() {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    beneficiaryApi.list({ per_page: 2000 })
      .then((res) => {
        const data = res.data.data?.data ?? res.data.data ?? res.data ?? [];
        setItems(Array.isArray(data) ? data : []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  /* ─── Derived stats ─── */
  const total    = items.length;
  const citizens = items.filter((b) => (b.beneficiary_type || b.type) === "citizen").length;
  const residents= items.filter((b) => (b.beneficiary_type || b.type) === "resident").length;
  const active   = items.filter((b) => b.status === "active" || !b.status).length;
  const suspended= items.filter((b) => b.status === "suspended").length;
  const underRev = items.filter((b) => b.status === "under_review").length;

  const specialNeeds = items.filter((b) => b.has_special_needs).length;

  // Family status breakdown
  const familyStatusMap = {
    poor:                   "فقير",
    widow:                  "أرملة",
    widow_with_orphans:     "أرملة مع أيتام",
    divorced:               "مطلقة",
    divorced_with_children: "مطلقة مع أطفال",
    abandoned:              "مهجورة",
  };
  const familyStatusCounts = Object.entries(familyStatusMap).map(([key, label]) => ({
    label,
    value: items.filter((b) => b.family_status === key).length,
  }));

  // City distribution (top 5)
  const cityMap = {};
  items.forEach((b) => {
    if (b.city) cityMap[b.city] = (cityMap[b.city] || 0) + 1;
  });
  const topCities = Object.entries(cityMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, value]) => ({ label, value }));

  // Income stats
  const totalIncome = items.reduce((sum, b) => {
    return sum +
      (parseFloat(b.monthly_salary) || 0) +
      (parseFloat(b.citizen_account_amount) || 0) +
      (parseFloat(b.social_security_amount) || 0) +
      (parseFloat(b.retirement_pension) || 0) +
      (parseFloat(b.family_support) || 0);
  }, 0);

  const avgIncome = total > 0 ? (totalIncome / total).toFixed(0) : 0;

  // Housing
  const renters = items.filter((b) => b.housing_type === "rent" || (!b.housing_type && !b.owns_house)).length;
  const owners  = items.filter((b) => b.housing_type === "own" || b.owns_house).length;

  return (
    <MainLayout>
      <div className="p-6 max-w-6xl mx-auto" dir="rtl">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-black text-gray-800 mb-1">📊 الإحصائيات والتحليلات</h1>
          <p className="text-sm text-gray-500">لمحة شاملة عن بيانات المستفيدين المسجلين في النظام</p>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* ─── Top stat cards ─── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard icon="👥" label="إجمالي المستفيدين" value={total} color="#C9A24A" />
              <StatCard icon="🟢" label="نشطون" value={active} sub={`${total ? Math.round(active / total * 100) : 0}%`} color="#16a34a" />
              <StatCard icon="♿" label="ذوو احتياجات خاصة" value={specialNeeds} color="#7c3aed" />
              <StatCard icon="💰" label="متوسط الدخل الشهري" value={`${avgIncome} ﷼`} color="#0369a1" />
            </div>

            {/* ─── Two column section ─── */}
            <div className="grid md:grid-cols-2 gap-6 mb-6">

              {/* Citizen vs Resident */}
              <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
                <h2 className="font-bold text-amber-800 text-base mb-4 border-b border-amber-50 pb-2">
                  🏠 المستفيدون حسب النوع
                </h2>
                <Bar label="مواطنون"  value={citizens}  max={total} color="#C9A24A" />
                <Bar label="مقيمون"   value={residents} max={total} color="#3b82f6" />
                <div className="mt-4 flex gap-4 text-sm">
                  <span className="bg-amber-50 text-amber-700 px-3 py-1 rounded-full font-semibold">
                    مواطن: {total > 0 ? Math.round(citizens / total * 100) : 0}%
                  </span>
                  <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-semibold">
                    مقيم: {total > 0 ? Math.round(residents / total * 100) : 0}%
                  </span>
                </div>
              </div>

              {/* Status breakdown */}
              <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
                <h2 className="font-bold text-amber-800 text-base mb-4 border-b border-amber-50 pb-2">
                  📋 الحالات
                </h2>
                <Bar label="نشط"          value={active}    max={total} color="#16a34a" />
                <Bar label="موقوف"         value={suspended} max={total} color="#dc2626" />
                <Bar label="قيد المراجعة" value={underRev}  max={total} color="#d97706" />
              </div>

              {/* Family status */}
              <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
                <h2 className="font-bold text-amber-800 text-base mb-4 border-b border-amber-50 pb-2">
                  👨‍👩‍👧 الحالة الأسرية
                </h2>
                {familyStatusCounts.filter(f => f.value > 0).length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-4">لا توجد بيانات حالة أسرية بعد.</p>
                ) : (
                  familyStatusCounts.filter(f => f.value > 0).map((f, i) => (
                    <Bar key={i} label={f.label} value={f.value} max={total}
                      color={["#C9A24A","#16a34a","#7c3aed","#3b82f6","#dc2626","#d97706"][i % 6]} />
                  ))
                )}
              </div>

              {/* Top cities */}
              <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
                <h2 className="font-bold text-amber-800 text-base mb-4 border-b border-amber-50 pb-2">
                  🏙️ أعلى المدن تسجيلاً
                </h2>
                {topCities.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-4">لا توجد بيانات مدن بعد.</p>
                ) : (
                  topCities.map((c, i) => (
                    <Bar key={i} label={c.label} value={c.value} max={topCities[0].value}
                      color="#C9A24A" />
                  ))
                )}
              </div>
            </div>

            {/* ─── Housing & financial summary ─── */}
            <div className="grid md:grid-cols-3 gap-4 mb-8">
              <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-100">
                <p className="text-sm text-gray-500 mb-1">🏘️ يسكنون بالإيجار</p>
                <p className="text-3xl font-black text-amber-700">{renters}</p>
              </div>
              <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-100">
                <p className="text-sm text-gray-500 mb-1">🏠 يملكون مسكناً</p>
                <p className="text-3xl font-black text-green-700">{owners}</p>
              </div>
              <div className="bg-white rounded-2xl shadow-md p-5 border border-gray-100">
                <p className="text-sm text-gray-500 mb-1">📊 إجمالي الدخل المُعلن</p>
                <p className="text-2xl font-black text-blue-700">{totalIncome.toLocaleString("ar-SA")} ﷼</p>
              </div>
            </div>

            {/* ─── Summary table ─── */}
            <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
              <div className="p-5 border-b border-gray-100">
                <h2 className="font-bold text-amber-800 text-base">📋 ملخص إجمالي</h2>
              </div>
              <table className="w-full text-sm text-right">
                <tbody>
                  {[
                    ["إجمالي المستفيدين", total, ""],
                    ["منهم مواطنون", citizens, `${total ? Math.round(citizens/total*100) : 0}%`],
                    ["منهم مقيمون", residents, `${total ? Math.round(residents/total*100) : 0}%`],
                    ["ذوو احتياجات خاصة", specialNeeds, `${total ? Math.round(specialNeeds/total*100) : 0}%`],
                    ["حالة نشطة", active, ""],
                    ["موقوفون", suspended, ""],
                    ["قيد المراجعة", underRev, ""],
                  ].map(([label, val, pct], i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                      <td className="px-5 py-3 text-gray-700">{label}</td>
                      <td className="px-5 py-3 font-bold text-amber-800">{val}</td>
                      <td className="px-5 py-3 text-gray-400">{pct}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}
