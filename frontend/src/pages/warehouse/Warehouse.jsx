import { useState, useEffect, useMemo } from 'react';
import { getInventory, addInventoryItem, updateInventoryItem, deleteInventoryItem, adjustStock } from '../../api/warehouse';
import MainLayout from '../../components/layout/MainLayout';
import PageHeader from '../../components/ui/PageHeader';
import KpiCard from '../../components/ui/KpiCard';
import Button from '../../components/ui/Button';
import Dialog from '../../components/overlays/Dialog';
import ConfirmDialog from '../../components/overlays/ConfirmDialog';
import StatusBadge from '../../components/ui/StatusBadge';
import FormField from '../../components/ui/FormField';
import { useNotifications } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { hasModuleAction } from '../../utils/modulePermissions';
import {
  Package, AlertTriangle, Plus, Trash2,
  ArrowUpCircle, Loader2, Search, RefreshCw,
  Calendar, Clock, CheckCircle2, FileSpreadsheet,
  Edit, Eye, Info
} from 'lucide-react';
import { exportArrayToExcel } from '../../utils/excelExport';

export default function Warehouse() {
  const { user } = useAuth();
  const canWarehouseAction = (action) => hasModuleAction(user, 'warehouse', action);
  const thresholdDays = 5;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expiryFilter, setExpiryFilter] = useState('all'); // 'all' | 'near_expiry' | 'expired' | 'valid'

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemForDetails, setItemForDetails] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    unit: 'كرتون',
    current_quantity: 0,
    min_threshold: 10,
    description: '',
    expiration_date: '',
    basket_number: '',
  });

  const [editFormData, setEditFormData] = useState({
    name: '',
    unit: 'كرتون',
    min_threshold: 10,
    description: '',
    expiration_date: '',
    basket_number: '',
  });

  const [adjustData, setAdjustData] = useState({ type: 'in', quantity: 1, reason: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { checkWarehouseExpirations } = useNotifications();

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await getInventory();
      const rawData = response.data?.data || response.data || [];
      const arrayData = Array.isArray(rawData) ? rawData : [];

      const enriched = arrayData.map((item) => {
        const rawDate = item.expiration_date || item.expiry_date;
        const normalizedDate = rawDate ? String(rawDate).slice(0, 10) : null;

        let remainingDays = item.remaining_days;
        let expiryState = item.expiry_status;

        if (remainingDays === undefined || remainingDays === null) {
          if (normalizedDate) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const exp = new Date(normalizedDate);
            exp.setHours(0, 0, 0, 0);
            const diffTime = exp.getTime() - today.getTime();
            remainingDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
          } else {
            remainingDays = null;
          }
        }

        if (!expiryState) {
          if (remainingDays === null) {
            expiryState = null;
          } else if (remainingDays <= 0) {
            expiryState = 'expired';
          } else if (remainingDays <= thresholdDays) {
            expiryState = 'near_expiry';
          } else {
            expiryState = 'valid';
          }
        }

        return {
          ...item,
          expiration_date: normalizedDate,
          expiry_date: normalizedDate,
          expiryState,
          remainingDays,
        };
      });

      setItems(enriched);
      // Automatically send alerts to notification center
      checkWarehouseExpirations(enriched);
    } catch (error) {
      console.error('Error fetching inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const dateVal = formData.expiration_date ? formData.expiration_date.slice(0, 10) : null;
      await addInventoryItem({
        ...formData,
        expiration_date: dateVal,
        expiry_date: dateVal,
      });
      setShowAddModal(false);
      setFormData({
        name: '',
        unit: 'كرتون',
        current_quantity: 0,
        min_threshold: 10,
        description: '',
        expiration_date: '',
        basket_number: '',
      });
      fetchData();
    } catch (error) {
      console.error('Add item error:', error);
      alert(error.response?.data?.message || 'حدث خطأ أثناء إضافة الصنف');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    const rawDate = item.expiration_date || item.expiry_date;
    setEditFormData({
      name: item.name || '',
      unit: item.unit || 'كرتون',
      min_threshold: item.min_threshold ?? 10,
      description: item.description || '',
      expiration_date: rawDate ? String(rawDate).slice(0, 10) : '',
      basket_number: item.basket_number || '',
    });
    setShowEditModal(true);
  };

  const handleOpenDetails = (item) => {
    setItemForDetails(item);
    setShowDetailsModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingItem?.id) return;
    setIsSubmitting(true);
    try {
      const dateVal = editFormData.expiration_date ? editFormData.expiration_date.slice(0, 10) : null;
      await updateInventoryItem(editingItem.id, {
        ...editFormData,
        expiration_date: dateVal,
        expiry_date: dateVal,
      });
      setShowEditModal(false);
      setEditingItem(null);
      fetchData();
    } catch (error) {
      console.error('Update item error:', error);
      alert(error.response?.data?.message || 'حدث خطأ أثناء تعديل الصنف');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    if (!selectedItem || !selectedItem.id) return;
    setIsSubmitting(true);

    try {
      await adjustStock(selectedItem.id, {
        ...adjustData,
      });
      setShowAdjustModal(false);
      setAdjustData({ type: 'in', quantity: 1, reason: '' });
      setSelectedItem(null);
      fetchData();
    } catch (error) {
      console.error('Adjust error:', error);
      alert(error.response?.data?.message || 'حدث خطأ أثناء تعديل المخزون');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    setDeleteLoading(true);
    try {
      await deleteInventoryItem(itemToDelete.id);
      setItemToDelete(null);
      fetchData();
    } catch (error) {
      alert('حدث خطأ أثناء حذف الصنف');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch = item.name?.toLowerCase().includes(search.toLowerCase()) ||
        item.description?.toLowerCase().includes(search.toLowerCase());

      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'in_stock' && item.stock_status === 'in_stock') ||
        (statusFilter === 'low_stock' && item.stock_status === 'low_stock') ||
        (statusFilter === 'out_of_stock' && item.stock_status === 'out_of_stock') ||
        (statusFilter === item.expiryState);

      const matchesExpiry = expiryFilter === 'all' || item.expiryState === expiryFilter;

      return matchesSearch && matchesStatus && matchesExpiry;
    });
  }, [items, search, statusFilter, expiryFilter]);

  const handleExportWarehouseExcel = () => {
    if (!filteredItems || filteredItems.length === 0) return;
    const exportData = filteredItems.map((item, idx) => ({
      "#": idx + 1,
      "اسم الصنف": item.name,
      "الكمية الحالية": item.current_quantity,
      "الوحدة": item.unit,
      "تاريخ انتهاء الصلاحية": (item.expiration_date || item.expiry_date) ? (item.expiration_date || item.expiry_date).slice(0, 10) : "غير محدد",
      "رقم السلة": item.basket_number || "—",
      "حالة الصلاحية": item.expiryState === "expired" ? "منتهي الصلاحية" : item.expiryState === "near_expiry" ? "قارب على الانتهاء" : "صالح",
      "الوصف": item.description || "",
    }));
    exportArrayToExcel({
      filename: "ikram-warehouse-inventory",
      sheetName: "مخزون المستودع",
      data: exportData,
    });
  };

  const stats = useMemo(() => {
    return {
      total: items.length,
      nearExpiry: items.filter((i) => i.expiryState === 'near_expiry').length,
      expired: items.filter((i) => i.expiryState === 'expired').length,
      distributed: items.filter((i) => i.expiryState === 'distributed').length,
      low: items.filter((i) => i.stock_status === 'low_stock').length,
    };
  }, [items]);

  return (
    <MainLayout>
      <div className="space-y-6 p-4 lg:p-6" dir="rtl">
        {/* Page Header with Primary Action */}
        <PageHeader
          title="إدارة المستودع والمخزون ومتابعة الصلاحية"
          subtitle={`متابعة كميات السلال، تواريخ الصلاحية، والتنبيهات المسبقة قبل الانتهاء بـ ${thresholdDays} أيام`}
          badge="المستودع العام"
          breadcrumbs={[{ label: "المستودع والمخزون" }]}
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                icon={FileSpreadsheet}
                onClick={handleExportWarehouseExcel}
              >
                تصدير إكسل
              </Button>
              {canWarehouseAction('create') && (
                <Button
                  variant="primary"
                  size="sm"
                  icon={Plus}
                  onClick={() => setShowAddModal(true)}
                >
                  إضافة صنف / مادة للسلة
                </Button>
              )}
            </div>
          }
        />

        {/* Top KPI Cards Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="إجمالي الأصناف"
            value={stats.total}
            subtitle="أصناف مخزنية مسجلة"
            icon={Package}
            iconColor="gold"
          />
          <KpiCard
            title="قاربت على الانتهاء"
            value={stats.nearExpiry}
            subtitle="تحت حد التنبيه"
            icon={Clock}
            iconColor="amber"
          />
          <KpiCard
            title="منتهية الصلاحية"
            value={stats.expired}
            subtitle="تتطلب استبعاد فوري"
            icon={AlertTriangle}
            iconColor="red"
          />
          <KpiCard
            title="تم توزيعها"
            value={stats.distributed}
            subtitle="صرفت للمستفيدين"
            icon={CheckCircle2}
            iconColor="green"
          />
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white p-4 rounded-2xl border border-[var(--color-border)] mb-4 flex flex-wrap items-center gap-3 shadow-xs">
          <div className="flex-1 min-w-[200px] relative">
            <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث عن اسم الصنف أو الوصف..."
              className="w-full pr-9 pl-4 py-2 rounded-xl border border-[var(--color-border)] focus:border-[var(--color-brand-gold)] outline-none text-xs text-right bg-[var(--color-bg-soft)]"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={expiryFilter}
              onChange={(e) => setExpiryFilter(e.target.value)}
              className="px-3 py-2 bg-[var(--color-bg-soft)] border border-[var(--color-border)] rounded-xl text-xs font-bold text-[var(--color-text-primary)] outline-none"
            >
              <option value="all">كل حالات الصلاحية</option>
              <option value="valid">صالح للاستخدام</option>
              <option value="near_expiry">قارب على الانتهاء (≤ {thresholdDays} أيام)</option>
              <option value="expired">منتهي الصلاحية</option>
              <option value="distributed">تم توزيعه</option>
            </select>

            <button
              onClick={fetchData}
              className="p-2 bg-[var(--color-bg-soft)] border border-[var(--color-border)] rounded-xl hover:bg-[var(--color-bg-soft)] text-[var(--color-text-primary)] cursor-pointer"
              title="تحديث البيانات"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-[var(--color-border)] overflow-hidden shadow-xs">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-right text-xs">
              <thead className="bg-[var(--color-bg-soft)] border-b border-[var(--color-border)] text-[var(--color-text-primary)] font-extrabold">
                <tr>
                  <th className="px-4 py-3.5">الصنف</th>
                  <th className="px-4 py-3.5">الوحدة</th>
                  <th className="px-4 py-3.5">المخزون الحالي</th>
                  <th className="px-4 py-3.5">الحد الأدنى</th>
                  <th className="px-4 py-3.5">تاريخ الانتهاء</th>
                  <th className="px-4 py-3.5">حالة الصلاحية</th>
                  <th className="px-4 py-3.5">حالة المخزون</th>
                  <th className="px-4 py-3.5 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center">
                      <div className="flex flex-col items-center justify-center gap-2 text-[var(--color-brand-gold)]">
                        <Loader2 size={32} className="animate-spin" />
                        <span className="text-xs font-bold text-[var(--color-text-muted)]">جاري تحميل بيانات المستودع...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-[var(--color-text-muted)]">
                      <Package size={40} className="mx-auto mb-2 text-[var(--color-border)]" />
                      <p className="font-bold text-sm text-[var(--color-text-primary)]">لا توجد أصناف مطابقة لخيارات البحث أو الفلتر</p>
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-[var(--color-bg-soft)] transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-bold text-[var(--color-text-primary)]">{item.name}</p>
                        <p className="text-[11px] text-[var(--color-text-muted)]">{item.description || 'لا يوجد وصف'}</p>
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)]">{item.unit}</td>
                      <td className="px-4 py-3">
                        <span className="font-extrabold text-[var(--color-text-primary)] font-mono text-sm">{item.current_quantity}</span>
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)] font-mono">{item.min_threshold}</td>
                      <td className="px-4 py-3">
                        {(item.expiration_date || item.expiry_date) ? (
                          <div className="flex flex-col gap-0.5 font-mono text-xs">
                            <div className="flex items-center gap-1.5">
                              <Calendar size={13} className="text-[var(--color-brand-gold)]" />
                              <span data-testid={`expiry-date-${item.id}`} className="font-bold text-[var(--color-text-primary)]">
                                {(item.expiration_date || item.expiry_date).slice(0, 10)}
                              </span>
                            </div>
                            {item.remainingDays !== null && (
                              <span className="text-[10px] text-[var(--color-text-muted)] font-sans">
                                {item.remainingDays <= 0 ? 'منتهي الصلاحية' : `متبقي ${item.remainingDays} يوم`}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[var(--color-text-muted)]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3" data-testid={`expiry-status-${item.id}`}>
                        <StatusBadge status={item.expiryState} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={item.stock_status || 'in_stock'} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenDetails(item)}
                            className="p-1.5 bg-[var(--color-bg-soft)] hover:bg-blue-50 text-blue-600 rounded-xl border border-[var(--color-border)] transition-colors cursor-pointer"
                            title="عرض تفاصيل الصنف والصلاحية"
                            aria-label="عرض تفاصيل الصنف"
                          >
                            <Eye size={15} />
                          </button>
                          {canWarehouseAction('edit') && <button
                            type="button"
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 bg-[var(--color-bg-soft)] hover:bg-[var(--color-bg-soft)] text-[#B45309] rounded-xl border border-[var(--color-border)] transition-colors cursor-pointer"
                            title="تعديل بيانات الصنف وتاريخ الصلاحية"
                            aria-label="تعديل الصنف"
                          >
                            <Edit size={15} />
                          </button>}
                          {canWarehouseAction('edit') && <button
                            type="button"
                            onClick={() => {
                              setSelectedItem(item);
                              setShowAdjustModal(true);
                            }}
                            className="p-1.5 bg-[var(--color-bg-soft)] hover:bg-green-50 text-[var(--color-brand-green)] rounded-xl border border-[var(--color-border)] transition-colors cursor-pointer"
                            title="تعديل المخزون (صرف / توريد)"
                            aria-label="تعديل المخزون"
                          >
                            <ArrowUpCircle size={15} />
                          </button>}
                          {canWarehouseAction('delete') && <button
                            type="button"
                            onClick={() => setItemToDelete(item)}
                            className="p-1.5 bg-[var(--color-bg-soft)] hover:bg-red-50 text-[#C24B3F] rounded-xl border border-[var(--color-border)] transition-colors cursor-pointer"
                            title="حذف الصنف"
                            aria-label="حذف الصنف"
                          >
                            <Trash2 size={15} />
                          </button>}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ─── ADD ITEM MODAL ─── */}
        <Dialog
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          title="إضافة صنف جديد للسلة والمستودع"
          subtitle="تسجيل بيانات المادة، الكمية، والحد الأدنى وتاريخ انتهاء الصلاحية"
          icon={Package}
          maxWidth="max-w-xl"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 bg-[var(--color-bg-soft)] text-[var(--color-text-secondary)] font-bold rounded-xl text-xs hover:bg-[var(--color-bg-soft)]"
              >
                إلغاء
              </button>
              <button
                type="submit"
                form="form-add-inventory-item"
                id="submit-add-item-btn"
                data-testid="submit-add-item-btn"
                disabled={isSubmitting}
                className="px-5 py-2 bg-[var(--color-brand-green)] hover:bg-[var(--color-brand-green-hover)] text-white font-extrabold rounded-xl text-xs shadow-xs cursor-pointer"
              >
                {isSubmitting ? "جاري الإضافة..." : "حفظ الصنف وتوثيق الصلاحية"}
              </button>
            </div>
          }
        >
          <form id="form-add-inventory-item" onSubmit={handleAddSubmit} className="space-y-3.5" dir="rtl">
            <FormField label="اسم الصنف / المادة" name="name" required>
              <input
                type="text"
                id="input-add-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--color-border)] text-xs text-right"
                placeholder="مثال: أرز بسمتي 5 كجم"
              />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="الوحدة" name="unit" required>
                <select
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--color-border)] text-xs text-right bg-white"
                >
                  <option value="كرتون">كرتون</option>
                  <option value="كيس">كيس</option>
                  <option value="حبة">حبة</option>
                  <option value="علبة">علبة</option>
                  <option value="كيلو">كيلو</option>
                  <option value="طرد">طرد</option>
                </select>
              </FormField>

              <FormField label="الكمية الابتدائية" name="current_quantity" required>
                <input
                  type="number"
                  id="input-add-quantity"
                  min="0"
                  max="9999999999.99"
                  step="0.01"
                  value={formData.current_quantity}
                  onChange={(e) => setFormData({ ...formData, current_quantity: e.target.value })}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--color-border)] text-xs text-right font-mono"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="حد التنبيه الأدنى للمخزون" name="min_threshold" required>
                <input
                  type="number"
                  id="input-add-min-threshold"
                  min="0"
                  max="9999999999.99"
                  step="0.01"
                  value={formData.min_threshold}
                  onChange={(e) => setFormData({ ...formData, min_threshold: e.target.value })}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--color-border)] text-xs text-right font-mono"
                />
              </FormField>

              <FormField
                label="تاريخ انتهاء الصلاحية *"
                name="expiration_date"
                required
                helperText={`يُرسل تنبيه تلقائي قبل ${thresholdDays} أيام من هذا التاريخ.`}
              >
                <input
                  type="date"
                  id="input-add-expiration-date"
                  value={formData.expiration_date}
                  onChange={(e) => setFormData({ ...formData, expiration_date: e.target.value })}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--color-border)] text-xs text-right font-mono bg-white"
                />
              </FormField>
            </div>

            <FormField label="الوصف والملاحظات" name="description">
              <textarea
                id="input-add-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                className="w-full px-3.5 py-2 rounded-xl border border-[var(--color-border)] text-xs text-right"
                placeholder="تفاصيل التخزين، المورد، أو السلة التابعة..."
              />
            </FormField>
          </form>
        </Dialog>

        {/* ─── EDIT ITEM MODAL ─── */}
        <Dialog
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setEditingItem(null);
          }}
          title={`تعديل صنف السلة والمستودع (${editingItem?.name || ''})`}
          subtitle="تعديل بيانات الصنف والحد الأدنى وتاريخ انتهاء الصلاحية"
          icon={Edit}
          maxWidth="max-w-xl"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <button
                type="button"
                onClick={() => {
                  setShowEditModal(false);
                  setEditingItem(null);
                }}
                className="px-4 py-2 bg-[var(--color-bg-soft)] text-[var(--color-text-secondary)] font-bold rounded-xl text-xs hover:bg-[var(--color-bg-soft)]"
              >
                إلغاء
              </button>
              <button
                type="submit"
                form="form-edit-inventory-item"
                id="submit-edit-item-btn"
                data-testid="submit-edit-item-btn"
                disabled={isSubmitting}
                className="px-5 py-2 bg-[var(--color-brand-green)] hover:bg-[var(--color-brand-green-hover)] text-white font-extrabold rounded-xl text-xs shadow-xs cursor-pointer"
              >
                {isSubmitting ? "جاري الحفظ..." : "حفظ التعديلات"}
              </button>
            </div>
          }
        >
          <form id="form-edit-inventory-item" onSubmit={handleEditSubmit} className="space-y-3.5" dir="rtl">
            <FormField label="اسم الصنف / المادة" name="edit_name" required>
              <input
                type="text"
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--color-border)] text-xs text-right"
                placeholder="مثال: أرز بسمتي 5 كجم"
              />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="الوحدة" name="edit_unit" required>
                <select
                  value={editFormData.unit}
                  onChange={(e) => setEditFormData({ ...editFormData, unit: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--color-border)] text-xs text-right bg-white"
                >
                  <option value="كرتون">كرتون</option>
                  <option value="كيس">كيس</option>
                  <option value="حبة">حبة</option>
                  <option value="علبة">علبة</option>
                  <option value="كيلو">كيلو</option>
                  <option value="طرد">طرد</option>
                </select>
              </FormField>

              <FormField label="رقم السلة" name="edit_basket_number">
                <input
                  type="text"
                  value={editFormData.basket_number}
                  onChange={(e) => setEditFormData({ ...editFormData, basket_number: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--color-border)] text-xs text-right"
                  placeholder="اختياري: مثال B-102"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="حد التنبيه الأدنى للمخزون" name="edit_min_threshold" required>
                <input
                  type="number"
                  min="0"
                  max="9999999999.99"
                  step="0.01"
                  value={editFormData.min_threshold}
                  onChange={(e) => setEditFormData({ ...editFormData, min_threshold: e.target.value })}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--color-border)] text-xs text-right font-mono"
                />
              </FormField>

              <FormField
                label="تاريخ انتهاء الصلاحية"
                name="edit_expiration_date"
                helperText={`تنبيه آلي قبل ${thresholdDays} أيام من تاريخ الصلاحية.`}
              >
                <input
                  type="date"
                  value={editFormData.expiration_date}
                  onChange={(e) => setEditFormData({ ...editFormData, expiration_date: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--color-border)] text-xs text-right font-mono bg-white"
                />
              </FormField>
            </div>

            <FormField label="الوصف والملاحظات" name="edit_description">
              <textarea
                value={editFormData.description}
                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                rows={2}
                className="w-full px-3.5 py-2 rounded-xl border border-[var(--color-border)] text-xs text-right"
                placeholder="تفاصيل التخزين أو ملاحظات الجودة..."
              />
            </FormField>
          </form>
        </Dialog>

        {/* ─── ITEM DETAILS MODAL ─── */}
        <Dialog
          isOpen={showDetailsModal}
          onClose={() => {
            setShowDetailsModal(false);
            setItemForDetails(null);
          }}
          title={`بطاقة بيانات الصنف (${itemForDetails?.name || ''})`}
          subtitle="مراجعة شاملة لبيانات المخزون وتاريخ الصلاحية وحالة التنبيه"
          icon={Info}
          maxWidth="max-w-lg"
          footer={
            <div className="flex items-center justify-between w-full">
              <button
                type="button"
                onClick={() => {
                  const item = itemForDetails;
                  setShowDetailsModal(false);
                  setItemForDetails(null);
                  if (item) handleOpenEdit(item);
                }}
                className="px-4 py-2 bg-amber-100 hover:bg-amber-200 text-[#B45309] font-bold rounded-xl text-xs flex items-center gap-1.5"
              >
                <Edit size={14} />
                تعديل الصنف
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDetailsModal(false);
                  setItemForDetails(null);
                }}
                className="px-4 py-2 bg-[var(--color-bg-soft)] text-[var(--color-text-secondary)] font-bold rounded-xl text-xs hover:bg-[var(--color-bg-soft)]"
              >
                إغلاق
              </button>
            </div>
          }
        >
          {itemForDetails && (
            <div className="space-y-4 text-xs" dir="rtl">
              <div className="grid grid-cols-2 gap-3 p-3 bg-[var(--color-bg-soft)] rounded-xl border border-[var(--color-border)]">
                <div>
                  <span className="text-[var(--color-text-muted)] block text-[11px] mb-0.5">اسم الصنف:</span>
                  <span className="font-extrabold text-[var(--color-text-primary)] text-sm">{itemForDetails.name}</span>
                </div>
                <div>
                  <span className="text-[var(--color-text-muted)] block text-[11px] mb-0.5">رقم السلة / الكود:</span>
                  <span className="font-bold text-[var(--color-text-primary)] font-mono">{itemForDetails.basket_number || '—'}</span>
                </div>
                <div>
                  <span className="text-[var(--color-text-muted)] block text-[11px] mb-0.5">الرصيد المتاح:</span>
                  <span className="font-extrabold text-[var(--color-text-primary)] font-mono text-sm">{itemForDetails.current_quantity} {itemForDetails.unit}</span>
                </div>
                <div>
                  <span className="text-[var(--color-text-muted)] block text-[11px] mb-0.5">الحد الأدنى للتنبيه:</span>
                  <span className="font-bold text-[var(--color-text-primary)] font-mono">{itemForDetails.min_threshold} {itemForDetails.unit}</span>
                </div>
              </div>

              <div className="p-3 bg-white rounded-xl border border-[var(--color-border)] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--color-text-muted)] font-bold">تاريخ انتهاء الصلاحية:</span>
                  <span className="font-mono font-bold text-sm text-[var(--color-text-primary)]">
                    {(itemForDetails.expiration_date || itemForDetails.expiry_date)
                      ? (itemForDetails.expiration_date || itemForDetails.expiry_date).slice(0, 10)
                      : 'غير محدد'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--color-text-muted)] font-bold">الأيام المتبقية:</span>
                  <span className="font-bold text-xs">
                    {itemForDetails.remainingDays !== null
                      ? (itemForDetails.remainingDays <= 0 ? 'منتهي الصلاحية' : `${itemForDetails.remainingDays} يوم`)
                      : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-[var(--color-border)]">
                  <span className="text-[var(--color-text-muted)] font-bold">حالة الصلاحية:</span>
                  <StatusBadge status={itemForDetails.expiryState} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--color-text-muted)] font-bold">حالة المخزون:</span>
                  <StatusBadge status={itemForDetails.stock_status || 'in_stock'} />
                </div>
              </div>

              {itemForDetails.description && (
                <div className="p-3 bg-[var(--color-bg-soft)] rounded-xl border border-[var(--color-border)]">
                  <span className="text-[var(--color-text-muted)] block text-[11px] mb-1">الوصف والملاحظات:</span>
                  <p className="text-[var(--color-text-secondary)] leading-relaxed">{itemForDetails.description}</p>
                </div>
              )}
            </div>
          )}
        </Dialog>

        {/* ─── ADJUST STOCK MODAL ─── */}
        <Dialog
          isOpen={showAdjustModal}
          onClose={() => setShowAdjustModal(false)}
          title={`تعديل كمية المخزون (${selectedItem?.name})`}
          subtitle="تسجيل حركة توريد إضافية أو صرف استهلاكي"
          icon={ArrowUpCircle}
          maxWidth="max-w-md"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <button
                type="button"
                onClick={() => setShowAdjustModal(false)}
                className="px-4 py-2 bg-[var(--color-bg-soft)] text-[var(--color-text-secondary)] font-bold rounded-xl text-xs hover:bg-[var(--color-bg-soft)]"
              >
                إلغاء
              </button>
              <button
                type="submit"
                form="form-adjust-inventory-item"
                disabled={isSubmitting}
                className="px-5 py-2 bg-[var(--color-brand-green)] hover:bg-[var(--color-brand-green-hover)] text-white font-extrabold rounded-xl text-xs shadow-xs"
              >
                {isSubmitting ? "جاري التعديل..." : "تأكيد حركة المخزون"}
              </button>
            </div>
          }
        >
          <form id="form-adjust-inventory-item" onSubmit={handleAdjustSubmit} className="space-y-3" dir="rtl">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="نوع الحركة" name="type" required>
                <select
                  value={adjustData.type}
                  onChange={(e) => setAdjustData({ ...adjustData, type: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--color-border)] text-xs font-bold bg-white"
                >
                  <option value="in">➕ توريد / إضافة (+) </option>
                  <option value="out">➖ صرف / إنقاص (-)</option>
                </select>
              </FormField>

              <FormField label="الكمية" name="quantity" required>
                <input
                  type="number"
                  min="0.01"
                  max="9999999999.99"
                  step="0.01"
                  value={adjustData.quantity}
                  onChange={(e) => setAdjustData({ ...adjustData, quantity: e.target.value })}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--color-border)] text-xs font-mono text-right"
                />
              </FormField>
            </div>

            <FormField label="سبب التعديل" name="reason" required>
              <input
                type="text"
                value={adjustData.reason}
                onChange={(e) => setAdjustData({ ...adjustData, reason: e.target.value })}
                required
                placeholder="مثال: وصول شحنة تبرعات جديدة / تجهيز سلال ميدانية"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--color-border)] text-xs text-right"
              />
            </FormField>
          </form>
        </Dialog>

        {/* ─── CONFIRM DELETE DIALOG ─── */}
        <ConfirmDialog
          isOpen={!!itemToDelete}
          onClose={() => setItemToDelete(null)}
          onConfirm={handleConfirmDelete}
          title={`حذف الصنف (${itemToDelete?.name})`}
          message={`هل أنت متأكد من رغبتك في حذف هذا الصنف من سجلات المستودع؟ لا يمكن التراجع عن هذه الخطوة.`}
          confirmLabel="حذف نهائياً"
          cancelLabel="إلغاء"
          loading={deleteLoading}
        />
      </div>
    </MainLayout>
  );
}
