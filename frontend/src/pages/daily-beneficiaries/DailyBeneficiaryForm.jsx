import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import MainLayout from "../../components/layout/MainLayout";
import Toast from "../../components/ui/Toast";
import ConfirmDialog from "../../components/overlays/ConfirmDialog";
import {
  getDailyBeneficiary,
  createDailyBeneficiary,
  updateDailyBeneficiary,
  checkNationalId,
  uploadDocument,
  deleteDocument,
} from "../../api/dailyBeneficiaries";
import api from "../../api/axios";
import {
  UserPlus,
  ArrowRight,
  Save,
  CheckCircle2,
  AlertCircle,
  Upload,
  FileText,
  Trash2,
  Download,
  Eye,
  FileCheck,
  UserCheck,
} from "lucide-react";

export default function DailyBeneficiaryForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [formData, setFormData] = useState({
    full_name: "",
    national_id: "",
    phone: "",
    date_of_birth: "",
    district: "",
    category_id: "",
    status: "active",
    notes: "",
  });

  const [categories, setCategories] = useState([]);
  const [districtsList, setDistrictsList] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  // National ID uniqueness check state
  const [idChecking, setIdChecking] = useState(false);
  const [idDuplicateWarning, setIdDuplicateWarning] = useState(null);

  // Documents state
  const [documents, setDocuments] = useState([]);
  const [docFile, setDocFile] = useState(null);
  const [docType, setDocType] = useState("national_id");
  const [docTitle, setDocTitle] = useState("");
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [deleteDocTarget, setDeleteDocTarget] = useState(null);

  // Toast
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  useEffect(() => {
    // Fetch categories and districts
    api.get("/categories")
      .then((res) => {
        setCategories(res.data.data || res.data || []);
      })
      .catch(() => {});

    // Common Mecca neighborhoods list
    setDistrictsList([
      "حي الصفا",
      "حي الروضة",
      "حي العزيزية",
      "حي النعيم",
      "حي الشاطئ",
      "حي الجامعة",
      "حي الزهراء",
      "حي المنصور",
      "حي الشرائع",
      "حي بطحاء قريش",
      "حي العوالي",
      "حي النزهة",
      "حي الرصيفة",
    ]);

    if (isEdit) {
      setLoading(true);
      getDailyBeneficiary(id)
        .then((res) => {
          if (res.data?.success) {
            const b = res.data.data;
            setFormData({
              full_name: b.full_name || "",
              national_id: b.national_id || "",
              phone: b.phone || "",
              date_of_birth: b.date_of_birth ? b.date_of_birth.slice(0, 10) : "",
              district: b.district || "",
              category_id: b.category_id || "",
              status: b.status || "active",
              notes: b.notes || "",
            });
            setDocuments(b.documents || []);
          }
        })
        .catch((err) => {
          setToast({ show: true, message: "تعذر تحميل بيانات المستفيد", type: "error" });
        })
        .finally(() => setLoading(false));
    }
  }, [id, isEdit]);

  // Handle national ID debounce check
  const handleNationalIdBlur = async () => {
    const natId = formData.national_id.trim();
    if (natId.length === 10) {
      setIdChecking(true);
      try {
        const res = await checkNationalId(natId, isEdit ? id : null);
        if (res.data?.exists) {
          setIdDuplicateWarning(res.data.beneficiary);
        } else {
          setIdDuplicateWarning(null);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIdChecking(false);
      }
    } else {
      setIdDuplicateWarning(null);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.full_name.trim()) {
      newErrors.full_name = "الاسم الرباعي مطلوب.";
    }

    if (!formData.national_id.trim()) {
      newErrors.national_id = "رقم الهوية الوطنية أو الإقامة مطلوب.";
    } else if (!/^[12]\d{9}$/.test(formData.national_id.trim())) {
      newErrors.national_id = "يجب أن يتكون رقم الهوية من 10 أرقام (يبدأ بـ 1 للسعوديين أو 2 للمقيمين).";
    }

    if (!formData.phone.trim()) {
      newErrors.phone = "رقم الجوال مطلوب.";
    } else if (!/^(05\d{8}|5\d{8})$/.test(formData.phone.trim())) {
      newErrors.phone = "رقم الجوال غير صحيح (يجب أن يبدأ بـ 05 ويتكون من 10 أرقام).";
    }

    if (!formData.district.trim()) {
      newErrors.district = "اسم الحي مطلوب.";
    }

    if (idDuplicateWarning) {
      newErrors.national_id = "رقم الهوية مسجل بالفعل لمستفيد آخر.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      setToast({ show: true, message: "يرجى تصحيح الحقول المطلوبة والموضحة أدناه", type: "error" });
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        const res = await updateDailyBeneficiary(id, formData);
        if (res.data?.success) {
          setToast({ show: true, message: "تم تحديث بيانات المستفيد بنجاح", type: "success" });
          setTimeout(() => navigate(`/daily-beneficiaries/${id}`), 1000);
        }
      } else {
        const res = await createDailyBeneficiary(formData);
        if (res.data?.success) {
          const newId = res.data.data.id;
          setToast({ show: true, message: "تم تسجيل المستفيد اليومي بنجاح", type: "success" });
          setTimeout(() => navigate(`/daily-beneficiaries/${newId}`), 1000);
        }
      }
    } catch (err) {
      const respErrors = err.response?.data?.errors;
      if (respErrors) {
        const formatted = {};
        Object.keys(respErrors).forEach((key) => {
          formatted[key] = respErrors[key][0];
        });
        setErrors(formatted);
      }
      const msg = err.response?.data?.message || "فشل في حفظ بيانات المستفيد";
      setToast({ show: true, message: msg, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  // Upload document
  const handleUploadDoc = async (e) => {
    e.preventDefault();
    if (!docFile) {
      setToast({ show: true, message: "يرجى اختيار ملف الوثيقة", type: "warning" });
      return;
    }

    if (!isEdit) {
      setToast({ show: true, message: "يرجى حفظ بيانات المستفيد أولاً قبل إرفاق الوثائق", type: "info" });
      return;
    }

    setUploadingDoc(true);
    const fd = new FormData();
    fd.append("document", docFile);
    fd.append("document_type", docType);
    if (docTitle) fd.append("title", docTitle);

    try {
      const res = await uploadDocument(id, fd);
      if (res.data?.success) {
        setDocuments([res.data.data, ...documents]);
        setDocFile(null);
        setDocTitle("");
        setToast({ show: true, message: "تم رفع الوثيقة بنجاح", type: "success" });
      }
    } catch (err) {
      setToast({ show: true, message: "فشل في رفع الوثيقة", type: "error" });
    } finally {
      setUploadingDoc(false);
    }
  };

  // Delete document
  const handleDeleteDocConfirm = async () => {
    if (!deleteDocTarget) return;
    try {
      const res = await deleteDocument(deleteDocTarget.id);
      if (res.data?.success) {
        setDocuments(documents.filter((d) => d.id !== deleteDocTarget.id));
        setToast({ show: true, message: "تم حذف الوثيقة", type: "success" });
        setDeleteDocTarget(null);
      }
    } catch (err) {
      setToast({ show: true, message: "تعذر حذف الوثيقة", type: "error" });
    }
  };

  if (loading) {
    return (
      <MainLayout title="تحميل المستفيد...">
        <div className="py-20 text-center text-slate-400">
          <div className="w-10 h-10 border-4 border-[#3F6B3A] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          جاري تحميل بيانات المستفيد اليومي...
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title={isEdit ? "تعديل بيانات المستفيد اليومي" : "إضافة مستفيد يومي جديد"}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back link & Header */}
        <div className="flex items-center justify-between">
          <Link
            to="/daily-beneficiaries"
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-[#3F6B3A] transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            العودة لقائمة المستفيدين اليوميين
          </Link>
          <span className="text-xs text-slate-400">
            {isEdit ? "تعديل الملف الشخصي" : "تسجيل مستفيد جديد"}
          </span>
        </div>

        {/* Main Form Card */}
        <div className="bg-white border border-[#E5E2D9] rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-3 pb-5 mb-6 border-b border-[#E5E2D9]">
            <div className="p-2.5 bg-[#3F6B3A]/10 text-[#3F6B3A] rounded-xl">
              {isEdit ? <UserCheck className="w-6 h-6" /> : <UserPlus className="w-6 h-6" />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                {isEdit ? `تعديل بيانات: ${formData.full_name}` : "تسجيل بيانات المستفيد اليومي"}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                يرجى إدخال البيانات الشخصية بدقة. رقم الهوية والجوال يخضعان لتدقيق مباشر لمنع التكرار.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Group 1: Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Full Name */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  الاسم الرباعي للمستفيد <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => {
                    setFormData({ ...formData, full_name: e.target.value });
                    if (errors.full_name) setErrors({ ...errors, full_name: null });
                  }}
                  placeholder="مثال: إبراهيم سليمان منصور المنصور"
                  className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-lg text-sm focus:outline-none focus:bg-white transition-colors ${
                    errors.full_name ? "border-red-500 focus:border-red-500" : "border-[#E5E2D9] focus:border-[#3F6B3A]"
                  }`}
                />
                {errors.full_name && <p className="text-red-500 text-xs mt-1">{errors.full_name}</p>}
              </div>

              {/* National ID */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  رقم الهوية الوطنية / الإقامة <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    maxLength="10"
                    value={formData.national_id}
                    onChange={(e) => {
                      setFormData({ ...formData, national_id: e.target.value.replace(/\D/g, "") });
                      if (errors.national_id) setErrors({ ...errors, national_id: null });
                    }}
                    onBlur={handleNationalIdBlur}
                    placeholder="10 أرقام (يبدأ بـ 1 أو 2)"
                    className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-lg text-sm font-mono focus:outline-none focus:bg-white transition-colors ${
                      errors.national_id || idDuplicateWarning
                        ? "border-red-500 focus:border-red-500"
                        : "border-[#E5E2D9] focus:border-[#3F6B3A]"
                    }`}
                  />
                  {idChecking && (
                    <div className="absolute left-3 top-1/2 -translate-y-1/2">
                      <div className="w-4 h-4 border-2 border-[#3F6B3A] border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
                {errors.national_id && <p className="text-red-500 text-xs mt-1">{errors.national_id}</p>}
                {idDuplicateWarning && (
                  <div className="mt-1.5 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-start gap-1.5">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      رقم الهوية مسجل بالفعل للمستفيد: <strong>{idDuplicateWarning.full_name}</strong> (حي {idDuplicateWarning.district}). لا يمكن تكرار نفس الهوية.
                    </div>
                  </div>
                )}
              </div>

              {/* Mobile Phone */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  رقم الجوال <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  maxLength="10"
                  dir="ltr"
                  value={formData.phone}
                  onChange={(e) => {
                    setFormData({ ...formData, phone: e.target.value.replace(/\D/g, "") });
                    if (errors.phone) setErrors({ ...errors, phone: null });
                  }}
                  placeholder="05xxxxxxxx"
                  className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-lg text-sm font-mono text-right focus:outline-none focus:bg-white transition-colors ${
                    errors.phone ? "border-red-500 focus:border-red-500" : "border-[#E5E2D9] focus:border-[#3F6B3A]"
                  }`}
                />
                {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
              </div>

              {/* District / Neighborhood */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  الحي السكني <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  list="districts-datalist"
                  value={formData.district}
                  onChange={(e) => {
                    setFormData({ ...formData, district: e.target.value });
                    if (errors.district) setErrors({ ...errors, district: null });
                  }}
                  placeholder="اختر أو اكتب اسم الحي..."
                  className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-lg text-sm focus:outline-none focus:bg-white transition-colors ${
                    errors.district ? "border-red-500 focus:border-red-500" : "border-[#E5E2D9] focus:border-[#3F6B3A]"
                  }`}
                />
                <datalist id="districts-datalist">
                  {districtsList.map((d) => (
                    <option key={d} value={d} />
                  ))}
                </datalist>
                {errors.district && <p className="text-red-500 text-xs mt-1">{errors.district}</p>}
              </div>

              {/* Date of Birth */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">تاريخ الميلاد (اختياري)</label>
                <input
                  type="date"
                  value={formData.date_of_birth}
                  onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-[#E5E2D9] rounded-lg text-sm focus:outline-none focus:border-[#3F6B3A] focus:bg-white"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">الفئة المستهدفة</label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-[#E5E2D9] rounded-lg text-sm focus:outline-none focus:border-[#3F6B3A] focus:bg-white"
                >
                  <option value="">-- اختر فئة المستفيد --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">حالة المستفيد</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-[#E5E2D9] rounded-lg text-sm focus:outline-none focus:border-[#3F6B3A] focus:bg-white"
                >
                  <option value="active">نشط (مؤهل لاستلام المساعدات اليومية)</option>
                  <option value="inactive">غير نشط (معلق / تم إيقاف الدعم)</option>
                </select>
              </div>

              {/* Notes */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">ملاحظات وتقرير الحالة</label>
                <textarea
                  rows="3"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="وصف إضافي للحالة، الوضع الصحي أو الاجتماعي، أسباب الحاجة اليومية..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-[#E5E2D9] rounded-lg text-sm focus:outline-none focus:border-[#3F6B3A] focus:bg-white"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-5 border-t border-[#E5E2D9]">
              <Link
                to="/daily-beneficiaries"
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition-colors"
              >
                إلغاء
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#3F6B3A] hover:bg-[#345830] text-white rounded-lg text-sm font-bold shadow transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? "جاري الحفظ..." : isEdit ? "حفظ التعديلات" : "تسجيل المستفيد"}
              </button>
            </div>
          </form>
        </div>

        {/* Documents Section (Available for Edit or upon creation) */}
        {isEdit && (
          <div className="bg-white border border-[#E5E2D9] rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-[#E5E2D9]">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-[#C9A24A]" />
                <h3 className="font-bold text-slate-800 text-base">وثائق ومرفقات المستفيد</h3>
              </div>
              <span className="text-xs text-slate-500">
                إجمالي الوثائق: <strong>{documents.length}</strong>
              </span>
            </div>

            {/* Upload Document Form */}
            <form onSubmit={handleUploadDoc} className="p-4 bg-slate-50 border border-slate-200 rounded-lg mb-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">نوع الوثيقة</label>
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#E5E2D9] rounded-lg text-xs"
                  >
                    <option value="national_id">صورة الهوية الوطنية</option>
                    <option value="residence_id">صورة الإقامة</option>
                    <option value="medical_report">تقرير طبي</option>
                    <option value="housing_proof">عقد إيجار / إثبات سكن</option>
                    <option value="income_proof">مشهد دخل / ضمان</option>
                    <option value="other">وثيقة أخرى</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">اسم / وصف الوثيقة</label>
                  <input
                    type="text"
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                    placeholder="مثال: الهوية الوطنية للمستفيد"
                    className="w-full px-3 py-2 bg-white border border-[#E5E2D9] rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">اختر الملف (PDF, صور)</label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.docx"
                    onChange={(e) => setDocFile(e.target.files[0] || null)}
                    className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#3F6B3A]/10 file:text-[#3F6B3A] hover:file:bg-[#3F6B3A]/20"
                  />
                </div>
              </div>

              <div className="flex justify-end mt-3">
                <button
                  type="submit"
                  disabled={uploadingDoc || !docFile}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#C9A24A] hover:bg-[#B8923D] text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {uploadingDoc ? "جاري الرفع..." : "رفع الوثيقة"}
                </button>
              </div>
            </form>

            {/* Documents List */}
            {documents.length === 0 ? (
              <p className="text-center py-6 text-xs text-slate-400">لا توجد وثائق مرفقة لهذا المستفيد حتى الآن.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <div className="p-2 bg-amber-50 text-amber-700 rounded-lg shrink-0">
                        <FileCheck className="w-4 h-4" />
                      </div>
                      <div className="overflow-hidden">
                        <h4 className="text-xs font-bold text-slate-800 truncate">{doc.file_name}</h4>
                        <span className="text-[10px] text-slate-400">
                          {new Date(doc.created_at).toLocaleDateString("ar-SA")}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {doc.file_url && (
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                          title="عرض الوثيقة"
                        >
                          <Eye className="w-4 h-4" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => setDeleteDocTarget(doc)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                        title="حذف الوثيقة"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Document Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteDocTarget}
        title="تأكيد حذف الوثيقة"
        message={`هل أنت متأكد من حذف الوثيقة (${deleteDocTarget?.file_name})؟`}
        confirmText="حذف الوثيقة"
        cancelText="إلغاء"
        type="danger"
        onConfirm={handleDeleteDocConfirm}
        onCancel={() => setDeleteDocTarget(null)}
      />

      {/* Toast */}
      <Toast
        show={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, show: false })}
      />
    </MainLayout>
  );
}
