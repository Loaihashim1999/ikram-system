import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { hasModuleAction } from "../../utils/modulePermissions";
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
  UserPlus,
  FileSpreadsheet,
  Search,
  Eye,
  Edit,
  Trash2,
  Package,
  History,
  CheckCircle2,
  Printer,
  ChevronRight,
  ChevronLeft,
  Filter,
  RotateCcw,
} from "lucide-react";
import { exportApiDataToExcel } from "../../utils/excelExport";
import { getDocumentPdfUrl } from "../../utils/documentUrl";

const classificationLabel = (row) => {
  if (row?.beneficiary_type === "citizen") return "مواطن";
  if (row?.beneficiary_type === "resident") return "مقيم";
  return "—";
};

export default function DailyBeneficiariesList({ embedded = false }) {
  const navigate = useNavigate();
  const auth = useAuth();
  const user = auth?.user ?? null;
  const canDaily = (action) => hasModuleAction(user, "daily_beneficiaries", action);

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
  const [selectedType, setSelectedType] = useState("all");
  const [nationality, setNationality] = useState("");
  const [nationalityMissing, setNationalityMissing] = useState(false);
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
        beneficiary_type: selectedType !== "all" ? selectedType : undefined,
        nationality: nationalityMissing ? undefined : (nationality.trim() || undefined),
        nationality_missing: nationalityMissing ? 1 : undefined,
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
  }, [selectedDistrict, selectedCategory, selectedStatus, selectedType, nationality, nationalityMissing, dateFrom, dateTo, lastDeliveryFrom, lastDeliveryTo]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchBeneficiaries(1);
  };

  const handleResetFilters = () => {
    setSearch("");
    setSelectedDistrict("all");
    setSelectedCategory("all");
    setSelectedStatus("all");
    setSelectedType("all");
    setNationality("");
    setNationalityMissing(false);
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

  // Export ALL records matching current filters to Excel
  const handleExportExcel = async () => {
    try {
      setToast({ show: true, message: "جاري استخراج وتصدير جميع السجلات المطابقة للتصفية...", type: "info" });
      const params = {
        search: search.trim() || undefined,
        district: selectedDistrict !== "all" ? selectedDistrict : undefined,
        beneficiary_type: selectedType !== "all" ? selectedType : undefined,
        nationality: nationalityMissing ? undefined : (nationality.trim() || undefined),
        nationality_missing: nationalityMissing ? 1 : undefined,
        category_id: selectedCategory !== "all" ? selectedCategory : undefined,
        status: selectedStatus !== "all" ? selectedStatus : undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        last_delivery_from: lastDeliveryFrom || undefined,
        last_delivery_to: lastDeliveryTo || undefined,
      };

      const count = await exportApiDataToExcel({
        endpoint: "/daily-beneficiaries",
        params,
        filename: "ikram-daily-beneficiaries",
        sheetName: "المستفيدون اليوميون",
        transform: (b, idx) => ({
          "#": idx + 1,
          "اسم المستفيد": b.full_name,
          "التصنيف": classificationLabel(b),
          "الجنسية": b.nationality?.trim() || "—",
          "رقم الهوية / الإقامة": b.national_id,
          "رقم الجوال": b.phone,
          "الحي": b.district || "غير محدد",
          "تاريخ التسجيل": b.created_at ? String(b.created_at).slice(0, 10) : "—",
          "الفئة": b.category_name || b.category?.name || "أسر متعففة",
          "مرات الاستلام": b.total_received_count || 0,
          "تاريخ آخر استلام": b.last_delivery_date ? b.last_delivery_date.slice(0, 10) : "لم يستلم بعد",
          "الحالة": b.status === "active" ? "نشط" : "غير نشط",
          "ملاحظات": b.notes || "",
        }),
      });

      setToast({ show: true, message: `تم تصدير ${count} مستفيد بنجاح إلى ملف إكسل.`, type: "success" });
    } catch (err) {
      setToast({ show: true, message: err.message || "فشل تصدير ملف الإكسل", type: "error" });
    }
  };

  const selectedInventoryItemObj = useMemo(() => {
    return inventoryItems.find((i) => i.id === selectedItem);
  }, [inventoryItems, selectedItem]);

  const mainContent = (
    <div className="space-y-6" dir="rtl">
      {/* Page Header with Actions (only if standalone) */}
      {!embedded && (
        <PageHeader
          title="سجل المستفيدين اليوميين"
          subtitle="إدارة المستفيدين من المساعدات اليومية وتسجيل الاستلامات وتتبع الصرف الفوري"
          badge="الحالات الطارئة"
          breadcrumbs={[{ label: "المستفيدون اليوميون" }]}
          actions={
            <div className="flex flex-wrap items-center gap-2.5">
              {canDaily("export") && <Button
                variant="outline"
                size="sm"
                icon={FileSpreadsheet}
                onClick={handleExportExcel}
              >
                تصدير إكسل
              </Button>}

              {canDaily("create") && <Link to="/daily-beneficiaries/add">
                <Button variant="primary" size="sm" icon={UserPlus}>
                  إضافة مستفيد جديد
                </Button>
              </Link>}
            </div>
          }
        />
      )}

        {/* Filter Card */}
        <div className="ikram-panel p-4">
          <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-5 h-5 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ابحث بالاسم الرباعي، رقم الهوية/الإقامة، أو رقم الجوال..."
                  className="ikram-control pl-4 pr-11"
                />
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <button
                  type="submit"
                  className="flex-1 md:flex-initial px-5 py-2.5 bg-[var(--color-brand-green)] text-white text-sm font-semibold rounded-lg hover:bg-[#345830] transition-colors"
                >
                  بحث
                </button>

                <button
                  type="button"
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg text-sm font-medium transition-colors ${
                    showFilters || selectedDistrict !== "all" || selectedStatus !== "all" || selectedType !== "all" || nationalityMissing || nationality.trim()
                      ? "bg-[var(--color-bg-soft)] border-[var(--color-brand-gold)] text-[#8C6C26]"
                      : "bg-white border-[var(--color-border)] text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <Filter className="w-4 h-4" />
                  <span>تصفية</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetFilters}
                  title="إعادة تعيين"
                  className="p-2.5 bg-white border border-[var(--color-border)] text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </form>

            {/* Expanded Filters Drawer */}
            {showFilters && (
              <div className="mt-4 p-4 bg-white border border-[var(--color-border)] rounded-lg grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in duration-200">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">التصنيف</label>
                  <select
                    aria-label="التصنيف"
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-brand-green)]"
                  >
                    <option value="all">الكل</option>
                    <option value="citizen">مواطن</option>
                    <option value="resident">مقيم</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">الجنسية</label>
                  <input
                    aria-label="الجنسية"
                    type="text"
                    value={nationality}
                    onChange={(e) => setNationality(e.target.value)}
                    disabled={nationalityMissing}
                    placeholder="الجنسية"
                    className="w-full px-3 py-2 bg-slate-50 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-brand-green)] disabled:opacity-60"
                  />
                  <label className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-600">
                    <input
                      aria-label="جنسية غير مسجلة"
                      type="checkbox"
                      checked={nationalityMissing}
                      onChange={(e) => setNationalityMissing(e.target.checked)}
                    />
                    جنسية غير مسجلة
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">الحي السكني</label>
                  <select
                    value={selectedDistrict}
                    onChange={(e) => setSelectedDistrict(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-brand-green)]"
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
                    className="w-full px-3 py-2 bg-slate-50 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-brand-green)]"
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
                    className="w-full px-3 py-2 bg-slate-50 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-brand-green)]"
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
                    className="w-full px-3 py-2 bg-slate-50 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-brand-green)]"
                  />
                </div>
              </div>
            )}
          </div>

        {/* Data Table */}
        <div className="ikram-panel overflow-hidden">
          <div className="ikram-table-wrap">
            <table className="ikram-table">
              <thead>
                <tr className="bg-[var(--color-bg-soft)] text-slate-700 text-xs font-bold border-b border-[var(--color-border)]">
                  <th className="py-3.5 px-4">اسم المستفيد</th>
                  <th className="py-3.5 px-4">التصنيف</th>
                  <th className="py-3.5 px-4">رقم الجوال</th>
                  <th className="py-3.5 px-4">الهوية / الإقامة</th>
                  <th className="py-3.5 px-4">الحي</th>
                  <th className="py-3.5 px-4">الجنسية</th>
                  <th className="py-3.5 px-4">تاريخ التسجيل</th>
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
                    <td colSpan="12" className="py-12 text-center text-slate-400">
                      <div className="w-8 h-8 border-3 border-[var(--color-brand-green)] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      جاري تحميل بيانات المستفيدين اليوميين...
                    </td>
                  </tr>
                ) : beneficiaries.length === 0 ? (
                  <tr>
                    <td colSpan="12" className="py-12 text-center text-slate-400">
                      لا يوجد مستفيدون يوميون يطابقون شروط البحث الحالية.
                    </td>
                  </tr>
                ) : (
                  beneficiaries.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-800">
                        {canDaily("view") ? (
                          <Link to={`/daily-beneficiaries/${b.id}`} className="hover:text-[var(--color-brand-green)] hover:underline">
                            {b.full_name}
                          </Link>
                        ) : b.full_name}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700">{classificationLabel(b)}</td>
                      <td className="py-3.5 px-4 text-slate-600 font-mono text-xs" dir="ltr">
                        {b.phone}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 font-mono text-xs">
                        {b.national_id}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {b.district || "غير محدد"}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {typeof b.nationality === "string" && b.nationality.trim() ? b.nationality.trim() : "—"}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 text-xs">
                        {b.created_at ? String(b.created_at).slice(0, 10) : "—"}
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
                          {canDaily("create") && <button
                            onClick={() => openQuickReceive(b)}
                            title="تسجيل استلام مساعدة فوري"
                            className="p-1.5 text-[var(--color-brand-green)] hover:bg-[#EBF4EA] rounded-lg transition-colors"
                          >
                            <Package className="w-4 h-4" />
                          </button>}

                          {canDaily("view") && <button
                            onClick={() => openHistory(b)}
                            title="سجل استلامات المستفيد"
                            className="p-1.5 text-amber-600 hover:bg-[var(--color-bg-soft)] rounded-lg transition-colors"
                          >
                            <History className="w-4 h-4" />
                          </button>}

                          {canDaily("view") && <Link
                            to={`/daily-beneficiaries/${b.id}`}
                            title="عرض ملف المستفيد"
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>}

                          {canDaily("edit") && <Link
                            to={`/daily-beneficiaries/${b.id}/edit`}
                            title="تعديل البيانات"
                            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </Link>}

                          {canDaily("delete") && <button
                            onClick={() => setDeleteTarget(b)}
                            title="حذف المستفيد"
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>}
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
            <div className="p-4 border-t border-[var(--color-border)] flex items-center justify-between">
              <span className="text-xs text-slate-500">
                إجمالي المستفيدين: <strong className="text-slate-800">{pagination.total}</strong> (صفحة {pagination.current_page} من {pagination.last_page})
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={pagination.current_page <= 1}
                  onClick={() => fetchBeneficiaries(pagination.current_page - 1)}
                  className="p-2 border border-[var(--color-border)] rounded-lg text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  disabled={pagination.current_page >= pagination.last_page}
                  onClick={() => fetchBeneficiaries(pagination.current_page + 1)}
                  className="p-2 border border-[var(--color-border)] rounded-lg text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
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
              <div className="p-4 bg-[#EBF4EA] border border-[var(--color-brand-green)]/30 rounded-xl space-y-3 text-center">
                <CheckCircle2 className="w-12 h-12 text-[var(--color-brand-green)] mx-auto" />
                <h3 className="font-bold text-slate-800 text-base">تم تسجيل الاستلام بنجاح!</h3>
                <p className="text-xs text-slate-600">
                  تم إصدار سند الاستلام برقم: <strong className="text-[#8C6C26] font-mono text-sm">{createdVoucher.document_number}</strong>
                </p>
                <div className="pt-2 flex justify-center gap-3">
                  <a
                    href={getDocumentPdfUrl(`/documents/daily-receiving/${createdVoucher.id}/pdf`)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-[var(--color-brand-gold)] hover:bg-[#B8923D] text-white rounded-lg text-xs font-bold transition-colors"
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
                    className="w-full px-3 py-2 bg-white border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-brand-green)]"
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
                    className="w-full px-3 py-2 bg-white border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-brand-green)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ملاحظات على الاستلام (اختياري)</label>
                  <textarea
                    rows="2"
                    value={receiveNotes}
                    onChange={(e) => setReceiveNotes(e.target.value)}
                    placeholder="تم التسليم يداً بيد بمقر الجمعية..."
                    className="w-full px-3 py-2 bg-white border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-brand-green)]"
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
                    className="px-5 py-2 bg-[var(--color-brand-green)] hover:bg-[#345830] text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
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
                          href={getDocumentPdfUrl(`/documents/daily-receiving/${h.id}/pdf`)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-[var(--color-bg-soft)] text-amber-700 hover:bg-amber-100 rounded text-[11px] font-bold"
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
    </div>
  );

  if (embedded) {
    return mainContent;
  }

  return <MainLayout>{mainContent}</MainLayout>;
}
