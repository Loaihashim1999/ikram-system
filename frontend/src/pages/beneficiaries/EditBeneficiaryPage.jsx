import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getBeneficiary, updateBeneficiary, getCategories } from '../../api/beneficiaries';
import MainLayout from '../../components/layout/MainLayout';
import { Loader2, Save, X } from 'lucide-react';

export default function EditBeneficiaryPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState([]);
  const [formData, setFormData] = useState({
    full_name: '',
    national_id: '',
    phone: '',
    city: '',
    district: '',
    street: '',
    category_id: '',
    status: 'active',
    has_special_needs: false,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [beneficiaryRes, categoriesRes] = await Promise.all([
          getBeneficiary(id),
          getCategories(),
        ]);
        
        const data = beneficiaryRes.data.data;
        setFormData({
          full_name: data.full_name || '',
          national_id: data.national_id || '',
          phone: data.phone || '',
          city: data.city || '',
          district: data.district || '',
          street: data.street || '',
          category_id: data.category_id || '',
          status: data.status || 'active',
          has_special_needs: data.has_special_needs || false,
        });
        
        setCategories(categoriesRes.data.data);
      } catch (error) {
        console.error('Error fetching data:', error);
        alert('حدث خطأ أثناء تحميل البيانات');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const formDataObj = new FormData();
      Object.keys(formData).forEach((key) => {
        if (formData[key] !== null && formData[key] !== '') {
          formDataObj.append(key, formData[key]);
        }
      });

      await updateBeneficiary(id, formDataObj);
      alert('تم تحديث بيانات المستفيد بنجاح');
      navigate('/beneficiaries');
    } catch (error) {
      console.error('Error updating beneficiary:', error);
      alert('حدث خطأ أثناء التحديث');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 size={40} className="text-[#C9A24A] animate-spin" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto" dir="rtl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[#546027]">تعديل بيانات المستفيد</h1>
          <p className="text-[#6B6B66] mt-1">قم بتحديث معلومات المستفيد</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl shadow-md border border-[#E5E2D9]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-[#111111] mb-2 text-right">الاسم الكامل *</label>
              <input
                type="text"
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 rounded-lg border border-[#E5E2D9] focus:border-[#C9A24A] outline-none text-right"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#111111] mb-2 text-right">رقم الهوية</label>
              <input
                type="text"
                name="national_id"
                value={formData.national_id}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-lg border border-[#E5E2D9] focus:border-[#C9A24A] outline-none text-right"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#111111] mb-2 text-right">رقم الهاتف</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-lg border border-[#E5E2D9] focus:border-[#C9A24A] outline-none text-right"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#111111] mb-2 text-right">المدينة</label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-lg border border-[#E5E2D9] focus:border-[#C9A24A] outline-none text-right"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#111111] mb-2 text-right">الحي</label>
              <input
                type="text"
                name="district"
                value={formData.district}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-lg border border-[#E5E2D9] focus:border-[#C9A24A] outline-none text-right"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-[#111111] mb-2 text-right">الشارع</label>
              <input
                type="text"
                name="street"
                value={formData.street}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-lg border border-[#E5E2D9] focus:border-[#C9A24A] outline-none text-right"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#111111] mb-2 text-right">الفئة</label>
              <select
                name="category_id"
                value={formData.category_id}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-lg border border-[#E5E2D9] focus:border-[#C9A24A] outline-none text-right"
              >
                <option value="">اختر الفئة</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#111111] mb-2 text-right">الحالة</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-lg border border-[#E5E2D9] focus:border-[#C9A24A] outline-none text-right"
              >
                <option value="active">نشط</option>
                <option value="suspended">موقوف</option>
                <option value="under_review">قيد المراجعة</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="has_special_needs"
                  checked={formData.has_special_needs}
                  onChange={handleChange}
                  className="w-4 h-4 text-[#C9A24A] rounded focus:ring-[#C9A24A]"
                />
                <span className="text-sm font-medium text-[#111111]">من ذوي الاحتياجات الخاصة</span>
              </label>
            </div>
          </div>

          <div className="flex justify-between mt-8 pt-6 border-t border-[#E5E2D9]">
            <button
              type="button"
              onClick={() => navigate('/beneficiaries')}
              className="flex items-center gap-2 px-6 py-3 rounded-lg border-2 border-[#E5E2D9] text-[#6B6B66] hover:bg-[#F7F5F0]"
            >
              <X size={18} />
              إلغاء
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-8 py-3 rounded-lg bg-[#C9A24A] text-white hover:bg-[#8A6B24] disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  جاري الحفظ...
                </>
              ) : (
                <>
                  <Save size={18} />
                  حفظ التعديلات
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}