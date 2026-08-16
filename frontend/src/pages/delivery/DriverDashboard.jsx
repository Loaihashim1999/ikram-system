import { useState, useEffect } from "react";
import beneficiaryApi from "../../api/beneficiaries";
import distributionApi from "../../api/distributions";
import MainLayout from "../../components/layout/MainLayout";
import { Truck, Phone, MapPin, CheckCircle, Clock, AlertTriangle } from "lucide-react";

export default function DriverDashboard() {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      beneficiaryApi.list({ per_page: 500 }),
      distributionApi.list({ per_page: 200 }),
    ]).then(([bRes, dRes]) => {
      const allB = Array.isArray(bRes.data?.data?.data) ? bRes.data.data.data : (Array.isArray(bRes.data?.data) ? bRes.data.data : []);
      const allD = Array.isArray(dRes.data?.data?.data) ? dRes.data.data.data : (Array.isArray(dRes.data?.data) ? dRes.data.data : []);

      // Driver filters for special needs and elderly deliveries
      const priorityB = allB.filter(
        (b) => b.has_special_needs || b.priority === "special_needs" || b.priority === "elderly" || (b.date_of_birth && new Date().getFullYear() - new Date(b.date_of_birth).getFullYear() >= 60)
      );

      const mapped = priorityB.map((b) => {
        const dist = allD.find((d) => d.beneficiary_id === b.id);
        return {
          id: dist?.id || b.id,
          beneficiary_name: b.full_name || b.name,
          phone: b.phone,
          city: b.city || "مكة المكرمة",
          district: b.district || "حي النسيم",
          street: b.street || "الشارع العام",
          priority_label: b.has_special_needs ? "ذوو احتياجات خاصة" : "كبار السن",
          basket_name: dist?.basket?.name || "سلة دعم مخصصة للمنزل",
          status: dist?.status || "pending",
        };
      });

      setDeliveries(mapped);
    }).finally(() => setLoading(false));
  }, []);

  const markStatus = (id, newStatus) => {
    setDeliveries((prev) =>
      prev.map((d) => (d.id === id ? { ...d, status: newStatus } : d))
    );
  };

  return (
    <MainLayout>
    <div className="p-6 max-w-5xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="mb-6 bg-gradient-to-r from-amber-800 to-amber-900 text-white p-6 rounded-2xl shadow-md">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Truck className="w-7 h-7 text-amber-400" />
          <span>لوحة سائق ومندوب التوصيل المباشر</span>
        </h1>
        <p className="text-xs text-amber-200 mt-1">تتبع مهام التوصيل اليومية لكبار السن وذوي الاحتياجات الخاصة وتحديث حالة التسليم</p>
      </div>

      {/* Task List */}
      <div className="space-y-4">
        {loading && (
          <div className="bg-white p-8 rounded-2xl text-center text-gray-400">
            جاري تحميل طلبات التوصيل...
          </div>
        )}

        {!loading && deliveries.map((d, idx) => (
          <div key={d.id || idx} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between gap-4 items-start md:items-center">
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-2">
                <span className="bg-purple-100 text-purple-800 px-2.5 py-0.5 rounded-full text-xs font-bold">
                  {d.priority_label}
                </span>
                <h3 className="text-base font-bold text-gray-800">{d.beneficiary_name}</h3>
              </div>

              <div className="flex items-center gap-3 text-xs text-gray-600">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-amber-600" />
                  {d.city} - {d.district} ({d.street})
                </span>
              </div>

              <div className="text-xs font-semibold text-amber-900">
                📦 {d.basket_name}
              </div>
            </div>

            {/* Actions & Status */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <a
                href={`tel:${d.phone}`}
                className="flex items-center gap-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold px-3 py-2 rounded-xl text-xs transition-colors"
              >
                <Phone className="w-4 h-4" />
                <span>اتصال ({d.phone})</span>
              </a>

              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(`${d.city} ${d.district} ${d.street}`)}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 bg-amber-50 text-amber-800 hover:bg-amber-100 font-bold px-3 py-2 rounded-xl text-xs transition-colors"
              >
                <MapPin className="w-4 h-4" />
                <span>الخريطة</span>
              </a>

              {d.status === "delivered" ? (
                <span className="flex items-center gap-1 bg-green-100 text-green-800 font-bold px-4 py-2 rounded-xl text-xs">
                  <CheckCircle className="w-4 h-4" />
                  <span>تم التسليم</span>
                </span>
              ) : (
                <button
                  onClick={() => markStatus(d.id, "delivered")}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-sm transition-all"
                >
                  تأكيد التسليم ✓
                </button>
              )}
            </div>
          </div>
        ))}

        {!loading && deliveries.length === 0 && (
          <div className="bg-white p-10 rounded-2xl text-center text-gray-400">
            لا توجد طلبات توصيل مسندة لك حالياً.
          </div>
        )}
      </div>
    </div>
    </MainLayout>
  );
}
