import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import MainLayout from "../../components/layout/MainLayout";
import Dialog from "../../components/overlays/Dialog";
import ConfirmDialog from "../../components/overlays/ConfirmDialog";
import Toast from "../../components/ui/Toast";
import PageHeader from "../../components/ui/PageHeader";
import Button from "../../components/ui/Button";
import {
  getDailyBeneficiary,
  deleteDailyBeneficiary,
  uploadDocument,
  deleteDocument,
  getDailyInventory,
  createDailyReceivingTransaction,
} from "../../api/dailyBeneficiaries";
import {
  ArrowRight,
  User,
  Phone,
  CreditCard,
  MapPin,
  Calendar,
  Package,
  History,
  FileText,
  Edit,
  Trash2,
  Printer,
  CheckCircle2,
  Plus,
  Clock,
  Eye,
  Download,
  AlertCircle,
  FileCheck,
} from "lucide-react";

export default function DailyBeneficiaryDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [beneficiary, setBeneficiary] = useState(null);
  const [loading, setLoading] = useState(true);

  // Toast
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  // Delete modal
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Receiving Modal
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState("");
  const [receiveQuantity, setReceiveQuantity] = useState(1);
  const [receiveNotes, setReceiveNotes] = useState("");
  const [submittingReceive, setSubmittingReceive] = useState(false);
  const [createdVoucher, setCreatedVoucher] = useState(null);

  // Document upload modal
  const [showDocModal, setShowDocModal] = useState(false);
  const [docFile, setDocFile] = useState(null);
  const [docType, setDocType] = useState("national_id");
  const [docTitle, setDocTitle] = useState("");
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const fetchDetails = async () => {
    try {
      setLoading(true);
      const res = await getDailyBeneficiary(id);
      if (res.data?.success) {
        setBeneficiary(res.data.data);
      }
    } catch (err) {
      setToast({ show: true, message: "فشل في تحميل تفاصيل المستفيد اليومي", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [id]);

  // Open Receive modal
  const openReceiveModal = async () => {
    setShowReceiveModal(true);
    setCreatedVoucher(null);
    setReceiveQuantity(1);
    setReceiveNotes("");
    try {
      const res = await getDailyInventory({ status: "available" });
      if (res.data?.success) {
        const items = res.data.data || [];
        setInventoryItems(items);
        if (items.length > 0) setSelectedItem(items[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Confirm receive
  const handleConfirmReceive = async () => {
    if (!selectedItem) {
      setToast({ show: true, message: "يرجى تحديد السلة أو المادة من المستودع", type: "error" });
      return;
    }

    setSubmittingReceive(true);
    try {
      const res = await createDailyReceivingTransaction({
        daily_beneficiary_id: beneficiary.id,
        daily_inventory_item_id: selectedItem,
        quantity: parseInt(receiveQuantity, 10) || 1,
        notes: receiveNotes,
      });

      if (res.data?.success) {
        setCreatedVoucher(res.data.data);
        setToast({ show: true, message: res.data.message, type: "success" });
        fetchDetails();
      }
    } catch (err) {
      const msg = err.response?.data?.message || "حدث خطأ أثناء تسجيل الاستلام";
      setToast({ show: true, message: msg, type: "error" });
    } finally {
      setSubmittingReceive(false);
    }
  };

  // Handle Document upload
  const handleUploadDoc = async (e) => {
    e.preventDefault();
    if (!docFile) {
      setToast({ show: true, message: "يرجى اختيار ملف", type: "warning" });
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
        setToast({ show: true, message: "تم رفع الوثيقة بنجاح", type: "success" });
        setShowDocModal(false);
        setDocFile(null);
        setDocTitle("");
        fetchDetails();
      }
    } catch (err) {
      setToast({ show: true, message: "فشل في رفع الوثيقة", type: "error" });
    } finally {
      setUploadingDoc(false);
    }
  };

  // Delete Beneficiary
  const handleDeleteBeneficiary = async () => {
    setDeleting(true);
    try {
      const res = await deleteDailyBeneficiary(id);
      if (res.data?.success) {
        setToast({ show: true, message: res.data.message, type: "success" });
        setTimeout(() => navigate("/daily-beneficiaries"), 1000);
      }
    } catch (err) {
      setToast({ show: true, message: "فشل في حذف المستفيد", type: "error" });
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <MainLayout title="تحميل ملف المستفيد...">
        <div className="py-20 text-center text-slate-400">
          <div className="w-10 h-10 border-4 border-[#3F6B3A] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          جاري تحميل ملف المستفيد اليومي...
        </div>
      </MainLayout>
    );
  }

  if (!beneficiary) {
    return (
      <MainLayout title="المستفيد غير موجود">
        <div className="py-16 text-center text-slate-500">
          لم يتم العثور على المستفيد اليومي المطلوب.
          <div className="mt-4">
            <Link to="/daily-beneficiaries" className="text-[#3F6B3A] font-bold hover:underline">
              العودة لقائمة المستفيدين اليوميين
            </Link>
          </div>
        </div>
      </MainLayout>
    );
  }

  const selectedInventoryItemObj = inventoryItems.find((i) => i.id === selectedItem);

  return (
    <MainLayout title={`ملف المستفيد اليومي: ${beneficiary.full_name}`}>
      <div className="space-y-6">
        {/* Top Header & Actions */}
        <PageHeader
          title={`ملف المستفيد: ${beneficiary.full_name}`}
          subtitle={`رقم الهوية: ${beneficiary.national_id} | الفئة: ${beneficiary.category?.name || "عام"} | الحي: ${beneficiary.district || "—"}`}
          badge={{
            text: beneficiary.status === "active" ? "نشط ومؤهل" : "غير نشط",
            variant: beneficiary.status === "active" ? "success" : "neutral"
          }}
          breadcrumbs={[
            { label: "الرئيسية", href: "/" },
            { label: "المستفيدين اليوميين", href: "/daily-beneficiaries" },
            { label: beneficiary.full_name }
          ]}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon={Package}
                onClick={openReceiveModal}
              >
                تسجيل استلام مساعدة
              </Button>

              <Button
                variant="gold"
                size="sm"
                icon={Plus}
                onClick={() => setShowDocModal(true)}
              >
                إرفاق وثيقة
              </Button>

              <Button
                variant="outline"
                size="sm"
                icon={Edit}
                as={Link}
                to={`/daily-beneficiaries/${beneficiary.id}/edit`}
              >
                تعديل
              </Button>

              <Button
                variant="dangerOutline"
                size="sm"
                icon={Trash2}
                onClick={() => setShowDelete(true)}
              >
                حذف
              </Button>
            </div>
          }
        />

        {/* Profile Card & KPIs Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info Card */}
          <div className="lg:col-span-2 bg-white border border-[#E5E2D9] rounded-xl shadow-sm p-6 space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-[#E5E2D9]">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#3F6B3A]/10 text-[#3F6B3A] flex items-center justify-center font-bold text-lg">
                  {beneficiary.full_name.charAt(0)}
                </div>
                <div>
                  <h1 className="text-lg font-bold text-slate-800">{beneficiary.full_name}</h1>
                  <span className="text-xs text-slate-500">
                    رقم الهوية: <strong className="text-slate-700 font-mono">{beneficiary.national_id}</strong>
                  </span>
                </div>
              </div>

              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                  beneficiary.status === "active"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-slate-100 text-slate-600 border border-slate-200"
                }`}
              >
                {beneficiary.status === "active" ? "مستفيد نشط" : "غير نشط"}
              </span>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                <Phone className="w-4 h-4 text-slate-400" />
                <div>
                  <span className="text-slate-400 block">رقم الجوال:</span>
                  <strong className="text-slate-800 font-mono text-sm" dir="ltr">{beneficiary.phone}</strong>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                <MapPin className="w-4 h-4 text-slate-400" />
                <div>
                  <span className="text-slate-400 block">الحي السكني:</span>
                  <strong className="text-slate-800 text-sm">{beneficiary.district || "غير محدد"}</strong>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                <Calendar className="w-4 h-4 text-slate-400" />
                <div>
                  <span className="text-slate-400 block">تاريخ الميلاد:</span>
                  <strong className="text-slate-800">
                    {beneficiary.date_of_birth ? new Date(beneficiary.date_of_birth).toLocaleDateString("ar-SA") : "غير مسجل"}
                  </strong>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                <User className="w-4 h-4 text-slate-400" />
                <div>
                  <span className="text-slate-400 block">الفئة المستهدفة:</span>
                  <strong className="text-slate-800">{beneficiary.category_name || beneficiary.category?.name || "أسر متعففة"}</strong>
                </div>
              </div>
            </div>

            {beneficiary.notes && (
              <div className="p-3.5 bg-amber-50/50 border border-amber-200/60 rounded-lg text-xs">
                <strong className="text-amber-800 block mb-1">ملاحظات الحالة الاجتماعية:</strong>
                <p className="text-slate-700 leading-relaxed">{beneficiary.notes}</p>
              </div>
            )}
          </div>

          {/* Assistance Statistics KPI Card */}
          <div className="bg-[#FAF8F5] border border-[#E5E2D9] rounded-xl shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-800 text-sm pb-3 border-b border-[#E5E2D9] flex items-center gap-2">
              <Package className="w-4 h-4 text-[#3F6B3A]" />
              ملخص المساعدات المستلمة
            </h3>

            <div className="space-y-3">
              <div className="p-4 bg-white border border-[#E5E2D9] rounded-lg text-center">
                <span className="text-xs text-slate-500 block">إجمالي مرات الاستلام</span>
                <strong className="text-2xl font-bold text-[#2E5A27]">{beneficiary.total_received_count || 0}</strong>
                <span className="text-[11px] text-slate-400 block mt-0.5">عمليات استلام مسجلة</span>
              </div>

              <div className="p-4 bg-white border border-[#E5E2D9] rounded-lg text-center">
                <span className="text-xs text-slate-500 block">تاريخ آخر استلام</span>
                <strong className="text-sm font-bold text-slate-800 mt-1 block">
                  {beneficiary.last_delivery_date
                    ? new Date(beneficiary.last_delivery_date).toLocaleDateString("ar-SA")
                    : "لم يستلم بعد"}
                </strong>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  {beneficiary.last_delivery_date
                    ? new Date(beneficiary.last_delivery_date).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })
                    : "-"}
                </span>
              </div>

              <div className="p-4 bg-white border border-[#E5E2D9] rounded-lg text-center">
                <span className="text-xs text-slate-500 block">تاريخ التسجيل بالنظام</span>
                <strong className="text-xs font-bold text-slate-700 mt-1 block">
                  {new Date(beneficiary.created_at).toLocaleDateString("ar-SA")}
                </strong>
              </div>
            </div>
          </div>
        </div>

        {/* Assistance Receiving History Table */}
        <div className="bg-white border border-[#E5E2D9] rounded-xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-[#E5E2D9] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-[#C9A24A]" />
              <h2 className="font-bold text-slate-800 text-base">سجل استلامات المساعدات الغذائية</h2>
            </div>
            <span className="text-xs text-slate-500">
              عدد السجلات: <strong>{beneficiary.receiving_transactions?.length || 0}</strong>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-[#FAF8F5] text-slate-700 font-bold border-b border-[#E5E2D9]">
                  <th className="py-3 px-4">رقم السند</th>
                  <th className="py-3 px-4">السلة / المادة الغذائية</th>
                  <th className="py-3 px-4 text-center">الكمية</th>
                  <th className="py-3 px-4">تاريخ ووقت الاستلام</th>
                  <th className="py-3 px-4">الموظف المعتمد للصرف</th>
                  <th className="py-3 px-4">ملاحظات</th>
                  <th className="py-3 px-4 text-center">سند الاستلام</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!beneficiary.receiving_transactions || beneficiary.receiving_transactions.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-10 text-center text-slate-400 text-sm">
                      لم يتم تسجيل أي عمليات استلام مساعدة لهذا المستفيد حتى الآن.
                    </td>
                  </tr>
                ) : (
                  beneficiary.receiving_transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-[#8C6C26]">{tx.document_number}</td>
                      <td className="py-3 px-4 font-bold text-slate-800">{tx.basket_type_name}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 bg-[#EBF4EA] text-[#2E5A27] font-bold rounded">
                          {tx.quantity} {tx.inventory_item?.unit || "سلة"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {new Date(tx.receiving_date).toLocaleString("ar-SA")}
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        {tx.authorized_user?.full_name || "مدير النظام"}
                      </td>
                      <td className="py-3 px-4 text-slate-500 max-w-xs truncate">
                        {tx.notes || "-"}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <a
                          href={`http://127.0.0.1:8000/api/documents/daily-receiving/${tx.id}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#F5EDDA] text-[#8C6C26] hover:bg-[#ECE0C4] rounded-lg text-xs font-bold transition-colors"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          طباعة السند
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Uploaded Documents Gallery */}
        <div className="bg-white border border-[#E5E2D9] rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#E5E2D9]">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#3F6B3A]" />
              <h3 className="font-bold text-slate-800 text-base">الوثائق والمرفقات المعتمدة</h3>
            </div>
            <button
              onClick={() => setShowDocModal(true)}
              className="flex items-center gap-1 text-xs font-bold text-[#3F6B3A] hover:underline"
            >
              <Plus className="w-3.5 h-3.5" />
              إضافة وثيقة جديدة
            </button>
          </div>

          {!beneficiary.documents || beneficiary.documents.length === 0 ? (
            <p className="text-center py-6 text-xs text-slate-400">لا توجد وثائق مرفقة للمستفيد.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {beneficiary.documents.map((doc) => (
                <div
                  key={doc.id}
                  className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors flex flex-col justify-between"
                >
                  <div className="flex items-start gap-2.5 mb-3">
                    <div className="p-2 bg-white text-[#3F6B3A] rounded border border-slate-200">
                      <FileCheck className="w-5 h-5" />
                    </div>
                    <div className="overflow-hidden">
                      <h4 className="text-xs font-bold text-slate-800 truncate">{doc.file_name}</h4>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        {new Date(doc.created_at).toLocaleDateString("ar-SA")}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                    {doc.file_url && (
                      <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline font-semibold"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        عرض
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Receive Modal */}
      <Dialog
        isOpen={showReceiveModal}
        onClose={() => setShowReceiveModal(false)}
        title="تسجيل استلام مساعدة غذائية للمستفيد"
        maxWidth="max-w-lg"
      >
        <div className="space-y-4">
          {createdVoucher ? (
            <div className="p-4 bg-[#EBF4EA] border border-[#3F6B3A]/30 rounded-xl space-y-3 text-center">
              <CheckCircle2 className="w-12 h-12 text-[#3F6B3A] mx-auto" />
              <h3 className="font-bold text-slate-800 text-base">تم تسجيل الاستلام بنجاح!</h3>
              <p className="text-xs text-slate-600">
                رقم سند الاستلام: <strong className="text-[#8C6C26] font-mono text-sm">{createdVoucher.document_number}</strong>
              </p>
              <div className="pt-2 flex justify-center gap-3">
                <a
                  href={`http://127.0.0.1:8000/api/documents/daily-receiving/${createdVoucher.id}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-[#C9A24A] hover:bg-[#B8923D] text-white rounded-lg text-xs font-bold transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  طباعة سند الاستلام
                </a>
                <button
                  onClick={() => setShowReceiveModal(false)}
                  className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-medium"
                >
                  إغلاق
                </button>
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  اختر السلة / الصنف من مستودع اليوميين *
                </label>
                <select
                  value={selectedItem}
                  onChange={(e) => setSelectedItem(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#E5E2D9] rounded-lg text-sm focus:outline-none focus:border-[#3F6B3A]"
                >
                  {inventoryItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} (المتاح بالمستودع: {item.current_quantity} {item.unit})
                    </option>
                  ))}
                </select>
                {selectedInventoryItemObj && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    الكمية المتوفرة حالياً:{" "}
                    <strong className="text-emerald-700">
                      {selectedInventoryItemObj.current_quantity} {selectedInventoryItemObj.unit}
                    </strong>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">الكمية المصروفة *</label>
                <input
                  type="number"
                  min="1"
                  max={selectedInventoryItemObj?.current_quantity || 1}
                  value={receiveQuantity}
                  onChange={(e) => setReceiveQuantity(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#E5E2D9] rounded-lg text-sm focus:outline-none focus:border-[#3F6B3A]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ملاحظات (اختياري)</label>
                <textarea
                  rows="2"
                  value={receiveNotes}
                  onChange={(e) => setReceiveNotes(e.target.value)}
                  placeholder="ملاحظات التسليم..."
                  className="w-full px-3 py-2 bg-white border border-[#E5E2D9] rounded-lg text-sm focus:outline-none focus:border-[#3F6B3A]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowReceiveModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-50"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  disabled={submittingReceive || !selectedItem}
                  onClick={handleConfirmReceive}
                  className="px-5 py-2 bg-[#3F6B3A] hover:bg-[#345830] text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                >
                  {submittingReceive ? "جاري التأكيد..." : "تأكيد الاستلام وخصم المخزون"}
                </button>
              </div>
            </>
          )}
        </div>
      </Dialog>

      {/* Document Upload Modal */}
      <Dialog
        isOpen={showDocModal}
        onClose={() => setShowDocModal(false)}
        title="إرفاق وثيقة جديدة للمستفيد"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleUploadDoc} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">نوع الوثيقة</label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-[#E5E2D9] rounded-lg text-xs focus:outline-none focus:border-[#3F6B3A]"
            >
              <option value="national_id">صورة الهوية الوطنية</option>
              <option value="residence_id">صورة الإقامة</option>
              <option value="medical_report">تقرير طبي</option>
              <option value="housing_proof">إثبات سكن / عقد إيجار</option>
              <option value="income_proof">مشهد دخل / ضمان</option>
              <option value="other">وثيقة أخرى</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">اسم الوثيقة</label>
            <input
              type="text"
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              placeholder="مثال: الهوية الوطنية للمستفيد"
              className="w-full px-3 py-2 bg-white border border-[#E5E2D9] rounded-lg text-xs focus:outline-none focus:border-[#3F6B3A]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">الملف (PDF أو صورة)</label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.docx"
              onChange={(e) => setDocFile(e.target.files[0] || null)}
              className="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#3F6B3A]/10 file:text-[#3F6B3A]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowDocModal(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-medium"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={uploadingDoc || !docFile}
              className="px-5 py-2 bg-[#3F6B3A] text-white rounded-lg text-xs font-bold disabled:opacity-50"
            >
              {uploadingDoc ? "جاري الرفع..." : "رفع وحفظ الوثيقة"}
            </button>
          </div>
        </form>
      </Dialog>

      {/* Delete Beneficiary Confirm Dialog */}
      <ConfirmDialog
        isOpen={showDelete}
        title="تأكيد حذف المستفيد اليومي"
        message={`هل أنت متأكد من رغبتك في حذف ملف (${beneficiary.full_name})؟ سيبقى أرشيف استلاماته محفوظاً ومحمياً في قاعدة البيانات.`}
        confirmText="تأكيد الحذف"
        cancelText="إلغاء"
        type="danger"
        isLoading={deleting}
        onConfirm={handleDeleteBeneficiary}
        onCancel={() => setShowDelete(false)}
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
