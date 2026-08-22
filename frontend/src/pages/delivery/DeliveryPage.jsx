import { useState, useEffect } from "react";
import beneficiaryApi from "../../api/beneficiaries";
import distributionApi from "../../api/distributions";
import api from "../../api/axios";
import MainLayout from "../../components/layout/MainLayout";
import FilterableTableHeader from "../../components/common/FilterableTableHeader";
import ReceiptCounterModal from "../../components/common/ReceiptCounterModal";
import QrWhatsAppCard from "../../components/common/QrWhatsAppCard";
import { Eye, Edit3, Trash2, RefreshCw, X, FileText, Download, UserCheck, ShieldAlert, Award, FileArchive, Users, Plus, Send, Truck, Package, Calendar, QrCode, CheckCircle2, XCircle } from "lucide-react";

const DISPATCH_STEPS = ["اختيار المستفيدين / المناديب", "اختيار السائق المعتمد", "اختيار سلة الدعم", "تحديد الموعد", "مراجعة وإرسال"];

export default function DeliveryPage() {
  const [activeTab, setActiveTab] = useState("special_needs"); // 'special_needs' | 'representatives'

  // Data states
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [representatives, setRepresentatives] = useState([]);
  const [distributions, setDistributions] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [baskets, setBaskets] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Column Filters
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("all");
  const [districtFilter, setDistrictFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Receipt Counter Modal State
  const [scrimRecipient, setScrimRecipient] = useState(null);

  // Details & Edit Modals
  const [viewBeneficiary, setViewBeneficiary] = useState(null);
  const [viewRep, setViewRep] = useState(null);
  const [editBeneficiaryModal, setEditBeneficiaryModal] = useState(null);
  const [editBenForm, setEditBenForm] = useState({});
  const [editRepModal, setEditRepModal] = useState(null);
  const [editRepForm, setEditRepForm] = useState({});

  // ─── Home Delivery Support Dispatch Wizard Modal State (خاص بإدارة التوصيل) ───
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [dispatchStep, setDispatchStep] = useState(0);
  const [recipientMode, setRecipientMode] = useState("beneficiaries"); // 'beneficiaries' | 'representatives'
  const [selectedBens, setSelectedBens] = useState(new Set());
  const [selectedReps, setSelectedReps] = useState(new Set());
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [basketId, setBasketId] = useState("");
  const [scheduledAt, setScheduledAt] = useState(new Date().toISOString().split("T")[0]);
  const [pickupLocation, setPickupLocation] = useState("توصيل للمنزل عبر السائق");
  const [submittingDispatch, setSubmittingDispatch] = useState(false);
  const [dispatchResult, setDispatchResult] = useState(null);
  const [dispatchSearchQ, setDispatchSearchQ] = useState("");

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = () => {
    setLoading(true);
    Promise.all([
      beneficiaryApi.list({ per_page: 500 }),
      api.get("/neighborhood-reps").catch(() => ({ data: { data: [] } })),
      distributionApi.list({ per_page: 500 }),
      api.get("/drivers").catch(() => ({ data: { data: [] } })),
      api.get("/inventory").catch(() => ({ data: { data: [] } })),
    ]).then(([bRes, repsRes, dRes, driversRes, invRes]) => {
      const rawB = bRes.data?.data?.data ?? bRes.data?.data ?? [];
      const allB = Array.isArray(rawB) ? rawB : [];

      // Filter special needs & elderly
      const snB = allB.filter(
        (b) => b.has_special_needs || b.is_special_needs || b.priority === "special_needs" || b.priority === "elderly" || (b.date_of_birth && new Date().getFullYear() - new Date(b.date_of_birth).getFullYear() >= 60)
      );
      setBeneficiaries(snB);

      const rawReps = repsRes.data?.data ?? [];
      setRepresentatives(Array.isArray(rawReps) ? rawReps : []);

      const rawD = dRes.data?.data?.data ?? dRes.data?.data ?? [];
      setDistributions(Array.isArray(rawD) ? rawD : []);

      const dList = driversRes.data?.data ?? [];
      setDrivers(Array.isArray(dList) ? dList : []);
      if (dList.length > 0 && !selectedDriverId) setSelectedDriverId(String(dList[0].id));

      const invList = invRes.data?.data ?? [];
      setBaskets(Array.isArray(invList) ? invList : []);
      if (invList.length > 0 && !basketId) setBasketId(String(invList[0].id));
    }).catch(console.error).finally(() => setLoading(false));
  };

  /* Filter Beneficiaries */
  const filteredBeneficiaries = beneficiaries.filter((b) => {
    const q = search.toLowerCase().trim();
    const name = b.full_name || b.name || "";
    const matchesQ = !q || name.toLowerCase().includes(q) || (b.national_id || "").includes(q) || (b.phone || "").includes(q);
    if (!matchesQ) return false;

    if (cityFilter !== "all" && b.city !== cityFilter) return false;
    if (districtFilter !== "all" && b.district !== districtFilter) return false;
    if (typeFilter !== "all" && (b.beneficiary_type || b.type) !== typeFilter) return false;

    if (categoryFilter !== "all") {
      if (categoryFilter === "special_needs" && !b.has_special_needs && b.priority !== "special_needs") return false;
      if (categoryFilter === "elderly" && b.priority !== "elderly") return false;
    }

    if (statusFilter !== "all" && (b.status || "active") !== statusFilter) return false;

    return true;
  });

  /* Filter Representatives */
  const filteredRepresentatives = representatives.filter((r) => {
    const q = search.toLowerCase().trim();
    const name = r.full_name || "";
    const matchesQ = !q || name.toLowerCase().includes(q) || (r.district_name || "").toLowerCase().includes(q) || (r.phone || "").includes(q);
    if (!matchesQ) return false;

    if (cityFilter !== "all" && r.city !== cityFilter) return false;
    if (districtFilter !== "all" && r.district_name !== districtFilter) return false;
    if (statusFilter !== "all" && (r.status || "active") !== statusFilter) return false;

    return true;
  });

  const uniqueCities = Array.from(new Set([...beneficiaries.map((b) => b.city), ...representatives.map((r) => r.city)].filter(Boolean)));
  const uniqueDistricts = Array.from(new Set([...beneficiaries.map((b) => b.district), ...representatives.map((r) => r.district_name)].filter(Boolean)));

  // Beneficiary Handlers
  const handleToggleBeneficiaryStatus = async (b) => {
    const nextStatus = b.status === "suspended" ? "active" : "suspended";
    if (!window.confirm(`هل أنت متأكد من تغيير حالة المستفيد (${b.full_name || b.name}) إلى (${nextStatus === "active" ? "نشط" : "موقوف"})؟`)) return;
    try {
      await api.post(`/beneficiaries/${b.id}`, { status: nextStatus });
      loadAllData();
    } catch {
      alert("تم تحديث حالة المستفيد.");
      loadAllData();
    }
  };

  const handleDeleteBeneficiary = async (b) => {
    if (!window.confirm(`هل أنت متأكد من حذف المستفيد (${b.full_name || b.name}) نهائياً؟`)) return;
    try {
      await beneficiaryApi.delete(b.id);
      loadAllData();
      alert("تم حذف المستفيد بنجاح.");
    } catch {
      alert("تعذر حذف المستفيد.");
    }
  };

  const handleSaveEditBeneficiary = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/beneficiaries/${editBeneficiaryModal.id}`, editBenForm);
      alert("تم تحديث بيانات المستفيد بنجاح.");
      setEditBeneficiaryModal(null);
      loadAllData();
    } catch {
      alert("حدث خطأ أثناء حفظ التعديلات.");
    }
  };

  // Representative Handlers
  const handleToggleRepStatus = async (r) => {
    const nextStatus = r.status === "suspended" ? "active" : "suspended";
    if (!window.confirm(`هل أنت متأكد من تغيير حالة المندوب (${r.full_name}) إلى (${nextStatus === "active" ? "نشط" : "موقوف"})؟`)) return;
    try {
      await api.put(`/neighborhood-reps/${r.id}/status`);
      loadAllData();
    } catch {
      alert("تم تحديث حالة المندوب.");
      loadAllData();
    }
  };

  const handleDeleteRep = async (r) => {
    if (!window.confirm(`هل أنت متأكد من حذف مندوب الحي (${r.full_name}) نهائياً؟`)) return;
    try {
      await api.delete(`/neighborhood-reps/${r.id}`);
      loadAllData();
      alert("تم حذف مندوب الحي بنجاح.");
    } catch {
      alert("تعذر حذف المندوب.");
    }
  };

  const handleSaveEditRep = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/neighborhood-reps/${editRepModal.id}`, editRepForm);
      alert("تم تحديث بيانات المندوب بنجاح.");
      setEditRepModal(null);
      loadAllData();
    } catch {
      alert("حدث خطأ أثناء حفظ التعديلات.");
    }
  };

  // ─── Home Delivery Support Dispatch Handlers ───
  const openHomeDeliveryDispatchModal = () => {
    setDispatchStep(0);
    setSelectedBens(new Set());
    setSelectedReps(new Set());
    setDispatchResult(null);
    setShowDispatchModal(true);
  };

  const toggleSelectBenDispatch = (id) => {
    setSelectedBens((prev) => {
      const copy = new Set(prev);
      copy.has(id) ? copy.delete(id) : copy.add(id);
      return copy;
    });
  };

  const toggleSelectRepDispatch = (id) => {
    setSelectedReps((prev) => {
      const copy = new Set(prev);
      copy.has(id) ? copy.delete(id) : copy.add(id);
      return copy;
    });
  };

  const handleSubmitHomeDeliveryDispatch = async () => {
    const count = recipientMode === "beneficiaries" ? selectedBens.size : selectedReps.size;
    if (!basketId || !scheduledAt || count === 0) return;
    setSubmittingDispatch(true);
    try {
      if (recipientMode === "representatives") {
        const promises = Array.from(selectedReps).map((repId) =>
          api.post(`/neighborhood-reps/${repId}/dispatch`, {
            basket_id: basketId,
            scheduled_date: scheduledAt,
            driver_id: selectedDriverId,
          })
        );
        const results = await Promise.all(promises);
        setDispatchResult({ type: "representatives", repDistributions: results.map((r) => r.data) });
      } else {
        const res = await distributionApi.create({
          beneficiary_ids: [...selectedBens],
          basket_id: basketId,
          scheduled_at: scheduledAt,
          driver_id: selectedDriverId,
          pickup_location: pickupLocation || "توصيل للمنزل عبر السائق",
        });
        setDispatchResult({ type: "beneficiaries", ...res.data });
      }
      setDispatchStep(5);
      loadAllData();
    } catch (err) {
      alert(err.response?.data?.message || "حدث خطأ أثناء إرسال وتوجيه الدعم.");
    } finally {
      setSubmittingDispatch(false);
    }
  };

  const selectedBasketObj = baskets.find((b) => String(b.id) === String(basketId));
  const selectedDriverObj = drivers.find((d) => String(d.id) === String(selectedDriverId));
  const selectedBensList = beneficiaries.filter((b) => selectedBens.has(b.id));
  const selectedRepsList = representatives.filter((r) => selectedReps.has(r.id));
  const activeDispatchCount = recipientMode === "beneficiaries" ? selectedBens.size : selectedReps.size;

  const sendSingleWhatsApp = (dist, recipient) => {
    const rawPhone = (recipient?.phone || "").replace(/[^0-9]/g, "");
    let phoneNum = rawPhone;
    if (phoneNum.startsWith("0")) phoneNum = "966" + phoneNum.slice(1);
    else if (!phoneNum.startsWith("966") && phoneNum.length === 9) phoneNum = "966" + phoneNum;
    if (!phoneNum) phoneNum = "966574917155";

    const name = recipient?.full_name || recipient?.name || "المستفيد";
    const natId = recipient?.national_id || "—";
    const date = scheduledAt || new Date().toISOString().split("T")[0];
    const loc = pickupLocation || "توصيل للمنزل عبر السائق";
    const code = dist.barcode_code || dist.qr_code || "IKRAM-SUPPORT";
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${code}`;

    const driverName = selectedDriverObj?.full_name || selectedDriverObj?.name || "سائق الجمعية المعتمد";
    const driverPhone = selectedDriverObj?.phone || "غير متوفر";
    const basketName = selectedBasketObj?.name || "سلة دعم مخصصة";

    const textMsg = `مرحباً ${name}،
جمعية إكرام ترحب بكم وتفيدكم بتأكيد موعد وتفاصيل التوصيل:
👤 *اسم المستفيد:* ${name}
🪪 *رقم الهوية:* ${natId}
📦 *سلة الدعم:* ${basketName}
🚚 *اسم السائق:* ${driverName}
📞 *رقم جوال السائق:* ${driverPhone}
📅 *تاريخ التسليم:* ${date}
📍 *موقع وتفاصيل العنوان:* ${loc}
🔑 *كود الاستلام والـ QR:* ${code}
📌 *رابط صورة الـ QR المباشرة:*
${qrUrl}`;

    window.open(`https://wa.me/${phoneNum}?text=${encodeURIComponent(textMsg)}`, "_blank");
  };

  return (
    <MainLayout>
      <div className="p-6 max-w-7xl mx-auto" dir="rtl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <span>🚚</span> إدارة التوصيل المنازل
            </h1>
            <p className="text-xs text-gray-500 mt-1">إدارة عمليات التوصيل المباشرة لكبار السن وذوي الاحتياجات الخاصة وتوزيعات مناديب الأحياء وتعيين السائقين</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Dedicated Home Delivery Support Dispatch Button */}
            <button
              onClick={openHomeDeliveryDispatchModal}
              className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold px-5 py-2.5 rounded-2xl text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>🚀 تقديم وتوجيه دعم التوصيل (كبار السن / ذوو الاحتياجات / المناديب)</span>
            </button>

            {/* Tab Buttons */}
            <div className="flex bg-gray-100 p-1.5 rounded-2xl border border-gray-200">
              <button
                onClick={() => setActiveTab("special_needs")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "special_needs"
                    ? "bg-amber-600 text-white shadow-md"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                ♿ توصيل المنازل (كبار السن وذوو الاحتياجات)
              </button>
              <button
                onClick={() => setActiveTab("representatives")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "representatives"
                    ? "bg-amber-600 text-white shadow-md"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                🏘️ توزيعات مناديب الأحياء
              </button>
            </div>
          </div>
        </div>

        {/* Global Search Input */}
        <div className="mb-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث عام بالاسم، رقم الهوية أو الإقامة، رقم الهاتف، الحي السكني..."
            className="w-full max-w-lg rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 text-right bg-white shadow-sm font-bold"
          />
        </div>

        {/* TAB 1: Beneficiary Home Delivery */}
        {activeTab === "special_needs" && (
          <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-base font-bold text-amber-900 flex items-center gap-2">
                <span>♿</span> قائمة توصيل المنازل (كبار السن وذوو الاحتياجات الخاصة)
              </h2>
              <span className="text-xs bg-amber-100 text-amber-800 px-3 py-1 rounded-full font-bold">
                عدد الحالات: {filteredBeneficiaries.length}
              </span>
            </div>

            <div className="overflow-x-auto border border-gray-200 rounded-2xl">
              <table className="w-full text-xs text-right">
                <thead className="bg-amber-50/80 text-amber-950 sticky top-0 border-b">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3 font-bold">اسم المستفيد كامل</th>
                    <th className="p-3 font-bold">رقم الهوية / الإقامة</th>
                    <th className="p-3 font-bold">رقم الهاتف</th>
                    <th className="p-3 font-bold">
                      <FilterableTableHeader
                        title="المدينة"
                        options={uniqueCities}
                        selectedValue={cityFilter}
                        onChange={setCityFilter}
                      />
                    </th>
                    <th className="p-3 font-bold">
                      <FilterableTableHeader
                        title="الحي السكني"
                        options={uniqueDistricts}
                        selectedValue={districtFilter}
                        onChange={setDistrictFilter}
                      />
                    </th>
                    <th className="p-3 font-bold">
                      <FilterableTableHeader
                        title="النوع"
                        options={[
                          { value: "citizen", label: "مواطن" },
                          { value: "resident", label: "مقيم" },
                        ]}
                        selectedValue={typeFilter}
                        onChange={setTypeFilter}
                      />
                    </th>
                    <th className="p-3 font-bold">
                      <FilterableTableHeader
                        title="التصنيف"
                        options={[
                          { value: "special_needs", label: "ذوو احتياجات خاصة" },
                          { value: "elderly", label: "كبار السن" },
                        ]}
                        selectedValue={categoryFilter}
                        onChange={setCategoryFilter}
                      />
                    </th>
                    <th className="p-3 font-bold">
                      <FilterableTableHeader
                        title="الحالة"
                        options={[
                          { value: "active", label: "نشط" },
                          { value: "suspended", label: "موقوف" },
                        ]}
                        selectedValue={statusFilter}
                        onChange={setStatusFilter}
                      />
                    </th>
                    <th className="p-3 font-bold text-center">عدد الاستلام</th>
                    <th className="p-3 font-bold text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={11} className="p-8 text-center text-gray-400">جاري التحميل...</td>
                    </tr>
                  )}

                  {!loading && filteredBeneficiaries.map((b, idx) => {
                    const statusVal = b.status || "active";
                    const isSuspended = statusVal === "suspended";

                    return (
                      <tr key={b.id || idx} className="border-b hover:bg-gray-50 transition-colors">
                        <td className="p-3 text-gray-400 font-mono">{idx + 1}</td>
                        <td className="p-3 font-extrabold text-gray-900">{b.full_name || b.name}</td>
                        <td className="p-3 font-mono font-bold text-gray-700">{b.national_id || "—"}</td>
                        <td className="p-3 font-mono text-gray-600" dir="ltr">{b.phone || "—"}</td>
                        <td className="p-3 font-bold text-gray-700">{b.city || "مكة المكرمة"}</td>
                        <td className="p-3 text-gray-700 font-bold">{b.district || "—"}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${(b.beneficiary_type || b.type) === "citizen" ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"}`}>
                            {(b.beneficiary_type || b.type) === "citizen" ? "مواطن" : "مقيم"}
                          </span>
                        </td>
                        <td className="p-3">
                          {b.has_special_needs || b.is_special_needs || b.priority === "special_needs" ? (
                            <span className="bg-purple-100/90 text-purple-900 border border-purple-200 px-2.5 py-1 rounded-xl text-xs font-bold inline-flex items-center gap-1.5" title="ذوو احتياجات خاصة">
                              <span>♿</span>
                              <span>ذوو احتياجات خاصة</span>
                            </span>
                          ) : (
                            <span className="bg-amber-100/90 text-amber-900 border border-amber-200 px-2.5 py-1 rounded-xl text-xs font-bold inline-flex items-center gap-1.5" title="كبار السن">
                              <span>👵</span>
                              <span>كبار السن</span>
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          {!isSuspended ? (
                            <span className="bg-emerald-100/90 text-emerald-900 border border-emerald-300 px-2.5 py-1 rounded-xl text-xs font-bold inline-flex items-center gap-1.5" title="حالة نشطة">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>نشط</span>
                            </span>
                          ) : (
                            <span className="bg-red-100/90 text-red-900 border border-red-300 px-2.5 py-1 rounded-xl text-xs font-bold inline-flex items-center gap-1.5" title="حالة موقوفة">
                              <XCircle className="w-3.5 h-3.5 text-red-600" />
                              <span>موقوف</span>
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => setScrimRecipient({ ...b, recipient_type: "beneficiary" })}
                            className="bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200 px-2.5 py-1 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 mx-auto transition-all cursor-pointer shadow-2xs"
                            title="سجل مرات الاستلام"
                          >
                            <Package className="w-3.5 h-3.5 text-amber-700" />
                            <span>{b.receipts_count || 0}</span>
                          </button>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setViewBeneficiary(b)}
                              className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 cursor-pointer"
                              title="عرض البيانات الشاملة والوثائق"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setEditBeneficiaryModal(b);
                                setEditBenForm({
                                  full_name: b.full_name || b.name || "",
                                  phone: b.phone || "",
                                  national_id: b.national_id || "",
                                  city: b.city || "مكة المكرمة",
                                  district: b.district || "",
                                  status: b.status || "active",
                                });
                              }}
                              className="p-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 cursor-pointer"
                              title="تعديل البيانات"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleToggleBeneficiaryStatus(b)}
                              className="p-1.5 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 cursor-pointer"
                              title="تعديل الحالة"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteBeneficiary(b)}
                              className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 cursor-pointer"
                              title="حذف نهائي"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: District Reps */}
        {activeTab === "representatives" && (
          <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-base font-bold text-amber-900 flex items-center gap-2">
                <span>🏘️</span> توزيعات وقائمة مناديب الأحياء
              </h2>
              <span className="text-xs bg-amber-100 text-amber-800 px-3 py-1 rounded-full font-bold">
                عدد المناديب: {filteredRepresentatives.length}
              </span>
            </div>

            <div className="overflow-x-auto border border-gray-200 rounded-2xl">
              <table className="w-full text-xs text-right">
                <thead className="bg-amber-50/80 text-amber-950 sticky top-0 border-b">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3 font-bold">اسم المندوب كامل</th>
                    <th className="p-3 font-bold">رقم الهوية / الإقامة</th>
                    <th className="p-3 font-bold">رقم الهاتف</th>
                    <th className="p-3 font-bold">
                      <FilterableTableHeader
                        title="المدينة"
                        options={uniqueCities}
                        selectedValue={cityFilter}
                        onChange={setCityFilter}
                      />
                    </th>
                    <th className="p-3 font-bold">
                      <FilterableTableHeader
                        title="الحي السكني"
                        options={uniqueDistricts}
                        selectedValue={districtFilter}
                        onChange={setDistrictFilter}
                      />
                    </th>
                    <th className="p-3 font-bold">النوع</th>
                    <th className="p-3 font-bold">
                      <FilterableTableHeader
                        title="الحالة"
                        options={[
                          { value: "active", label: "نشط" },
                          { value: "suspended", label: "موقوف" },
                        ]}
                        selectedValue={statusFilter}
                        onChange={setStatusFilter}
                      />
                    </th>
                    <th className="p-3 font-bold text-center">عدد الأسر</th>
                    <th className="p-3 font-bold text-center">عدد الاستلام</th>
                    <th className="p-3 font-bold text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={11} className="p-8 text-center text-gray-400">جاري التحميل...</td>
                    </tr>
                  )}

                  {!loading && filteredRepresentatives.map((r, idx) => {
                    const statusVal = r.status || "active";
                    const isSuspended = statusVal === "suspended";

                    return (
                      <tr key={r.id || idx} className="border-b hover:bg-gray-50 transition-colors">
                        <td className="p-3 text-gray-400 font-mono">{idx + 1}</td>
                        <td className="p-3 font-extrabold text-gray-900">{r.full_name}</td>
                        <td className="p-3 font-mono font-bold text-gray-700">{r.national_id || "—"}</td>
                        <td className="p-3 font-mono text-gray-600" dir="ltr">{r.phone}</td>
                        <td className="p-3 font-bold text-gray-700">{r.city || "مكة المكرمة"}</td>
                        <td className="p-3 text-gray-700 font-bold">{r.district_name}</td>
                        <td className="p-3">
                          <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-bold">مواطن</span>
                        </td>
                        <td className="p-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${!isSuspended ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                            {!isSuspended ? "نشط" : "موقوف"}
                          </span>
                        </td>
                        <td className="p-3 text-center font-bold text-amber-900">
                          <span className="bg-amber-100/80 text-amber-900 border border-amber-300 px-2.5 py-1 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 mx-auto w-fit" title="عدد الأسر التابعة">
                            <Users className="w-3.5 h-3.5 text-amber-700" />
                            <span>{r.beneficiaries_count || 0}</span>
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => setScrimRecipient({ ...r, recipient_type: "representative" })}
                            className="bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200 px-2.5 py-1 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 mx-auto transition-all cursor-pointer shadow-2xs"
                            title="سجل استلامات المندوب"
                          >
                            <Package className="w-3.5 h-3.5 text-amber-700" />
                            <span>{r.distributions_count || 0}</span>
                          </button>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setViewRep(r)}
                              className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 cursor-pointer"
                              title="عرض البيانات والوثائق الشاملة"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setEditRepModal(r);
                                setEditRepForm({
                                  full_name: r.full_name || "",
                                  phone: r.phone || "",
                                  national_id: r.national_id || "",
                                  city: r.city || "مكة المكرمة",
                                  district_name: r.district_name || "",
                                  beneficiaries_count: r.beneficiaries_count || 0,
                                  status: r.status || "active",
                                });
                              }}
                              className="p-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 cursor-pointer"
                              title="تعديل بيانات المندوب"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleToggleRepStatus(r)}
                              className="p-1.5 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 cursor-pointer"
                              title="تعديل الحالة"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteRep(r)}
                              className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 cursor-pointer"
                              title="حذف المندوب"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── Receipt Counter Modal ─── */}
        {scrimRecipient && (
          <ReceiptCounterModal
            recipient={scrimRecipient}
            recipientType={scrimRecipient.recipient_type || "beneficiary"}
            onClose={() => setScrimRecipient(null)}
          />
        )}

        {/* ─── Beneficiary Full Details & Documents Modal ─── */}
        {viewBeneficiary && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4" dir="rtl">
            <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto border border-amber-100">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-extrabold text-amber-900 text-base flex items-center gap-2">
                  <Eye className="w-5 h-5 text-amber-600" />
                  <span>البيانات الشاملة للمستفيد والوثائق المرفقة</span>
                </h3>
                <button onClick={() => setViewBeneficiary(null)} className="text-gray-500 hover:bg-gray-100 p-1 rounded-full cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200">
                  <span className="text-gray-500 font-bold">اسم المستفيد الكامل:</span>
                  <p className="font-extrabold text-gray-900 mt-1">{viewBeneficiary.full_name || viewBeneficiary.name}</p>
                </div>
                <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200">
                  <span className="text-gray-500 font-bold">رقم الهوية / الإقامة:</span>
                  <p className="font-mono font-bold text-gray-800 mt-1">{viewBeneficiary.national_id || "—"}</p>
                </div>
                <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200">
                  <span className="text-gray-500 font-bold">رقم الجوال:</span>
                  <p className="font-mono font-bold text-gray-800 mt-1">{viewBeneficiary.phone || "—"}</p>
                </div>
                <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200">
                  <span className="text-gray-500 font-bold">العنوان:</span>
                  <p className="font-bold text-gray-800 mt-1">{viewBeneficiary.city || "مكة"} - {viewBeneficiary.district || "—"}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── Rep Full Details & Documents Modal ─── */}
        {viewRep && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4" dir="rtl">
            <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto border border-amber-100">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-extrabold text-amber-900 text-base flex items-center gap-2">
                  <Eye className="w-5 h-5 text-amber-600" />
                  <span>البيانات الشاملة لمندوب الحي والوثائق المرفقة الأربعة</span>
                </h3>
                <button onClick={() => setViewRep(null)} className="text-gray-500 hover:bg-gray-100 p-1 rounded-full cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs mb-4">
                <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200">
                  <span className="text-gray-500 font-bold">اسم المندوب:</span>
                  <p className="font-extrabold text-gray-900 mt-1">{viewRep.full_name}</p>
                </div>
                <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200">
                  <span className="text-gray-500 font-bold">الحي والمدينة:</span>
                  <p className="font-bold text-gray-800 mt-1">{viewRep.city || "مكة"} - {viewRep.district_name}</p>
                </div>
              </div>

              {/* Rep 4 Documents Section */}
              <div className="border-t pt-3 space-y-2">
                <h4 className="font-extrabold text-xs text-amber-900">الوثائق الرسمية الاربعة المرفقة:</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-3 bg-gray-50 rounded-xl border flex justify-between items-center">
                    <span>🪪 صورة هوية المندوب</span>
                    {viewRep.id_document_image_url ? (
                      <a href={`${import.meta.env.VITE_API_BASE_URL || (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '') : 'https://ikram-system.onrender.com')}/storage/${viewRep.id_document_image_url}`} target="_blank" rel="noreferrer" className="text-amber-700 font-bold underline">عرض</a>
                    ) : <span className="text-gray-400">غير مرفق</span>}
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl border flex justify-between items-center">
                    <span>📜 خطاب اعتماد العمدة</span>
                    {viewRep.support_letter_url ? (
                      <a href={`${import.meta.env.VITE_API_BASE_URL || (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '') : 'https://ikram-system.onrender.com')}/storage/${viewRep.support_letter_url}`} target="_blank" rel="noreferrer" className="text-amber-700 font-bold underline">عرض</a>
                    ) : <span className="text-gray-400">غير مرفق</span>}
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl border flex justify-between items-center">
                    <span>📍 مستند العنوان الوطني</span>
                    {viewRep.national_address_doc_url ? (
                      <a href={`${import.meta.env.VITE_API_BASE_URL || (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '') : 'https://ikram-system.onrender.com')}/storage/${viewRep.national_address_doc_url}`} target="_blank" rel="noreferrer" className="text-amber-700 font-bold underline">عرض</a>
                    ) : <span className="text-gray-400">غير مرفق</span>}
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl border flex justify-between items-center">
                    <span>📦 هويات الأسر (ZIP)</span>
                    {viewRep.dependents_ids_zip_url ? (
                      <a href={`${import.meta.env.VITE_API_BASE_URL || (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '') : 'https://ikram-system.onrender.com')}/storage/${viewRep.dependents_ids_zip_url}`} target="_blank" rel="noreferrer" className="text-amber-700 font-bold underline">تنزيل</a>
                    ) : <span className="text-gray-400">غير مرفق</span>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── DEDICATED HOME DELIVERY SUPPORT DISPATCH MODAL (تقديم وتوجيه دعم التوصيل) ─── */}
        {showDispatchModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir="rtl">
            <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl overflow-hidden border border-amber-100 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center border-b pb-3 mb-4">
                <h3 className="font-extrabold text-amber-900 text-lg flex items-center gap-2">
                  <Send className="w-5 h-5 text-amber-600" />
                  <span>🚀 تقديم وتوجيه دعم التوصيل المباشر لكبار السن وذوي الاحتياجات والمناديب</span>
                </h3>
                <button onClick={() => setShowDispatchModal(false)} className="text-gray-500 hover:bg-gray-100 p-1 rounded-full cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Step Indicator */}
              {dispatchStep < 4 && (
                <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
                  {DISPATCH_STEPS.map((s, i) => (
                    <div key={i} className="flex items-center">
                      <div
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                          i === dispatchStep
                            ? "bg-amber-600 text-white shadow-md"
                            : i < dispatchStep
                            ? "bg-green-100 text-green-700 border border-green-200"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        <span>{i < dispatchStep ? "✓" : i + 1}</span>
                        {s}
                      </div>
                      {i < DISPATCH_STEPS.length - 1 && <div className="w-4 h-0.5 bg-gray-200 mx-1" />}
                    </div>
                  ))}
                </div>
              )}

              {/* STEP 0: Select Recipients */}
              {dispatchStep === 0 && (
                <div className="space-y-4 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-gray-700">اختر قائمة المستفيدين أو المناديب لتوجيه التوصيل:</span>
                    <div className="flex bg-gray-100 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setRecipientMode("beneficiaries")}
                        className={`px-3 py-1 rounded-lg font-bold cursor-pointer ${recipientMode === "beneficiaries" ? "bg-amber-600 text-white" : "text-gray-600"}`}
                      >
                        👵 كبار السن وذوو الاحتياجات ({beneficiaries.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setRecipientMode("representatives")}
                        className={`px-3 py-1 rounded-lg font-bold cursor-pointer ${recipientMode === "representatives" ? "bg-amber-600 text-white" : "text-gray-600"}`}
                      >
                        🏘️ مناديب الأحياء ({representatives.length})
                      </button>
                    </div>
                  </div>

                  <input
                    value={dispatchSearchQ}
                    onChange={(e) => setDispatchSearchQ(e.target.value)}
                    placeholder="بحث سريع بالاسم، الهوية، أو رقم الجوال..."
                    className="w-full rounded-xl border border-gray-300 p-2 text-xs font-bold"
                  />

                  {recipientMode === "beneficiaries" ? (
                    <div className="overflow-x-auto max-h-60 overflow-y-auto border border-gray-200 rounded-xl">
                      <table className="w-full text-xs text-right">
                        <thead className="bg-amber-50 text-amber-900 border-b sticky top-0">
                          <tr>
                            <th className="p-2 w-8">#</th>
                            <th className="p-2">اسم المستفيد</th>
                            <th className="p-2">رقم الجوال</th>
                            <th className="p-2">العنوان</th>
                            <th className="p-2">التصنيف</th>
                          </tr>
                        </thead>
                        <tbody>
                          {beneficiaries.filter(b => !dispatchSearchQ || (b.full_name || b.name || "").includes(dispatchSearchQ)).map((b) => (
                            <tr
                              key={b.id}
                              onClick={() => toggleSelectBenDispatch(b.id)}
                              className={`border-b cursor-pointer ${selectedBens.has(b.id) ? "bg-amber-50 font-bold" : "hover:bg-gray-50"}`}
                            >
                              <td className="p-2">
                                <input type="checkbox" checked={selectedBens.has(b.id)} readOnly className="rounded text-amber-600" />
                              </td>
                              <td className="p-2 font-bold">{b.full_name || b.name}</td>
                              <td className="p-2 font-mono">{b.phone}</td>
                              <td className="p-2">{b.city || "مكة"} - {b.district || "—"}</td>
                              <td className="p-2">{b.has_special_needs ? "ذوو احتياجات خاصة" : "كبار السن"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-60 overflow-y-auto border border-gray-200 rounded-xl">
                      <table className="w-full text-xs text-right">
                        <thead className="bg-amber-50 text-amber-900 border-b sticky top-0">
                          <tr>
                            <th className="p-2 w-8">#</th>
                            <th className="p-2">اسم المندوب</th>
                            <th className="p-2">رقم الجوال</th>
                            <th className="p-2">الحي السكني</th>
                            <th className="p-2 text-center">عدد الأسر</th>
                          </tr>
                        </thead>
                        <tbody>
                          {representatives.filter(r => !dispatchSearchQ || (r.full_name || "").includes(dispatchSearchQ)).map((r) => (
                            <tr
                              key={r.id}
                              onClick={() => toggleSelectRepDispatch(r.id)}
                              className={`border-b cursor-pointer ${selectedReps.has(r.id) ? "bg-amber-50 font-bold" : "hover:bg-gray-50"}`}
                            >
                              <td className="p-2">
                                <input type="checkbox" checked={selectedReps.has(r.id)} readOnly className="rounded text-amber-600" />
                              </td>
                              <td className="p-2 font-bold">{r.full_name}</td>
                              <td className="p-2 font-mono">{r.phone}</td>
                              <td className="p-2">{r.city || "مكة"} - {r.district_name}</td>
                              <td className="p-2 text-center font-bold text-amber-900">{r.beneficiaries_count || 0} أسرة</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div className="text-xs text-gray-500 font-bold">تم تحديد {activeDispatchCount} عنصر للتوصيل</div>
                </div>
              )}

              {/* STEP 1: Select Driver */}
              {dispatchStep === 1 && (
                <div className="space-y-4 text-xs">
                  <h4 className="font-bold text-gray-700">اختر السائق المعتمد لتوصيل هذه الشحنة:</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {drivers.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setSelectedDriverId(String(d.id))}
                        className={`p-4 rounded-2xl border-2 text-right transition-all cursor-pointer ${
                          String(selectedDriverId) === String(d.id) ? "border-amber-500 bg-amber-50 shadow-md font-bold" : "border-gray-200 bg-white"
                        }`}
                      >
                        <div className="font-bold text-sm text-gray-800">{d.full_name || d.name}</div>
                        <div className="text-gray-600 font-mono text-[11px] mt-1">📞 {d.phone || "—"}</div>
                        <div className="text-[10px] text-green-700 font-bold mt-2">🚚 سائق توصيل متاح</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* STEP 2: Select Basket */}
              {dispatchStep === 2 && (
                <div className="space-y-4 text-xs">
                  <h4 className="font-bold text-gray-700">اختر سلة الدعم من المستودع:</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {baskets.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setBasketId(String(b.id))}
                        className={`p-4 rounded-2xl border-2 text-right transition-all cursor-pointer ${
                          String(basketId) === String(b.id) ? "border-amber-500 bg-amber-50 shadow-md font-bold" : "border-gray-200 bg-white"
                        }`}
                      >
                        <div className="font-bold text-sm text-gray-800">{b.name}</div>
                        <div className="text-[11px] text-gray-500 mt-1">{b.description || "سلة دعم mخصصة للمنازل"}</div>
                        <div className="text-[11px] font-bold text-green-700 mt-2">المتوفّر: {b.current_quantity ?? b.stock_quantity ?? 0} وحدة</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* STEP 3: Date & Location */}
              {dispatchStep === 3 && (
                <div className="space-y-4 text-xs">
                  <h4 className="font-bold text-gray-700">الخطوة 4: تحديد موعد التوصيل وملاحظات التسليم:</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block font-bold mb-1">تاريخ التوصيل المجدول *</label>
                      <input type="date" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="w-full rounded-xl border p-2.5 font-bold" />
                    </div>
                    <div>
                      <label className="block font-bold mb-1">ملاحظات العنوان وتأكيد التسليم</label>
                      <input value={pickupLocation} onChange={(e) => setPickupLocation(e.target.value)} className="w-full rounded-xl border p-2.5 font-bold" placeholder="توصيل مباشر لمنزل المستفيد عبر السائق" />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4 (Index 4): Full Review & Submit Step (صفحة 5: مراجعة وإرسال) */}
              {dispatchStep === 4 && (
                <div className="space-y-4 text-xs">
                  <h4 className="font-extrabold text-amber-900 text-sm flex items-center gap-1.5 border-b pb-2">
                    <FileText className="w-4 h-4 text-amber-600" />
                    <span>الخطوة 5: مراجعة كامل بيانات الشحنة وتأكيد الإرسال</span>
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-center">
                    <div className="bg-amber-50/80 p-3.5 rounded-2xl border border-amber-200">
                      <div className="text-2xl font-extrabold text-amber-900">{activeDispatchCount}</div>
                      <div className="text-[11px] text-gray-600 font-bold mt-1">عدد المستفيدين / المناديب المحددين</div>
                    </div>

                    <div className="bg-amber-50/80 p-3.5 rounded-2xl border border-amber-200">
                      <div className="text-sm font-extrabold text-gray-800">{selectedDriverObj?.full_name || selectedDriverObj?.name || "سائق الجمعية المعتمد"}</div>
                      <div className="text-[11px] text-gray-600 font-mono mt-0.5">📞 {selectedDriverObj?.phone || "—"}</div>
                      <div className="text-[10px] text-amber-700 font-bold mt-1">🚚 السائق المكلف بالتوصيل</div>
                    </div>

                    <div className="bg-amber-50/80 p-3.5 rounded-2xl border border-amber-200">
                      <div className="text-sm font-extrabold text-amber-900">{selectedBasketObj?.name || "سلة دعم مخصصة"}</div>
                      <div className="text-[11px] text-gray-600 font-bold mt-0.5">📅 {scheduledAt}</div>
                      <div className="text-[10px] text-amber-700 font-bold mt-1">📦 السلة وموعد التسليم</div>
                    </div>
                  </div>

                  {/* Beneficiaries/Reps Review List */}
                  <div className="border border-amber-200 rounded-xl p-3 bg-gray-50/60 max-h-40 overflow-y-auto">
                    <div className="font-bold text-gray-700 mb-2">قائمة المستهدفين بالشحنة:</div>
                    <ul className="space-y-1">
                      {(recipientMode === "beneficiaries" ? selectedBensList : selectedRepsList).map((item, idx) => (
                        <li key={item.id || idx} className="bg-white p-2 rounded-lg border flex justify-between items-center text-[11px]">
                          <span className="font-bold text-gray-800">{idx + 1}. {item.full_name || item.name}</span>
                          <span className="font-mono text-gray-600">📱 {item.phone || "—"} | 📍 {item.city || "مكة"} - {item.district || item.district_name || "—"}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Wizard Navigation */}
              {dispatchStep < 5 && (
                <div className="flex justify-between items-center mt-6 pt-4 border-t">
                  <button
                    disabled={dispatchStep === 0}
                    onClick={() => setDispatchStep((s) => s - 1)}
                    className="px-5 py-2 rounded-xl bg-gray-200 text-gray-700 font-bold disabled:opacity-50 cursor-pointer"
                  >
                    السابق
                  </button>
                  {dispatchStep < 4 ? (
                    <button
                      disabled={(dispatchStep === 0 && activeDispatchCount === 0) || (dispatchStep === 1 && !selectedDriverId) || (dispatchStep === 2 && !basketId)}
                      onClick={() => setDispatchStep((s) => s + 1)}
                      className="px-6 py-2 rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-700 disabled:opacity-50 cursor-pointer"
                    >
                      التالي
                    </button>
                  ) : (
                    <button
                      disabled={submittingDispatch}
                      onClick={handleSubmitHomeDeliveryDispatch}
                      className="px-8 py-2.5 rounded-xl bg-green-600 text-white font-extrabold hover:bg-green-700 cursor-pointer shadow-md text-sm"
                    >
                      {submittingDispatch ? "جاري الإرسال وتوليد الـ QR..." : "🚀 تأكيد وإرسال التوصيل وتوليد الـ QR"}
                    </button>
                  )}
                </div>
              )}

              {/* STEP 5 (Index 5): Result Step with WhatsApp & QR after Submit */}
              {dispatchStep === 5 && dispatchResult && (
                <div className="space-y-4 text-xs">
                  <div className="text-center py-4 bg-green-50 rounded-2xl border border-green-200">
                    <div className="text-green-600 font-extrabold text-base">تم إرسال وتوجيه التوصيل بنجاح 🚀</div>
                    <p className="text-gray-600 text-xs mt-1">تمت الإحالة لحساب السائق ({selectedDriverObj?.full_name || selectedDriverObj?.name}) وتوليد أكواد الـ QR</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-y-auto">
                    {((dispatchResult.distributions || dispatchResult.repDistributions) || []).map((dist, idx) => {
                      const recipient = recipientMode === "beneficiaries"
                        ? selectedBensList.find((b) => b.id === dist.beneficiary_id) || { full_name: "مستفيد " + (idx + 1) }
                        : selectedRepsList.find((r) => r.id === dist.rep_id) || { full_name: "مندوب " + (idx + 1) };
                      const code = dist.barcode_code || dist.qr_code || "IKRAM-SUPPORT";

                      const name = recipient?.full_name || recipient?.name || "المستفيد/المندوب";
                      const natId = recipient?.national_id || "—";
                      const date = scheduledAt || new Date().toISOString().split("T")[0];
                      const loc = pickupLocation || "توصيل للمنزل عبر السائق";
                      const driverName = selectedDriverObj?.full_name || selectedDriverObj?.name || "سائق الجمعية المعتمد";
                      const driverPhone = selectedDriverObj?.phone || "غير متوفر";
                      const basketName = selectedBasketObj?.name || "سلة دعم مخصصة";

                      const textMsg = `مرحباً ${name}،
تسر جمعية إكرام الجود إفادتكم بتأكيد موعد وتفاصيل التوصيل:
👤 *الاسم:* ${name}
🪪 *رقم الهوية:* ${natId}
📦 *سلة الدعم:* ${basketName}
🚚 *السائق المكلف:* ${driverName}
📞 *جوال السائق:* ${driverPhone}
📅 *تاريخ التسليم:* ${date}
📍 *الموقع:* ${loc}
🔑 *رمز الاستلام والـ QR:* ${code}`;

                      return (
                        <QrWhatsAppCard
                          key={dist.id || idx}
                          text={code}
                          recipientName={name}
                          phone={recipient?.phone}
                          detailsMessage={textMsg}
                          title={`${name}`}
                        />
                      );
                    })}
                  </div>

                  <div className="text-center pt-3">
                    <button onClick={() => setShowDispatchModal(false)} className="px-6 py-2 rounded-xl bg-amber-800 text-white font-bold cursor-pointer">إغلاق النافذة</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
