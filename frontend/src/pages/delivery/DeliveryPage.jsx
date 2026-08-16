import { useState, useEffect } from "react";
import beneficiaryApi from "../../api/beneficiaries";
import distributionApi from "../../api/distributions";
import api from "../../api/axios";
import MainLayout from "../../components/layout/MainLayout";

export default function DeliveryPage() {
  const [activeTab, setActiveTab] = useState("special_needs"); // 'special_needs' | 'representatives'

  // Data states
  const [specialNeedsList, setSpecialNeedsList] = useState([]);
  const [repDistributions, setRepDistributions] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [representatives, setRepresentatives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Load delivery data
  useEffect(() => {
    setLoading(true);
    Promise.all([
      beneficiaryApi.list({ per_page: 500 }),
      distributionApi.list({ per_page: 200 }),
      api.get("/drivers").catch(() => ({ data: { data: [] } })),
      api.get("/representatives").catch(() => ({ data: { data: [] } })),
    ]).then(([bRes, dRes, driversRes, repsRes]) => {
      const rawB = bRes.data?.data?.data ?? bRes.data?.data ?? bRes.data ?? [];
      const allB = Array.isArray(rawB) ? rawB : [];

      const rawD = dRes.data?.data?.data ?? dRes.data?.data ?? dRes.data ?? [];
      const allD = Array.isArray(rawD) ? rawD : [];

      // Filter beneficiaries who are special needs or elderly
      const snBeneficiaries = allB.filter(
        (b) => b.has_special_needs || b.priority === "special_needs" || b.priority === "elderly" || (b.date_of_birth && (new Date().getFullYear() - new Date(b.date_of_birth).getFullYear() >= 60))
      );

      // Match distributions for special needs
      const snDistributions = allD.filter((d) =>
        snBeneficiaries.some((b) => b.id === d.beneficiary_id)
      );

      setSpecialNeedsList(snDistributions.length > 0 ? snDistributions : snBeneficiaries.map(b => ({ id: b.id, beneficiary: b, status: 'pending', barcode_code: 'DRAFT' })));
      setRepDistributions(allD);
      const rawDrivers = driversRes.data?.data ?? driversRes.data ?? [];
      setDrivers(Array.isArray(rawDrivers) ? rawDrivers : []);
      const rawReps = repsRes.data?.data ?? repsRes.data ?? [];
      setRepresentatives(Array.isArray(rawReps) ? rawReps : []);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const markDelivered = async (id) => {
    try {
      await distributionApi.markReceived(id);
      setSpecialNeedsList((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: "delivered" } : item))
      );
    } catch {
      alert("حدث خطأ أثناء تحديث حالة التوصيل.");
    }
  };

  const filteredSpecialNeeds = specialNeedsList.filter((item) => {
    const name = item.beneficiary?.full_name || item.beneficiary?.name || item.full_name || item.name || "";
    const phone = item.beneficiary?.phone || item.phone || "";
    const q = search.toLowerCase();
    return !q || name.toLowerCase().includes(q) || phone.includes(q);
  });

  const filteredReps = repDistributions.filter((item) => {
    const name = item.beneficiary?.full_name || item.beneficiary?.name || "";
    const q = search.toLowerCase();
    return !q || name.toLowerCase().includes(q);
  });

  return (
    <MainLayout>
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      {/* Page Title */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <span>🚚</span> إدارة عمليات التوصيل
          </h1>
          <p className="text-xs text-gray-500 mt-1">تتبع وتسليم المساعدات لكبار السن وذوي الاحتياجات الخاصة ومناديب الأحياء</p>
        </div>

        {/* Tab Buttons */}
        <div className="flex bg-gray-100 p-1.5 rounded-2xl border border-gray-200">
          <button
            onClick={() => setActiveTab("special_needs")}
            className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "special_needs"
                ? "bg-amber-600 text-white shadow-md"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            ♿ توصيل كبار السن وذوي الاحتياجات الخاصة
          </button>
          <button
            onClick={() => setActiveTab("representatives")}
            className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "representatives"
                ? "bg-amber-600 text-white shadow-md"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            🏘️ توصيل مناديب الأحياء
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث بالاسم أو رقم الهاتف..."
          className="w-full max-w-md rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 text-right bg-white shadow-sm"
        />
      </div>

      {/* TAB 1: Special Needs & Elderly */}
      {activeTab === "special_needs" && (
        <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-base font-bold text-amber-900 flex items-center gap-2">
              <span>♿</span> قائمة توصيل المنازل (كبار السن وذوو الاحتياجات الخاصة)
            </h2>
            <span className="text-xs bg-amber-100 text-amber-800 px-3 py-1 rounded-full font-bold">
              إجمالي الطلبات: {filteredSpecialNeeds.length}
            </span>
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded-xl">
            <table className="w-full text-xs text-right">
              <thead className="bg-amber-50/70 text-amber-900 border-b">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3 font-bold">اسم المستفيد</th>
                  <th className="p-3 font-bold">الفئة / التصنيف</th>
                  <th className="p-3 font-bold">العنوان التفصيلي</th>
                  <th className="p-3 font-bold">رقم التواصل</th>
                  <th className="p-3 font-bold">نوع السلة</th>
                  <th className="p-3 font-bold">حالة التوصيل</th>
                  <th className="p-3 font-bold">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-gray-400">
                      جاري التحميل...
                    </td>
                  </tr>
                )}
                {!loading && filteredSpecialNeeds.map((item, idx) => {
                  const b = item.beneficiary || item;
                  return (
                    <tr key={item.id || idx} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="p-3 text-gray-400">{idx + 1}</td>
                      <td className="p-3 font-bold text-gray-800">{b.full_name || b.name}</td>
                      <td className="p-3">
                        <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded-md text-[11px] font-bold">
                          {b.has_special_needs ? "ذوو احتياجات خاصة" : "كبار السن"}
                        </span>
                      </td>
                      <td className="p-3 text-gray-600">
                        {b.city ? `${b.city} - ${b.district || ''} (${b.street || ''})` : "عنوان غير محدد"}
                      </td>
                      <td className="p-3 text-gray-700 font-mono">{b.phone}</td>
                      <td className="p-3 text-gray-700">{item.basket?.name || "سلة دعم مخصصة"}</td>
                      <td className="p-3">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            item.status === "delivered"
                              ? "bg-green-100 text-green-700"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {item.status === "delivered" ? "✓ تم التسليم" : "⏳ قيد التوصيل"}
                        </span>
                      </td>
                      <td className="p-3">
                        {item.status !== "delivered" && (
                          <button
                            onClick={() => markDelivered(item.id)}
                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-lg text-xs font-bold transition-all shadow-sm"
                          >
                            تأكيد التسليم
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!loading && filteredSpecialNeeds.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-gray-400">
                      لا توجد طلبات توصيل مسجلة لهذه الفئة حالياً.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Neighborhood Representatives */}
      {activeTab === "representatives" && (
        <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-base font-bold text-amber-900 flex items-center gap-2">
              <span>🏘️</span> توزيعات مناديب الأحياء
            </h2>
            <span className="text-xs bg-amber-100 text-amber-800 px-3 py-1 rounded-full font-bold">
              إجمالي التوزيعات: {filteredReps.length}
            </span>
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded-xl">
            <table className="w-full text-xs text-right">
              <thead className="bg-amber-50/70 text-amber-900 border-b">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3 font-bold">اسم المستفيد</th>
                  <th className="p-3 font-bold">الحي والمدينة</th>
                  <th className="p-3 font-bold">السلة المخصصة</th>
                  <th className="p-3 font-bold">رمز الباركود</th>
                  <th className="p-3 font-bold">حالة التوزيع</th>
                  <th className="p-3 font-bold">إجراءات المندوب</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-gray-400">
                      جاري التحميل...
                    </td>
                  </tr>
                )}
                {!loading && filteredReps.map((item, idx) => (
                  <tr key={item.id || idx} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="p-3 text-gray-400">{idx + 1}</td>
                    <td className="p-3 font-bold text-gray-800">
                      {item.beneficiary?.full_name || item.beneficiary?.name || "—"}
                    </td>
                    <td className="p-3 text-gray-600">
                      {item.beneficiary?.district ? `${item.beneficiary?.city} - ${item.beneficiary?.district}` : "—"}
                    </td>
                    <td className="p-3 text-gray-700">{item.basket?.name || "سلة مساعدة"}</td>
                    <td className="p-3 font-mono font-bold text-amber-800">{item.barcode_code}</td>
                    <td className="p-3">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          item.status === "delivered"
                            ? "bg-green-100 text-green-700"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {item.status === "delivered" ? "✓ تم التسليم للمندوب" : "⏳ بانتظار التسليم"}
                      </span>
                    </td>
                    <td className="p-3">
                      {item.status !== "delivered" && (
                        <button
                          onClick={() => markDelivered(item.id)}
                          className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 rounded-lg text-xs font-bold transition-all shadow-sm"
                        >
                          تأكيد استلام المندوب
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {!loading && filteredReps.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-gray-400">
                      لا توجد توزيعات مناديب أحياء مسجلة.
                    </td>
                  </tr>
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
