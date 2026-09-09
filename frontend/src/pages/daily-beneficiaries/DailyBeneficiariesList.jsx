import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import MainLayout from "../../components/layout/MainLayout";
import PageHeader from "../../components/ui/PageHeader";
import Button from "../../components/ui/Button";
import Dialog from "../../components/overlays/Dialog";
import ConfirmDialog from "../../components/overlays/ConfirmDialog";
import Toast from "../../components/ui/Toast";
import {
  getDailyBeneficiaries,
  deleteDailyBeneficiary,
  getReceivingHistory,
  getDailyInventory,
  createDailyReceivingTransaction,
} from "../../api/dailyBeneficiaries";
import {
  Users,
  UserPlus,
  FileSpreadsheet,
  Search,
  Eye,
  Edit,
  Trash2,
  Package,
  Calendar,
  History,
  CheckCircle2,
  AlertCircle,
  X,
  Printer,
  ChevronRight,
  ChevronLeft,
  Filter,
  RotateCcw,
} from "lucide-react";

export default function DailyBeneficiariesList() {
  const navigate = useNavigate();

  // Data & loading states
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [districts, setDistricts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0 });

  // Filters & search
  const [search, setSearch] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [lastDeliveryFrom, setLastDeliveryFrom] = useState("");
  const [lastDeliveryTo, setLastDeliveryTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Toast state
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // History modal
  const [historyTarget, setHistoryTarget] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Quick Receiving Modal
  const [receiveTarget, setReceiveTarget] = useState(null);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState("");
  const [receiveQuantity, setReceiveQuantity] = useState(1);
  const [receiveNotes, setReceiveNotes] = useState("");
  const [submittingReceive, setSubmittingReceive] = useState(false);
  const [createdVoucher, setCreatedVoucher] = useState(null);

  const fetchBeneficiaries = async (page = 1) => {
    try {
      setLoading(true);
      const params = {
        page,
        per_page: 15,
        search: search.trim() || undefined,
        district: selectedDistrict !== "all" ? selectedDistrict : undefined,
        category_id: selectedCategory !== "all" ? selectedCategory : undefined,
        status: selectedStatus !== "all" ? selectedStatus : undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        last_delivery_from: lastDeliveryFrom || undefined,
        last_delivery_to: lastDeliveryTo || undefined,
      };

      const res = await getDailyBeneficiaries(params);
      if (res.data?.success) {
        setBeneficiaries(res.data.data.data || []);
        setPagination({
          current_page: res.data.data.current_page,
          last_page: res.data.data.last_page,
          total: res.data.data.total,
        });
        if (res.data.districts) setDistricts(res.data.districts);
        if (res.data.categories) setCategories(res.data.categories);
      }
    } catch (err) {
      console.error(err);
      setToast({ show: true, message: "فشل في تحميل بيانات المستفيدين اليوميين", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBeneficiaries(1);
  }, [selectedDistrict, selectedCategory, selectedStatus, dateFrom, dateTo, lastDeliveryFrom, lastDeliveryTo]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchBeneficiaries(1);
  };

  const handleResetFilters = () => {
    setSearch("");
    setSelectedDistrict("all");
    setSelectedCategory("all");
    setSelectedStatus("all");
    setDateFrom("");
    setDateTo("");
    setLastDeliveryFrom("");
    setLastDeliveryTo("");
    fetchBeneficiaries(1);
  };

  // Open receiving history modal
  const openHistory = async (beneficiary) => {
    setHistoryTarget(beneficiary);
    setLoadingHistory(true);
    try {
      const res = await getReceivingHistory(beneficiary.id);
      if (res.data?.success) {
        setHistoryData(res.data.data?.data || []);
      }
    } catch (err) {
      setToast({ show: true, message: "تعذر جلب سجل الاستلامات", type: "error" });
    } finally {
      setLoadingHistory(false);
    }
  };

  // Open quick receiving modal
  const openQuickReceive = async (beneficiary) => {
    setReceiveTarget(beneficiary);
    setReceiveQuantity(1);
    setReceiveNotes("");
    setCreatedVoucher(null);
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

  // Submit quick receiving transaction
  const handleConfirmReceive = async () => {
    if (!selectedItem) {
      setToast({ show: true, message: "يرجى تحديد صنف أو سلة من المستودع", type: "error" });
      return;
    }

    setSubmittingReceive(true);
    try {
      const res = await createDailyReceivingTransaction({
        daily_beneficiary_id: receiveTarget.id,
        daily_inventory_item_id: selectedItem,
        quantity: parseInt(receiveQuantity, 10) || 1,
        notes: receiveNotes,
      });

      if (res.data?.success) {
        setCreatedVoucher(res.data.data);
        setToast({ show: true, message: res.data.message, type: "success" });
        fetchBeneficiaries(pagination.current_page);
      }
    } catch (err) {
      const msg = err.response?.data?.message || "حدث خطأ أثناء تسجيل عملية الاستلام";
      setToast({ show: true, message: msg, type: "error" });
    } finally {
      setSubmittingReceive(false);
    }
  };

  // Confirm delete
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await deleteDailyBeneficiary(deleteTarget.id);
      if (res.data?.success) {
        setToast({ show: true, message: res.data.message, type: "success" });
        setDeleteTarget(null);
        fetchBeneficiaries(pagination.current_page);
      }
    } catch (err) {
      setToast({ show: true, message: "فشل في حذف المستفيد", type: "error" });
    } finally {
      setDeleting(false);
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (beneficiaries.length === 0) {
      setToast({ show: true, message: "لا توجد بيانات متاحة للتصدير", type: "warning" });
      return;
    }

    const exportRows = beneficiaries.map((b, idx) => ({
      "#": idx + 1,
      "اسم المستفيد": b.full_name,
      "رقم الهوية / الإقامة": b.national_id,
      "رقم الجوال": b.phone,
      "الحي": b.district || "غير محدد",
      "الفئة": b.category_name || b.category?.name || "أسر متعففة",
      "مرات الاستلام": b.total_received_count || 0,
      "تاريخ آخر استلام": b.last_delivery_date ? new Date(b.last_delivery_date).toLocaleDateString("ar-SA") : "لم يستلم بعد",
      "تاريخ التسجيل": new Date(b.created_at).toLocaleDateString("ar-SA"),
      "الحالة": b.status === "active" ? "نشط" : "غير نشط",
      "ملاحظات": b.notes || "",
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    ws["!dir"] = "rtl";
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "المستفيدون اليوميون");
    XLSX.writeFile(wb, `قائمة_المستفيدين_اليوميين_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const selectedInventoryItemObj = useMemo(() => {
    return inventoryItems.find((i) => i.id === selectedItem);
  }, [inventoryItems, selectedItem]);

  return (
    <MainLayout>
      <div className="space-y-6" dir="rtl">
        {/* Page Header with Actions */}
        <PageHeader
          title="سجل المستفيدين اليوميين"
          subtitle="إدارة المستفيدين من المساعدات اليومية وتسجيل الاستلامات وتتبع الصرف الفوري"
          badge="الحالات الطارئة"
          breadcrumbs={[{ label: "المستفيدون اليوميون" }]}
          actions={
            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                variant="outline"
                size="sm"
                icon={FileSpreadsheet}
                onClick={handleExportExcel}
              >
                تصدير إكسل
              </Button>

              <Button
                variant="outline"
                size="sm"
                icon={Package}
                onClick={() => navigate("/daily-beneficiaries/receiving")}
              >
                شاشة الاستلام والتسليم
              </Button>

              <Button
                variant="primary"
                size="sm"
                icon={UserPlus}
                onClick={() => navigate("/daily-beneficiaries/add")}
              >
                إضافة مستفيد جديد
              </Button>
            </div>
          }
        />

        {/* Filter Card */}
        <div className="bg-white border border-[#E5E2D9] rounded-2xl p-4 shadow-xs">
          <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-5 h-5 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ابحث بالاسم الرباعي، رقم الهوية/الإقامة، أو رقم الجوال..."
                  className="w-full pl-4 pr-11 py-2.5 bg-white border border-[#E5E2D9] rounded-lg text-sm focus:outline-none focus:border-[#3F6B3A] focus:ring-1 focus:ring-[#3F6B3A]"
                />
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <button
                  type="submit"
                  className="flex-1 md:flex-initial px-5 py-2.5 bg-[#3F6B3A] text-white text-sm font-semibold rounded-lg hover:bg-[#345830] transition-colors"
                >
                  بحث
                </button>

                <button
                  type="button"
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg text-sm font-medium transition-colors ${
                    showFilters || selectedDistrict !== "all" || selectedStatus !== "all"
                      ? "bg-[#F5EDDA] border-[#C9A24A] text-[#8C6C26]"
                      : "bg-white border-[#E5E2D9] text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <Filter className="w-4 h-4" />
                  <span>تصفية</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetFilters}
                  title="إعادة تعيين"
                  className="p-2.5 bg-white border border-[#E5E2D9] text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </form>

            {/* Expanded Filters Drawer */}
            {showFilters && (
              <div className="mt-4 p-4 bg-white border border-[#E5E2D9] rounded-lg grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in duration-200">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">الحي السكني</label>
                  <select
                    value={selectedDistrict}
                    onChange={(e) => setSelectedDistrict(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-[#E5E2D9] rounded-lg text-sm focus:outline-none focus:border-[#3F6B3A]"
                  >
                    <option value="all">جميع الأحياء</option>
                    {districts.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">الفئة</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-[#E5E2D9] rounded-lg text-sm focus:outline-none focus:border-[#3F6B3A]"
                  >
                    <option value="all">جميع الفئات</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">الحالة</label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-[#E5E2D9] rounded-lg text-sm focus:outline-none focus:border-[#3F6B3A]"
                  >
                    <option value="all">الكل</option>
                    <option value="active">نشط</option>
                    <option value="inactive">غير نشط</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">تاريخ التسجيل (من)</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-[#E5E2D9] rounded-lg text-sm focus:outline-none focus:border-[#3F6B3A]"
                  />
                </div>
              </div>
            )}
          </div>

        {/* Data Table */}
        <div className="bg-white border border-[#E5E2D9] rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-[#FAF8F5] text-slate-700 text-xs font-bold border-b border-[#E5E2D9]">
                  <th className="py-3.5 px-4">اسم المستفيد</th>
                  <th className="py-3.5 px-4">رقم الجوال</th>
                  <th className="py-3.5 px-4">الهوية / الإقامة</th>
                  <th className="py-3.5 px-4">الحي</th>
                  <th className="py-3.5 px-4">الفئة</th>
                  <th className="py-3.5 px-4 text-center">مرات الاستلام</th>
                  <th className="py-3.5 px-4 text-center">آخر استلام</th>
                  <th className="py-3.5 px-4 text-center">الحالة</th>
                  <th className="py-3.5 px-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan="9" className="py-12 text-center text-slate-400">
                      <div className="w-8 h-8 border-3 border-[#3F6B3A] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      جاري تحميل بيانات المستفيدين اليوميين...
                    </td>
                  </tr>
                ) : beneficiaries.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="py-12 text-center text-slate-400">
                      لا يوجد مستفيدون يوميون يطابقون شروط البحث الحالية.
                    </td>
                  </tr>
                ) : (
                  beneficiaries.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-800">
                        <Link to={`/daily-beneficiaries/${b.id}`} className="hover:text-[#3F6B3A] hover:underline">
                          {b.full_name}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-mono text-xs" dir="ltr">
                        {b.phone}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 font-mono text-xs">
                        {b.national_id}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {b.district || "غير محدد"}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 text-xs">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md">
                          {b.category_name || b.category?.name || "أسر متعففة"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#EBF4EA] text-[#2E5A27]">
                          {b.total_received_count || 0}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center text-xs text-slate-500">
                        {b.last_delivery_date
                          ? new Date(b.last_delivery_date).toLocaleDateString("ar-SA")
                          : "لم يستلم بعد"}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            b.status === "active"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}
                        >
                          {b.status === "active" ? "نشط" : "غير نشط"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Quick Receive Button */}
                          <button
                            onClick={() => openQuickReceive(b)}
                            title="تسجيل استلام مساعدة فوري"
                            className="p-1.5 text-[#3F6B3A] hover:bg-[#EBF4EA] rounded-lg transition-colors"
                          >
                            <Package className="w-4 h-4" />
                          </button>

                          {/* History */}
                          <button
                            onClick={() => openHistory(b)}
                            title="سجل استلامات المستفيد"
                            className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          >
                            <History className="w-4 h-4" />
                          </button>

                          {/* Details */}
                          <Link
                            to={`/daily-beneficiaries/${b.id}`}
                            title="عرض ملف المستفيد"
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>

                          {/* Edit */}
                          <Link
                            to={`/daily-beneficiaries/${b.id}/edit`}
                            title="تعديل البيانات"
                            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </Link>

                          {/* Delete */}
                          <button
                            onClick={() => setDeleteTarget(b)}
                            title="حذف المستفيد"
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.last_page > 1 && (
            <div className="p-4 border-t border-[#E5E2D9] flex items-center justify-between">
              <span className="text-xs text-slate-500">
                إجمالي المستفيدين: <strong className="text-slate-800">{pagination.total}</strong> (صفحة {pagination.current_page} من {pagination.last_page})
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={pagination.current_page <= 1}
                  onClick={() => fetchBeneficiaries(pagination.current_page - 1)}
                  className="p-2 border border-[#E5E2D9] rounded-lg text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  disabled={pagination.current_page >= pagination.last_page}
                  onClick={() => fetchBeneficiaries(pagination.current_page + 1)}
                  className="p-2 border border-[#E5E2D9] rounded-lg text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="تأكيد حذف المستفيد اليومي"
        message={`هل أنت متأكد من رغبتك في حذف المستفيد (${deleteTarget?.full_name})؟ سيتم الاحتفاظ بسجل استلاماته التاريخية لضمان دقة الرقابة المالية والإحصائية.`}
        confirmText="تأكيد الحذف"
        cancelText="إلغاء"
        type="danger"
        isLoading={deleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Quick Receiving Modal */}
      <Dialog
        isOpen={!!receiveTarget}
        onClose={() => setReceiveTarget(null)}
        title="تسجيل استلام مساعدة للمستفيد اليومي"
        maxWidth="max-w-xl"
      >
        {receiveTarget && (
          <div className="space-y-4">
            {createdVoucher ? (
              <div className="p-4 bg-[#EBF4EA] border border-[#3F6B3A]/30 rounded-xl space-y-3 text-center">
                <CheckCircle2 className="w-12 h-12 text-[#3F6B3A] mx-auto" />
                <h3 className="font-bold text-slate-800 text-base">تم تسجيل الاستلام بنجاح!</h3>
                <p className="text-xs text-slate-600">
                  تم إصدار سند الاستلام برقم: <strong className="text-[#8C6C26] font-mono text-sm">{createdVoucher.document_number}</strong>
                </p>
                <div className="pt-2 flex justify-center gap-3">
                  <a
                    href={`http://127.0.0.1:8000/api/documents/daily-receiving/${createdVoucher.id}/pdf`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-[#C9A24A] hover:bg-[#B8923D] text-white rounded-lg text-xs font-bold transition-colors"
                  >
                    <Printer className="w-4 h-4" />
                    طباعة سند الاستلام (PDF)
                  </a>
                  <button
                    onClick={() => setReceiveTarget(null)}
                    className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-medium"
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                  <div><strong>اسم المستفيد:</strong> {receiveTarget.full_name}</div>
                  <div><strong>رقم الهوية:</strong> {receiveTarget.national_id} | <strong>الحي:</strong> {receiveTarget.district}</div>
                  <div><strong>مرات الاستلام السابقة:</strong> {receiveTarget.total_received_count || 0} مرات</div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    حدد سلة الدعم / الصنف من مستودع اليوميين *
                  </label>
                  <select
                    value={selectedItem}
                    onChange={(e) => setSelectedItem(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#E5E2D9] rounded-lg text-sm focus:outline-none focus:border-[#3F6B3A]"
                  >
                    {inventoryItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} (المتوفر: {item.current_quantity} {item.unit})
                      </option>
                    ))}
                  </select>
                  {selectedInventoryItemObj && (
                    <p className="text-[11px] text-slate-500 mt-1">
                      الكمية المتوفرة حالياً في المستودع:{" "}
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ملاحظات على الاستلام (اختياري)</label>
                  <textarea
                    rows="2"
                    value={receiveNotes}
                    onChange={(e) => setReceiveNotes(e.target.value)}
                    placeholder="تم التسليم يداً بيد بمقر الجمعية..."
                    className="w-full px-3 py-2 bg-white border border-[#E5E2D9] rounded-lg text-sm focus:outline-none focus:border-[#3F6B3A]"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setReceiveTarget(null)}
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
                    {submittingReceive ? "جاري التأكيد والخصم..." : "تأكيد الاستلام وخصم المخزون"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </Dialog>

      {/* Receiving History Drawer / Dialog */}
      <Dialog
        isOpen={!!historyTarget}
        onClose={() => setHistoryTarget(null)}
        title={`سجل استلامات المستفيد: ${historyTarget?.full_name || ""}`}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          {loadingHistory ? (
            <div className="py-8 text-center text-slate-400">جاري تحميل سجل الاستلامات...</div>
          ) : historyData.length === 0 ? (
            <div className="py-8 text-center text-slate-400">لا توجد عمليات استلام مسجلة لهذا المستفيد حتى الآن.</div>
          ) : (
            <div className="overflow-x-auto max-h-96 border rounded-lg">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 font-bold border-b">
                    <th className="p-2.5">رقم السند</th>
                    <th className="p-2.5">السلة المستلمة</th>
                    <th className="p-2.5 text-center">الكمية</th>
                    <th className="p-2.5">التاريخ والوقت</th>
                    <th className="p-2.5">الموظف المعتمد</th>
                    <th className="p-2.5 text-center">سند PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {historyData.map((h) => (
                    <tr key={h.id} className="hover:bg-slate-50">
                      <td className="p-2.5 font-bold font-mono text-[#8C6C26]">{h.document_number}</td>
                      <td className="p-2.5 font-semibold text-slate-800">{h.basket_type_name}</td>
                      <td className="p-2.5 text-center font-bold text-[#2E5A27]">{h.quantity}</td>
                      <td className="p-2.5 text-slate-500">
                        {new Date(h.receiving_date).toLocaleString("ar-SA")}
                      </td>
                      <td className="p-2.5 text-slate-600">{h.authorized_user?.full_name || "النظام"}</td>
                      <td className="p-2.5 text-center">
                        <a
                          href={`http://127.0.0.1:8000/api/documents/daily-receiving/${h.id}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded text-[11px] font-bold"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          طباعة
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              onClick={() => setHistoryTarget(null)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
            >
              إغلاق
            </button>
          </div>
        </div>
      </Dialog>

      {/* Toast Notification */}
      <Toast
        show={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, show: false })}
      />
    </MainLayout>
  );
}
