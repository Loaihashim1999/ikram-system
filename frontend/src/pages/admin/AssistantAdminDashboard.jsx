import { useState, useEffect } from "react";
import beneficiaryApi from "../../api/beneficiaries";
import distributionApi from "../../api/distributions";
import MainLayout from "../../components/layout/MainLayout";
import { UserCheck, CheckCircle2, Clock, AlertCircle, FileText } from "lucide-react";

export default function AssistantAdminDashboard() {
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [distributions, setDistributions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      beneficiaryApi.list({ per_page: 100 }),
      distributionApi.list({ per_page: 100 }),
    ]).then(([bRes, dRes]) => {
      const rawB = Array.isArray(bRes.data?.data?.data) ? bRes.data.data.data : (Array.isArray(bRes.data?.data) ? bRes.data.data : []);
      const rawD = Array.isArray(dRes.data?.data?.data) ? dRes.data.data.data : (Array.isArray(dRes.data?.data) ? dRes.data.data : []);
      setBeneficiaries(rawB);
      setDistributions(rawD);
    }).finally(() => setLoading(false));
  }, []);

  return (
    <MainLayout>
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="mb-6 bg-gradient-to-r from-purple-900 to-indigo-900 text-white p-6 rounded-2xl shadow-md">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <UserCheck className="w-7 h-7 text-purple-300" />
          <span>لوحة متابعة مساعد / نائب المدير</span>
        </h1>
        <p className="text-xs text-purple-200 mt-1">مراجعة الحالات التشغيلية، اعتماد طلبات تقديم الدعم، ومتابعة سرعة الإنجاز</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-semibold">إجمالي الحالات المراجعة</p>
            <h3 className="text-2xl font-black text-purple-900 mt-1">{beneficiaries.length}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-700 font-bold">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-semibold">توزيعات السلات المكتملة</p>
            <h3 className="text-2xl font-black text-green-700 mt-1">
              {distributions.filter(d => d.status === 'delivered').length}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-green-700 font-bold">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 font-semibold">طلبات قيد المتابعة</p>
            <h3 className="text-2xl font-black text-amber-700 mt-1">
              {distributions.filter(d => d.status !== 'delivered').length}
            </h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700 font-bold">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="text-base font-bold text-gray-800 mb-4">📋 مراجعة الحالات الجديدة للتصنيف والدعم</h2>
        <div className="overflow-x-auto border border-gray-200 rounded-xl">
          <table className="w-full text-xs text-right">
            <thead className="bg-purple-50/70 text-purple-900 border-b">
              <tr>
                <th className="p-3">#</th>
                <th className="p-3 font-bold">اسم المستفيد</th>
                <th className="p-3 font-bold">رقم الهوية</th>
                <th className="p-3 font-bold">تصنيف الدخل</th>
                <th className="p-3 font-bold">الحالة</th>
                <th className="p-3 font-bold">تاريخ التسجيل</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-400">
                    جاري تحميل الحالات...
                  </td>
                </tr>
              )}
              {!loading && beneficiaries.map((b, idx) => (
                <tr key={b.id || idx} className="border-b hover:bg-gray-50 transition-colors">
                  <td className="p-3 text-gray-400">{idx + 1}</td>
                  <td className="p-3 font-bold text-gray-800">{b.full_name || b.name}</td>
                  <td className="p-3 font-mono">{b.national_id}</td>
                  <td className="p-3">
                    <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full text-[11px] font-bold">
                      {b.priority === 'first_class' ? 'درجة أولى' : b.priority === 'second_class' ? 'درجة ثانية' : b.priority === 'special_needs' ? 'ذوو احتياجات' : b.priority === 'elderly' ? 'كبار السن' : b.priority || 'مراجعة'}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-[11px] font-bold">
                      معتمد
                    </span>
                  </td>
                  <td className="p-3 text-gray-500 font-mono">
                    {b.created_at ? new Date(b.created_at).toLocaleDateString("ar-SA") : "—"}
                  </td>
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
