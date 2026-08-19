import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";
import staffApi from "../../api/staffApi";
import distributionApi from "../../api/distributions";
import api from "../../api/axios";
import MainLayout from "../../components/layout/MainLayout";
import FilterableTableHeader from "../../components/common/FilterableTableHeader";
import Dialog from "../../components/overlays/Dialog";
import ConfirmDialog from "../../components/overlays/ConfirmDialog";
import Toast from "../../components/ui/Toast";
import { Eye, Edit, Trash2, RefreshCw, X, FileText, Users, Home, Briefcase, Package, Send, QrCode, UserPlus, FileSpreadsheet, Upload, Download, CheckCircle2, XCircle, Plus } from "lucide-react";

const statusLabels = {
  active: { label: "نشط", class: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  on_leave: { label: "إجازة", class: "bg-amber-100 text-amber-800 border-amber-300" },
  terminated: { label: "منتهي الخدمة", class: "bg-red-100 text-red-800 border-red-300" },
};

const DISPATCH_STEPS = ["اختيار الموظفين", "اختيار سلة الدعم", "تحديد الموعد", "مراجعة وإرسال"];
const RELATIONSHIP_OPTIONS = ["ابن", "بنت", "زوجة", "أم", "أب", "أخ", "أخت", "جد", "جدة", "حفيد", "أخرى"];

const initialAddForm = {
  name: "",
  national_id: "",
  phone: "",
  email: "",
  birth_date: "",
  national_address: "",
  job_title: "موظف مالي",
  department: "المالية",
  hire_date: new Date().toISOString().split("T")[0],
  salary: "",
  status: "active",
  family_members_count: 1,
  wives_count: 0,
  father_status: "alive",
  mother_status: "alive",
  owns_house: false,
};

export default function StaffListPage() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);

  // Column Filters & Search
  const [searchQ, setSearchQ] = useState("");
  const [jobTitleFilter, setJobTitleFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modals state
  const [selectedStaff, setSelectedStaff] = useState(null); // For 4-tab View Modal
  const [activeTab, setActiveTab] = useState("info");
  const [staffToDelete, setStaffToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Status Change Modal
  const [editingStatusStaff, setEditingStatusStaff] = useState(null);
  const [newStatus, setNewStatus] = useState("active");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // ─── Full Multi-Tab Add Staff Modal State ───
  const [showAddModal, setShowAddModal] = useState(false);
  const [addTab, setAddTab] = useState("personal"); // personal, job, family, dependents
  const [addForm, setAddForm] = useState(initialAddForm);
  const [dependents, setDependents] = useState([]);
  const [submittingAdd, setSubmittingAdd] = useState(false);

  // ─── Excel Import Staff Modal State ───
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [parsedRows, setParsedRows] = useState([]);
  const [previewRows, setPreviewRows] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importErrorMsg, setImportErrorMsg] = useState(null);

  // Toast feedback state
  const [toast, setToast] = useState({ isOpen: false, type: "success", message: "" });

  // ─── Staff Support Dispatch Modal State ───
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [dispatchStep, setDispatchStep] = useState(0);
  const [selectedStaffIds, setSelectedStaffIds] = useState(new Set());
  const [baskets, setBaskets] = useState([]);
  const [basketId, setBasketId] = useState("");
  const [scheduledAt, setScheduledAt] = useState(new Date().toISOString().split("T")[0]);
  const [pickupLocation, setPickupLocation] = useState("مقر جمعية إكرام الرئيسي (قسم الموظفين)");
  const [submittingDispatch, setSubmittingDispatch] = useState(false);
  const [dispatchResult, setDispatchResult] = useState(null);
  const [dispatchSearchQ, setDispatchSearchQ] = useState("");

  const triggerToast = (message, type = "success") => {
    setToast({ isOpen: true, message, type });
  };

  const loadData = () => {
    setLoading(true);
    Promise.all([
      staffApi.list(),
      api.get("/inventory").catch(() => ({ data: { data: [] } })),
    ])
      .then(([res, invRes]) => {
        const data = res.data?.data?.data ?? res.data?.data ?? res.data ?? [];
        setStaff(Array.isArray(data) ? data : []);

        const invList = invRes.data?.data ?? [];
        setBaskets(Array.isArray(invList) ? invList : []);
        if (invList.length > 0 && !basketId) setBasketId(String(invList[0].id));
      })
      .catch((err) => {
        console.error(err);
        setStaff([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(loadData, []);

  const openAddStaffModal = () => {
    setAddForm(initialAddForm);
    setDependents([]);
    setAddTab("personal");
    setShowAddModal(true);
  };

  const addDependentRow = () => {
    setDependents((prev) => [...prev, { name: "", relationship: "ابن", date_of_birth: "" }]);
  };

  const removeDependentRow = (idx) => {
    setDependents((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateDependentField = (idx, field, value) => {
    setDependents((prev) => prev.map((dep, i) => (i === idx ? { ...dep, [field]: value } : dep)));
  };

  const handleSaveStaff = async (e) => {
    e.preventDefault();
    if (!addForm.name || !addForm.national_id || !addForm.phone) {
      triggerToast("يرجى إدخال البيانات الأساسية المطلوبة (الاسم، الهوية، الجوال)", "warning");
      setAddTab("personal");
      return;
    }

    setSubmittingAdd(true);
    try {
      await staffApi.create({ ...addForm, dependents });
      triggerToast(`تم حفظ بيانات الموظف (${addForm.name}) بنجاح!`, "success");
      setShowAddModal(false);
      setAddForm(initialAddForm);
      setDependents([]);
      loadData();
    } catch (err) {
      triggerToast(err.response?.data?.message || "تعذر إضافة الموظف. يرجى التثبت من المدخلات.", "error");
    } finally {
      setSubmittingAdd(false);
    }
  };

  // ─── Excel Staff File Handlers ───
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setImportFile(selectedFile);
    setImportResult(null);
    setImportErrorMsg(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonRows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        if (jsonRows.length === 0) {
          setImportErrorMsg("⚠️ الملف المرفوع لا يحتوي على بيانات أو أن السطر الأول فارغ.");
          setParsedRows([]);
          setPreviewRows([]);
        } else {
          setParsedRows(jsonRows);
          setPreviewRows(jsonRows.slice(0, 10));
        }
      } catch (err) {
        console.error("SheetJS parse error:", err);
        setImportErrorMsg("⚠️ تعذر قراءة محتوى الملف. يرجى التأكد من أن الملف صيغة Excel (.xlsx, .xls) أو CSV سليم.");
      }
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  const handleSubmitImport = async (e) => {
    e.preventDefault();
    if (!importFile) return;

    setImporting(true);
    setImportResult(null);

    const formData = new FormData();
    formData.append("file", importFile);
    if (parsedRows.length > 0) {
      formData.append("rows_json", JSON.stringify(parsedRows));
    }

    try {
      const res = await staffApi.importExcel(formData);
      setImportResult(res.data);
      triggerToast("تم معالجة واستيراد ملف الموظفين بنجاح!", "success");
      loadData();
    } catch (err) {
      setImportResult({
        success: false,
        message: err.response?.data?.message || "حدث خطأ أثناء معالجة واستيراد الملف.",
        errors: err.response?.data?.errors ? Object.values(err.response.data.errors).flat() : [],
      });
      triggerToast("تعذر استيراد الملف.", "error");
    } finally {
      setImporting(false);
    }
  };

  const downloadSampleTemplate = () => {
    const csvContent =
      "\uFEFF" +
      "اسم الموظف,رقم الهوية,رقم الهاتف,المسمى الوظيفي,القسم,تاريخ التعيين,الراتب,البريد الإلكتروني,العنوان الوطني\n" +
      "عبد الله محمد علي,1012345678,0501234567,محاسب مالية,المالية,2024-01-15,6500,abdullah@example.com,مكة المكرمة - حي العزيزية\n" +
      "سارة أحمد عمر,1023456789,0507654321,مدير مشاريع,المشاريع,2023-05-10,9000,sara@example.com,مكة المكرمة - حي النعيم\n";

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "نموذج_استيراد_الموظفين.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleConfirmDelete = async () => {
    if (!staffToDelete) return;
    setDeleteLoading(true);
    try {
      await staffApi.remove(staffToDelete.id);
      triggerToast(`تم حذف بيانات الموظف (${staffToDelete.name}) بنجاح.`, "success");
      setStaffToDelete(null);
      loadData();
    } catch {
      triggerToast("تعذر حذف الموظف.", "error");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!editingStatusStaff) return;
    setUpdatingStatus(true);
    try {
      await staffApi.update(editingStatusStaff.id, {
        ...editingStatusStaff,
        status: newStatus,
      });
      triggerToast(`تم تحديث حالة الموظف (${editingStatusStaff.name}) بنجاح.`, "success");
      setEditingStatusStaff(null);
      loadData();
    } catch {
      triggerToast("تعذر تحديث حالة الموظف.", "error");
    } finally {
      setUpdatingStatus(false);
    }
  };

  // ─── Staff Dispatch Handlers ───
  const openStaffDispatchModal = () => {
    setDispatchStep(0);
    setSelectedStaffIds(new Set());
    setDispatchResult(null);
    setShowDispatchModal(true);
  };

  const toggleSelectStaff = (id) => {
    setSelectedStaffIds((prev) => {
      const copy = new Set(prev);
      copy.has(id) ? copy.delete(id) : copy.add(id);
      return copy;
    });
  };

  const handleSubmitStaffDispatch = async () => {
    if (!basketId || !scheduledAt || selectedStaffIds.size === 0) return;
    setSubmittingDispatch(true);
    try {
      const res = await distributionApi.create({
        staff_ids: [...selectedStaffIds],
        basket_id: basketId,
        scheduled_at: scheduledAt,
        pickup_location: pickupLocation || "مقر جمعية إكرام الرئيسي (قسم الموظفين)",
      });
      setDispatchResult(res.data);
      setDispatchStep(4);
      triggerToast("تم توجيه وإرسال سلال الدعم للموظفين بنجاح! 🚀", "success");
      loadData();
    } catch (err) {
      triggerToast(err.response?.data?.message || "حدث خطأ أثناء إرسال الدعم للموظفين.", "error");
    } finally {
      setSubmittingDispatch(false);
    }
  };

  const selectedBasketObj = baskets.find((b) => String(b.id) === String(basketId));
  const selectedStaffList = staff.filter((s) => selectedStaffIds.has(s.id));

  const sendStaffWhatsAppMsg = (dist, sObj) => {
    const rawPhone = (sObj?.phone || "").replace(/[^0-9]/g, "");
    let phoneNum = rawPhone;
    if (phoneNum.startsWith("0")) phoneNum = "966" + phoneNum.slice(1);
    else if (!phoneNum.startsWith("966") && phoneNum.length === 9) phoneNum = "966" + phoneNum;
    if (!phoneNum) phoneNum = "966574917155";

    const name = sObj?.name || "الموظف الكريم";
    const natId = sObj?.national_id || "—";
    const date = scheduledAt || new Date().toISOString().split("T")[0];
    const loc = pickupLocation || "مقر جمعية إكرام الرئيسي (قسم الموظفين)";
    const code = dist.barcode_code || dist.qr_code || "IKRAM-STAFF-SUPPORT";
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${code}`;
    const basketName = selectedBasketObj?.name || "سلة دعم موظف مخصصة";

    const textMsg = `مرحباً الزميل/ة ${name}،
تسر إدارة الجمعية إفادتكم بصدور وتأكيد استحقاقكم لسلة الدعم المخصصة للموظفين:
👤 *اسم الموظف:* ${name}
🪪 *رقم الهوية:* ${natId}
📦 *سلة الدعم:* ${basketName}
📅 *موعد الاستلام:* ${date}
📍 *موقع الاستلام:* ${loc}
🔑 *كود الاستلام والـ QR:* ${code}
📌 *رابط صورة الـ QR المباشرة:*
${qrUrl}`;

    window.open(`https://wa.me/${phoneNum}?text=${encodeURIComponent(textMsg)}`, "_blank");
  };

  const jobTitles = Array.from(new Set(staff.map((s) => s.job_title).filter(Boolean)));
  const departments = Array.from(new Set(staff.map((s) => s.department).filter(Boolean)));

  const filteredStaff = staff.filter((s) => {
    const q = searchQ.toLowerCase();
    const matchQ =
      !q ||
      (s.name || "").toLowerCase().includes(q) ||
      (s.national_id || "").includes(q) ||
      (s.phone || "").includes(q) ||
      (s.job_title || "").toLowerCase().includes(q);

    const matchJob = jobTitleFilter === "all" || s.job_title === jobTitleFilter;
    const matchDept = departmentFilter === "all" || s.department === departmentFilter;
    const matchStatus = statusFilter === "all" || s.status === statusFilter;

    return matchQ && matchJob && matchDept && matchStatus;
  });

  return (
    <MainLayout>
      <div className="p-6 max-w-7xl mx-auto" dir="rtl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Briefcase className="w-7 h-7 text-amber-600" />
              <span>إدارة وقوائم موظفي الجمعية</span>
            </h1>
            <p className="text-xs text-gray-500 mt-1">عرض وإضافة الموظفين بكافة البيانات، استيراد القوائم بملف Excel وتوجيه سلال الدعم المخصصة</p>
          </div>

          <div className="flex gap-2 flex-wrap text-xs font-bold">
            <button
              onClick={openStaffDispatchModal}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>🚀 تقديم الدعم للموظفين</span>
            </button>

            <button
              onClick={openAddStaffModal}
              className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ إضافة موظف جديد (بيانات كاملة)</span>
            </button>

            <button
              onClick={() => setShowImportModal(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>📊 استيراد موظفين (Excel)</span>
            </button>
          </div>
        </div>

        {/* Global Search Bar */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="🔍 بحث باسم الموظف، رقم الهوية، رقم الجوال، أو المسمى الوظيفي..."
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            className="w-full max-w-md p-2.5 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 bg-white font-bold"
          />
        </div>

        {/* Main Staff Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-amber-50/80 text-amber-950 font-bold border-b border-amber-200">
              <tr>
                <th className="p-3">#</th>
                <th className="p-3 font-bold">اسم الموظف</th>
                <th className="p-3 font-bold">رقم الهوية</th>
                <th className="p-3 font-bold">رقم الجوال</th>

                <th className="p-3">
                  <FilterableTableHeader
                    title="المسمى الوظيفي"
                    options={jobTitles}
                    selectedValue={jobTitleFilter}
                    onChange={setJobTitleFilter}
                  />
                </th>

                <th className="p-3">
                  <FilterableTableHeader
                    title="القسم"
                    options={departments}
                    selectedValue={departmentFilter}
                    onChange={setDepartmentFilter}
                  />
                </th>

                <th className="p-3 font-bold">تاريخ التعيين</th>

                <th className="p-3">
                  <FilterableTableHeader
                    title="الحالة"
                    options={[
                      { value: "active", label: "نشط" },
                      { value: "on_leave", label: "إجازة" },
                      { value: "terminated", label: "منتهي الخدمة" },
                    ]}
                    selectedValue={statusFilter}
                    onChange={setStatusFilter}
                  />
                </th>

                <th className="p-3 font-bold text-center font-mono">الراتب</th>
                <th className="p-3 font-bold text-center">إجراءات الموظف</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-gray-400">
                    <div className="inline-block w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mb-1" />
                    <p>جاري تحميل قائمة الموظفين...</p>
                  </td>
                </tr>
              )}
              {!loading && filteredStaff.map((s, idx) => {
                const st = statusLabels[s.status] || { label: s.status, class: "bg-gray-100 text-gray-600" };
                return (
                  <tr key={s.id || idx} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="p-3 text-gray-400 font-mono">{idx + 1}</td>
                    <td className="p-3 font-bold text-gray-800">{s.name}</td>
                    <td className="p-3 font-mono font-semibold text-gray-700">{s.national_id}</td>
                    <td className="p-3 font-mono text-gray-600">{s.phone}</td>
                    <td className="p-3 font-bold text-amber-900">{s.job_title || "—"}</td>
                    <td className="p-3">{s.department || "—"}</td>
                    <td className="p-3 font-mono text-gray-600">{s.hire_date || "—"}</td>
                    <td className="p-3">
                      <span className={`px-2.5 py-1 rounded-xl text-xs font-bold border ${st.class}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-center font-bold text-green-700">{s.salary ? `${s.salary} ر.س` : "—"}</td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => { setSelectedStaff(s); setActiveTab("info"); }}
                          className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl border border-blue-200 cursor-pointer transition-all"
                          title="عرض ملف الموظف والتابعين والوثائق"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <Link
                          to={`/staff/${s.id}/edit`}
                          className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl border border-amber-200 cursor-pointer transition-all"
                          title="تعديل بيانات الموظف"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => { setEditingStatusStaff(s); setNewStatus(s.status || "active"); }}
                          className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl border border-emerald-200 cursor-pointer transition-all"
                          title="تحديث الحالة الوظيفية"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setStaffToDelete({ id: s.id, name: s.name })}
                          className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl border border-red-200 cursor-pointer transition-all"
                          title="حذف الموظف"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && filteredStaff.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-gray-400">
                    لا توجد نتائج مطابقة لخيار البحث والفلترة المحدد
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ─── FULL MULTI-TAB ADD STAFF DIALOG ─── */}
        <Dialog
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          title="➕ تسجيل موظف جديد بالجمعية (كافة البيانات الرسمية)"
          subtitle="إدخال البيانات الشخصية والمهنية، البيانات المالية، والتابعين"
          icon={UserPlus}
          maxWidth="max-w-4xl"
          footer={
            <>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-5 py-2.5 rounded-xl bg-gray-200 text-gray-700 font-bold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveStaff}
                disabled={submittingAdd}
                className="px-7 py-2.5 rounded-xl bg-amber-600 text-white font-extrabold hover:bg-amber-700 shadow-md cursor-pointer text-xs flex items-center gap-2"
              >
                {submittingAdd ? "جاري الحفظ..." : "💾 حفظ كافة بيانات الموظف والتابعين"}
              </button>
            </>
          }
        >
          {/* Tabs */}
          <div className="flex border-b border-gray-200 mb-4 overflow-x-auto gap-2 text-xs font-bold pb-2">
            <button
              type="button"
              onClick={() => setAddTab("personal")}
              className={`px-4 py-2 rounded-xl transition-all cursor-pointer ${
                addTab === "personal" ? "bg-amber-600 text-white shadow-xs" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <span>👤 1. البيانات الشخصية</span>
            </button>

            <button
              type="button"
              onClick={() => setAddTab("job")}
              className={`px-4 py-2 rounded-xl transition-all cursor-pointer ${
                addTab === "job" ? "bg-amber-600 text-white shadow-xs" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <span>💼 2. البيانات الوظيفية والمالية</span>
            </button>

            <button
              type="button"
              onClick={() => setAddTab("family")}
              className={`px-4 py-2 rounded-xl transition-all cursor-pointer ${
                addTab === "family" ? "bg-amber-600 text-white shadow-xs" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <span>🏠 3. الأسرة والتابعين ({dependents.length})</span>
            </button>
          </div>

          <form onSubmit={handleSaveStaff} className="space-y-4 text-xs">
            {/* TAB 1: PERSONAL */}
            {addTab === "personal" && (
              <div className="space-y-3">
                <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-200 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">اسم الموظف الكامل *</label>
                    <input
                      required
                      value={addForm.name}
                      onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                      placeholder="الاسم الرباعي للموظف"
                      className="w-full rounded-xl border border-gray-300 p-2.5 text-right font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">رقم الهوية الوطنية / الإقامة *</label>
                    <input
                      required
                      value={addForm.national_id}
                      onChange={(e) => setAddForm({ ...addForm, national_id: e.target.value })}
                      placeholder="10XXXXXXXX"
                      className="w-full rounded-xl border border-gray-300 p-2.5 font-mono text-right"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">رقم الجوال *</label>
                    <input
                      required
                      value={addForm.phone}
                      onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                      placeholder="05XXXXXXXX"
                      className="w-full rounded-xl border border-gray-300 p-2.5 font-mono text-right"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">البريد الإلكتروني</label>
                    <input
                      type="email"
                      value={addForm.email}
                      onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                      placeholder="staff@ikram.org.sa"
                      className="w-full rounded-xl border border-gray-300 p-2.5 text-right font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">تاريخ الميلاد</label>
                    <input
                      type="date"
                      value={addForm.birth_date}
                      onChange={(e) => setAddForm({ ...addForm, birth_date: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 p-2.5 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">العنوان الوطني التفصيلي</label>
                    <input
                      value={addForm.national_address}
                      onChange={(e) => setAddForm({ ...addForm, national_address: e.target.value })}
                      placeholder="مكة المكرمة - حي العزيزية"
                      className="w-full rounded-xl border border-gray-300 p-2.5 text-right"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setAddTab("job")}
                    className="bg-amber-600 text-white px-5 py-2 rounded-xl font-bold hover:bg-amber-700 cursor-pointer"
                  >
                    التالي: البيانات الوظيفية والمالية ←
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: JOB & FINANCIAL */}
            {addTab === "job" && (
              <div className="space-y-3">
                <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-200 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">المسمى الوظيفي *</label>
                    <input
                      required
                      value={addForm.job_title}
                      onChange={(e) => setAddForm({ ...addForm, job_title: e.target.value })}
                      placeholder="مثال: محصل مالي / أخصائي مستفيدين"
                      className="w-full rounded-xl border border-gray-300 p-2.5 text-right font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">القسم *</label>
                    <input
                      required
                      value={addForm.department}
                      onChange={(e) => setAddForm({ ...addForm, department: e.target.value })}
                      placeholder="مثال: المالية / خدمات المستفيدين"
                      className="w-full rounded-xl border border-gray-300 p-2.5 text-right font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">تاريخ التعيين</label>
                    <input
                      type="date"
                      value={addForm.hire_date}
                      onChange={(e) => setAddForm({ ...addForm, hire_date: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 p-2.5 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">الراتب الشهري (ر.س)</label>
                    <input
                      type="number"
                      value={addForm.salary}
                      onChange={(e) => setAddForm({ ...addForm, salary: e.target.value })}
                      placeholder="6500"
                      className="w-full rounded-xl border border-gray-300 p-2.5 font-mono text-right font-bold text-emerald-800"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">الحالة الوظيفية</label>
                    <select
                      value={addForm.status}
                      onChange={(e) => setAddForm({ ...addForm, status: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 p-2.5 bg-white text-right font-bold"
                    >
                      <option value="active">نشط</option>
                      <option value="on_leave">إجازة</option>
                      <option value="terminated">منتهي الخدمة</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setAddTab("personal")}
                    className="bg-gray-200 text-gray-700 px-5 py-2 rounded-xl font-bold cursor-pointer"
                  >
                    ← السابق
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddTab("family")}
                    className="bg-amber-600 text-white px-5 py-2 rounded-xl font-bold hover:bg-amber-700 cursor-pointer"
                  >
                    التالي: الأسرة والتابعين ←
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3: FAMILY & DEPENDENTS */}
            {addTab === "family" && (
              <div className="space-y-3">
                <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-200 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">عدد أفراد الأسرة</label>
                      <input
                        type="number"
                        min={1}
                        value={addForm.family_members_count}
                        onChange={(e) => setAddForm({ ...addForm, family_members_count: e.target.value })}
                        className="w-full rounded-xl border border-gray-300 p-2.5 font-mono text-right"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-gray-700 mb-1">عدد الزوجات</label>
                      <input
                        type="number"
                        min={0}
                        value={addForm.wives_count}
                        onChange={(e) => setAddForm({ ...addForm, wives_count: e.target.value })}
                        className="w-full rounded-xl border border-gray-300 p-2.5 font-mono text-right"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-gray-700 mb-1">ملكية السكن</label>
                      <select
                        value={addForm.owns_house ? "yes" : "no"}
                        onChange={(e) => setAddForm({ ...addForm, owns_house: e.target.value === "yes" })}
                        className="w-full rounded-xl border border-gray-300 p-2.5 bg-white text-right font-bold"
                      >
                        <option value="no">إيجار / غير ملك</option>
                        <option value="yes">ملك خاص</option>
                      </select>
                    </div>
                  </div>

                  <div className="border-t pt-3 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-gray-800">قائمة التابعين والمعالين لـ الموظف:</span>
                      <button
                        type="button"
                        onClick={addDependentRow}
                        className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ إضافة تابع</span>
                      </button>
                    </div>

                    {dependents.length === 0 && (
                      <div className="p-3 text-center text-gray-400">لا يوجد تابعين مضافين. انقر على (+ إضافة تابع) لإضافتهم.</div>
                    )}

                    {dependents.map((dep, idx) => (
                      <div key={idx} className="bg-white p-3 rounded-xl border border-gray-200 grid grid-cols-1 md:grid-cols-4 gap-2 items-center">
                        <div>
                          <label className="block text-[11px] font-bold text-gray-600">اسم التابع</label>
                          <input
                            value={dep.name}
                            onChange={(e) => updateDependentField(idx, "name", e.target.value)}
                            placeholder="الاسم الثلاثي"
                            className="w-full rounded-lg border p-1.5 text-xs text-right"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-gray-600">صلة القرابة</label>
                          <select
                            value={dep.relationship}
                            onChange={(e) => updateDependentField(idx, "relationship", e.target.value)}
                            className="w-full rounded-lg border p-1.5 text-xs bg-white text-right"
                          >
                            {RELATIONSHIP_OPTIONS.map((r) => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-gray-600">تاريخ الميلاد</label>
                          <input
                            type="date"
                            value={dep.date_of_birth}
                            onChange={(e) => updateDependentField(idx, "date_of_birth", e.target.value)}
                            className="w-full rounded-lg border p-1.5 text-xs"
                          />
                        </div>
                        <div className="flex justify-end pt-3">
                          <button
                            type="button"
                            onClick={() => removeDependentRow(idx)}
                            className="text-red-600 hover:bg-red-50 p-1.5 rounded-lg border border-red-200 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setAddTab("job")}
                    className="bg-gray-200 text-gray-700 px-5 py-2 rounded-xl font-bold cursor-pointer"
                  >
                    ← السابق
                  </button>
                  <button
                    type="submit"
                    disabled={submittingAdd}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-7 py-2.5 rounded-xl font-extrabold text-xs shadow-md cursor-pointer flex items-center gap-2"
                  >
                    {submittingAdd ? "جاري الحفظ..." : "🚀 حفظ كافة بيانات الموظف والتابعين"}
                  </button>
                </div>
              </div>
            )}
          </form>
        </Dialog>

        {/* ─── IMPORT STAFF EXCEL DIALOG ─── */}
        <Dialog
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          title="📊 استيراد قائمة الموظفين من ملف Excel / CSV"
          subtitle="رفع واستيراد قوائم الموظفين والرواتب بالجمعية دفعة واحدة"
          icon={FileSpreadsheet}
          maxWidth="max-w-3xl"
        >
          <div className="space-y-4 text-xs">
            <div className="bg-amber-50/80 p-4 rounded-2xl border border-amber-200 flex items-center justify-between gap-3">
              <div>
                <div className="font-bold text-amber-900 text-sm">💡 يمكنك تحميل نموذج استيراد الموظفين المجهز:</div>
                <div className="text-[11px] text-gray-600 mt-0.5">شيت CSV قياسي يحتوي حقول الهوية والوظيفة والراتب</div>
              </div>
              <button
                type="button"
                onClick={downloadSampleTemplate}
                className="bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Download className="w-4 h-4" />
                <span>تحميل النموذج (.csv)</span>
              </button>
            </div>

            <form onSubmit={handleSubmitImport} className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 hover:border-amber-500 rounded-2xl p-6 text-center bg-gray-50/50 transition-colors">
                <Upload className="w-8 h-8 text-amber-600 mx-auto mb-2" />
                <label className="block font-bold text-gray-800 text-xs mb-1 cursor-pointer">
                  اختر ملف Excel (.xlsx, .xls) أو CSV من جهازك
                </label>
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                  className="hidden"
                  id="staff-excel-upload"
                />
                <label
                  htmlFor="staff-excel-upload"
                  className="inline-block mt-2 px-4 py-2 bg-amber-100 text-amber-900 rounded-xl font-bold border border-amber-300 cursor-pointer hover:bg-amber-200"
                >
                  {importFile ? importFile.name : "تصفح واختيار الملف..."}
                </label>
              </div>

              {importErrorMsg && (
                <div className="p-3 bg-red-50 text-red-700 rounded-xl border border-red-200 font-bold">{importErrorMsg}</div>
              )}

              {previewRows.length > 0 && (
                <div className="space-y-2">
                  <div className="font-bold text-gray-800">معاينة أول 10 أسطر من شيت الموظفين:</div>
                  <div className="overflow-x-auto max-h-48 border border-gray-200 rounded-xl">
                    <table className="w-full text-xs text-right">
                      <thead className="bg-amber-50 text-amber-900 border-b sticky top-0">
                        <tr>
                          {Object.keys(previewRows[0]).map((k, i) => (
                            <th key={i} className="p-2 font-bold whitespace-nowrap">{k}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((r, idx) => (
                          <tr key={idx} className="border-b">
                            {Object.values(r).map((v, i) => (
                              <td key={i} className="p-2 whitespace-nowrap">{String(v)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-5 py-2.5 rounded-xl bg-gray-200 text-gray-700 font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={!importFile || importing}
                  className="px-7 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-extrabold shadow-md disabled:opacity-50 cursor-pointer flex items-center gap-2"
                >
                  {importing ? "جاري الاستيراد..." : "🚀 تأكيد واستيراد ملف الموظفين"}
                </button>
              </div>
            </form>

            {importResult && (
              <div className={`p-4 rounded-2xl border ${importResult.success !== false ? "bg-green-50 text-green-900 border-green-200" : "bg-red-50 text-red-900 border-red-200"}`}>
                <div className="font-bold text-sm mb-1">{importResult.message}</div>
                {importResult.created_count !== undefined && (
                  <div className="text-xs font-bold">تم إضافة {importResult.created_count} موظف جديد بنجاح!</div>
                )}
              </div>
            )}
          </div>
        </Dialog>

        {/* ─── Staff Support Dispatch Dialog ─── */}
        <Dialog
          isOpen={showDispatchModal}
          onClose={() => setShowDispatchModal(false)}
          title="🚀 تقديم ودعم موظفي الجمعية المباشر"
          subtitle="خطوات إسناد وتوجيه السلال للموظفين وتوليد الـ QR الخاص بها"
          icon={Send}
          maxWidth="max-w-4xl"
        >
          {/* Steps Indicator */}
          {dispatchStep < 4 && (
            <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 border-b pb-4">
              {DISPATCH_STEPS.map((s, i) => (
                <div key={i} className="flex items-center">
                  <div
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                      i === dispatchStep
                        ? "bg-amber-600 text-white shadow-md"
                        : i < dispatchStep
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
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

          {/* STEP 0: Select Staff */}
          {dispatchStep === 0 && (
            <div className="space-y-4 text-xs">
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-700">اختر الموظفين لتوجيه سلال الدعم لهم:</span>
                <span className="text-amber-900 font-extrabold bg-amber-50 border border-amber-300 px-3 py-1 rounded-xl">
                  محدد: {selectedStaffIds.size} موظف
                </span>
              </div>

              <input
                value={dispatchSearchQ}
                onChange={(e) => setDispatchSearchQ(e.target.value)}
                placeholder="بحث باسم الموظف، الهوية، الجوال، أو المسمى الوظيفي..."
                className="w-full rounded-xl border border-gray-300 p-2.5 text-xs font-bold"
              />

              <div className="overflow-x-auto max-h-60 overflow-y-auto border border-gray-200 rounded-xl">
                <table className="w-full text-xs text-right">
                  <thead className="bg-amber-50 text-amber-900 border-b sticky top-0">
                    <tr>
                      <th className="p-2 w-8">#</th>
                      <th className="p-2 font-bold">اسم الموظف</th>
                      <th className="p-2 font-bold">رقم الهوية</th>
                      <th className="p-2 font-bold">الوظيفة والقسم</th>
                      <th className="p-2 font-bold">الجوال</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staff
                      .filter((s) => !dispatchSearchQ || (s.name || "").includes(dispatchSearchQ) || (s.job_title || "").includes(dispatchSearchQ))
                      .map((s) => (
                        <tr
                          key={s.id}
                          onClick={() => toggleSelectStaff(s.id)}
                          className={`border-b cursor-pointer ${selectedStaffIds.has(s.id) ? "bg-amber-50 font-bold" : "hover:bg-gray-50"}`}
                        >
                          <td className="p-2">
                            <input type="checkbox" checked={selectedStaffIds.has(s.id)} readOnly className="rounded accent-amber-600" />
                          </td>
                          <td className="p-2 font-bold">{s.name}</td>
                          <td className="p-2 font-mono">{s.national_id}</td>
                          <td className="p-2">{s.job_title} ({s.department})</td>
                          <td className="p-2 font-mono">{s.phone}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP 1: Select Basket */}
          {dispatchStep === 1 && (
            <div className="space-y-4 text-xs">
              <h4 className="font-bold text-gray-700">اختر سلة الدعم المخصصة للموظف من المستودع:</h4>
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
                    <div className="text-[11px] text-gray-500 mt-1">{b.description || "سلة مساعدة مخصصة"}</div>
                    <div className="text-[11px] font-bold text-emerald-700 mt-2">المتوفّر: {b.current_quantity ?? b.stock_quantity ?? 0} وحدة</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2: Date & Location */}
          {dispatchStep === 2 && (
            <div className="space-y-4 text-xs">
              <h4 className="font-bold text-gray-700">تحديد موعد وموقع التسليم للموظفين:</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold mb-1">تاريخ التسليم المجدول *</label>
                  <input type="date" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="w-full rounded-xl border p-2.5 font-bold" />
                </div>
                <div>
                  <label className="block font-bold mb-1">موقع تسليم الموظف</label>
                  <input value={pickupLocation} onChange={(e) => setPickupLocation(e.target.value)} className="w-full rounded-xl border p-2.5 font-bold" placeholder="مقر الجمعية (قسم الموظفين)" />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Review */}
          {dispatchStep === 3 && (
            <div className="space-y-4 text-xs">
              <h4 className="font-extrabold text-amber-900 text-sm flex items-center gap-1.5 border-b pb-2">
                <FileText className="w-4 h-4 text-amber-600" />
                <span>مراجعة ملخص دعم الموظفين والإرسال</span>
              </h4>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-amber-50 p-3.5 rounded-2xl border border-amber-200">
                  <div className="text-2xl font-extrabold text-amber-900">{selectedStaffIds.size}</div>
                  <div className="text-[11px] text-gray-600 font-bold mt-1">عدد الموظفين المحددين</div>
                </div>
                <div className="bg-amber-50 p-3.5 rounded-2xl border border-amber-200">
                  <div className="text-sm font-extrabold text-amber-900">{selectedBasketObj?.name || "سلة موظف مخصصة"}</div>
                  <div className="text-[11px] text-gray-600 font-bold mt-1">نوع السلة المختارة</div>
                </div>
                <div className="bg-amber-50 p-3.5 rounded-2xl border border-amber-200">
                  <div className="text-sm font-extrabold text-gray-800">{scheduledAt}</div>
                  <div className="text-[11px] text-gray-600 font-bold mt-1">موعد التسليم</div>
                </div>
              </div>
            </div>
          )}

          {/* Wizard Nav */}
          {dispatchStep < 4 && (
            <div className="flex justify-between items-center mt-6 pt-4 border-t">
              <button
                disabled={dispatchStep === 0}
                onClick={() => setDispatchStep((s) => s - 1)}
                className="px-5 py-2.5 rounded-xl bg-gray-200 text-gray-700 font-bold disabled:opacity-50 cursor-pointer"
              >
                السابق
              </button>
              {dispatchStep < 3 ? (
                <button
                  disabled={(dispatchStep === 0 && selectedStaffIds.size === 0) || (dispatchStep === 1 && !basketId)}
                  onClick={() => setDispatchStep((s) => s + 1)}
                  className="px-6 py-2.5 rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-700 disabled:opacity-50 cursor-pointer"
                >
                  التالي
                </button>
              ) : (
                <button
                  disabled={submittingDispatch}
                  onClick={handleSubmitStaffDispatch}
                  className="px-8 py-2.5 rounded-xl bg-emerald-600 text-white font-extrabold hover:bg-emerald-700 cursor-pointer shadow-md text-xs"
                >
                  {submittingDispatch ? "جاري الإرسال وتوليد الـ QR..." : "🚀 تأكيد وإرسال الدعم وتوليد الـ QR"}
                </button>
              )}
            </div>
          )}

          {/* STEP 4: Success Result Step */}
          {dispatchStep === 4 && dispatchResult && (
            <div className="space-y-4 text-xs">
              <div className="text-center py-4 bg-emerald-50 rounded-2xl border border-emerald-200">
                <div className="text-emerald-700 font-extrabold text-base">تم توجيه سلال الدعم للموظفين وتوليد أكواد الـ QR بنجاح 🚀</div>
              </div>

              <div className="space-y-3 max-h-60 overflow-y-auto">
                {(dispatchResult.distributions || []).map((dist, idx) => {
                  const sObj = selectedStaffList.find((s) => s.id === dist.staff_id) || { name: "موظف " + (idx + 1) };
                  const code = dist.barcode_code || dist.qr_code || "IKRAM-STAFF-SUPPORT";
                  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${code}`;

                  return (
                    <div key={dist.id || idx} className="p-3 bg-amber-50/50 rounded-xl border border-amber-200 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-bold text-gray-900">👤 {sObj.name} ({sObj.phone})</div>
                        <div className="text-[11px] text-gray-600">💼 المسمى: {sObj.job_title} | 📦 السلة: {selectedBasketObj?.name}</div>
                      </div>

                      <div className="flex items-center gap-2 bg-white p-2 rounded-lg border">
                        <img src={qrUrl} alt="QR" className="w-12 h-12" />
                        <div className="font-mono font-bold text-amber-900">{code}</div>
                      </div>

                      <button
                        type="button"
                        onClick={() => sendStaffWhatsAppMsg(dist, sObj)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 cursor-pointer"
                      >
                        <span>💬 إرسال إشعار الواتساب</span>
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="text-center pt-3">
                <button onClick={() => setShowDispatchModal(false)} className="px-6 py-2.5 rounded-xl bg-amber-800 text-white font-bold cursor-pointer">إغلاق النافذة</button>
              </div>
            </div>
          )}
        </Dialog>

        {/* ─── CONFIRM DESTRUCTIVE DELETE DIALOG ─── */}
        <ConfirmDialog
          isOpen={!!staffToDelete}
          onClose={() => setStaffToDelete(null)}
          onConfirm={handleConfirmDelete}
          title={`حذف حساب الموظف (${staffToDelete?.name})`}
          message={`هل أنت متأكد من رغبتك في حذف بيانات الموظف (${staffToDelete?.name}) نهائياً؟ لا يمكن التراجع عن هذا الإجراء.`}
          confirmLabel="حذف نهائياً"
          cancelLabel="إلغاء"
          loading={deleteLoading}
        />

        {/* ─── TOAST FEEDBACK ─── */}
        <Toast
          isOpen={toast.isOpen}
          onClose={() => setToast({ ...toast, isOpen: false })}
          type={toast.type}
          message={toast.message}
        />
      </div>
    </MainLayout>
  );
}