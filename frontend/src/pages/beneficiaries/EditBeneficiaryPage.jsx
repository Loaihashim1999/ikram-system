import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import beneficiaryApi, { getBeneficiary, updateBeneficiary } from '../../api/beneficiaries';
import MainLayout from '../../components/layout/MainLayout';
import { Loader2, Save, X, User, MapPin, Users, DollarSign, FileText } from 'lucide-react';

export default function EditBeneficiaryPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [files, setFiles] = useState({});
  const [formData, setFormData] = useState({
    full_name: '',
    national_id: '',
    phone: '',
    date_of_birth: '',
    place_of_birth: '',
    nationality: '',
    profession: '',
    city: '',
    district: '',
    street: '',
    family_status: '',
    family_members_count: 0,
    housing_type: 'rent',
    annual_rent_amount: '',
    has_special_needs: false,
    monthly_salary: '',
    social_security_amount: '',
    citizen_account_amount: '',
    retirement_pension: '',
    family_support: '',
    status: 'active',
    priority: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await getBeneficiary(id);
        const data = res.data.data ?? res.data;
        
        setFormData({
          full_name: data.full_name || data.name || '',
          national_id: data.national_id || '',
          phone: data.phone || '',
          date_of_birth: data.date_of_birth ? data.date_of_birth.substring(0, 10) : '',
          place_of_birth: data.place_of_birth || '',
          nationality: data.nationality || '',
          profession: data.profession || '',
          city: data.city || '',
          district: data.district || '',
          street: data.street || '',
          family_status: data.family_status || '',
          family_members_count: data.family_members_count || 0,
          housing_type: data.housing_type || 'rent',
          annual_rent_amount: data.annual_rent_amount || '',
          has_special_needs: !!data.has_special_needs,
          monthly_salary: data.monthly_salary || '',
          social_security_amount: data.social_security_amount || '',
          citizen_account_amount: data.citizen_account_amount || '',
          retirement_pension: data.retirement_pension || '',
          family_support: data.family_support || '',
          status: data.status || 'active',
          priority: data.priority || '',
        });
      } catch (error) {
        console.error('Error fetching beneficiary:', error);
        alert('حدث خطأ أثناء تحميل بيانات المستفيد');
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

  const handleFileChange = (e) => {
    const { name, files: fl } = e.target;
    if (fl && fl[0]) {
      setFiles((prev) => ({ ...prev, [name]: fl[0] }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const fd = new FormData();
      Object.keys(formData).forEach((key) => {
        if (formData[key] !== null && formData[key] !== undefined) {
          if (typeof formData[key] === 'boolean') {
            fd.append(key, formData[key] ? '1' : '0');
          } else {
            fd.append(key, formData[key]);
          }
        }
      });

      Object.entries(files).forEach(([k, fileObj]) => {
        if (fileObj) fd.append(k, fileObj);
      });

      await updateBeneficiary(id, fd);
      alert('✅ تم تحديث بيانات المستفيد والمالية والوثائق بنجاح');
      navigate('/beneficiaries');
    } catch (error) {
      console.error('Error updating beneficiary:', error);
      if (error.response?.status === 422) {
        const errs = Object.values(error.response.data?.errors || {}).flat();
        alert('⚠️ تعذر الحفظ بسبب الأخطاء التالية:\n\n• ' + errs.join('\n• '));
      } else {
        alert('حدث خطأ أثناء حفظ التعديلات.');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-20" dir="rtl">
          <Loader2 size={40} className="text-amber-600 animate-spin" />
        </div>
      </MainLayout>
    );
  }

  const inputCls = "w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-400 text-right text-xs bg-white";
  const labelCls = "block text-xs font-bold text-gray-700 mb-1 text-right";
  const sectionCls = "bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-6";
  const headerCls = "text-base font-bold text-amber-900 mb-4 border-b border-amber-100 pb-2 flex items-center gap-2";

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto p-6" dir="rtl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">✏️ تعديل بيانات المستفيد الشاملة</h1>
            <p className="text-xs text-gray-500 mt-1">تعديل البيانات الأساسية، السكن، الأسرة، المالية والوثائق المرفقة</p>
          </div>
          <Link to="/beneficiaries" className="text-amber-700 hover:underline text-xs font-bold">
            ← العودة لقائمة المستفيدين
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Basic Info */}
          <div className={sectionCls}>
            <h2 className={headerCls}>
              <User className="w-5 h-5 text-amber-600" />
              <span>البيانات الأساسية والهوية</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>الاسم الكامل *</label>
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  required
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>رقم الهوية / الإقامة *</label>
                <input
                  type="text"
                  name="national_id"
                  value={formData.national_id}
                  onChange={handleChange}
                  required
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>رقم الجوال *</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>تاريخ الميلاد</label>
                <input
                  type="date"
                  name="date_of_birth"
                  value={formData.date_of_birth}
                  onChange={handleChange}
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>مكان الميلاد</label>
                <input
                  type="text"
                  name="place_of_birth"
                  value={formData.place_of_birth}
                  onChange={handleChange}
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>الجنسية</label>
                <input
                  type="text"
                  name="nationality"
                  value={formData.nationality}
                  onChange={handleChange}
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          {/* Section 2: National Address */}
          <div className={sectionCls}>
            <h2 className={headerCls}>
              <MapPin className="w-5 h-5 text-amber-600" />
              <span>بيانات العنوان الوطني والسكن</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>المدينة</label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>الحي السكني</label>
                <input
                  type="text"
                  name="district"
                  value={formData.district}
                  onChange={handleChange}
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>الشارع / المربع</label>
                <input
                  type="text"
                  name="street"
                  value={formData.street}
                  onChange={handleChange}
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          {/* Section 3: Family Info */}
          <div className={sectionCls}>
            <h2 className={headerCls}>
              <Users className="w-5 h-5 text-amber-600" />
              <span>البيانات الأسرية والاجتماعية</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>الحالة الاجتماعية</label>
                <select
                  name="family_status"
                  value={formData.family_status}
                  onChange={handleChange}
                  className={inputCls}
                >
                  <option value="">-- اختر --</option>
                  <option value="poor">فقير</option>
                  <option value="widow">أرملة</option>
                  <option value="widow_with_orphans">أرملة مع أيتام</option>
                  <option value="divorced">مطلقة</option>
                  <option value="divorced_with_children">مطلقة مع أطفال</option>
                  <option value="abandoned">مهجورة</option>
                </select>
              </div>

              <div>
                <label className={labelCls}>عدد أفراد الأسرة</label>
                <input
                  type="number"
                  name="family_members_count"
                  value={formData.family_members_count}
                  onChange={handleChange}
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>نوع السكن</label>
                <select
                  name="housing_type"
                  value={formData.housing_type}
                  onChange={handleChange}
                  className={inputCls}
                >
                  <option value="rent">إيجار</option>
                  <option value="own">ملك</option>
                </select>
              </div>

              <div>
                <label className={labelCls}>حالة الفئة</label>
                <select
                  name="priority"
                  value={formData.priority}
                  onChange={handleChange}
                  className={inputCls + " font-bold text-amber-900"}
                >
                  <option value="first_class">درجة أولى (≤ 3000 ريال)</option>
                  <option value="second_class">درجة ثانية (≤ 6000 ريال)</option>
                  <option value="special_needs">ذوو احتياجات خاصة</option>
                  <option value="elderly">كبار السن</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-5">
                <input
                  type="checkbox"
                  id="has_special_needs"
                  name="has_special_needs"
                  checked={formData.has_special_needs}
                  onChange={handleChange}
                  className="w-4 h-4 text-amber-600 rounded"
                />
                <label htmlFor="has_special_needs" className="text-xs font-bold text-gray-800 cursor-pointer">
                  من ذوي الاحتياجات الخاصة (الإعاقة)
                </label>
              </div>
            </div>
          </div>

          {/* Section 4: Financial Info */}
          <div className={sectionCls}>
            <h2 className={headerCls}>
              <DollarSign className="w-5 h-5 text-amber-600" />
              <span>البيانات المالية والدخل الشهري</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>الراتب الشهري (ريال)</label>
                <input
                  type="number"
                  name="monthly_salary"
                  value={formData.monthly_salary}
                  onChange={handleChange}
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>الضمان الاجتماعي (ريال)</label>
                <input
                  type="number"
                  name="social_security_amount"
                  value={formData.social_security_amount}
                  onChange={handleChange}
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>حساب المواطن (ريال)</label>
                <input
                  type="number"
                  name="citizen_account_amount"
                  value={formData.citizen_account_amount}
                  onChange={handleChange}
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>معاش التقاعد (ريال)</label>
                <input
                  type="number"
                  name="retirement_pension"
                  value={formData.retirement_pension}
                  onChange={handleChange}
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>دعم الأسرة (ريال)</label>
                <input
                  type="number"
                  name="family_support"
                  value={formData.family_support}
                  onChange={handleChange}
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          {/* Section 5: Documents Updates */}
          <div className={sectionCls}>
            <h2 className={headerCls}>
              <FileText className="w-5 h-5 text-amber-600" />
              <span>تحديث الوثائق والمستندات المرفقة</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FileUpload name="national_id_image" label="تحديث صورة الهوية / الإقامة" onChange={handleFileChange} />
              <FileUpload name="citizen_account_image" label="تحديث صورة إثبات حساب المواطن / الراتب" onChange={handleFileChange} />
              <FileUpload name="social_security_image" label="تحديث صورة مشهد الضمان الاجتماعي" onChange={handleFileChange} />
              <FileUpload name="pension_certificate_image" label="تحديث صورة راتب التقاعد" onChange={handleFileChange} accept=".pdf,.jpg,.jpeg,.png" />
              <FileUpload name="rental_contract_image" label="تحديث عقد الإيجار / فاتورة الكهرباء" onChange={handleFileChange} accept=".pdf,.jpg,.jpeg,.png" />
              <FileUpload name="national_address_image" label="تحديث صورة العنوان الوطني" onChange={handleFileChange} />
            </div>
          </div>

          {/* Submit Action */}
          <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <button
              type="button"
              onClick={() => navigate('/beneficiaries')}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl border border-gray-300 text-gray-600 hover:bg-gray-100 font-bold text-xs"
            >
              <X size={18} />
              إلغاء
            </button>

            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-8 py-2.5 rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-700 shadow-md text-xs disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  جاري حفظ التعديلات...
                </>
              ) : (
                <>
                  <Save size={18} />
                  حفظ التعديلات والتصنيف
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}

function FileUpload({ name, label, onChange, accept = "image/*" }) {
  const [fileName, setFileName] = useState(null);

  const handleChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFileName(file.name);
      onChange(e);
    }
  };

  return (
    <div className="border-2 border-dashed border-gray-200 rounded-xl p-3.5 hover:border-amber-300 transition-colors bg-white">
      <label className="block text-xs font-bold text-gray-700 mb-1">{label}</label>
      <input type="file" name={name} accept={accept} onChange={handleChange} className="block w-full text-xs text-gray-500 file:mr-3 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:bg-amber-50 file:text-amber-700 file:font-bold cursor-pointer" />
      {fileName && <p className="text-[11px] text-green-600 font-bold mt-1">✓ تم اختيار: {fileName}</p>}
    </div>
  );
}