import { useState, useEffect, useMemo } from 'react';
import { getInventory, addInventoryItem, deleteInventoryItem, adjustStock } from '../../api/warehouse';
import MainLayout from '../../components/layout/MainLayout';
import PageHeader from '../../components/ui/PageHeader';
import KpiCard from '../../components/ui/KpiCard';
import Button from '../../components/ui/Button';
import Dialog from '../../components/overlays/Dialog';
import ConfirmDialog from '../../components/overlays/ConfirmDialog';
import StatusBadge from '../../components/ui/StatusBadge';
import FormField from '../../components/ui/FormField';
import { useNotifications } from '../../context/NotificationContext';
import {
  Package, AlertTriangle, TrendingUp, Plus, Edit, Trash2,
  ArrowUpCircle, ArrowDownCircle, X, Loader2, Search, RefreshCw,
  Calendar, Filter, Clock, CheckCircle2
} from 'lucide-react';

export default function Warehouse() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expiryFilter, setExpiryFilter] = useState('all'); // 'all' | 'near_expiry' | 'expired' | 'valid'

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
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

  const [adjustData, setAdjustData] = useState({ type: 'in', quantity: 1, reason: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { thresholdDays, checkWarehouseExpirations } = useNotifications();

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await getInventory();
      const rawData = response.data?.data || response.data || [];
      const arrayData = Array.isArray(rawData) ? rawData : [];

      // Enrich items with calculated expiration statuses
      const now = new Date();
      const enriched = arrayData.map((item) => {
        let expiryState = 'valid';
        let remainingDays = null;

        if (item.status === 'distributed' || item.is_distributed) {
          expiryState = 'distributed';
        } else if (item.expiration_date) {
          const exp = new Date(item.expiration_date);
          const diff = exp.getTime() - now.getTime();
          remainingDays = Math.ceil(diff / (1000 * 60 * 60 * 24));

          if (remainingDays <= 0) {
            expiryState = 'expired';
          } else if (remainingDays <= thresholdDays) {
            expiryState = 'near_expiry';
          } else {
            expiryState = 'valid';
          }
        }

        return {
          ...item,
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
      await addInventoryItem({
        ...formData,
        current_quantity: parseInt(formData.current_quantity) || 0,
        min_threshold: parseInt(formData.min_threshold) || 0,
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

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    if (!selectedItem || !selectedItem.id) return;
    setIsSubmitting(true);

    try {
      await adjustStock(selectedItem.id, {
        ...adjustData,
        quantity: parseInt(adjustData.quantity) || 0,
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
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => setShowAddModal(true)}
            >
              إضافة صنف / مادة للسلة
            </Button>
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
        <div className="bg-white p-4 rounded-2xl border border-[#E5E2D9] mb-4 flex flex-wrap items-center gap-3 shadow-xs">
          <div className="flex-1 min-w-[200px] relative">
            <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث عن اسم الصنف أو الوصف..."
              className="w-full pr-9 pl-4 py-2 rounded-xl border border-[#E5E2D9] focus:border-[#C9A24A] outline-none text-xs text-right bg-[#FAF8F5]"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={expiryFilter}
              onChange={(e) => setExpiryFilter(e.target.value)}
              className="px-3 py-2 bg-[#FAF8F5] border border-[#E5E2D9] rounded-xl text-xs font-bold text-[#111827] outline-none"
            >
              <option value="all">كل حالات الصلاحية</option>
              <option value="valid">صالح للاستخدام</option>
              <option value="near_expiry">قارب على الانتهاء (≤ {thresholdDays} أيام)</option>
              <option value="expired">منتهي الصلاحية</option>
              <option value="distributed">تم توزيعه</option>
            </select>

            <button
              onClick={fetchData}
              className="p-2 bg-[#FAF8F5] border border-[#E5E2D9] rounded-xl hover:bg-gray-100 text-[#111827] cursor-pointer"
              title="تحديث البيانات"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-[#E5E2D9] overflow-hidden shadow-xs">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-right text-xs">
              <thead className="bg-[#FAF8F5] border-b border-[#E5E2D9] text-[#111827] font-extrabold">
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
              <tbody className="divide-y divide-[#E5E2D9]">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center">
                      <div className="flex flex-col items-center justify-center gap-2 text-[#C9A24A]">
                        <Loader2 size={32} className="animate-spin" />
                        <span className="text-xs font-bold text-[#6B7280]">جاري تحميل بيانات المستودع...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-[#6B7280]">
                      <Package size={40} className="mx-auto mb-2 text-[#E5E2D9]" />
                      <p className="font-bold text-sm text-[#111827]">لا توجد أصناف مطابقة لخيارات البحث أو الفلتر</p>
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-[#FAF8F5] transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-bold text-[#111827]">{item.name}</p>
                        <p className="text-[11px] text-[#6B7280]">{item.description || 'لا يوجد وصف'}</p>
                      </td>
                      <td className="px-4 py-3 text-[#4B5563]">{item.unit}</td>
                      <td className="px-4 py-3">
                        <span className="font-extrabold text-[#111827] font-mono text-sm">{item.current_quantity}</span>
                      </td>
                      <td className="px-4 py-3 text-[#6B7280] font-mono">{item.min_threshold}</td>
                      <td className="px-4 py-3">
                        {item.expiration_date ? (
                          <div className="flex items-center gap-1.5 font-mono text-xs">
                            <Calendar size={13} className="text-[#C9A24A]" />
                            <span>{new Date(item.expiration_date).toLocaleDateString('ar-SA')}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={item.expiryState} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={item.stock_status || 'in_stock'} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedItem(item);
                              setShowAdjustModal(true);
                            }}
                            className="p-1.5 bg-[#FAF8F5] hover:bg-green-50 text-[#3F6B3A] rounded-xl border border-[#E5E2D9] transition-colors cursor-pointer"
                            title="تعديل المخزون (صرف / توريد)"
                            aria-label="تعديل المخزون"
                          >
                            <ArrowUpCircle size={15} />
                          </button>
                          <button
                            onClick={() => setItemToDelete(item)}
                            className="p-1.5 bg-[#FAF8F5] hover:bg-red-50 text-[#C24B3F] rounded-xl border border-[#E5E2D9] transition-colors cursor-pointer"
                            title="حذف الصنف"
                            aria-label="حذف الصنف"
                          >
                            <Trash2 size={15} />
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
                className="px-4 py-2 bg-gray-100 text-gray-700 font-bold rounded-xl text-xs hover:bg-gray-200"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleAddSubmit}
                disabled={isSubmitting}
                className="px-5 py-2 bg-[#D97706] hover:bg-[#B45309] text-white font-extrabold rounded-xl text-xs shadow-xs"
              >
                {isSubmitting ? "جاري الإضافة..." : "حفظ الصنف وتوثيق الصلاحية"}
              </button>
            </div>
          }
        >
          <form className="space-y-3.5" dir="rtl">
            <FormField label="اسم الصنف / المادة" name="name" required>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E2D9] text-xs text-right"
                placeholder="مثال: أرز بسمتي 5 كجم"
              />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="الوحدة" name="unit" required>
                <select
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E2D9] text-xs text-right bg-white"
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
                  min="0"
                  value={formData.current_quantity}
                  onChange={(e) => setFormData({ ...formData, current_quantity: e.target.value })}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E2D9] text-xs text-right font-mono"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="حد التنبيه الأدنى للمخزون" name="min_threshold" required>
                <input
                  type="number"
                  min="1"
                  value={formData.min_threshold}
                  onChange={(e) => setFormData({ ...formData, min_threshold: e.target.value })}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E2D9] text-xs text-right font-mono"
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
                  value={formData.expiration_date}
                  onChange={(e) => setFormData({ ...formData, expiration_date: e.target.value })}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E2D9] text-xs text-right font-mono bg-white"
                />
              </FormField>
            </div>

            <FormField label="الوصف والملاحظات" name="description">
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                className="w-full px-3.5 py-2 rounded-xl border border-[#E5E2D9] text-xs text-right"
                placeholder="تفاصيل التخزين، المورد، أو السلة التابعة..."
              />
            </FormField>
          </form>
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
                className="px-4 py-2 bg-gray-100 text-gray-700 font-bold rounded-xl text-xs hover:bg-gray-200"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleAdjustSubmit}
                disabled={isSubmitting}
                className="px-5 py-2 bg-[#3F6B3A] hover:bg-[#31542D] text-white font-extrabold rounded-xl text-xs shadow-xs"
              >
                {isSubmitting ? "جاري التعديل..." : "تأكيد حركة المخزون"}
              </button>
            </div>
          }
        >
          <form className="space-y-3" dir="rtl">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="نوع الحركة" name="type" required>
                <select
                  value={adjustData.type}
                  onChange={(e) => setAdjustData({ ...adjustData, type: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E2D9] text-xs font-bold bg-white"
                >
                  <option value="in">➕ توريد / إضافة (+) </option>
                  <option value="out">➖ صرف / إنقاص (-)</option>
                </select>
              </FormField>

              <FormField label="الكمية" name="quantity" required>
                <input
                  type="number"
                  min="1"
                  value={adjustData.quantity}
                  onChange={(e) => setAdjustData({ ...adjustData, quantity: e.target.value })}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E2D9] text-xs font-mono text-right"
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
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E2D9] text-xs text-right"
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