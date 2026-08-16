import { useState, useEffect } from 'react';
import { getInventory, addInventoryItem, deleteInventoryItem, adjustStock } from '../../api/warehouse';
import MainLayout from '../../components/layout/MainLayout';
import {
  Package, AlertTriangle, TrendingUp, Plus, Edit, Trash2, 
  ArrowUpCircle, ArrowDownCircle, X, Loader2, Search, RefreshCw
} from 'lucide-react';

export default function Warehouse() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  
  // Form states
  const [formData, setFormData] = useState({ name: '', unit: 'كرتون', current_quantity: 0, min_threshold: 10, description: '' });
  const [adjustData, setAdjustData] = useState({ type: 'in', quantity: 1, reason: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
  setLoading(true);
  try {
    const response = await getInventory();
    console.log('Inventory data:', response.data);
    setItems(response.data.data);
  } catch (error) {
    console.error('Error fetching inventory:', error);
  } finally {
    setLoading(false);
  }
};

  useEffect(() => { fetchData(); }, []);

 
 const handleAddSubmit = async (e) => {
  e.preventDefault();
  setIsSubmitting(true);
  try {
    const response = await addInventoryItem({
      ...formData,
      current_quantity: parseInt(formData.current_quantity) || 0,
      min_threshold: parseInt(formData.min_threshold) || 0,
    });
    console.log('Success:', response.data);
    setShowAddModal(false);
    setFormData({ name: '', unit: 'كرتون', current_quantity: 0, min_threshold: 10, description: '' });
    fetchData();
    alert('تم إضافة الصنف بنجاح');
  } catch (error) {
    console.error('Full error:', error);
    
    if (error.response) {
      if (error.response.status === 422) {
        const errors = error.response.data.errors || error.response.data.message;
        let errorMessage = 'حدث خطأ في البيانات:\n\n';
        if (typeof errors === 'object') {
          Object.keys(errors).forEach(key => {
            errorMessage += `${key}: ${errors[key].join(', ')}\n`;
          });
        } else {
          errorMessage += errors;
        }
        alert(errorMessage);
      } else {
        alert(`خطأ: ${error.response.data.message || 'حدث خطأ غير متوقع'}`);
      }
    } else {
      alert('حدث خطأ في الاتصال بالخادم. تأكد أن Laravel يعمل على المنفذ 8000');
    }
  } finally {
    setIsSubmitting(false);
  }
};

const handleAdjustSubmit = async (e) => {
  e.preventDefault();
  setIsSubmitting(true);
  
  // التحقق من أن selectedItem موجود
  if (!selectedItem || !selectedItem.id) {
    alert('حدث خطأ: لم يتم تحديد الصنف');
    setIsSubmitting(false);
    return;
  }
  
  try {
    await adjustStock(selectedItem.id, {
      ...adjustData,
      quantity: parseInt(adjustData.quantity) || 0,
    });
    setShowAdjustModal(false);
    setAdjustData({ type: 'in', quantity: 1, reason: '' });
    setSelectedItem(null);
    fetchData();
    alert('تم تعديل المخزون بنجاح');
  } catch (error) {
    console.error('Adjust error:', error);
    alert(error.response?.data?.message || 'حدث خطأ أثناء تعديل المخزون');
  } finally {
    setIsSubmitting(false);
  }
};

  const handleDelete = async (id) => {
    if (window.confirm('هل أنت متأكد من حذف هذا الصنف؟')) {
      try {
        await deleteInventoryItem(id);
        fetchData();
      } catch (error) {
        alert('حدث خطأ أثناء الحذف');
      }
    }
  };

  const getStatusBadge = (status) => {
    if (status === 'out_of_stock') return <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#FCE8E6] text-[#C24B3F]">نافذ</span>;
    if (status === 'low_stock') return <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#FEF3D6] text-[#D89A2E]">منخفض</span>;
    return <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#E6F4EC] text-[#3B8A5E]">متوفر</span>;
  };

  const filteredItems = items.filter(item => item.name.toLowerCase().includes(search.toLowerCase()));
  
  const stats = {
    total: items.length,
    low: items.filter(i => i.stock_status === 'low_stock').length,
    out: items.filter(i => i.stock_status === 'out_of_stock').length,
  };

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto" dir="rtl">
        {/* الرأس */}
        <div className="flex flex-wrap items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#546027]">إدارة المستودع</h1>
            <p className="text-[#6B6B66] mt-1">متابعة المخزون، إضافة الأصناف، وتسجيل حركات الصرف والإضافة</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-[#C9A24A] text-white rounded-lg hover:bg-[#8A6B24] transition-colors font-medium"
          >
            <Plus size={20} />
            إضافة صنف جديد
          </button>
        </div>

        {/* الإحصائيات */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-5 rounded-xl border border-[#E5E2D9] flex items-center gap-4">
            <div className="w-12 h-12 bg-[#F5EDDA] rounded-full flex items-center justify-center">
              <Package size={24} className="text-[#C9A24A]" />
            </div>
            <div>
              <p className="text-sm text-[#6B6B66]">إجمالي الأصناف</p>
              <p className="text-2xl font-bold text-[#111111]">{stats.total}</p>
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-[#E5E2D9] flex items-center gap-4">
            <div className="w-12 h-12 bg-[#FEF3D6] rounded-full flex items-center justify-center">
              <AlertTriangle size={24} className="text-[#D89A2E]" />
            </div>
            <div>
              <p className="text-sm text-[#6B6B66]">مخزون منخفض</p>
              <p className="text-2xl font-bold text-[#D89A2E]">{stats.low}</p>
            </div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-[#E5E2D9] flex items-center gap-4">
            <div className="w-12 h-12 bg-[#FCE8E6] rounded-full flex items-center justify-center">
              <TrendingUp size={24} className="text-[#C24B3F]" />
            </div>
            <div>
              <p className="text-sm text-[#6B6B66]">أصناف نافذة</p>
              <p className="text-2xl font-bold text-[#C24B3F]">{stats.out}</p>
            </div>
          </div>
        </div>

        {/* شريط البحث */}
        <div className="bg-white p-4 rounded-xl border border-[#E5E2D9] mb-4 flex gap-3">
          <div className="flex-1 relative">
            <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B6B66]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث عن اسم الصنف..."
              className="w-full pr-10 pl-4 py-2.5 rounded-lg border border-[#E5E2D9] focus:border-[#C9A24A] outline-none transition-all text-right"
            />
          </div>
          <button onClick={fetchData} className="px-4 py-2.5 bg-white border border-[#E5E2D9] rounded-lg hover:bg-[#F7F5F0]">
            <RefreshCw size={18} className="text-[#6B6B66]" />
          </button>
        </div>

        {/* الجدول */}
        <div className="bg-white rounded-xl border border-[#E5E2D9] overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={40} className="text-[#C9A24A] animate-spin" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Package size={60} className="text-[#E5E2D9] mb-4" />
              <p className="text-[#6B6B66] text-lg">لا توجد أصناف في المستودع</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#F7F5F0] border-b border-[#E5E2D9]">
                  <tr>
                    <th className="px-6 py-4 text-right text-sm font-bold text-[#111111]">الصنف</th>
                    <th className="px-6 py-4 text-right text-sm font-bold text-[#111111]">الوحدة</th>
                    <th className="px-6 py-4 text-right text-sm font-bold text-[#111111]">المخزون الحالي</th>
                    <th className="px-6 py-4 text-right text-sm font-bold text-[#111111]">الحد الأدنى</th>
                    <th className="px-6 py-4 text-right text-sm font-bold text-[#111111]">الحالة</th>
                    <th className="px-6 py-4 text-right text-sm font-bold text-[#111111]">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E2D9]">
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-[#F7F5F0] transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-medium text-[#111111]">{item.name}</p>
                        <p className="text-xs text-[#6B6B66]">{item.description || 'لا يوجد وصف'}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-[#111111]">{item.unit}</td>
                      <td className="px-6 py-4">
                        <span className="text-lg font-bold text-[#111111]">{item.current_quantity}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-[#6B6B66]">{item.min_threshold}</td>
                      <td className="px-6 py-4">{getStatusBadge(item.stock_status)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => { setSelectedItem(item); setShowAdjustModal(true); }}
                            className="p-2 rounded-lg hover:bg-[#E6F4EC] text-[#3B8A5E] transition-colors"
                            title="تعديل المخزون (إضافة/صرف)"
                          >
                            <ArrowUpCircle size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-2 rounded-lg hover:bg-[#FCE8E6] text-[#C24B3F] transition-colors"
                            title="حذف"
                          >
                            <Trash2 size={18} />
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

        {/* Modal: إضافة صنف جديد */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-[#111111]">إضافة صنف جديد</h3>
                <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-[#F7F5F0] rounded-lg"><X size={20} /></button>
              </div>
              <form onSubmit={handleAddSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#111111] mb-1">اسم الصنف *</label>
                  <input required type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-2.5 rounded-lg border border-[#E5E2D9] focus:border-[#C9A24A] outline-none text-right" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#111111] mb-1">الوحدة *</label>
                    <select value={formData.unit} onChange={(e) => setFormData({...formData, unit: e.target.value})} className="w-full px-4 py-2.5 rounded-lg border border-[#E5E2D9] focus:border-[#C9A24A] outline-none text-right">
                      <option value="كرتون">كرتون</option>
                      <option value="حبة">حبة</option>
                      <option value="كيلو">كيلو</option>
                      <option value="سلة">سلة</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#111111] mb-1">الكمية الابتدائية *</label>
                    <input required type="number" min="0" value={formData.current_quantity} onChange={(e) => setFormData({...formData, current_quantity: e.target.value === '' ? '' : parseInt(e.target.value) || 0})} className="w-full px-4 py-2.5 rounded-lg border border-[#E5E2D9] focus:border-[#C9A24A] outline-none text-right" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#111111] mb-1">الحد الأدنى للتنبيه *</label>
                  <input required type="number" min="0" value={formData.min_threshold} onChange={(e) => setFormData({...formData, min_threshold: e.target.value === '' ? '' : parseInt(e.target.value) || 0})} className="w-full px-4 py-2.5 rounded-lg border border-[#E5E2D9] focus:border-[#C9A24A] outline-none text-right" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#111111] mb-1">وصف الصنف</label>
                  <textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className="w-full px-4 py-2.5 rounded-lg border border-[#E5E2D9] focus:border-[#C9A24A] outline-none text-right" rows="2"></textarea>
                </div>
                <button type="submit" disabled={isSubmitting} className="w-full py-3 bg-[#C9A24A] text-white rounded-lg hover:bg-[#8A6B24] font-medium flex items-center justify-center gap-2">
                  {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                  {isSubmitting ? 'جاري الحفظ...' : 'حفظ الصنف'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Modal: تعديل المخزون (إضافة / صرف) */}
        {showAdjustModal && selectedItem && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-[#111111]">تعديل مخزون: {selectedItem.name}</h3>
                <button onClick={() => setShowAdjustModal(false)} className="p-1 hover:bg-[#F7F5F0] rounded-lg"><X size={20} /></button>
              </div>
              <div className="bg-[#F7F5F0] p-3 rounded-lg mb-4 flex justify-between text-sm">
                <span className="text-[#6B6B66]">المخزون الحالي:</span>
                <span className="font-bold text-[#111111]">{selectedItem.current_quantity} {selectedItem.unit}</span>
              </div>
              <form onSubmit={handleAdjustSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#111111] mb-1">نوع الحركة *</label>
                    <select value={adjustData.type} onChange={(e) => setAdjustData({...adjustData, type: e.target.value})} className="w-full px-4 py-2.5 rounded-lg border border-[#E5E2D9] focus:border-[#C9A24A] outline-none text-right">
                      <option value="in">إضافة للمخزون (وارد)</option>
                      <option value="out">صرف من المخزون (صادر)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#111111] mb-1">الكمية *</label>
                    <input required type="number" min="1" value={adjustData.quantity} onChange={(e) => setAdjustData({...adjustData, quantity: e.target.value === '' ? '' : parseInt(e.target.value) || 0})} className="w-full px-4 py-2.5 rounded-lg border border-[#E5E2D9] focus:border-[#C9A24A] outline-none text-right" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#111111] mb-1">سبب الحركة *</label>
                  <input required type="text" value={adjustData.reason} onChange={(e) => setAdjustData({...adjustData, reason: e.target.value})} placeholder="مثال: استلام دفعة جديدة، توزيع على مستفيدين" className="w-full px-4 py-2.5 rounded-lg border border-[#E5E2D9] focus:border-[#C9A24A] outline-none text-right" />
                </div>
                <button type="submit" disabled={isSubmitting} className={`w-full py-3 text-white rounded-lg font-medium flex items-center justify-center gap-2 ${adjustData.type === 'in' ? 'bg-[#3B8A5E] hover:bg-[#2d6a48]' : 'bg-[#C24B3F] hover:bg-[#A03A30]'}`}>
                  {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : (adjustData.type === 'in' ? <ArrowUpCircle size={18} /> : <ArrowDownCircle size={18} />)}
                  {isSubmitting ? 'جاري التنفيذ...' : (adjustData.type === 'in' ? 'تأكيد الإضافة' : 'تأكيد الصرف')}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}