import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";
import beneficiaryApi from "../../api/beneficiaries";
import distributionApi from "../../api/distributions";
import api from "../../api/axios";
import MainLayout from "../../components/layout/MainLayout";
import ReceiptCounterModal from "../../components/common/ReceiptCounterModal";
import FilterableTableHeader from "../../components/common/FilterableTableHeader";
import Dialog from "../../components/overlays/Dialog";
import ConfirmDialog from "../../components/overlays/ConfirmDialog";
import Toast from "../../components/ui/Toast";
import { Users, UserPlus, FileSpreadsheet, Search, Eye, Edit, Trash2, Package, RefreshCw, Send, X, FileText, QrCode, CheckCircle2, XCircle, Upload, ArrowRight, Download, Home, DollarSign, Plus } from "lucide-react";

const DISPATCH_STEPS = ["اختيار المستفيدين", "اختيار سلة الدعم", "تحديد الموعد", "مراجعة وإرسال"];

const FAMILY_STATUS_OPTIONS = [
  { value: "poor", label: "فقير" },
  { value: "widow", label: "أرملة" },
  { value: "widow_with_orphans", label: "أرملة مع أيتام" },
  { value: "divorced", label: "مطلقة" },
  { value: "divorced_with_children", label: "مطلقة مع أطفال" },
  { value: "abandoned", label: "مهجورة" },
];

const CITIZEN_INCOME_OPTIONS = [
  { value: "salary", label: "راتب" },
  { value: "social_security", label: "ضمان اجتماعي" },
  { value: "retirement", label: "معاش تقاعدي" },
  { value: "citizen_account", label: "حساب المواطن" },
];

const RESIDENT_INCOME_OPTIONS = [
  { value: "salary", label: "راتب" },
  { value: "family_support", label: "دعم الأسرة من الأقارب" },
];

const RELATIONSHIP_OPTIONS = ["ابن", "بنت", "زوجة", "أم", "أب", "أخ", "أخت", "جد", "جدة", "حفيد", "أخرى"];

const makeInitialForm = (type = "citizen") => ({
  beneficiary_type: type,
  full_name: "",
  national_id: "",
  phone: "",
  date_of_birth: "",
  place_of_birth: "",
  nationality: type === "citizen" ? "سعودي" : "",
  profession: "",
  national_address: "",
  city: "مكة المكرمة",
  district: "",
  street: "",

  // الأسرة والسكن
  family_status: "poor",
  wives_count: 0,
  family_members_count: 1,
  working_members_count: 0,
  non_working_children_count: 0,
  father_status: "alive",
  mother_status: "alive",
  housing_type: "rent",
  annual_rent_amount: "",
  owns_house: false,
  has_special_needs: false,

  // البيانات المالية
  priority: "first_class",
  income_sources: [],
  monthly_salary: "",
  citizen_account_amount: "",
  social_security_amount: "",
  retirement_pension: "",
  family_support: "",
  bank_name: "",
  iban: "",
  status: "active",
});

export default function BeneficiaryList() {
  const [items, setItems]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState("");
  const [typeFilter, setTypeFilter]     = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [cityFilter, setCityFilter]     = useState("all");
  const [districtFilter, setDistrictFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [selectedBeneficiary, setSelectedBeneficiary] = useState(null);

  // ─── Delete & Status Dialog States ───
  const [benToDelete, setBenToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [benToToggle, setBenToToggle] = useState(null);
  const [toggleLoading, setToggleLoading] = useState(false);

  // ─── Full Multi-Section Add Beneficiary Modal State ───
  const [showAddModal, setShowAddModal] = useState(false);
  const [addTab, setAddTab] = useState("basic"); // basic, family, financial, dependents, docs
  const [addForm, setAddForm] = useState(makeInitialForm("citizen"));
  const [dependents, setDependents] = useState([]);
  const [files, setFiles] = useState({});
  const [submittingAdd, setSubmittingAdd] = useState(false);

  // ─── Excel Import Modal State ───
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [parsedRows, setParsedRows] = useState([]);
  const [previewRows, setPreviewRows] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importErrorMsg, setImportErrorMsg] = useState(null);

  // Toast feedback state
  const [toast, setToast] = useState({ isOpen: false, type: "success", message: "" });

  // ─── Beneficiary Support Dispatch Modal State ───
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [dispatchStep, setDispatchStep] = useState(0);
  const [selectedBenIds, setSelectedBenIds] = useState(new Set());
  const [baskets, setBaskets] = useState([]);
  const [basketId, setBasketId] = useState("");
  const [scheduledAt, setScheduledAt] = useState(new Date().toISOString().split("T")[0]);
  const [pickupLocation, setPickupLocation] = useState("مقر جمعية إكرام الرئيسي");
  const [submittingDispatch, setSubmittingDispatch] = useState(false);
  const [dispatchResult, setDispatchResult] = useState(null);
  const [dispatchSearchQ, setDispatchSearchQ] = useState("");

  const triggerToast = (message, type = "success") => {
    setToast({ isOpen: true, message, type });
  };

  const loadData = () => {
    setLoading(true);
    Promise.all([
      beneficiaryApi.list({ per_page: 500 }),
      api.get("/inventory").catch(() => ({ data: { data: [] } })),
    ])
      .then(([res, invRes]) => {
        const raw = res.data?.data?.data ?? res.data?.data ?? res.data ?? [];
        const nonEmployees = (Array.isArray(raw) ? raw : []).filter(
          (b) => !b.is_employee && b.priority !== "employee"
        );
        setItems(nonEmployees);

        const invList = invRes.data?.data ?? [];
        setBaskets(Array.isArray(invList) ? invList : []);
        if (invList.length > 0 && !basketId) setBasketId(String(invList[0].id));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const openAddModalWithType = (targetType = "citizen") => {
    setAddForm(makeInitialForm(targetType));
    setDependents([]);
    setFiles({});
    setAddTab("basic");
    setShowAddModal(true);
  };

  const toggleIncomeSource = (val) => {
    setAddForm((f) => ({
      ...f,
      income_sources: f.income_sources.includes(val)
        ? f.income_sources.filter((v) => v !== val)
        : [...f.income_sources, val],
    }));
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

  const handleFileChangeField = (e) => {
    const { name, files: fl } = e.target;
    if (fl && fl[0]) {
      setFiles((prev) => ({ ...prev, [name]: fl[0] }));
    }
  };

  const handleSaveBeneficiary = async (e) => {
    e.preventDefault();
    if (!addForm.full_name || !addForm.national_id || !addForm.phone) {
      triggerToast("يرجى إدخال الحقول الأساسية المطلوبة (الاسم، الهوية، الجوال)", "warning");
      setAddTab("basic");
      return;
    }

    setSubmittingAdd(true);
    const fd = new FormData();

    const appendField = (key, value) => {
      if (value === null || value === undefined || value === "") return;
      if (Array.isArray(value)) {
        value.forEach((item, i) => fd.append(`${key}[${i}]`, item));
      } else if (typeof value === 'boolean') {
        fd.append(key, value ? '1' : '0');
      } else {
        fd.append(key, value);
      }
    };

    Object.entries(addForm).forEach(([k, v]) => appendField(k, v));

    dependents.forEach((dep, i) => {
      Object.entries(dep).forEach(([k, v]) => {
        if (v) fd.append(`dependents[${i}][${k}]`, v);
      });
    });

    Object.entries(files).forEach(([k, f]) => {
      if (f) fd.append(k, f);
    });

    try {
      await beneficiaryApi.create(fd);
      triggerToast(`تم حفظ وتصنيف بيانات المستفيد (${addForm.full_name}) بنجاح!`, "success");
      setShowAddModal(false);
      setAddForm(makeInitialForm("citizen"));
      setDependents([]);
      setFiles({});
      loadData();
    } catch (err) {
      triggerToast(err.response?.data?.message || "تعذر حفظ البيانات. يرجى التثبت من الحقول.", "error");
    } finally {
      setSubmittingAdd(false);
    }
  };

  // ─── Excel Import File Handlers ───
  const handleExcelFileChange = (e) => {
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
      const res = await beneficiaryApi.importExcel(formData);
      setImportResult(res.data);
      triggerToast("تم معالجة واستيراد ملف المستفيدين بنجاح!", "success");
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
      "اسم المستفيد,رقم الهوية,رقم الجوال,نوع المستفيد,المدينة,الحي,العنوان الوطني,التصنيف,عدد أفراد الأسرة,الراتب الشهري,حساب المواطن,الضمان الاجتماعي\n" +
      "محمد علي بن عابد,1019876543,0501112233,مواطن,مكة المكرمة,حي العزيزية,12345 مكة المكرمة 6789,درجة أولى,5,3000,720,1100\n" +
      "أحمد حسن عمر,2098765432,0551122334,مقيم,مكة المكرمة,حي العتيبية,23456 مكة المكرمة 7890,درجة ثانية,3,2500,0,0\n";

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "نموذج_استيراد_المستفيدين_الشامل.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleConfirmToggleStatus = async () => {
    if (!benToToggle) return;
    setToggleLoading(true);
    const nextStatus = benToToggle.status === "active" ? "suspended" : "active";
    try {
      await beneficiaryApi.update(benToToggle.id, { ...benToToggle, status: nextStatus });
      triggerToast(`تم تغيير حالة المستفيد (${benToToggle.full_name || benToToggle.name}) إلى (${nextStatus === "active" ? "نشط" : "موقوف"}) بنجاح.`, "success");
      setBenToToggle(null);
      loadData();
    } catch {
      triggerToast("تعذر تحديث حالة المستفيد.", "error");
    } finally {
      setToggleLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!benToDelete) return;
    setDeleteLoading(true);
    try {
      await beneficiaryApi.remove(benToDelete.id);
      setItems((prev) => prev.filter((b) => b.id !== benToDelete.id));
      triggerToast(`تم حذف بيانات المستفيد (${benToDelete.name}) بنجاح.`, "success");
      setBenToDelete(null);
    } catch {
      triggerToast("حدث خطأ أثناء حذف بيانات المستفيد.", "error");
    } finally {
      setDeleteLoading(false);
    }
  };

  const cities = Array.from(new Set(items.map((i) => i.city).filter(Boolean)));
  const districts = Array.from(new Set(items.map((i) => i.district).filter(Boolean)));

  const filtered = items.filter((b) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      (b.full_name || b.name || "").toLowerCase().includes(q) ||
      (b.national_id || "").includes(q) ||
      (b.phone || "").includes(q);

    const matchType = typeFilter === "all" || (b.beneficiary_type || b.type) === typeFilter;
    const matchPriority = priorityFilter === "all" || b.priority === priorityFilter;
    const matchCity = cityFilter === "all" || b.city === cityFilter;
    const matchDistrict = districtFilter === "all" || b.district === districtFilter;
    const matchStatus = statusFilter === "all" || b.status === statusFilter;

    return matchSearch && matchType && matchPriority && matchCity && matchDistrict && matchStatus;
  });

  // ─── Dispatch Handlers ───
  const openDispatchModal = () => {
    setDispatchStep(0);
    setSelectedBenIds(new Set());
    setDispatchResult(null);
    setShowDispatchModal(true);
  };

  const toggleSelectBen = (id) => {
    setSelectedBenIds((prev) => {
      const copy = new Set(prev);
      copy.has(id) ? copy.delete(id) : copy.add(id);
      return copy;
    });
  };

  const handleSubmitDispatch = async () => {
    if (!basketId || !scheduledAt || selectedBenIds.size === 0) return;
    setSubmittingDispatch(true);
    try {
      const res = await distributionApi.create({
        beneficiary_ids: [...selectedBenIds],
        basket_id: basketId,
        scheduled_at: scheduledAt,
        pickup_location: pickupLocation || "مقر جمعية إكرام الرئيسي",
      });
      setDispatchResult(res.data);
      setDispatchStep(4);
      triggerToast("تم توجيه وإرسال سلال الدعم بنجاح! 🚀", "success");
      loadData();
    } catch (err) {
      triggerToast(err.response?.data?.message || "حدث خطأ أثناء إرسال الدعم للمستفيدين.", "error");
    } finally {
      setSubmittingDispatch(false);
    }
  };

  const selectedBasketObj = baskets.find((b) => String(b.id) === String(basketId));
  const selectedBensList = items.filter((b) => selectedBenIds.has(b.id));

  const sendWhatsAppMsg = (dist, bObj) => {
    const rawPhone = (bObj?.phone || "").replace(/[^0-9]/g, "");
    let phoneNum = rawPhone;
    if (phoneNum.startsWith("0")) phoneNum = "966" + phoneNum.slice(1);
    else if (!phoneNum.startsWith("966") && phoneNum.length === 9) phoneNum = "966" + phoneNum;
    if (!phoneNum) phoneNum = "966574917155";

    const name = bObj?.full_name || bObj?.name || "المستفيد الكريم";
    const natId = bObj?.national_id || "—";
    const date = scheduledAt || new Date().toISOString().split("T")[0];
    const loc = pickupLocation || "مقر جمعية إكرام الرئيسي";
    const code = dist.barcode_code || dist.qr_code || "IKRAM-SUPPORT";
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${code}`;
    const basketName = selectedBasketObj?.name || "سلة دعم مخصصة";

    const textMsg = `مرحباً ${name}،
تسر جمعية إكرام إفادتكم بصدور وتأكيد استحقاقكم لسلة المساعدة:
👤 *اسم المستفيد:* ${name}
🪪 *رقم الهوية:* ${natId}
📦 *سلة الدعم:* ${basketName}
📅 *موعد الاستلام:* ${date}
📍 *موقع الاستلام:* ${loc}
🔑 *كود الاستلام والـ QR:* ${code}
📌 *رابط صورة الـ QR المباشرة:*
${qrUrl}`;

    window.open(`https://wa.me/${phoneNum}?text=${encodeURIComponent(textMsg)}`, "_blank");
  };

  const generalBensForDispatch = items.filter(
    (b) => !b.has_special_needs && !b.is_special_needs && b.priority !== "special_needs" && b.priority !== "elderly"
  );

  return (
    <MainLayout>
      <div className="p-6 max-w-7xl mx-auto" dir="rtl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Users className="w-7 h-7 text-amber-600" />
              <span>قائمة وتوجيه المستفيدين (المواطنين والمقيمين)</span>
            </h1>
            <p className="text-xs text-gray-500 mt-1">إدارة شاملة لجميع المستفيدين، تسجيل كافة البيانات، إضافة المواطنين والمقيمين واستيراد القوائم بملف Excel</p>
          </div>

          <div className="flex gap-2 flex-wrap text-xs font-bold">
            <button
              onClick={openDispatchModal}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>🚀 تقديم الدعم للمستفيدين</span>
            </button>

            <button
              onClick={() => openAddModalWithType("citizen")}
              className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ إضافة مواطن (بيانات كاملة)</span>
            </button>

            <button
              onClick={() => openAddModalWithType("resident")}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ إضافة مقيم (بيانات كاملة)</span>
            </button>

            <button
              onClick={() => setShowImportModal(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>📊 استيراد مستفيدين (Excel)</span>
            </button>
          </div>
        </div>

        {/* Global Search Bar */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="🔍 بحث بالاسم الكامل أو رقم الهوية أو رقم الجوال..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-md p-2.5 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 bg-white font-bold"
          />
        </div>

        {/* Main Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-amber-50/80 text-amber-950 font-bold border-b border-amber-200">
              <tr>
                <th className="p-3">#</th>
                <th className="p-3 font-bold">اسم المستفيد الكامل</th>
                <th className="p-3 font-bold">رقم الهوية / الإقامة</th>
                <th className="p-3 font-bold">رقم الجوال</th>
                
                <th className="p-3">
                  <FilterableTableHeader
                    title="المدينة"
                    options={cities}
                    selectedValue={cityFilter}
                    onChange={setCityFilter}
                  />
                </th>

                <th className="p-3">
                  <FilterableTableHeader
                    title="الحي السكني"
                    options={districts}
                    selectedValue={districtFilter}
                    onChange={setDistrictFilter}
                  />
                </th>

                <th className="p-3">
                  <FilterableTableHeader
                    title="النوع"
                    options={[
                      { value: "citizen", label: "مواطن سعودي" },
                      { value: "resident", label: "مقيم" }
                    ]}
                    selectedValue={typeFilter}
                    onChange={setTypeFilter}
                  />
                </th>

                <th className="p-3">
                  <FilterableTableHeader
                    title="التصنيف"
                    options={[
                      { value: "first_class", label: "درجة أولى" },
                      { value: "second_class", label: "درجة ثانية" },
                      { value: "special_needs", label: "ذوو احتياجات خاصة" },
                      { value: "elderly", label: "كبار السن" }
                    ]}
                    selectedValue={priorityFilter}
                    onChange={setPriorityFilter}
                  />
                </th>

                <th className="p-3">
                  <FilterableTableHeader
                    title="الحالة"
                    options={[
                      { value: "active", label: "نشط" },
                      { value: "suspended", label: "موقوف" }
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
                  <td colSpan={11} className="p-8 text-center text-gray-400">
                    <div className="inline-block w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mb-1" />
                    <p>جاري تحميل قائمة المستفيدين...</p>
                  </td>
                </tr>
              )}
              {!loading && filtered.map((b, idx) => {
                const receiptCount = b.distributions?.length || 0;
                const isCitizen = (b.beneficiary_type || b.type) === "citizen";
                return (
                  <tr key={b.id || idx} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="p-3 text-gray-400 font-mono">{idx + 1}</td>
                    <td className="p-3 font-bold text-gray-800">{b.full_name || b.name}</td>
                    <td className="p-3 font-mono font-semibold text-gray-700">{b.national_id}</td>
                    <td className="p-3 font-mono text-gray-600">{b.phone}</td>
                    <td className="p-3">{b.city || "—"}</td>
                    <td className="p-3 font-bold text-amber-900">{b.district || "—"}</td>
                    <td className="p-3">
                      <span className={`px-2.5 py-1 rounded-xl text-xs font-bold border ${
                        isCitizen ? "bg-emerald-100/90 text-emerald-900 border-emerald-300" : "bg-blue-100/90 text-blue-900 border-blue-300"
                      }`}>
                        {isCitizen ? "مواطن" : "مقيم"}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2.5 py-1 rounded-xl text-xs font-bold whitespace-nowrap border ${
                        b.priority === "first_class"   ? "bg-emerald-100 text-emerald-900 border-emerald-300" :
                        b.priority === "second_class"  ? "bg-amber-100 text-amber-900 border-amber-300" :
                        b.priority === "special_needs" ? "bg-purple-100 text-purple-900 border-purple-300" :
                        b.priority === "elderly"       ? "bg-blue-100 text-blue-900 border-blue-300" :
                                                         "bg-gray-100 text-gray-700"
                      }`}>
                        {b.priority === "first_class"   ? "درجة أولى" :
                         b.priority === "second_class"  ? "درجة ثانية" :
                         b.priority === "special_needs" ? "♿ ذوو احتياجات" :
                         b.priority === "elderly"       ? "👵 كبار السن" : b.priority || "—"}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2.5 py-1 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 ${
                        b.status === "active" ? "bg-emerald-100 text-emerald-800 border border-emerald-300" : "bg-red-100 text-red-800 border border-red-300"
                      }`}>
                        {b.status === "active" ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-red-600" />}
                        <span>{b.status === "active" ? "نشط" : "موقوف"}</span>
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => setSelectedBeneficiary(b)}
                        className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl border border-amber-300 font-bold text-xs inline-flex items-center gap-1.5 mx-auto cursor-pointer"
                      >
                        <Package className="w-3.5 h-3.5 text-amber-700" />
                        <span>{receiptCount} سلة</span>
                      </button>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <Link
                          to={`/beneficiaries/${b.id}`}
                          className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl border border-blue-200 cursor-pointer transition-all"
                          title="عرض البيانات الشاملة والوثائق"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <Link
                          to={`/beneficiaries/${b.id}/edit`}
                          className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl border border-amber-200 cursor-pointer transition-all"
                          title="تعديل البيانات"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => setBenToToggle(b)}
                          className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl border border-emerald-200 cursor-pointer transition-all"
                          title="تعديل حالة المستفيد (نشط / موقوف)"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setBenToDelete({ id: b.id, name: b.full_name || b.name })}
                          className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl border border-red-200 cursor-pointer transition-all"
                          title="حذف المستفيد نهائياً"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-gray-400">
                    لا توجد نتائج مطابقة لخيارات الفلترة المحددة
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Receipt Counter Modal */}
        {selectedBeneficiary && (
          <ReceiptCounterModal
            isOpen={true}
            onClose={() => setSelectedBeneficiary(null)}
            beneficiary={selectedBeneficiary}
          />
        )}

        {/* ─── FULL MULTI-TAB ADD BENEFICIARY DIALOG (مواطن / مقيم ببيانات كاملة) ─── */}
        <Dialog
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          title={addForm.beneficiary_type === "citizen" ? "➕ تسجيل مواطن جديد (كافة البيانات الرسمية)" : "➕ تسجيل مقيم جديد (كافة البيانات الرسمية)"}
          subtitle="إدخال كافة بيانات المستفيد، بيانات الأسرة والتابعين، الدخل المالي، والوثائق المرفقة"
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
                onClick={handleSaveBeneficiary}
                disabled={submittingAdd}
                className="px-7 py-2.5 rounded-xl bg-amber-600 text-white font-extrabold hover:bg-amber-700 shadow-md cursor-pointer text-xs flex items-center gap-2"
              >
                {submittingAdd ? "جاري الحفظ وتصنيف الاستحقاق..." : "💾 حفظ كافة بيانات المستفيد والتابعين"}
              </button>
            </>
          }
        >
          {/* Sub Navigation Tabs */}
          <div className="flex border-b border-gray-200 mb-4 overflow-x-auto gap-2 text-xs font-bold pb-2">
            <button
              type="button"
              onClick={() => setAddTab("basic")}
              className={`px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${
                addTab === "basic" ? "bg-amber-600 text-white shadow-xs" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <span>📋 1. البيانات الأساسية والعنوان</span>
            </button>

            <button
              type="button"
              onClick={() => setAddTab("family")}
              className={`px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${
                addTab === "family" ? "bg-amber-600 text-white shadow-xs" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <span>🏠 2. الأسرة والسكن</span>
            </button>

            <button
              type="button"
              onClick={() => setAddTab("financial")}
              className={`px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${
                addTab === "financial" ? "bg-amber-600 text-white shadow-xs" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <span>💰 3. البيانات المالية والدخل</span>
            </button>

            <button
              type="button"
              onClick={() => setAddTab("dependents")}
              className={`px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${
                addTab === "dependents" ? "bg-amber-600 text-white shadow-xs" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <span>👥 4. التابعين ({dependents.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setAddTab("docs")}
              className={`px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${
                addTab === "docs" ? "bg-amber-600 text-white shadow-xs" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <span>📎 5. الوثائق والمرفقات</span>
            </button>
          </div>

          <form onSubmit={handleSaveBeneficiary} className="space-y-4 text-xs">
            {/* TAB 1: BASIC INFO & NATIONAL ADDRESS */}
            {addTab === "basic" && (
              <div className="space-y-3">
                <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-200 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">الاسم الكامل للمستفيد *</label>
                    <input
                      required
                      value={addForm.full_name}
                      onChange={(e) => setAddForm({ ...addForm, full_name: e.target.value })}
                      placeholder="الاسم الرباعي كما في الهوية الرسمية"
                      className="w-full rounded-xl border border-gray-300 p-2.5 text-right font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">
                      {addForm.beneficiary_type === "citizen" ? "رقم الهوية الوطنية *" : "رقم الإقامة *"}
                    </label>
                    <input
                      required
                      value={addForm.national_id}
                      onChange={(e) => setAddForm({ ...addForm, national_id: e.target.value })}
                      placeholder="10XXXXXXXX / 20XXXXXXXX"
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
                    <label className="block font-bold text-gray-700 mb-1">تاريخ الميلاد</label>
                    <input
                      type="date"
                      value={addForm.date_of_birth}
                      onChange={(e) => setAddForm({ ...addForm, date_of_birth: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 p-2.5 font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">الجنسية</label>
                    <input
                      value={addForm.nationality}
                      onChange={(e) => setAddForm({ ...addForm, nationality: e.target.value })}
                      placeholder="سعودي / مقيم"
                      className="w-full rounded-xl border border-gray-300 p-2.5 text-right"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">المهنة / العمل الحالي</label>
                    <input
                      value={addForm.profession}
                      onChange={(e) => setAddForm({ ...addForm, profession: e.target.value })}
                      placeholder="مثال: متسبب / عاطل / موظف قطاع خاص"
                      className="w-full rounded-xl border border-gray-300 p-2.5 text-right"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">المدينة *</label>
                    <input
                      required
                      value={addForm.city}
                      onChange={(e) => setAddForm({ ...addForm, city: e.target.value })}
                      placeholder="مكة المكرمة"
                      className="w-full rounded-xl border border-gray-300 p-2.5 text-right font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">الحي السكني</label>
                    <input
                      value={addForm.district}
                      onChange={(e) => setAddForm({ ...addForm, district: e.target.value })}
                      placeholder="مثال: حي العزيزية"
                      className="w-full rounded-xl border border-gray-300 p-2.5 text-right"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">الشارع التفصيلي</label>
                    <input
                      value={addForm.street}
                      onChange={(e) => setAddForm({ ...addForm, street: e.target.value })}
                      placeholder="اسم الشارع الرئيسي / معلم مجاور"
                      className="w-full rounded-xl border border-gray-300 p-2.5 text-right"
                    />
                  </div>

                  {/* 📍 العنوان الوطني المختصر والتفصيلي */}
                  <div className="md:col-span-3">
                    <label className="block font-bold text-amber-900 mb-1">📍 العنوان الوطني الكامل (رقم المبنى - الشارع - الرمز البريدي - الإضافي)</label>
                    <input
                      value={addForm.national_address}
                      onChange={(e) => setAddForm({ ...addForm, national_address: e.target.value })}
                      placeholder="مثال: 12345 مكة المكرمة 6789 - حي العزيزية، شارع عبد الله خياط"
                      className="w-full rounded-xl border border-amber-300 bg-white p-2.5 text-right font-bold text-gray-800"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setAddTab("family")}
                    className="bg-amber-600 text-white px-5 py-2 rounded-xl font-bold hover:bg-amber-700 cursor-pointer"
                  >
                    التالي: بيانات الأسرة والسكن ←
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: FAMILY & HOUSING */}
            {addTab === "family" && (
              <div className="space-y-3">
                <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-200 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">حالة الأسرة الاجتماعية *</label>
                    <select
                      value={addForm.family_status}
                      onChange={(e) => setAddForm({ ...addForm, family_status: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 p-2.5 bg-white text-right font-bold"
                    >
                      {FAMILY_STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">إجمالي عدد أفراد الأسرة *</label>
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
                    <label className="block font-bold text-gray-700 mb-1">نوع السكن</label>
                    <select
                      value={addForm.housing_type}
                      onChange={(e) => setAddForm({ ...addForm, housing_type: e.target.value })}
                      className="w-full rounded-xl border border-gray-300 p-2.5 bg-white text-right font-bold"
                    >
                      <option value="rent">إيجار</option>
                      <option value="owned">ملك</option>
                      <option value="popular">شعبي / خيري</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">قيمة الإيجار السنوي (ر.س)</label>
                    <input
                      type="number"
                      value={addForm.annual_rent_amount}
                      onChange={(e) => setAddForm({ ...addForm, annual_rent_amount: e.target.value })}
                      placeholder="18000"
                      className="w-full rounded-xl border border-gray-300 p-2.5 font-mono text-right"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">من ذوي الاحتياجات الخاصة؟</label>
                    <select
                      value={addForm.has_special_needs ? "yes" : "no"}
                      onChange={(e) => setAddForm({ ...addForm, has_special_needs: e.target.value === "yes" })}
                      className="w-full rounded-xl border border-gray-300 p-2.5 bg-white text-right font-bold"
                    >
                      <option value="no">لا</option>
                      <option value="yes">نعم (يصنف ذوو احتياجات خاصة)</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setAddTab("basic")}
                    className="bg-gray-200 text-gray-700 px-5 py-2 rounded-xl font-bold cursor-pointer"
                  >
                    ← السابق
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddTab("financial")}
                    className="bg-amber-600 text-white px-5 py-2 rounded-xl font-bold hover:bg-amber-700 cursor-pointer"
                  >
                    التالي: البيانات المالية والدخل ←
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3: FINANCIAL & INCOME */}
            {addTab === "financial" && (
              <div className="space-y-3">
                <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-200 space-y-4">
                  <div>
                    <label className="block font-bold text-gray-800 mb-2">مصادر الدخل الشهرية المعتمدة:</label>
                    <div className="flex flex-wrap gap-3">
                      {(addForm.beneficiary_type === "citizen" ? CITIZEN_INCOME_OPTIONS : RESIDENT_INCOME_OPTIONS).map((opt) => (
                        <label key={opt.value} className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-gray-300 cursor-pointer font-bold">
                          <input
                            type="checkbox"
                            checked={addForm.income_sources.includes(opt.value)}
                            onChange={() => toggleIncomeSource(opt.value)}
                            className="w-4 h-4 accent-amber-600 rounded cursor-pointer"
                          />
                          <span>{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border-t pt-3">
                    <div>
                      <label className="block font-bold text-gray-700 mb-1">الراتب الشهري الفعلي (ر.س)</label>
                      <input
                        type="number"
                        value={addForm.monthly_salary}
                        onChange={(e) => setAddForm({ ...addForm, monthly_salary: e.target.value })}
                        placeholder="2500"
                        className="w-full rounded-xl border border-gray-300 p-2.5 font-mono text-right font-bold text-emerald-800"
                      />
                    </div>

                    {addForm.beneficiary_type === "citizen" && (
                      <>
                        <div>
                          <label className="block font-bold text-gray-700 mb-1">مبلغ الضمان الاجتماعي (ر.س)</label>
                          <input
                            type="number"
                            value={addForm.social_security_amount}
                            onChange={(e) => setAddForm({ ...addForm, social_security_amount: e.target.value })}
                            placeholder="1100"
                            className="w-full rounded-xl border border-gray-300 p-2.5 font-mono text-right font-bold text-amber-900"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-gray-700 mb-1">مبلغ حساب المواطن (ر.س)</label>
                          <input
                            type="number"
                            value={addForm.citizen_account_amount}
                            onChange={(e) => setAddForm({ ...addForm, citizen_account_amount: e.target.value })}
                            placeholder="720"
                            className="w-full rounded-xl border border-gray-300 p-2.5 font-mono text-right font-bold text-amber-900"
                          />
                        </div>
                      </>
                    )}

                    <div>
                      <label className="block font-bold text-gray-700 mb-1">اسم البنك</label>
                      <input
                        value={addForm.bank_name}
                        onChange={(e) => setAddForm({ ...addForm, bank_name: e.target.value })}
                        placeholder="مصرف الراجحي / البنك الأهلي"
                        className="w-full rounded-xl border border-gray-300 p-2.5 text-right font-bold"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block font-bold text-gray-700 mb-1">رقم الحساب البنكي (IBAN)</label>
                      <input
                        value={addForm.iban}
                        onChange={(e) => setAddForm({ ...addForm, iban: e.target.value })}
                        placeholder="SA0000000000000000000000"
                        className="w-full rounded-xl border border-gray-300 p-2.5 font-mono text-right"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setAddTab("family")}
                    className="bg-gray-200 text-gray-700 px-5 py-2 rounded-xl font-bold cursor-pointer"
                  >
                    ← السابق
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddTab("dependents")}
                    className="bg-amber-600 text-white px-5 py-2 rounded-xl font-bold hover:bg-amber-700 cursor-pointer"
                  >
                    التالي: أفراد الأسرة التابعين ←
                  </button>
                </div>
              </div>
            )}

            {/* TAB 4: DEPENDENTS */}
            {addTab === "dependents" && (
              <div className="space-y-3">
                <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-200 space-y-3">
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="font-bold text-gray-800">قائمة التابعين والمعالين بالأسرة:</span>
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
                    <div className="p-4 text-center text-gray-400">لا يوجد تابعين مضافين حالياً. انقر على (+ إضافة تابع) لإضافتهم.</div>
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

                <div className="flex justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setAddTab("financial")}
                    className="bg-gray-200 text-gray-700 px-5 py-2 rounded-xl font-bold cursor-pointer"
                  >
                    ← السابق
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddTab("docs")}
                    className="bg-amber-600 text-white px-5 py-2 rounded-xl font-bold hover:bg-amber-700 cursor-pointer"
                  >
                    التالي: الوثائق المرفقة ←
                  </button>
                </div>
              </div>
            )}

            {/* TAB 5: ALL DOCUMENTS & ATTACHMENTS */}
            {addTab === "docs" && (
              <div className="space-y-3">
                <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-200 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {addForm.beneficiary_type === "citizen" ? (
                    <>
                      <div>
                        <label className="block font-bold text-gray-800 mb-1">1. صورة هوية مواطن *</label>
                        <input
                          type="file"
                          name="national_id_image"
                          onChange={handleFileChangeField}
                          className="w-full bg-white border border-gray-300 p-2 rounded-xl text-xs"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-gray-800 mb-1">2. صورة إثبات مشهد الضمان الاجتماعي 🏛️</label>
                        <input
                          type="file"
                          name="social_security_image"
                          onChange={handleFileChangeField}
                          className="w-full bg-white border border-amber-300 p-2 rounded-xl text-xs"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-gray-800 mb-1">3. صورة إثبات حساب المواطن 💳</label>
                        <input
                          type="file"
                          name="citizen_account_image"
                          onChange={handleFileChangeField}
                          className="w-full bg-white border border-amber-300 p-2 rounded-xl text-xs"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-gray-800 mb-1">4. صورة إثبات الراتب / مشهد الدخل 💵</label>
                        <input
                          type="file"
                          name="salary_certificate"
                          onChange={handleFileChangeField}
                          className="w-full bg-white border border-gray-300 p-2 rounded-xl text-xs"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-gray-800 mb-1">5. صك السكن / عقد الإيجار أو فاتورة الكهرباء 🏠</label>
                        <input
                          type="file"
                          name="rental_contract_image"
                          onChange={handleFileChangeField}
                          className="w-full bg-white border border-gray-300 p-2 rounded-xl text-xs"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-gray-800 mb-1">6. صورة إثبات العنوان الوطني 📍</label>
                        <input
                          type="file"
                          name="national_address_image"
                          onChange={handleFileChangeField}
                          className="w-full bg-white border border-amber-300 p-2 rounded-xl text-xs"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="block font-bold text-gray-800 mb-1">1. صورة هوية مقيم (الإقامة) *</label>
                        <input
                          type="file"
                          name="residence_id_image"
                          onChange={handleFileChangeField}
                          className="w-full bg-white border border-gray-300 p-2 rounded-xl text-xs"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-gray-800 mb-1">2. صورة إثبات الراتب / مشهد الدخل</label>
                        <input
                          type="file"
                          name="salary_certificate"
                          onChange={handleFileChangeField}
                          className="w-full bg-white border border-gray-300 p-2 rounded-xl text-xs"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-gray-800 mb-1">3. عقد الإيجار أو فاتورة الكهرباء</label>
                        <input
                          type="file"
                          name="rental_contract_image"
                          onChange={handleFileChangeField}
                          className="w-full bg-white border border-gray-300 p-2 rounded-xl text-xs"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-gray-800 mb-1">4. صورة إثبات العنوان الوطني 📍</label>
                        <input
                          type="file"
                          name="national_address_image"
                          onChange={handleFileChangeField}
                          className="w-full bg-white border border-amber-300 p-2 rounded-xl text-xs"
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="flex justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setAddTab("dependents")}
                    className="bg-gray-200 text-gray-700 px-5 py-2 rounded-xl font-bold cursor-pointer"
                  >
                    ← السابق
                  </button>
                  <button
                    type="submit"
                    disabled={submittingAdd}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-7 py-2.5 rounded-xl font-extrabold text-xs shadow-md cursor-pointer flex items-center gap-2"
                  >
                    {submittingAdd ? "جاري الحفظ والتصنيف..." : "🚀 حفظ وتصنيف المستفيد بنجاح"}
                  </button>
                </div>
              </div>
            )}
          </form>
        </Dialog>

        {/* ─── IMPORT BENEFICIARIES EXCEL DIALOG ─── */}
        <Dialog
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          title="📊 استيراد قائمة المستفيدين من ملف Excel / CSV"
          subtitle="رفع ومعالجة شيتات المستفيدين دفعة واحدة بالنظام"
          icon={FileSpreadsheet}
          maxWidth="max-w-3xl"
        >
          <div className="space-y-4 text-xs">
            <div className="bg-amber-50/80 p-4 rounded-2xl border border-amber-200 flex items-center justify-between gap-3">
              <div>
                <div className="font-bold text-amber-900 text-sm">💡 يمكنك تحميل الشيت النموذجي المجهز للاستيراد:</div>
                <div className="text-[11px] text-gray-600 mt-0.5">يتضمن الحقول الأساسية والمالية والعنوان الوطني المطلوب لنظام الجمعية</div>
              </div>
              <button
                type="button"
                onClick={downloadSampleTemplate}
                className="bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Download className="w-4 h-4" />
                <span>تحميل النموذج النموذجي (.csv)</span>
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
                  onChange={handleExcelFileChange}
                  className="hidden"
                  id="ben-excel-upload"
                />
                <label
                  htmlFor="ben-excel-upload"
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
                  <div className="font-bold text-gray-800">معاينة أول 10 أسطر من الملف المرفوع ({parsedRows.length} إجمالي):</div>
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
                  {importing ? "جاري المعالجة والاستيراد..." : "🚀 تأكيد واستيراد الملف للنظام"}
                </button>
              </div>
            </form>

            {importResult && (
              <div className={`p-4 rounded-2xl border ${importResult.success !== false ? "bg-green-50 text-green-900 border-green-200" : "bg-red-50 text-red-900 border-red-200"}`}>
                <div className="font-bold text-sm mb-1">{importResult.message}</div>
                {importResult.created_count !== undefined && (
                  <div className="text-xs font-bold">تم إضافة {importResult.created_count} مستفيد جديد بنجاح!</div>
                )}
              </div>
            )}
          </div>
        </Dialog>

        {/* ─── Beneficiary Support Dispatch Dialog ─── */}
        <Dialog
          isOpen={showDispatchModal}
          onClose={() => setShowDispatchModal(false)}
          title="🚀 تقديم ودعم المستفيدين المسجلين (المواطنين والمقيمين)"
          subtitle="خطوات تقديم وتوجيه سلال الدعم وتوليد أكواد الاستلام والـ QR"
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

          {/* STEP 0: Select Beneficiaries */}
          {dispatchStep === 0 && (
            <div className="space-y-4 text-xs">
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-700">اختر المستفيدين لتوجيه سلال الدعم لهم:</span>
                <span className="text-amber-900 font-extrabold bg-amber-50 border border-amber-300 px-3 py-1 rounded-xl">
                  محدد: {selectedBenIds.size} مستفيد
                </span>
              </div>

              <input
                value={dispatchSearchQ}
                onChange={(e) => setDispatchSearchQ(e.target.value)}
                placeholder="بحث باسم المستفيد، رقم الهوية، أو الجوال..."
                className="w-full rounded-xl border border-gray-300 p-2.5 text-xs font-bold"
              />

              <div className="overflow-x-auto max-h-60 overflow-y-auto border border-gray-200 rounded-xl">
                <table className="w-full text-xs text-right">
                  <thead className="bg-amber-50 text-amber-900 border-b sticky top-0">
                    <tr>
                      <th className="p-2 w-8">#</th>
                      <th className="p-2 font-bold">اسم المستفيد</th>
                      <th className="p-2 font-bold">رقم الهوية</th>
                      <th className="p-2 font-bold">الجوال</th>
                      <th className="p-2 font-bold">المدينة والحي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {generalBensForDispatch
                      .filter((b) => !dispatchSearchQ || (b.full_name || b.name || "").includes(dispatchSearchQ))
                      .map((b) => (
                        <tr
                          key={b.id}
                          onClick={() => toggleSelectBen(b.id)}
                          className={`border-b cursor-pointer ${selectedBenIds.has(b.id) ? "bg-amber-50 font-bold" : "hover:bg-gray-50"}`}
                        >
                          <td className="p-2">
                            <input type="checkbox" checked={selectedBenIds.has(b.id)} readOnly className="rounded accent-amber-600" />
                          </td>
                          <td className="p-2 font-bold">{b.full_name || b.name}</td>
                          <td className="p-2 font-mono">{b.national_id}</td>
                          <td className="p-2 font-mono">{b.phone}</td>
                          <td className="p-2">{b.city || "مكة"} - {b.district || "—"}</td>
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
              <h4 className="font-bold text-gray-700">اختر سلة الدعم المخصصة من المستودع:</h4>
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

          {/* STEP 2: Date & Pickup Location */}
          {dispatchStep === 2 && (
            <div className="space-y-4 text-xs">
              <h4 className="font-bold text-gray-700">تحديد موعد وموقع تسليم السلال:</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold mb-1">تاريخ التسليم المجدول *</label>
                  <input type="date" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="w-full rounded-xl border p-2.5 font-bold" />
                </div>
                <div>
                  <label className="block font-bold mb-1">مقر أو موقع تسليم السلة</label>
                  <input value={pickupLocation} onChange={(e) => setPickupLocation(e.target.value)} className="w-full rounded-xl border p-2.5 font-bold" placeholder="مقر الجمعية الرئيسي" />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Review Step */}
          {dispatchStep === 3 && (
            <div className="space-y-4 text-xs">
              <h4 className="font-extrabold text-amber-900 text-sm flex items-center gap-1.5 border-b pb-2">
                <FileText className="w-4 h-4 text-amber-600" />
                <span>مراجعة ملخص الدعم والإرسال النهائي</span>
              </h4>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-amber-50 p-3.5 rounded-2xl border border-amber-200">
                  <div className="text-2xl font-extrabold text-amber-900">{selectedBenIds.size}</div>
                  <div className="text-[11px] text-gray-600 font-bold mt-1">عدد المستفيدين المحددين</div>
                </div>
                <div className="bg-amber-50 p-3.5 rounded-2xl border border-amber-200">
                  <div className="text-sm font-extrabold text-amber-900">{selectedBasketObj?.name || "سلة دعم مخصصة"}</div>
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
                  disabled={(dispatchStep === 0 && selectedBenIds.size === 0) || (dispatchStep === 1 && !basketId)}
                  onClick={() => setDispatchStep((s) => s + 1)}
                  className="px-6 py-2.5 rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-700 disabled:opacity-50 cursor-pointer"
                >
                  التالي
                </button>
              ) : (
                <button
                  disabled={submittingDispatch}
                  onClick={handleSubmitDispatch}
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
                <div className="text-emerald-700 font-extrabold text-base">تم إرسال وتوجيه الدعم للمستفيدين بنجاح 🚀</div>
                <p className="text-gray-600 text-xs mt-1">تم إنشاء سجلات التوزيع وتوليد أكواد الـ QR</p>
              </div>

              <div className="space-y-3 max-h-60 overflow-y-auto">
                {(dispatchResult.distributions || []).map((dist, idx) => {
                  const bObj = selectedBensList.find((b) => b.id === dist.beneficiary_id) || { full_name: "مستفيد " + (idx + 1) };
                  const code = dist.barcode_code || dist.qr_code || "IKRAM-SUPPORT";
                  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${code}`;

                  return (
                    <div key={dist.id || idx} className="p-3 bg-amber-50/50 rounded-xl border border-amber-200 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-bold text-gray-900">👤 {bObj.full_name || bObj.name} ({bObj.phone})</div>
                        <div className="text-[11px] text-gray-600">📦 السلة: {selectedBasketObj?.name}</div>
                      </div>

                      <div className="flex items-center gap-2 bg-white p-2 rounded-lg border">
                        <img src={qrUrl} alt="QR" className="w-12 h-12" />
                        <div className="font-mono font-bold text-amber-900">{code}</div>
                      </div>

                      <button
                        type="button"
                        onClick={() => sendWhatsAppMsg(dist, bObj)}
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
          isOpen={!!benToDelete}
          onClose={() => setBenToDelete(null)}
          onConfirm={handleConfirmDelete}
          title={`حذف بيانات المستفيد (${benToDelete?.name})`}
          message={`هل أنت متأكد من رغبتك في حذف بيانات المستفيد (${benToDelete?.name}) نهائياً من الجمعية؟ لا يمكن التراجع عن هذا الإجراء.`}
          confirmLabel="حذف نهائياً"
          cancelLabel="إلغاء"
          loading={deleteLoading}
        />

        {/* ─── CONFIRM TOGGLE STATUS DIALOG ─── */}
        <ConfirmDialog
          isOpen={!!benToToggle}
          onClose={() => setBenToToggle(null)}
          onConfirm={handleConfirmToggleStatus}
          title={`تغيير حالة المستفيد (${benToToggle?.full_name || benToToggle?.name})`}
          message={`هل أنت متأكد من تغيير حالة المستفيد (${benToToggle?.full_name || benToToggle?.name}) من (${benToToggle?.status === "active" ? "نشط" : "موقوف"}) إلى (${benToToggle?.status === "active" ? "موقوف" : "نشط"})؟`}
          confirmLabel="تغيير الحالة"
          cancelLabel="إلغاء"
          loading={toggleLoading}
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
