import { useState, useEffect } from "react";
import beneficiaryApi from "../../api/beneficiaries";
import distributionApi from "../../api/distributions";
import api from "../../api/axios";
import MainLayout from "../../components/layout/MainLayout";
import { Truck, Phone, MapPin, CheckCircle, QrCode, Search } from "lucide-react";

export default function DriverDashboard() {
  const [activeTab, setActiveTab] = useState("special_needs"); // 'special_needs' | 'representatives'
  const [drivers, setDrivers] = useState([]);
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [user, setUser] = useState(null);

  const [beneficiaryDeliveries, setBeneficiaryDeliveries] = useState([]);
  const [repDeliveries, setRepDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);

  // QR Confirmation Modal State
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrCodeInput, setQrCodeInput] = useState("");
  const [verifyingQr, setVerifyingQr] = useState(false);

  useEffect(() => {
    // Load logged in user & drivers
    api.get("/me").then((res) => {
      const u = res.data?.user || res.data;
      setUser(u);
      if (u?.id) setSelectedDriverId(String(u.id));
    }).catch(() => {});

    api.get("/drivers").then((res) => {
      const dList = res.data?.data ?? [];
      setDrivers(Array.isArray(dList) ? dList : []);
      if (dList.length > 0 && !selectedDriverId) {
        setSelectedDriverId(String(dList[0].id));
      }
    }).catch(console.error);
  }, []);

  useEffect(() => {
    loadDriverData();
  }, [selectedDriverId]);

  const loadDriverData = () => {
    setLoading(true);
    Promise.all([
      distributionApi.list({ per_page: 500 }),
      api.get("/neighborhood-reps").catch(() => ({ data: { data: [] } })),
      beneficiaryApi.list({ per_page: 500 }),
    ]).then(([dRes, repsRes, bRes]) => {
      const allD = Array.isArray(dRes.data?.data?.data) ? dRes.data.data.data : (Array.isArray(dRes.data?.data) ? dRes.data.data : []);
      const allReps = repsRes.data?.data ?? [];
      const allB = Array.isArray(bRes.data?.data?.data) ? bRes.data.data.data : (Array.isArray(bRes.data?.data) ? bRes.data.data : []);

      // Filter beneficiary distributions assigned to this driver
      const benDistributions = allD.filter((d) => {
        if (!selectedDriverId) return true;
        return String(d.driver_id) === String(selectedDriverId);
      });

      setBeneficiaryDeliveries(benDistributions);

      // Filter representative distributions assigned to this driver
      const driverRepDistributions = [];
      allReps.forEach((r) => {
        if (r.rep_distributions && Array.isArray(r.rep_distributions)) {
          r.rep_distributions.forEach((rd) => {
            if (!selectedDriverId || String(rd.driver_id) === String(selectedDriverId)) {
              driverRepDistributions.push({
                ...rd,
                rep: r,
              });
            }
          });
        }
      });

      setRepDeliveries(driverRepDistributions);
    }).finally(() => setLoading(false));
  };

  const confirmReceiptByQr = async (codeToConfirm) => {
    const code = (codeToConfirm || qrCodeInput).trim().toUpperCase();
    if (!code) return;
    setVerifyingQr(true);
    try {
      const res = await api.post(`/receiver/confirm/${code}`);
      alert(res.data?.message || "تم قراءة كود الـ QR وتأكيد استلام التوصيل بنجاح!");
      setShowQrModal(false);
      setQrCodeInput("");
      loadDriverData();
    } catch (err) {
      alert(err.response?.data?.message || "كود الـ QR غير صحيح أو تم تأكيده سابقاً.");
    } finally {
      setVerifyingQr(false);
    }
  };

  return (
    <MainLayout>
      <div className="p-6 max-w-5xl mx-auto" dir="rtl">
        {/* Header */}
        <div className="mb-6 bg-gradient-to-r from-amber-800 to-amber-900 text-white p-6 rounded-2xl shadow-md flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Truck className="w-7 h-7 text-amber-400" />
              <span>لوحة سائق التوصيل المباشر</span>
            </h1>
            <p className="text-xs text-amber-200 mt-1">عرض المستفيدين والمناديب المسندين إليك فقط وتأكيد الاستلام عبر كود الـ QR</p>
          </div>

          {/* Driver Switcher Selector */}
          <div className="bg-white/10 p-2 rounded-xl border border-white/20">
            <label className="block text-[10px] text-amber-200 font-bold mb-1">السائق الحالي:</label>
            <select
              value={selectedDriverId}
              onChange={(e) => setSelectedDriverId(e.target.value)}
              className="bg-amber-950 text-white text-xs font-bold rounded-lg p-2 border border-amber-600 focus:outline-none"
            >
              <option value="">جميع السائقين (عرض شمول)</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  🚚 {d.full_name || d.name} ({d.phone})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex bg-gray-100 p-1.5 rounded-2xl border border-gray-200 mb-6">
          <button
            onClick={() => setActiveTab("special_needs")}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "special_needs"
                ? "bg-amber-600 text-white shadow-md"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            👵 قائمة كبار السن وذوي الاحتياجات الخاصة ({beneficiaryDeliveries.length})
          </button>
          <button
            onClick={() => setActiveTab("representatives")}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "representatives"
                ? "bg-amber-600 text-white shadow-md"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            🏘️ قائمة مناديب الأحياء ({repDeliveries.length})
          </button>
        </div>

        {/* TAB 1: Beneficiary Deliveries */}
        {activeTab === "special_needs" && (
          <div className="space-y-4">
            {loading && (
              <div className="bg-white p-8 rounded-2xl text-center text-gray-400">جاري تحميل طلبات المستفيدين...</div>
            )}

            {!loading && beneficiaryDeliveries.map((d, idx) => {
              const b = d.beneficiary || {};
              const isDelivered = d.status === "delivered";

              return (
                <div key={d.id || idx} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between gap-4 items-start md:items-center">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="bg-purple-100 text-purple-800 px-2.5 py-0.5 rounded-full text-xs font-bold">
                        {b.has_special_needs ? "ذوو احتياجات خاصة" : "كبار السن"}
                      </span>
                      <h3 className="text-base font-bold text-gray-800">{b.full_name || b.name || "المستفيد"}</h3>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-gray-600 font-bold">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-amber-600" />
                        {b.city || "مكة المكرمة"} - {b.district || "—"} ({b.street || "الشارع العام"})
                      </span>
                    </div>

                    <div className="text-xs font-semibold text-amber-900 flex items-center gap-3">
                      <span>📦 {d.basket?.name || "سلة دعم مخصصة للمنزل"}</span>
                      <span className="font-mono bg-amber-100 px-2 py-0.5 rounded">🔑 {d.barcode_code}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    <a
                      href={`tel:${b.phone}`}
                      className="flex items-center gap-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold px-3 py-2 rounded-xl text-xs transition-colors"
                    >
                      <Phone className="w-4 h-4" />
                      <span>اتصال ({b.phone || "—"})</span>
                    </a>

                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(`${b.city || 'مكة'} ${b.district || ''} ${b.street || ''}`)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 bg-amber-50 text-amber-800 hover:bg-amber-100 font-bold px-3 py-2 rounded-xl text-xs transition-colors"
                    >
                      <MapPin className="w-4 h-4" />
                      <span>الخريطة</span>
                    </a>

                    {isDelivered ? (
                      <span className="flex items-center gap-1 bg-green-100 text-green-800 font-bold px-4 py-2 rounded-xl text-xs">
                        <CheckCircle className="w-4 h-4" />
                        <span>تم الاستلام وقراءة QR</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => confirmReceiptByQr(d.barcode_code)}
                        className="bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-xs transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <QrCode className="w-4 h-4" />
                        <span>تأكيد وقراءة QR ✓</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {!loading && beneficiaryDeliveries.length === 0 && (
              <div className="bg-white p-10 rounded-2xl text-center text-gray-400">
                لا توجد طلبات توصيل مستفيدين مسندة لهذا السائق حالياً.
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Representative Deliveries */}
        {activeTab === "representatives" && (
          <div className="space-y-4">
            {loading && (
              <div className="bg-white p-8 rounded-2xl text-center text-gray-400">جاري تحميل توزيعات المناديب...</div>
            )}

            {!loading && repDeliveries.map((rd, idx) => {
              const r = rd.rep || {};
              const isDelivered = rd.status === "delivered";

              return (
                <div key={rd.id || idx} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between gap-4 items-start md:items-center">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-full text-xs font-bold">
                        مندوب حي
                      </span>
                      <h3 className="text-base font-bold text-gray-800">{r.full_name || "مندوب الحي"}</h3>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-gray-600 font-bold">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-amber-600" />
                        {r.city || "مكة المكرمة"} - {r.district_name || "الفيصلية"}
                      </span>
                      <span className="text-amber-800 font-bold">👥 الأسر التابعة: {r.beneficiaries_count || 0} أسرة</span>
                    </div>

                    <div className="text-xs font-semibold text-amber-900 flex items-center gap-3">
                      <span>📦 الكمية: {rd.basket_count || r.beneficiaries_count || 1} سلة</span>
                      <span className="font-mono bg-amber-100 px-2 py-0.5 rounded">🔑 {rd.barcode_code}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    <a
                      href={`tel:${r.phone}`}
                      className="flex items-center gap-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold px-3 py-2 rounded-xl text-xs transition-colors"
                    >
                      <Phone className="w-4 h-4" />
                      <span>اتصال ({r.phone || "—"})</span>
                    </a>

                    {isDelivered ? (
                      <span className="flex items-center gap-1 bg-green-100 text-green-800 font-bold px-4 py-2 rounded-xl text-xs">
                        <CheckCircle className="w-4 h-4" />
                        <span>تم الاستلام وقراءة QR</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => confirmReceiptByQr(rd.barcode_code)}
                        className="bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-xs transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <QrCode className="w-4 h-4" />
                        <span>تأكيد وقراءة QR ✓</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {!loading && repDeliveries.length === 0 && (
              <div className="bg-white p-10 rounded-2xl text-center text-gray-400">
                لا توجد طلبات توصيل مناديب مسندة لهذا السائق حالياً.
              </div>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
