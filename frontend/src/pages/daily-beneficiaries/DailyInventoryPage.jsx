import { useEffect, useState } from "react";
import MainLayout from "../../components/layout/MainLayout";
import PageHeader from "../../components/ui/PageHeader";
import KpiCard from "../../components/ui/KpiCard";
import Button from "../../components/ui/Button";
import Dialog from "../../components/overlays/Dialog";
import ConfirmDialog from "../../components/overlays/ConfirmDialog";
import Toast from "../../components/ui/Toast";
import {
  getDailyInventory,
  createDailyInventoryItem,
  updateDailyInventoryItem,
  deleteDailyInventoryItem,
  adjustDailyInventoryStock,
  getDailyInventoryMovements,
} from "../../api/dailyBeneficiaries";
import {
  Package,
  Plus,
  ArrowUpDown,
  History,
  AlertTriangle,
  Calendar,
  Search,
  Filter,
  Edit,
  Trash2,
  CheckCircle2,
  Clock,
  Layers,
} from "lucide-react";

export default function DailyInventoryPage() {
  const [activeTab, setActiveTab] = useState("items"); // 'items' | 'movements'

  // Items state
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total_items: 0,
    total_quantity: 0,
    low_stock_count: 0,
    expired_count: 0,
  });
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  // Movements state
  const [movements, setMovements] = useState([]);
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [paginationMovements, setPaginationMovements] = useState({ current_page: 1, last_page: 1, total: 0 });

  // Add / Edit Item Modal
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [itemForm, setItemForm] = useState({
    name: "",
    quantity: 0,
    unit: "سلة",
    min_threshold: 5,
    category: "",
    batch_number: "",
    supplier: "",
    expiry_date: "",
    description: "",
  });
  const [savingItem, setSavingItem] = useState(false);

  // Stock Adjustment Modal
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState(null);
  const [adjustForm, setAdjustForm] = useState({
    type: "in", // in, out, adjustment
    quantity: 1,
    reason: "",
    notes: "",
  });
  const [submittingAdjust, setSubmittingAdjust] = useState(false);

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Toast
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  const fetchItems = async () => {
    try {
      setLoading(true);
      const res = await getDailyInventory({
        search: search.trim() || undefined,
        category: selectedCategory !== "all" ? selectedCategory : undefined,
        status: selectedStatus !== "all" ? selectedStatus : undefined,
      });

      if (res.data?.success) {
        setItems(res.data.data || []);
        if (res.data.stats) setStats(res.data.stats);
        if (res.data.categories) setCategories(res.data.categories);
      }
    } catch (err) {
      setToast({ show: true, message: "تعذر تحميل أصناف المستودع", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const fetchMovements = async (page = 1) => {
    try {
      setLoadingMovements(true);
      const res = await getDailyInventoryMovements({ page, per_page: 20 });
      if (res.data?.success) {
        setMovements(res.data.data.data || []);
        setPaginationMovements({
          current_page: res.data.data.current_page,
          last_page: res.data.data.last_page,
          total: res.data.data.total,
        });
      }
    } catch (err) {
      setToast({ show: true, message: "فشل في تحميل سجل الحركات", type: "error" });
    } finally {
      setLoadingMovements(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [selectedCategory, selectedStatus]);

  useEffect(() => {
    if (activeTab === "movements") {
      fetchMovements(1);
    }
  }, [activeTab]);

  const handleOpenAddModal = () => {
    setEditingItem(null);
    setItemForm({
      name: "",
      quantity: 0,
      unit: "سلة",
      min_threshold: 5,
      category: "",
      batch_number: "",
      supplier: "",
      expiry_date: "",
      description: "",
    });
    setShowItemModal(true);
  };

  const handleOpenEditModal = (item) => {
    setEditingItem(item);
    setItemForm({
      name: item.name,
      quantity: item.current_quantity,
      unit: item.unit || "سلة",
      min_threshold: item.min_threshold || 5,
      category: item.category || "",
      batch_number: item.batch_number || "",
      supplier: item.supplier || "",
      expiry_date: item.expiry_date ? item.expiry_date.slice(0, 10) : "",
      description: item.description || "",
    });
    setShowItemModal(true);
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    if (!itemForm.name.trim()) {
      setToast({ show: true, message: "اسم الصنف مطلوب", type: "warning" });
      return;
    }

    setSavingItem(true);
    try {
      if (editingItem) {
        const res = await updateDailyInventoryItem(editingItem.id, itemForm);
        if (res.data?.success) {
          setToast({ show: true, message: "تم تحديث بيانات الصنف", type: "success" });
          setShowItemModal(false);
          fetchItems();
        }
      } else {
        const res = await createDailyInventoryItem(itemForm);
        if (res.data?.success) {
          setToast({ show: true, message: "تمت إضافة الصنف لمستودع اليوميين", type: "success" });
          setShowItemModal(false);
          fetchItems();
        }
      }
    } catch (err) {
      setToast({ show: true, message: "فشل في حفظ الصنف", type: "error" });
    } finally {
      setSavingItem(false);
    }
  };

  const handleOpenAdjustModal = (item) => {
    setAdjustTarget(item);
    setAdjustForm({
      type: "in",
      quantity: 1,
      reason: "",
      notes: "",
    });
    setShowAdjustModal(true);
  };

  const handleConfirmAdjust = async (e) => {
    e.preventDefault();
    if (!adjustForm.reason.trim()) {
      setToast({ show: true, message: "سبب التعديل إلزامي لتوثيق الحركة", type: "warning" });
      return;
    }

    setSubmittingAdjust(true);
    try {
      const res = await adjustDailyInventoryStock(adjustTarget.id, {
        type: adjustForm.type,
        quantity: parseInt(adjustForm.quantity, 10) || 1,
        reason: adjustForm.reason,
        notes: adjustForm.notes,
      });

      if (res.data?.success) {
        setToast({ show: true, message: res.data.message, type: "success" });
        setShowAdjustModal(false);
        fetchItems();
        if (activeTab === "movements") fetchMovements(1);
      }
    } catch (err) {
      const msg = err.response?.data?.message || "فشل في تسوية الرصيد";
      setToast({ show: true, message: msg, type: "error" });
    } finally {
      setSubmittingAdjust(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await deleteDailyInventoryItem(deleteTarget.id);
      if (res.data?.success) {
        setToast({ show: true, message: "تم حذف الصنف من المستودع", type: "success" });
        setDeleteTarget(null);
        fetchItems();
      }
    } catch (err) {
      setToast({ show: true, message: "تعذر حذف الصنف", type: "error" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6" dir="rtl">
        {/* Page Header */}
        <PageHeader
          title="مستودع المستفيدين اليوميين"
          subtitle="إدارة الأصناف المخزنية المخصصة للحالات الطارئة ومتابعة تواريخ الصلاحية والتسويات"
          badge="مستودع مستقل"
          breadcrumbs={[
            { label: "المستفيدون اليوميون", to: "/daily-beneficiaries" },
            { label: "المستودع والمخزون" },
          ]}
          actions={
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => {
                setEditingItem(null);
                setForm(initialForm);
                setShowItemModal(true);
              }}
            >
              إضافة صنف جديد
            </Button>
          }
        />

        {/* Top KPI Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="إجمالي الأصناف والسلال"
            value={stats.total_items}
            subtitle="أصناف مسجلة"
            icon={Package}
            iconColor="green"
          />
          <KpiCard
            title="إجمالي الرصيد المتوفر"
            value={stats.total_quantity}
            subtitle="وحدة جاهزة للصرف"
            icon={Layers}
            iconColor="gold"
          />
          <KpiCard
            title="أصناف قاربت على النفاد"
            value={stats.low_stock_count}
            subtitle="تحت حد التنبيه الأدنى"
            icon={AlertTriangle}
            iconColor="amber"
          />
          <KpiCard
            title="أصناف منتهية الصلاحية"
            value={stats.expired_count}
            subtitle="تتطلب استبعاد فوري"
            icon={Clock}
            iconColor="red"
          />
        </div>

        {/* Action & Tab Bar */}
        <div className="bg-white border border-[#E5E2D9] rounded-xl p-2 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setActiveTab("items")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-colors ${
                activeTab === "items" ? "bg-[#3F6B3A] text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Package className="w-4 h-4" />
              أصناف وسلال المستودع
            </button>

            <button
              onClick={() => setActiveTab("movements")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-colors ${
                activeTab === "movements" ? "bg-[#3F6B3A] text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <History className="w-4 h-4" />
              سجل الحركات الصادرة والواردة
            </button>
          </div>

          {activeTab === "items" && (
            <button
              onClick={handleOpenAddModal}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#3F6B3A] hover:bg-[#345830] text-white rounded-lg text-xs font-bold transition-colors w-full sm:w-auto justify-center"
            >
              <Plus className="w-4 h-4" />
              إضافة صنف / سلة جديدة
            </button>
          )}
        </div>

        {/* TAB 1: Inventory Items Table */}
        {activeTab === "items" && (
          <div className="space-y-4">
            {/* Search and Filters */}
            <div className="bg-[#FAF8F5] border border-[#E5E2D9] rounded-xl p-4 shadow-sm flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchItems()}
                  placeholder="ابحث باسم الصنف، المورد، رقم التشغيلة..."
                  className="w-full pl-3 pr-10 py-2 bg-white border border-[#E5E2D9] rounded-lg text-xs focus:outline-none focus:border-[#3F6B3A]"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-3 py-2 bg-white border border-[#E5E2D9] rounded-lg text-xs focus:outline-none focus:border-[#3F6B3A]"
                >
                  <option value="all">جميع التصنيفات</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>

                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="px-3 py-2 bg-white border border-[#E5E2D9] rounded-lg text-xs focus:outline-none focus:border-[#3F6B3A]"
                >
                  <option value="all">جميع الحالات</option>
                  <option value="available">متوفر بالمستودع</option>
                  <option value="low_stock">منخفض المخزون</option>
                  <option value="expired">منتهي الصلاحية</option>
                </select>

                <button
                  onClick={fetchItems}
                  className="px-4 py-2 bg-[#3F6B3A] text-white text-xs font-semibold rounded-lg hover:bg-[#345830] transition-colors"
                >
                  تطبيق
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white border border-[#E5E2D9] rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#FAF8F5] text-slate-700 font-bold border-b border-[#E5E2D9]">
                      <th className="py-3 px-4">اسم الصنف / السلة</th>
                      <th className="py-3 px-4">التصنيف</th>
                      <th className="py-3 px-4 text-center">الرصيد المتاح</th>
                      <th className="py-3 px-4 text-center">المحجوز</th>
                      <th className="py-3 px-4 text-center">حد التنبيه</th>
                      <th className="py-3 px-4">تاريخ الصلاحية</th>
                      <th className="py-3 px-4">المورد / التشغيلة</th>
                      <th className="py-3 px-4 text-center">الحالة</th>
                      <th className="py-3 px-4 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td colSpan="9" className="py-10 text-center text-slate-400">
                          جاري تحميل أصناف المستودع...
                        </td>
                      </tr>
                    ) : items.length === 0 ? (
                      <tr>
                        <td colSpan="9" className="py-10 text-center text-slate-400">
                          لا توجد أصناف في مستودع المستفيدين اليوميين حالياً.
                        </td>
                      </tr>
                    ) : (
                      items.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4">
                            <strong className="text-slate-800 block text-xs">{item.name}</strong>
                            {item.description && (
                              <span className="text-[11px] text-slate-400 truncate max-w-xs block">
                                {item.description}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            <span className="px-2 py-0.5 bg-slate-100 rounded text-[11px]">
                              {item.category || "عام"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`px-2.5 py-1 rounded font-bold text-xs ${
                                item.is_low_stock
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-emerald-50 text-emerald-700"
                              }`}
                            >
                              {item.current_quantity} {item.unit}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center text-slate-500 font-mono">
                            {item.reserved_quantity || 0}
                          </td>
                          <td className="py-3 px-4 text-center text-slate-500 font-mono">
                            {item.min_threshold}
                          </td>
                          <td className="py-3 px-4">
                            {item.expiry_date ? (
                              <span
                                className={`text-[11px] font-semibold ${
                                  item.is_expired ? "text-red-600" : "text-slate-600"
                                }`}
                              >
                                {new Date(item.expiry_date).toLocaleDateString("ar-SA")}
                                {item.is_expired && " (منتهي)"}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-600 text-[11px]">
                            {item.supplier || "-"} {item.batch_number ? `(${item.batch_number})` : ""}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                item.is_expired
                                  ? "bg-red-100 text-red-700"
                                  : item.is_low_stock
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-emerald-100 text-emerald-800"
                              }`}
                            >
                              {item.is_expired
                                ? "منتهي"
                                : item.is_low_stock
                                ? "منخفض"
                                : "متوفر"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Stock Adjust button */}
                              <button
                                onClick={() => handleOpenAdjustModal(item)}
                                title="حركة مخزنية (توريد / صرف / تسوية)"
                                className="p-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded transition-colors"
                              >
                                <ArrowUpDown className="w-3.5 h-3.5" />
                              </button>

                              {/* Edit item */}
                              <button
                                onClick={() => handleOpenEditModal(item)}
                                title="تعديل بيانات الصنف"
                                className="p-1.5 text-slate-600 hover:bg-slate-100 rounded transition-colors"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>

                              {/* Delete item */}
                              <button
                                onClick={() => setDeleteTarget(item)}
                                title="حذف الصنف"
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Movements Log Table */}
        {activeTab === "movements" && (
          <div className="bg-white border border-[#E5E2D9] rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-[#FAF8F5] text-slate-700 font-bold border-b border-[#E5E2D9]">
                    <th className="py-3 px-4">الصنف</th>
                    <th className="py-3 px-4 text-center">نوع الحركة</th>
                    <th className="py-3 px-4 text-center">الكمية</th>
                    <th className="py-3 px-4">السبب / البيان</th>
                    <th className="py-3 px-4">المسؤول عن العملية</th>
                    <th className="py-3 px-4">تاريخ ووقت الحركة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingMovements ? (
                    <tr>
                      <td colSpan="6" className="py-10 text-center text-slate-400">
                        جاري تحميل سجل حركات المستودع...
                      </td>
                    </tr>
                  ) : movements.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-10 text-center text-slate-400">
                        لا توجد حركات مسجلة حتى الآن.
                      </td>
                    </tr>
                  ) : (
                    movements.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-800">{m.item?.name || "صنف مستودع"}</td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              m.type === "in"
                                ? "bg-emerald-50 text-emerald-700"
                                : m.type === "out"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-blue-50 text-blue-700"
                            }`}
                          >
                            {m.type === "in" ? "توريد (+)" : m.type === "out" ? "صرف (-)" : "تسوية جرد"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-800">
                          {m.quantity} {m.item?.unit || "سلة"}
                        </td>
                        <td className="py-3 px-4 text-slate-600">{m.reason}</td>
                        <td className="py-3 px-4 text-slate-700">{m.user?.full_name || "مدير النظام"}</td>
                        <td className="py-3 px-4 text-slate-500 font-mono">
                          {new Date(m.created_at).toLocaleString("ar-SA")}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination for movements */}
            {paginationMovements.last_page > 1 && (
              <div className="p-3 border-t border-[#E5E2D9] flex items-center justify-between text-xs">
                <span>
                  الصفحة {paginationMovements.current_page} من {paginationMovements.last_page}
                </span>
                <div className="flex gap-1">
                  <button
                    disabled={paginationMovements.current_page <= 1}
                    onClick={() => fetchMovements(paginationMovements.current_page - 1)}
                    className="p-1.5 border rounded disabled:opacity-30"
                  >
                    السابق
                  </button>
                  <button
                    disabled={paginationMovements.current_page >= paginationMovements.last_page}
                    onClick={() => fetchMovements(paginationMovements.current_page + 1)}
                    className="p-1.5 border rounded disabled:opacity-30"
                  >
                    التالي
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal: Add/Edit Item */}
        <Dialog
          isOpen={showItemModal}
          onClose={() => setShowItemModal(false)}
          title={editingItem ? `تعديل صنف: ${editingItem.name}` : "إضافة صنف / سلة جديدة إلى مستودع اليوميين"}
          maxWidth="max-w-xl"
        >
          <form onSubmit={handleSaveItem} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">اسم الصنف أو سلة الدعم *</label>
                <input
                  type="text"
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  placeholder="مثال: سلة الوجبات الساخنة اليومية"
                  className="w-full px-3 py-2 bg-white border border-[#E5E2D9] rounded-lg text-xs focus:outline-none focus:border-[#3F6B3A]"
                />
              </div>

              {!editingItem && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">الكمية الابتدائية *</label>
                  <input
                    type="number"
                    min="0"
                    value={itemForm.quantity}
                    onChange={(e) => setItemForm({ ...itemForm, quantity: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-[#E5E2D9] rounded-lg text-xs focus:outline-none focus:border-[#3F6B3A]"
                  />
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">وحدة القياس</label>
                <input
                  type="text"
                  value={itemForm.unit}
                  onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
                  placeholder="سلة، طرد، وجبة، كرتون..."
                  className="w-full px-3 py-2 bg-white border border-[#E5E2D9] rounded-lg text-xs focus:outline-none focus:border-[#3F6B3A]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">حد التنبيه عند نقص المخزون</label>
                <input
                  type="number"
                  min="1"
                  value={itemForm.min_threshold}
                  onChange={(e) => setItemForm({ ...itemForm, min_threshold: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-[#E5E2D9] rounded-lg text-xs focus:outline-none focus:border-[#3F6B3A]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">التصنيف</label>
                <input
                  type="text"
                  value={itemForm.category}
                  onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                  placeholder="وجبات طازجة، تموين جاف..."
                  className="w-full px-3 py-2 bg-white border border-[#E5E2D9] rounded-lg text-xs focus:outline-none focus:border-[#3F6B3A]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">تاريخ انتهاء الصلاحية</label>
                <input
                  type="date"
                  value={itemForm.expiry_date}
                  onChange={(e) => setItemForm({ ...itemForm, expiry_date: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-[#E5E2D9] rounded-lg text-xs focus:outline-none focus:border-[#3F6B3A]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">المورد / الجهة المانحة</label>
                <input
                  type="text"
                  value={itemForm.supplier}
                  onChange={(e) => setItemForm({ ...itemForm, supplier: e.target.value })}
                  placeholder="مثال: مطابخ الإحسان"
                  className="w-full px-3 py-2 bg-white border border-[#E5E2D9] rounded-lg text-xs focus:outline-none focus:border-[#3F6B3A]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">رقم التشغيلة / الدفعة</label>
                <input
                  type="text"
                  value={itemForm.batch_number}
                  onChange={(e) => setItemForm({ ...itemForm, batch_number: e.target.value })}
                  placeholder="BATCH-001"
                  className="w-full px-3 py-2 bg-white border border-[#E5E2D9] rounded-lg text-xs focus:outline-none focus:border-[#3F6B3A]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">وصف الصنف ومحتوياته</label>
                <textarea
                  rows="2"
                  value={itemForm.description}
                  onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                  placeholder="تفاصيل محتويات السلة أو الصنف..."
                  className="w-full px-3 py-2 bg-white border border-[#E5E2D9] rounded-lg text-xs focus:outline-none focus:border-[#3F6B3A]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowItemModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={savingItem}
                className="px-5 py-2 bg-[#3F6B3A] text-white rounded-lg text-xs font-bold disabled:opacity-50"
              >
                {savingItem ? "جاري الحفظ..." : editingItem ? "حفظ التعديلات" : "إضافة الصنف"}
              </button>
            </div>
          </form>
        </Dialog>

        {/* Modal: Adjust Stock */}
        <Dialog
          isOpen={showAdjustModal}
          onClose={() => setShowAdjustModal(false)}
          title={`تسوية وتعديل رصيد: ${adjustTarget?.name || ""}`}
          maxWidth="max-w-md"
        >
          {adjustTarget && (
            <form onSubmit={handleConfirmAdjust} className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg flex items-center justify-between">
                <span>الرصيد المتوفر حالياً:</span>
                <strong className="text-emerald-800 text-sm font-bold">
                  {adjustTarget.current_quantity} {adjustTarget.unit}
                </strong>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">نوع حركة التعديل *</label>
                <select
                  value={adjustForm.type}
                  onChange={(e) => setAdjustForm({ ...adjustForm, type: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-[#E5E2D9] rounded-lg text-xs focus:outline-none focus:border-[#3F6B3A]"
                >
                  <option value="in">توريد إضافي (+) - استلام كميات جديدة للمستودع</option>
                  <option value="out">صرف / استبعاد (-) - إتلاف أو صرف استثنائي</option>
                  <option value="adjustment">تسوية جردية - ضبط الرصيد الفعلي للمستودع</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {adjustForm.type === "adjustment" ? "الرصيد الفعلي الجديد *" : "الكمية المراد تعديلها *"}
                </label>
                <input
                  type="number"
                  min="1"
                  value={adjustForm.quantity}
                  onChange={(e) => setAdjustForm({ ...adjustForm, quantity: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-[#E5E2D9] rounded-lg text-sm focus:outline-none focus:border-[#3F6B3A]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">سبب التعديل (إلزامي للرقابة والتدقيق) *</label>
                <input
                  type="text"
                  value={adjustForm.reason}
                  onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                  placeholder="مثال: توريد دفعة جديدة من المتبرع، تسوية جرد ربع سنوي..."
                  className="w-full px-3 py-2 bg-white border border-[#E5E2D9] rounded-lg text-xs focus:outline-none focus:border-[#3F6B3A]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">ملاحظات إضافية</label>
                <textarea
                  rows="2"
                  value={adjustForm.notes}
                  onChange={(e) => setAdjustForm({ ...adjustForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-[#E5E2D9] rounded-lg text-xs focus:outline-none focus:border-[#3F6B3A]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submittingAdjust}
                  className="px-5 py-2 bg-[#3F6B3A] text-white rounded-lg text-xs font-bold disabled:opacity-50"
                >
                  {submittingAdjust ? "جاري التسوية..." : "تأكيد حركة الرصيد"}
                </button>
              </div>
            </form>
          )}
        </Dialog>

        {/* Confirm Delete Dialog */}
        <ConfirmDialog
          isOpen={!!deleteTarget}
          title="تأكيد حذف الصنف من المستودع"
          message={`هل أنت متأكد من رغبتك في حذف الصنف (${deleteTarget?.name})؟`}
          confirmText="تأكيد الحذف"
          cancelText="إلغاء"
          type="danger"
          isLoading={deleting}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />

        {/* Toast */}
        <Toast
          show={toast.show}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ ...toast, show: false })}
        />
      </div>
    </MainLayout>
  );
}
