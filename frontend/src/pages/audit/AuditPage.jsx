import { useState, useEffect } from "react";
import api from "../../api/axios";
import MainLayout from "../../components/layout/MainLayout";
import { FileText, Shield, User, MapPin, Package, Truck, Download, Search, CheckCircle2 } from "lucide-react";

import FilterableTableHeader from "../../components/common/FilterableTableHeader";

export default function AuditPage() {
  const [data, setData] = useState({
    beneficiaries: [], distributions: [], representatives: [], inventory_movements: [], drivers: [], audit_logs: []
  });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("distributions");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    api.get("/audit")
      .then((res) => {
        if (res.data?.data) setData(res.data.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '') : 'https://ikram-system.onrender.com');

  return (
    <MainLayout>
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Shield className="w-7 h-7 text-amber-600" />
            <span>سجل التدقيق العام والتوثيق الرسمي (Audit & Logs)</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">تتبع كافة العمليات والتوزيعات وإخراج السندات المكسوة بالخط الهوائي الرسمي للجمعية</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap border-b pb-3">
        <button
          onClick={() => setTab("distributions")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            tab === "distributions" ? "bg-amber-600 text-white shadow-sm" : "bg-white text-gray-600 border hover:bg-amber-50"
          }`}
        >
          <Package className="w-4 h-4" />
          <span>سندات وعمليات التوزيع ({data.distributions.length})</span>
        </button>

        <button
          onClick={() => setTab("representatives")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            tab === "representatives" ? "bg-amber-600 text-white shadow-sm" : "bg-white text-gray-600 border hover:bg-amber-50"
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>سندات مناديب الأحياء ({data.representatives.length})</span>
        </button>

        <button
          onClick={() => setTab("movements")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            tab === "movements" ? "bg-amber-600 text-white shadow-sm" : "bg-white text-gray-600 border hover:bg-amber-50"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>سجل حركات المستودع ({data.inventory_movements.length})</span>
        </button>

        <button
          onClick={() => setTab("drivers")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            tab === "drivers" ? "bg-amber-600 text-white shadow-sm" : "bg-white text-gray-600 border hover:bg-amber-50"
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>سجل وأداء السائقين ({data.drivers.length})</span>
        </button>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        
        {/* Tab 1: Distributions & Receipts */}
        {tab === "distributions" && (
          <div className="overflow-x-auto border border-gray-200 rounded-xl text-xs">
            <table className="w-full text-right">
              <thead className="bg-amber-50/70 text-amber-900 border-b">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3 font-bold">اسم المستفيد</th>
                  <th className="p-3 font-bold">التصنيف</th>
                  <th className="p-3 font-bold">نوع السلة</th>
                  <th className="p-3 font-bold">تاريخ التوجيه</th>
                  <th className="p-3 font-bold">رمز الباركود</th>
                  <th className="p-3">
                    <FilterableTableHeader
                      title="حالة التسليم"
                      options={[
                        { value: "delivered", label: "تم الاستلام ✓" },
                        { value: "pending", label: "قيد الانتظار" }
                      ]}
                      selectedValue={statusFilter}
                      onChange={setStatusFilter}
                    />
                  </th>
                  <th className="p-3 font-bold">تصدير السند الرسمي (PDF)</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={8} className="p-8 text-center text-gray-400">جاري التحميل...</td></tr>
                )}
                {!loading && data.distributions
                  .filter((d) => statusFilter === "all" || (statusFilter === "delivered" ? d.status === "delivered" : d.status !== "delivered"))
                  .map((d, idx) => (
                  <tr key={d.id || idx} className="border-b hover:bg-gray-50">
                    <td className="p-3 text-gray-400">{idx + 1}</td>
                    <td className="p-3 font-bold text-gray-800">{d.beneficiaries?.full_name || d.beneficiary?.name || "مستفيد"}</td>
                    <td className="p-3"><span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold text-[11px]">مستحق</span></td>
                    <td className="p-3 font-bold">{d.basket?.name || "سلة دعم"}</td>
                    <td className="p-3 font-mono">{d.scheduled_at ? new Date(d.scheduled_at).toLocaleDateString('ar-SA') : "—"}</td>
                    <td className="p-3 font-mono font-bold text-amber-900">{d.barcode_code}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${d.status === 'delivered' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                        {d.status === 'delivered' ? 'تم الاستلام ✓' : 'قيد الانتظار'}
                      </span>
                    </td>
                    <td className="p-3 flex gap-2">
                      <a
                        href={`${API_BASE}/api/documents/individual-receipt/${d.id}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1 rounded-lg text-xs flex items-center gap-1 shadow-sm"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>سند الاستلام الفردي</span>
                      </a>

                      <a
                        href={`${API_BASE}/api/documents/total-delivery/${d.beneficiary_id}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-gray-100 text-gray-700 hover:bg-gray-200 font-bold px-3 py-1 rounded-lg text-xs flex items-center gap-1"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>السند الشامل</span>
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Representatives Documents */}
        {tab === "representatives" && (
          <div className="overflow-x-auto border border-gray-200 rounded-xl text-xs">
            <table className="w-full text-right">
              <thead className="bg-amber-50/70 text-amber-900 border-b">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3 font-bold">اسم مندوب الحي</th>
                  <th className="p-3 font-bold">الحي السكني</th>
                  <th className="p-3 font-bold">رقم الهوية</th>
                  <th className="p-3 font-bold">عدد أسر الحي</th>
                  <th className="p-3 font-bold">تصدير سند التوزيع المعتمد (PDF)</th>
                </tr>
              </thead>
              <tbody>
                {data.representatives.map((r, idx) => (
                  <tr key={r.id || idx} className="border-b hover:bg-gray-50">
                    <td className="p-3 text-gray-400">{idx + 1}</td>
                    <td className="p-3 font-bold text-gray-800">{r.full_name}</td>
                    <td className="p-3 font-bold text-amber-900">{r.district_name}</td>
                    <td className="p-3 font-mono">{r.national_id || "—"}</td>
                    <td className="p-3 font-bold text-green-700">{r.beneficiaries_count} أسرة</td>
                    <td className="p-3">
                      <a
                        href={`${API_BASE}/api/documents/rep-receipt/${r.id}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs inline-flex items-center gap-1.5 shadow-sm"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>تصدير سند تسليم المندوب بالخط الهوائي (PDF)</span>
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Inventory Movements */}
        {tab === "movements" && (
          <div className="overflow-x-auto border border-gray-200 rounded-xl text-xs">
            <table className="w-full text-right">
              <thead className="bg-amber-50/70 text-amber-900 border-b">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3 font-bold">المادة / الصنف</th>
                  <th className="p-3 font-bold">نوع الحركة</th>
                  <th className="p-3 font-bold">الكمية</th>
                  <th className="p-3 font-bold">السبب والتفاصيل</th>
                  <th className="p-3 font-bold">التاريخ والتوقيت</th>
                </tr>
              </thead>
              <tbody>
                {data.inventory_movements.map((m, idx) => (
                  <tr key={m.id || idx} className="border-b">
                    <td className="p-3 text-gray-400">{idx + 1}</td>
                    <td className="p-3 font-bold text-gray-800">{m.inventory_item?.name || "سلة غذائية"}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${m.type === 'in' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {m.type === 'in' ? 'إدخال مخزون +' : 'صرف توزيع -'}
                      </span>
                    </td>
                    <td className="p-3 font-mono font-bold">{m.quantity} وحدة</td>
                    <td className="p-3 text-gray-600">{m.reason || "توجيه وسحب سلال"}</td>
                    <td className="p-3 font-mono text-gray-500">{m.created_at ? new Date(m.created_at).toLocaleString('ar-SA') : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 4: Drivers Performance */}
        {tab === "drivers" && (
          <div className="overflow-x-auto border border-gray-200 rounded-xl text-xs">
            <table className="w-full text-right">
              <thead className="bg-amber-50/70 text-amber-900 border-b">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3 font-bold">اسم السائق</th>
                  <th className="p-3 font-bold">رقم الجوال</th>
                  <th className="p-3 font-bold">الدور والصلاحية</th>
                  <th className="p-3 font-bold">المهام المنجزة والتسليم</th>
                </tr>
              </thead>
              <tbody>
                {data.drivers.map((drv, idx) => (
                  <tr key={drv.id || idx} className="border-b">
                    <td className="p-3 text-gray-400">{idx + 1}</td>
                    <td className="p-3 font-bold text-gray-800">{drv.full_name || drv.username}</td>
                    <td className="p-3 font-mono">{drv.phone || "—"}</td>
                    <td className="p-3"><span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold text-[11px]">سائق التوصيل الميداني</span></td>
                    <td className="p-3 font-bold text-green-700">نشط في المنظومة ✓</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
    </MainLayout>
  );
}
