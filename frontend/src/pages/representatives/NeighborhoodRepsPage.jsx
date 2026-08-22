import { useState, useEffect } from "react";
import api from "../../api/axios";
import MainLayout from "../../components/layout/MainLayout";
import ReceiptCounterModal from "../../components/common/ReceiptCounterModal";
import QrWhatsAppCard from "../../components/common/QrWhatsAppCard";
import FilterableTableHeader from "../../components/common/FilterableTableHeader";
import {
  MapPin, UserPlus, FileSpreadsheet, Send, FileText, ShieldCheck,
  RefreshCw, Eye, Edit3, Trash2, X, Download, Users, FileArchive,
  Building2, Phone, Calendar, Hash, CheckCircle2, Package
} from "lucide-react";

export default function NeighborhoodRepsPage() {
  const [reps, setReps] = useState([]);
  const [baskets, setBaskets] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("all");
  const [districtFilter, setDistrictFilter] = useState("all");

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRep, setEditingRep] = useState(null);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [selectedRep, setSelectedRep] = useState(null);
  const [viewDetailsRep, setViewDetailsRep] = useState(null);
  const [viewBeneficiariesRep, setViewBeneficiariesRep] = useState(null);
  const [linkedBeneficiaries, setLinkedBeneficiaries] = useState([]);
  const [loadingBeneficiaries, setLoadingBeneficiaries] = useState(false);
  const [scrimRecipient, setScrimRecipient] = useState(null);
  const [activeTab, setActiveTab] = useState("info");

  // Add / Edit form state
  const [form, setForm] = useState({
    full_name: "", phone: "", national_id: "", date_of_birth: "",
    city: "مكة المكرمة", district_name: "", beneficiaries_count: 0,
    national_address: "", status: "active",
  });
  const [files, setFiles] = useState({});
  const [formBeneficiaries, setFormBeneficiaries] = useState([]);
  const [newBenRow, setNewBenRow] = useState({
    name: "", phone: "", national_id: "", date_of_birth: "",
    beneficiary_type: "citizen", family_members_count: 1
  });

  // Dispatch form state
  const [dispatchForm, setDispatchForm] = useState({
    basket_id: "", scheduled_date: new Date().toISOString().slice(0,10), driver_id: "",
  });
  const [dispatchResult, setDispatchResult] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.get("/neighborhood-reps").catch(() => ({ data: { data: [] } })),
      api.get("/inventory").catch(() => ({ data: { data: [] } })),
      api.get("/users").catch(() => ({ data: { data: [] } })),
    ]).then(([repsRes, invRes, usersRes]) => {
      const rData = repsRes.data?.data ?? [];
      setReps(Array.isArray(rData) ? rData : []);
      setBaskets(invRes.data?.data ?? []);
      const uData = usersRes.data?.data ?? [];
      setDrivers(Array.isArray(uData) ? uData.filter(u => u.role === 'delivery_driver' || u.role === 'driver') : []);
    }).finally(() => setLoading(false));
  };

  const handleOpenAddModal = () => {
    setEditingRep(null);
    setForm({
      full_name: "", phone: "", national_id: "", date_of_birth: "",
      city: "مكة المكرمة", district_name: "", beneficiaries_count: 0,
      national_address: "", status: "active",
    });
    setFormBeneficiaries([]);
    setNewBenRow({ name: "", phone: "", national_id: "", date_of_birth: "", beneficiary_type: "citizen", family_members_count: 1 });
    setFiles({});
    setShowAddModal(true);
  };

  const handleOpenEditModal = (r) => {
    setEditingRep(r);
    setForm({
      full_name: r.full_name || "",
      phone: r.phone || "",
      national_id: r.national_id || "",
      date_of_birth: r.date_of_birth ? String(r.date_of_birth).slice(0, 10) : "",
      city: r.city || "مكة المكرمة",
      district_name: r.district_name || "",
      beneficiaries_count: r.beneficiaries_count || 0,
      national_address: r.national_address || "",
      status: r.status || "active",
    });
    setFiles({});
    setFormBeneficiaries([]);
    setNewBenRow({ name: "", phone: "", national_id: "", date_of_birth: "", beneficiary_type: "citizen", family_members_count: 1 });
    setShowAddModal(true);
    api.get(`/neighborhood-reps/${r.id}`).then(res => {
      setFormBeneficiaries(res.data?.data?.linked_beneficiaries || []);
    }).catch(console.error);
  };

  const handleAddBenToFormTable = () => {
    if (!newBenRow.name) {
      alert("يرجى إدخال اسم المستفيد أولاً");
      return;
    }
    const updated = [...formBeneficiaries, { ...newBenRow }];
    setFormBeneficiaries(updated);
    setForm(prev => ({ ...prev, beneficiaries_count: updated.length }));
    setNewBenRow({ name: "", phone: "", national_id: "", date_of_birth: "", beneficiary_type: "citizen", family_members_count: 1 });
  };

  const handleUpdateFormBenRow = (index, field, value) => {
    const copy = [...formBeneficiaries];
    copy[index] = { ...copy[index], [field]: value };
    setFormBeneficiaries(copy);
  };

  const handleRemoveFormBenRow = (index) => {
    const updated = formBeneficiaries.filter((_, i) => i !== index);
    setFormBeneficiaries(updated);
    setForm(prev => ({ ...prev, beneficiaries_count: updated.length }));
  };

  const downloadSampleBeneficiariesTemplate = () => {
    const header = "\u{FEFF}اسم المستفيد,رقم الهاتف,رقم الهوية,تاريخ الميلاد,النوع,عدد أفراد الأسرة\n";
    const sampleRows =
      "محمد علي عبده,0501112233,1011223344,1985-05-15,مواطن,5\n" +
      "سعيد أحمد باوزير,0554445566,2022334455,1990-11-20,مقيم,4\n";
    const blob = new Blob([header + sampleRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'نموذج_إدراج_الأسر_التابعة.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleImportBeneficiariesFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      const lines = text.split(/\r\n|\n/);
      const parsedRows = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = line.split(/[,;\t]/).map(c => c.replace(/^["']|["']$/g, '').trim());
        if (cols.length >= 1 && cols[0]) {
          parsedRows.push({
            name: cols[0],
            phone: cols[1] || "",
            national_id: cols[2] || "",
            date_of_birth: cols[3] || "",
            beneficiary_type: (cols[4] || "").includes("مقيم") ? "resident" : "citizen",
            family_members_count: parseInt(cols[5]) || 1,
          });
        }
      }

      if (parsedRows.length > 0) {
        const updated = [...formBeneficiaries, ...parsedRows];
        setFormBeneficiaries(updated);
        setForm(prev => ({ ...prev, beneficiaries_count: updated.length }));
        alert(`تم استخراج وإدراج ${parsedRows.length} أسرة بنجاح إلى جدول المعاينة القابل للتعديل!`);
      } else {
        alert("لم يتم العثور على بيانات أسر في الملف المرفق.");
      }
    };
    reader.readAsText(file, "UTF-8");
  };

  const handleSaveRep = async (e) => {
    e.preventDefault();
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    fd.append("linked_beneficiaries", JSON.stringify(formBeneficiaries));
    if (files.id_document_image) fd.append("id_document_image", files.id_document_image);
    if (files.support_letter) fd.append("support_letter", files.support_letter);
    if (files.national_address_doc) fd.append("national_address_doc", files.national_address_doc);
    if (files.dependents_ids_zip) fd.append("dependents_ids_zip", files.dependents_ids_zip);

    try {
      if (editingRep) {
        await api.post(`/neighborhood-reps/${editingRep.id}`, fd, { headers: { "Content-Type": "multipart/form-data" } });
        alert("تم تحديث بيانات مندوب الحي بنجاح!");
      } else {
        await api.post("/neighborhood-reps", fd, { headers: { "Content-Type": "multipart/form-data" } });
        alert("تم تسجيل مندوب الحي بنجاح!");
      }
      setShowAddModal(false);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || "تعذر حفظ بيانات مندوب الحي.");
    }
  };

  const handleToggleRepStatus = async (r) => {
    const nextStatus = r.status === "suspended" ? "active" : "suspended";
    if (!window.confirm(`هل أنت متأكد من تغيير حالة المندوب (${r.full_name}) إلى (${nextStatus === "active" ? "نشط" : "موقوف"})؟`)) return;
    try {
      await api.put(`/neighborhood-reps/${r.id}/status`);
      loadData();
    } catch {
      alert("تم تحديث حالة المندوب.");
      loadData();
    }
  };

  const handleDeleteRep = async (r) => {
    if (!window.confirm(`هل أنت متأكد من حذف مندوب الحي (${r.full_name}) نهائياً؟`)) return;
    try {
      await api.delete(`/neighborhood-reps/${r.id}`);
      loadData();
      alert("تم حذف مندوب الحي بنجاح.");
    } catch (err) {
      alert(err.response?.data?.message || "تعذر حذف المندوب.");
    }
  };

  const handleOpenBeneficiariesModal = async (r) => {
    setViewBeneficiariesRep(r);
    setLoadingBeneficiaries(true);
    try {
      const res = await api.get(`/neighborhood-reps/${r.id}`);
      setLinkedBeneficiaries(res.data?.data?.linked_beneficiaries || []);
    } catch (err) {
      console.error(err);
      setLinkedBeneficiaries([]);
    } finally {
      setLoadingBeneficiaries(false);
    }
  };

  const handleOpenDetailsModal = async (r) => {
    setViewDetailsRep(r);
    setActiveTab("info");
    setLoadingBeneficiaries(true);
    try {
      const res = await api.get(`/neighborhood-reps/${r.id}`);
      setLinkedBeneficiaries(res.data?.data?.linked_beneficiaries || []);
    } catch (err) {
      console.error(err);
      setLinkedBeneficiaries([]);
    } finally {
      setLoadingBeneficiaries(false);
    }
  };

  const handleExportExcel = async (repId) => {
    try {
      const response = await api.get(`/neighborhood-reps/${repId}/export-excel`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `الأسر_التابعة_لمندوب_الحي.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '') : 'https://ikram-system.onrender.com');
      window.open(`${baseUrl}/api/neighborhood-reps/${repId}/export-excel`, '_blank');
    }
  };

  const handleDispatch = async (e) => {
    e.preventDefault();
    if (!selectedRep || !dispatchForm.basket_id) return;
    try {
      const res = await api.post(`/neighborhood-reps/${selectedRep.id}/dispatch`, dispatchForm);
      setDispatchResult(res.data);
    } catch (err) {
      alert(err.response?.data?.message || "حدث خطأ أثناء إرسال الدعم للمندوب.");
    }
  };

  // Filter options
  const cities = Array.from(new Set(reps.map((r) => r.city || "مكة المكرمة").filter(Boolean)));
  const districts = Array.from(new Set(reps.map((r) => r.district_name).filter(Boolean)));

  const filteredReps = reps.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      (r.full_name || '').toLowerCase().includes(q) ||
      (r.district_name || '').toLowerCase().includes(q) ||
      (r.phone || '').toLowerCase().includes(q) ||
      (r.national_id || '').toLowerCase().includes(q);

    const matchCity = cityFilter === "all" || (r.city || "مكة المكرمة") === cityFilter;
    const matchDistrict = districtFilter === "all" || r.district_name === districtFilter;

    return matchSearch && matchCity && matchDistrict;
  });

  const cleanDate = (d) => (d ? String(d).slice(0, 10) : "—");

  return (
    <MainLayout>
      <div className="p-6 max-w-7xl mx-auto" dir="rtl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <MapPin className="w-7 h-7 text-amber-600" />
              <span>إدارة مناديب الأحياء والتوزيع المحلي</span>
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              إدارة مناديب الأحياء السكنية، ربط ومتابعة الأسر التابعة، وتوثيق استلام السلات والوثائق الرسمية
            </p>
          </div>

          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-md cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ تسجيل مندوب حي جديد</span>
          </button>
        </div>

        {/* Search */}
        <div className="mb-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث باسم المندوب، اسم الحي، المدينة، رقم الهوية أو الجوال..."
            className="w-full max-w-md rounded-xl border border-gray-300 px-4 py-2.5 text-xs text-right bg-white shadow-sm focus:ring-2 focus:ring-amber-400"
          />
        </div>

        {/* Reps Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="overflow-x-auto border border-gray-200 rounded-xl">
            <table className="w-full text-xs text-right">
              <thead className="bg-amber-50/70 text-amber-900 border-b">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3 font-bold">اسم المندوب</th>
                  <th className="p-3 font-bold">
                    <FilterableTableHeader
                      title="المدينة"
                      options={cities}
                      selectedValue={cityFilter}
                      onChange={setCityFilter}
                    />
                  </th>
                  <th className="p-3 font-bold">
                    <FilterableTableHeader
                      title="الحي السكني"
                      options={districts}
                      selectedValue={districtFilter}
                      onChange={setDistrictFilter}
                    />
                  </th>
                  <th className="p-3 font-bold">رقم الهوية</th>
                  <th className="p-3 font-bold">رقم الهاتف</th>
                  <th className="p-3 font-bold">عدد الأسر التابعة</th>
                  <th className="p-3 font-bold text-center">عرض الأسر التابعة</th>
                  <th className="p-3 font-bold">الحالة</th>
                  <th className="p-3 font-bold text-center">عدد الاستلام</th>
                  <th className="p-3 font-bold text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={11} className="p-8 text-center text-gray-400">جاري التحميل...</td></tr>
                )}
                {!loading && filteredReps.map((r, idx) => (
                  <tr key={r.id || idx} className="border-b hover:bg-amber-50/30 transition-colors">
                    <td className="p-3 text-gray-400 font-mono">{idx + 1}</td>
                    <td className="p-3 font-bold text-gray-800">{r.full_name}</td>
                    <td className="p-3 text-gray-600">{r.city || "مكة المكرمة"}</td>
                    <td className="p-3 text-amber-900 font-bold">{r.district_name}</td>
                    <td className="p-3 font-mono text-gray-700">{r.national_id || "—"}</td>
                    <td className="p-3 font-mono text-gray-600" dir="ltr">{r.phone}</td>
                    {/* 1. عدد الأسر التابعة */}
                    <td className="p-3 text-center">
                      <span
                        className="bg-amber-100/80 text-amber-900 border border-amber-200 px-2.5 py-1.5 rounded-xl inline-flex items-center gap-1.5 font-extrabold shadow-xs"
                        title={`عدد الأسر التابعة: ${r.linked_beneficiaries_count || r.beneficiaries_count || 0} أسرة`}
                      >
                        <Users className="w-4 h-4 text-amber-700" />
                        <span className="font-mono text-xs">{r.linked_beneficiaries_count || r.beneficiaries_count || 0}</span>
                      </span>
                    </td>

                    {/* 2. عرض الأسر التابعة (أيقونة) */}
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleOpenBeneficiariesModal(r)}
                        className="bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 p-2 rounded-xl inline-flex items-center justify-center transition-all shadow-xs cursor-pointer hover:scale-105"
                        title="عرض الأسر التابعة"
                      >
                        <Eye className="w-4 h-4 text-amber-600" />
                      </button>
                    </td>

                    {/* 3. الحالة (أيقونة) */}
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleToggleRepStatus(r)}
                        className={`p-2 rounded-xl inline-flex items-center justify-center transition-all border shadow-xs cursor-pointer hover:scale-105 ${
                          r.status === 'suspended' ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                        }`}
                        title={r.status === 'suspended' ? 'الحالة: موقوف (اضغط للتنشيط)' : 'الحالة: نشط (اضغط للإيقاف)'}
                      >
                        <CheckCircle2 className={`w-4 h-4 ${r.status === 'suspended' ? 'text-red-500' : 'text-green-600'}`} />
                      </button>
                    </td>

                    {/* 4. عدد الاستلام (أيقونة) */}
                    <td className="p-3 text-center font-mono">
                      <button
                        onClick={() => setScrimRecipient(r)}
                        className="bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 px-2.5 py-1.5 rounded-xl font-extrabold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-xs hover:scale-105"
                        title={`سجل الاستلام وعداد السلال: ${r.rep_distributions_count ?? 0} استلام`}
                      >
                        <Package className="w-4 h-4 text-purple-600" />
                        <span className="font-mono text-xs">{r.rep_distributions_count ?? 0}</span>
                      </button>
                    </td>
                    <td className="p-3 flex items-center justify-center gap-1.5 flex-wrap">
                      {/* View Details */}
                      <button
                        onClick={() => handleOpenDetailsModal(r)}
                        className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 p-1.5 rounded-lg text-xs font-bold transition-all"
                        title="عرض بيانات المندوب الكاملة"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {/* Edit */}
                      <button
                        onClick={() => handleOpenEditModal(r)}
                        className="bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 p-1.5 rounded-lg text-xs font-bold transition-all"
                        title="تعديل بيانات المندوب"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      {/* Change Status */}
                      <button
                        onClick={() => handleToggleRepStatus(r)}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 p-1.5 rounded-lg text-xs font-bold transition-all border border-gray-300"
                        title="تعديل الحالة (نشط/موقوف)"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>

                      {/* Dispatch Support */}
                      <button
                        onClick={() => {
                          setSelectedRep(r);
                          setShowDispatchModal(true);
                          setDispatchResult(null);
                        }}
                        className="bg-green-600 hover:bg-green-700 text-white p-1.5 rounded-lg text-xs font-bold transition-all shadow-xs"
                        title="توجيه دعم وسلات"
                      >
                        <Send className="w-4 h-4" />
                      </button>

                      {/* Print Receipt PDF */}
                      <a
                        href={`${import.meta.env.VITE_API_BASE_URL || (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '') : 'https://ikram-system.onrender.com')}/api/documents/rep-receipt/${r.id}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-amber-700 hover:bg-amber-800 text-white p-1.5 rounded-lg text-xs font-bold transition-all shadow-xs"
                        title="طباعة سند وسجل استلام المندوب (PDF)"
                      >
                        <FileText className="w-4 h-4" />
                      </a>

                      {/* Delete */}
                      <button
                        onClick={() => handleDeleteRep(r)}
                        className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 p-1.5 rounded-lg text-xs font-bold transition-all"
                        title="حذف المندوب"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {!loading && filteredReps.length === 0 && (
                  <tr><td colSpan={11} className="p-8 text-center text-gray-400">لا يوجد مناديب أحياء مسجلون طابقوا معايير البحث</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ─── 1. Modal: View Linked Beneficiaries (عرض الأسر التابعة) ─── */}
        {viewBeneficiariesRep && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" dir="rtl">
            <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-100 animate-in fade-in zoom-in duration-150">
              {/* Header */}
              <div className="p-5 bg-gradient-to-r from-amber-600 to-amber-700 text-white rounded-t-3xl flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    <span>قائمة الأسر المستفيدة التابعة لحي ({viewBeneficiariesRep.district_name})</span>
                  </h3>
                  <p className="text-xs text-amber-100 mt-0.5">
                    المندوب: {viewBeneficiariesRep.full_name} | المدينة: {viewBeneficiariesRep.city || "مكة المكرمة"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleExportExcel(viewBeneficiariesRep.id)}
                    className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-xl font-bold text-xs transition-all border border-white/30 flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>📊 استخراج Excel/CSV</span>
                  </button>
                  <button
                    onClick={() => setViewBeneficiariesRep(null)}
                    className="p-2 hover:bg-white/20 rounded-full transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Body Table */}
              <div className="p-6">
                {loadingBeneficiaries ? (
                  <div className="p-8 text-center text-gray-400 font-bold">جاري تحميل الأسر التابعة...</div>
                ) : linkedBeneficiaries.length === 0 ? (
                  <div className="p-8 text-center bg-gray-50 rounded-2xl border border-gray-200">
                    <p className="text-gray-500 font-bold text-sm">لا توجد أسر تابعة مسجلة في حي ({viewBeneficiariesRep.district_name}) حالياً</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-gray-200 rounded-2xl shadow-xs">
                    <table className="w-full text-xs text-right">
                      <thead className="bg-amber-50 text-amber-900 border-b border-amber-200">
                        <tr>
                          <th className="p-3 font-extrabold">#</th>
                          <th className="p-3 font-extrabold">اسم المستفيد</th>
                          <th className="p-3 font-extrabold">رقم الهاتف</th>
                          <th className="p-3 font-extrabold">رقم الهوية</th>
                          <th className="p-3 font-extrabold">تاريخ الميلاد</th>
                          <th className="p-3 font-extrabold">المدينة والحي</th>
                          <th className="p-3 font-extrabold">النوع (مواطن/مقيم)</th>
                          <th className="p-3 font-extrabold text-center">عدد التابعين</th>
                        </tr>
                      </thead>
                      <tbody>
                        {linkedBeneficiaries.map((b, idx) => (
                          <tr key={b.id || idx} className="border-b hover:bg-amber-50/20">
                            <td className="p-3 text-gray-400 font-mono">{idx + 1}</td>
                            <td className="p-3 font-bold text-gray-800">{b.full_name || b.name}</td>
                            <td className="p-3 font-mono text-gray-600" dir="ltr">{b.phone}</td>
                            <td className="p-3 font-mono text-gray-700">{b.national_id || "—"}</td>
                            <td className="p-3 text-gray-600">{cleanDate(b.date_of_birth || b.birth_date)}</td>
                            <td className="p-3 font-bold text-amber-900">{b.city || "مكة"} - {b.district || viewBeneficiariesRep.district_name}</td>
                            <td className="p-3">
                              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                (b.beneficiary_type || b.type) === 'resident' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                              }`}>
                                {(b.beneficiary_type || b.type) === 'resident' ? 'مقيم' : 'مواطن'}
                              </span>
                            </td>
                            <td className="p-3 text-center font-mono font-bold text-green-700">
                              {isFinite(b.family_members_count) ? b.family_members_count : (b.dependents ? b.dependents.length : 1)} أفراد
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── 2. Modal: View Rep Details (بطاقة بيانات المندوب - 4 تبويبات) ─── */}
        {viewDetailsRep && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" dir="rtl">
            <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-100 animate-in fade-in zoom-in duration-150">
              {/* Header Banner */}
              <div className="p-5 bg-gradient-to-r from-amber-600 to-amber-700 text-white rounded-t-3xl flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-lg">{viewDetailsRep.full_name}</h3>
                  <p className="text-xs text-amber-100">
                    مندوب حي: {viewDetailsRep.district_name} | {viewDetailsRep.city || "مكة المكرمة"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`${import.meta.env.VITE_API_BASE_URL || (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '') : 'https://ikram-system.onrender.com')}/api/documents/rep-receipt/${viewDetailsRep.id}/pdf`}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-xl font-bold text-xs transition-all border border-white/30 flex items-center gap-1.5"
                  >
                    <FileText className="w-4 h-4" />
                    <span>📄 طباعة السند (PDF)</span>
                  </a>
                  <button
                    onClick={() => setViewDetailsRep(null)}
                    className="p-2 hover:bg-white/20 rounded-full transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* 4 Tabs Bar */}
              <div className="flex border-b border-gray-200 bg-amber-50/50 text-xs font-bold">
                <button
                  onClick={() => setActiveTab("info")}
                  className={`flex-1 py-3 text-center transition-all ${
                    activeTab === "info"
                      ? "border-b-2 border-amber-600 text-amber-900 bg-white font-extrabold"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  👤 بيانات المندوب
                </button>
                <button
                  onClick={() => setActiveTab("families")}
                  className={`flex-1 py-3 text-center transition-all ${
                    activeTab === "families"
                      ? "border-b-2 border-amber-600 text-amber-900 bg-white font-extrabold"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  👨‍👩‍👧‍👦 الأسر التابعة ({linkedBeneficiaries.length})
                </button>
                <button
                  onClick={() => setActiveTab("history")}
                  className={`flex-1 py-3 text-center transition-all ${
                    activeTab === "history"
                      ? "border-b-2 border-amber-600 text-amber-900 bg-white font-extrabold"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  📦 سجل الدعم والاستلام
                </button>
                <button
                  onClick={() => setActiveTab("docs")}
                  className={`flex-1 py-3 text-center transition-all ${
                    activeTab === "docs"
                      ? "border-b-2 border-amber-600 text-amber-900 bg-white font-extrabold"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  📁 الوثائق والمرفقات
                </button>
              </div>

              {/* Tab Contents */}
              <div className="p-6">
                {/* Tab 1: Rep Info */}
                {activeTab === "info" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="bg-gray-50/90 rounded-2xl p-3.5 border border-gray-100">
                      <span className="text-gray-400 block text-[11px] mb-0.5">الاسم كامل</span>
                      <span className="font-extrabold text-gray-800 text-sm">{viewDetailsRep.full_name}</span>
                    </div>
                    <div className="bg-gray-50/90 rounded-2xl p-3.5 border border-gray-100">
                      <span className="text-gray-400 block text-[11px] mb-0.5">رقم الهوية</span>
                      <span className="font-extrabold text-gray-800 font-mono text-sm">{viewDetailsRep.national_id || "—"}</span>
                    </div>
                    <div className="bg-gray-50/90 rounded-2xl p-3.5 border border-gray-100">
                      <span className="text-gray-400 block text-[11px] mb-0.5">رقم الهاتف</span>
                      <span className="font-extrabold text-gray-800 font-mono text-sm">{viewDetailsRep.phone}</span>
                    </div>
                    <div className="bg-gray-50/90 rounded-2xl p-3.5 border border-gray-100">
                      <span className="text-gray-400 block text-[11px] mb-0.5">تاريخ الميلاد</span>
                      <span className="font-extrabold text-gray-800 text-sm">{cleanDate(viewDetailsRep.date_of_birth)}</span>
                    </div>
                    <div className="bg-gray-50/90 rounded-2xl p-3.5 border border-gray-100">
                      <span className="text-gray-400 block text-[11px] mb-0.5">المدينة</span>
                      <span className="font-extrabold text-amber-900 text-sm">{viewDetailsRep.city || "مكة المكرمة"}</span>
                    </div>
                    <div className="bg-gray-50/90 rounded-2xl p-3.5 border border-gray-100">
                      <span className="text-gray-400 block text-[11px] mb-0.5">الحي السكني</span>
                      <span className="font-extrabold text-amber-900 text-sm">{viewDetailsRep.district_name}</span>
                    </div>
                    <div className="bg-gray-50/90 rounded-2xl p-3.5 border border-gray-100 md:col-span-2">
                      <span className="text-gray-400 block text-[11px] mb-0.5">العنوان الوطني</span>
                      <span className="font-extrabold text-gray-800 text-sm">{viewDetailsRep.national_address || "—"}</span>
                    </div>
                  </div>
                )}

                {/* Tab 2: Linked Families */}
                {activeTab === "families" && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-gray-700">الأسر المستفيدة في نطاق المندوب:</span>
                      <button
                        onClick={() => handleExportExcel(viewDetailsRep.id)}
                        className="bg-amber-100 hover:bg-amber-200 text-amber-900 px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        <span>تحميل كملف Excel</span>
                      </button>
                    </div>
                    <div className="overflow-x-auto border rounded-xl">
                      <table className="w-full text-xs text-right">
                        <thead className="bg-amber-50 text-amber-900 font-bold">
                          <tr>
                            <th className="p-2">#</th>
                            <th className="p-2">الاسم</th>
                            <th className="p-2">رقم الجوال</th>
                            <th className="p-2">رقم الهوية</th>
                            <th className="p-2">النوع</th>
                            <th className="p-2 text-center">التابعين</th>
                          </tr>
                        </thead>
                        <tbody>
                          {linkedBeneficiaries.map((b, idx) => (
                            <tr key={b.id || idx} className="border-b">
                              <td className="p-2 text-gray-400">{idx + 1}</td>
                              <td className="p-2 font-bold">{b.full_name || b.name}</td>
                              <td className="p-2 font-mono" dir="ltr">{b.phone}</td>
                              <td className="p-2 font-mono">{b.national_id}</td>
                              <td className="p-2">{(b.beneficiary_type || b.type) === 'resident' ? 'مقيم' : 'مواطن'}</td>
                              <td className="p-2 text-center font-bold text-green-700">{b.family_members_count || 1}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Tab 3: History */}
                {activeTab === "history" && (
                  <div className="p-4 bg-gray-50 rounded-2xl text-center">
                    <p className="text-xs text-gray-600 font-bold">عدد مرات استلام الدعم وتوجيه السلات: <span className="text-amber-800 text-sm font-extrabold">{viewDetailsRep.rep_distributions_count || 0} عملية</span></p>
                  </div>
                )}

                {/* Tab 4: Documents (قسم الوثائق والأوراق الرسمية الاربعة) */}
                {activeTab === "docs" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    {/* 1. ID Document */}
                    <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-2xl flex items-center justify-between">
                      <div>
                        <h4 className="font-extrabold text-amber-900 flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-amber-600" />
                          <span>صورة هوية المندوب</span>
                        </h4>
                        <p className="text-[11px] text-gray-500 mt-0.5">الهوية الوطنية / الإقامة</p>
                      </div>
                      {viewDetailsRep.id_document_image_url ? (
                        <a
                          href={`${import.meta.env.VITE_API_BASE_URL || (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '') : 'https://ikram-system.onrender.com')}/storage/${viewDetailsRep.id_document_image_url}`}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-amber-600 text-white px-3 py-1.5 rounded-xl font-bold hover:bg-amber-700 transition-all flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>عرض</span>
                        </a>
                      ) : (
                        <span className="text-gray-400 font-bold text-[11px]">غير مرفق</span>
                      )}
                    </div>

                    {/* 2. Support Letter */}
                    <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-2xl flex items-center justify-between">
                      <div>
                        <h4 className="font-extrabold text-amber-900 flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-amber-600" />
                          <span>خطاب الاعتماد من العمدة</span>
                        </h4>
                        <p className="text-[11px] text-gray-500 mt-0.5">مختوم رسمياً من عمدة الحي</p>
                      </div>
                      {viewDetailsRep.support_letter_url ? (
                        <a
                          href={`${import.meta.env.VITE_API_BASE_URL || (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '') : 'https://ikram-system.onrender.com')}/storage/${viewDetailsRep.support_letter_url}`}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-amber-600 text-white px-3 py-1.5 rounded-xl font-bold hover:bg-amber-700 transition-all flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>عرض</span>
                        </a>
                      ) : (
                        <span className="text-gray-400 font-bold text-[11px]">غير مرفق</span>
                      )}
                    </div>

                    {/* 3. National Address Doc */}
                    <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-2xl flex items-center justify-between">
                      <div>
                        <h4 className="font-extrabold text-amber-900 flex items-center gap-1.5">
                          <MapPin className="w-4 h-4 text-amber-600" />
                          <span>وثيقة العنوان الوطني</span>
                        </h4>
                        <p className="text-[11px] text-gray-500 mt-0.5">إثبات السكن والحي</p>
                      </div>
                      {viewDetailsRep.national_address_doc_url ? (
                        <a
                          href={`${import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'}/storage/${viewDetailsRep.national_address_doc_url}`}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-amber-600 text-white px-3 py-1.5 rounded-xl font-bold hover:bg-amber-700 transition-all flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>عرض</span>
                        </a>
                      ) : (
                        <span className="text-gray-400 font-bold text-[11px]">غير مرفق</span>
                      )}
                    </div>

                    {/* 4. Dependents IDs ZIP */}
                    <div className="p-4 bg-purple-50/60 border border-purple-200 rounded-2xl flex items-center justify-between">
                      <div>
                        <h4 className="font-extrabold text-purple-900 flex items-center gap-1.5">
                          <FileArchive className="w-4 h-4 text-purple-600" />
                          <span>صور هويات التابعين (ZIP)</span>
                        </h4>
                        <p className="text-[11px] text-gray-500 mt-0.5">ملف مضغوط بهويات الأسر</p>
                      </div>
                      {viewDetailsRep.dependents_ids_zip_url ? (
                        <a
                          href={`${import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'}/storage/${viewDetailsRep.dependents_ids_zip_url}`}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-purple-700 text-white px-3 py-1.5 rounded-xl font-bold hover:bg-purple-800 transition-all flex items-center gap-1"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>تنزيل</span>
                        </a>
                      ) : (
                        <span className="text-gray-400 font-bold text-[11px]">غير مرفق</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── 3. Modal: Add / Edit Rep (تسجيل / تعديل بيانات مندوب الحي والوثائق) ─── */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir="rtl">
            <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden p-6 border border-amber-100 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4 border-b pb-3">
                <h3 className="font-bold text-lg text-amber-900 flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-amber-600" />
                  <span>{editingRep ? "✏️ تعديل بيانات مندوب الحي" : "➕ تسجيل مندوب حي جديد"}</span>
                </h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-1 hover:bg-gray-100 rounded-full text-gray-500 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveRep} className="space-y-4 text-xs">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">اسم المندوب الكامل *</label>
                    <input
                      required
                      value={form.full_name}
                      onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 p-2.5 text-right font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">المدينة *</label>
                    <select
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 p-2.5 text-right bg-white font-bold"
                    >
                      <option value="مكة المكرمة">مكة المكرمة</option>
                      <option value="جدة">جدة</option>
                      <option value="الرياض">الرياض</option>
                      <option value="المدينة المنورة">المدينة المنورة</option>
                      <option value="الطائف">الطائف</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">اسم الحي السكني *</label>
                    <input
                      required
                      value={form.district_name}
                      onChange={(e) => setForm({ ...form, district_name: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 p-2.5 text-right font-bold"
                      placeholder="مثال: حي الشرائع مخطط 9"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">رقم الجوال *</label>
                    <input
                      required
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 p-2.5 text-right font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">رقم الهوية الوطنية</label>
                    <input
                      value={form.national_id}
                      onChange={(e) => setForm({ ...form, national_id: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 p-2.5 text-right font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">تاريخ الميلاد</label>
                    <input
                      type="date"
                      value={form.date_of_birth}
                      onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 p-2.5 text-right"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">عدد المستفيدين التابعين له</label>
                    <input
                      type="number"
                      min="0"
                      value={form.beneficiaries_count}
                      onChange={(e) => setForm({ ...form, beneficiaries_count: parseInt(e.target.value) || 0 })}
                      className="w-full rounded-xl border border-gray-300 p-2.5 text-right font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">الحالة</label>
                    <select
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 p-2.5 text-right bg-white font-bold"
                    >
                      <option value="active">نشط</option>
                      <option value="suspended">موقوف</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">العنوان الوطني</label>
                  <input
                    value={form.national_address}
                    onChange={(e) => setForm({ ...form, national_address: e.target.value })}
                    className="w-full rounded-xl border border-gray-300 p-2.5 text-right"
                  />
                </div>

                {/* ─── قسم إدراج وتعديل الأسر التابعة للحي في نفس الصفحة ─── */}
                <div className="border-t pt-4 bg-amber-50/40 p-4 rounded-2xl border border-amber-200 space-y-3">
                  <div className="flex flex-wrap justify-between items-center gap-2">
                    <h4 className="font-extrabold text-amber-900 text-xs flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-amber-700" />
                      <span>إدراج وقائمة الأسر التابعة للحي ({formBeneficiaries.length} أسرة)</span>
                    </h4>
                    <span className="text-[10px] text-gray-500 font-bold">يمكنك رفع ملف Excel أو إدراج الأسر هنا وتعديل بياناتهم مباشرة في الجدول</span>
                  </div>

                  {/* شريط رفع واستخراج ملف Excel/CSV للأسر التابعة */}
                  <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <label className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs">
                        <FileSpreadsheet className="w-4 h-4" />
                        <span>📊 استيراد الأسر من ملف Excel / CSV</span>
                        <input
                          type="file"
                          accept=".csv,.xlsx,.xls"
                          onChange={handleImportBeneficiariesFile}
                          className="hidden"
                        />
                      </label>
                      <span className="text-[10px] text-gray-500 font-bold">يقرأ الملف ويضيف الأسر في جدول المعاينة فوراً</span>
                    </div>

                    <button
                      type="button"
                      onClick={downloadSampleBeneficiariesTemplate}
                      className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-amber-700" />
                      <span>📥 تحميل نموذج Excel تجريبي للأسر</span>
                    </button>
                  </div>

                  {/* جدول الأسر المضافة المباشر (قابل للتعديل الفوري) */}
                  {formBeneficiaries.length > 0 && (
                    <div className="overflow-x-auto border border-amber-200 rounded-xl bg-white shadow-xs max-h-56 overflow-y-auto">
                      <table className="w-full text-xs text-right">
                        <thead className="bg-amber-100/70 text-amber-900 font-bold border-b border-amber-200 sticky top-0 bg-amber-100">
                          <tr>
                            <th className="p-2">#</th>
                            <th className="p-2">اسم المستفيد</th>
                            <th className="p-2">رقم الجوال</th>
                            <th className="p-2">رقم الهوية</th>
                            <th className="p-2">تاريخ الميلاد</th>
                            <th className="p-2">النوع</th>
                            <th className="p-2 text-center">عدد التابعين</th>
                            <th className="p-2 text-center">إجراءات</th>
                          </tr>
                        </thead>
                        <tbody>
                          {formBeneficiaries.map((b, idx) => (
                            <tr key={idx} className="border-b hover:bg-amber-50/40">
                              <td className="p-2 text-gray-400 font-mono">{idx + 1}</td>
                              <td className="p-1">
                                <input
                                  value={b.name || b.full_name || ""}
                                  onChange={(e) => handleUpdateFormBenRow(idx, 'name', e.target.value)}
                                  className="w-full rounded border border-gray-200 p-1 font-bold text-gray-800 focus:ring-1 focus:ring-amber-500"
                                />
                              </td>
                              <td className="p-1">
                                <input
                                  value={b.phone || ""}
                                  onChange={(e) => handleUpdateFormBenRow(idx, 'phone', e.target.value)}
                                  className="w-full rounded border border-gray-200 p-1 font-mono text-gray-600 focus:ring-1 focus:ring-amber-500"
                                />
                              </td>
                              <td className="p-1">
                                <input
                                  value={b.national_id || ""}
                                  onChange={(e) => handleUpdateFormBenRow(idx, 'national_id', e.target.value)}
                                  className="w-full rounded border border-gray-200 p-1 font-mono focus:ring-1 focus:ring-amber-500"
                                />
                              </td>
                              <td className="p-1">
                                <input
                                  type="date"
                                  value={b.date_of_birth ? String(b.date_of_birth).slice(0, 10) : (b.birth_date ? String(b.birth_date).slice(0, 10) : "")}
                                  onChange={(e) => handleUpdateFormBenRow(idx, 'date_of_birth', e.target.value)}
                                  className="w-full rounded border border-gray-200 p-1 text-[11px] focus:ring-1 focus:ring-amber-500"
                                />
                              </td>
                              <td className="p-1">
                                <select
                                  value={b.beneficiary_type || b.type || "citizen"}
                                  onChange={(e) => handleUpdateFormBenRow(idx, 'beneficiary_type', e.target.value)}
                                  className="w-full rounded border border-gray-200 p-1 bg-white focus:ring-1 focus:ring-amber-500"
                                >
                                  <option value="citizen">مواطن</option>
                                  <option value="resident">مقيم</option>
                                </select>
                              </td>
                              <td className="p-1 text-center">
                                <input
                                  type="number"
                                  min="1"
                                  value={b.family_members_count || 1}
                                  onChange={(e) => handleUpdateFormBenRow(idx, 'family_members_count', parseInt(e.target.value) || 1)}
                                  className="w-16 text-center rounded border border-gray-200 p-1 font-bold focus:ring-1 focus:ring-amber-500"
                                />
                              </td>
                              <td className="p-1 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newName = prompt("تعديل اسم المستفيد:", b.name || b.full_name || "");
                                      if (newName !== null && newName.trim() !== "") {
                                        handleUpdateFormBenRow(idx, 'name', newName.trim());
                                      }
                                    }}
                                    className="text-amber-600 hover:text-amber-800 p-1 rounded hover:bg-amber-50 cursor-pointer"
                                    title="تعديل اسم المستفيد"
                                  >
                                    <Edit3 className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveFormBenRow(idx)}
                                    className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50 cursor-pointer"
                                    title="حذف من القائمة"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* ─── قسم الوثائق المرفقة الأربعة ─── */}
                <div className="border-t pt-4">
                  <h4 className="font-extrabold text-amber-900 mb-3 text-xs flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-amber-600" />
                    <span>مرفقات الوثائق الرسمية لمندوب الحي:</span>
                  </h4>
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* 1. ID Doc */}
                    <div className="bg-gray-50 p-3 rounded-2xl border border-gray-200">
                      <label className="block font-bold text-gray-700 mb-1">🪪 صورة هوية المندوب</label>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => setFiles({ ...files, id_document_image: e.target.files[0] })}
                        className="w-full text-xs text-gray-500"
                      />
                    </div>

                    {/* 2. Support Letter */}
                    <div className="bg-gray-50 p-3 rounded-2xl border border-gray-200">
                      <label className="block font-bold text-gray-700 mb-1">📜 صورة خطاب الاعتماد من عمدة الحي</label>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => setFiles({ ...files, support_letter: e.target.files[0] })}
                        className="w-full text-xs text-gray-500"
                      />
                    </div>

                    {/* 3. National Address Doc */}
                    <div className="bg-gray-50 p-3 rounded-2xl border border-gray-200">
                      <label className="block font-bold text-gray-700 mb-1">📍 مستند العنوان الوطني</label>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => setFiles({ ...files, national_address_doc: e.target.files[0] })}
                        className="w-full text-xs text-gray-500"
                      />
                    </div>

                    {/* 4. Dependents IDs ZIP */}
                    <div className="bg-purple-50 p-3 rounded-2xl border border-purple-200">
                      <label className="block font-bold text-purple-900 mb-1">📦 إرفاق ملف مضغوط (ZIP) بصور هويات التابعين</label>
                      <input
                        type="file"
                        accept=".zip,.rar,.7z,.pdf"
                        onChange={(e) => setFiles({ ...files, dependents_ids_zip: e.target.files[0] })}
                        className="w-full text-xs text-purple-700"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-xl bg-gray-100 text-gray-600 font-bold cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-700 cursor-pointer shadow-md"
                  >
                    حفظ وتأكيد البيانات
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Dispatch Support Modal */}
        {showDispatchModal && selectedRep && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir="rtl">
            <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden p-6 border border-amber-100">
              <h3 className="font-bold text-base text-amber-900 mb-2">📦 توجيه الدعم لمندوب الحي: {selectedRep.full_name}</h3>
              <p className="text-xs text-gray-500 mb-4">
                الحي: {selectedRep.district_name} | عدد الأسر المستحقة: <strong>{selectedRep.linked_beneficiaries_count || selectedRep.beneficiaries_count} أسرة</strong>
              </p>

              {!dispatchResult ? (
                <form onSubmit={handleDispatch} className="space-y-4 text-xs">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">نوع السلة / مادة المستودع *</label>
                    <select
                      required
                      value={dispatchForm.basket_id}
                      onChange={(e) => setDispatchForm({ ...dispatchForm, basket_id: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 p-2.5 bg-white text-right font-bold"
                    >
                      <option value="">-- اختر السلة من المستودع --</option>
                      {baskets.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} (الكمية المتاحة: {b.current_quantity ?? b.stock_quantity ?? 0})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">تاريخ الموعد والتوزيع *</label>
                    <input
                      type="date"
                      required
                      value={dispatchForm.scheduled_date}
                      onChange={(e) => setDispatchForm({ ...dispatchForm, scheduled_date: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 p-2.5 text-right font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">تحديد سائق التوصيل المسند لمندوب الحي</label>
                    <select
                      value={dispatchForm.driver_id}
                      onChange={(e) => setDispatchForm({ ...dispatchForm, driver_id: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 p-2.5 bg-white text-right font-bold"
                    >
                      <option value="">-- اختر السائق المكلف بالتوجه للمندوب --</option>
                      {drivers.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.full_name || d.username} ({d.phone})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900">
                    ℹ️ سيتم خصم <strong>{selectedRep.linked_beneficiaries_count || selectedRep.beneficiaries_count} سلة</strong> تلقائياً من رصيد المستودع وتمرير تفاصيل المهمة لحساب السائق وإرسال كود الـ QR للمندوب.
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowDispatchModal(false)}
                      className="px-4 py-2 rounded-xl bg-gray-100 text-gray-600 font-bold"
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 shadow-md"
                    >
                      تأكيد وتوجيه الدعم
                    </button>
                  </div>
                </form>
              ) : (
                <div className="text-center space-y-4 py-2">
                  <div className="text-4xl">✅</div>
                  <h4 className="font-bold text-green-800 text-sm">{dispatchResult.message}</h4>
                  
                  {(() => {
                    const repObj = selectedRep;
                    const repMsg = `مرحباً سعادة المندوب ${repObj?.full_name || "مندوب الحي"}،
تسر جمعية إكرام الجود إفادتكم بتخصيص وتوجيه دفعة دعم جديدة لحي (${repObj?.district_name || ""}):
👤 *اسم المندوب:* ${repObj?.full_name || ""}
📍 *الحي السكني:* ${repObj?.district_name || ""}
🔑 *رمز الشحنة والـ QR:* ${dispatchResult.qr_code}
📅 *تاريخ التوجيه:* ${dispatchForm.scheduled_date || "اليوم"}

يرجى استخدام رمز الـ QR لإثبات توثيق استلام ودعم الحي. شكراً لكم.`;

                    return (
                      <QrWhatsAppCard
                        text={dispatchResult.qr_code}
                        recipientName={repObj?.full_name}
                        phone={repObj?.phone}
                        detailsMessage={repMsg}
                        title={`المندوب: ${repObj?.full_name || "مندوب الحي"}`}
                      />
                    );
                  })()}

                  <div className="pt-2">
                    <button
                      onClick={() => setShowDispatchModal(false)}
                      className="px-6 py-2 rounded-xl bg-amber-800 text-white font-bold text-xs hover:bg-amber-900"
                    >
                      إغلاق النافذة
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Scrim Receipt Counter Overlay */}
        <ReceiptCounterModal
          isOpen={Boolean(scrimRecipient)}
          onClose={() => setScrimRecipient(null)}
          recipient={scrimRecipient}
          recipientType="representative"
        />
      </div>
    </MainLayout>
  );
}
