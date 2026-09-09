import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getBeneficiary, updateBeneficiary } from '../../api/beneficiaries';
import MainLayout from '../../components/layout/MainLayout';
import { calculateIncomeAndClassification } from '../../utils/financialCalculations';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import { 
  Loader2, Save, X, User, MapPin, Users, DollarSign, FileText, 
  Plus, Trash2, Shield, CheckCircle2, ArrowRight, Upload, AlertCircle, Calculator 
} from 'lucide-react';

const FAMILY_STATUS_OPTIONS = [
  { value: "poor",                    label: "فقير" },
  { value: "widow",                   label: "أرملة" },
  { value: "widow_with_orphans",      label: "أرملة مع أيتام" },
  { value: "divorced",                label: "مطلقة" },
  { value: "divorced_with_children",  label: "مطلقة مع أطفال" },
  { value: "abandoned",               label: "مهجورة" },
];

const RELATIONSHIP_OPTIONS = [
  "ابن", "بنت", "زوجة", "أم", "أب", "أخ", "أخت",
  "جد", "جدة", "حفيد", "أخرى"
];

const INITIAL_DEPENDENT = { name: "", relationship: "ابن", date_of_birth: "" };

export default function EditBeneficiaryPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");

  // Form Fields State
  const [form, setForm] = useState({
    beneficiary_type: "citizen",
    full_name: "",
    national_id: "",
    phone: "",
    date_of_birth: "",
    place_of_birth: "",
    nationality: "سعودي",
    profession: "",
    city: "مكة المكرمة",
    district: "",
    street: "",
    family_status: "",
    family_members_count: 1,
    housing_type: "rent",
    annual_rent_amount: "",
    owns_house: false,
    has_special_needs: false,
    monthly_salary: "",
    social_security_amount: "",
    citizen_account_amount: "",
    retirement_pension: "",
    family_support: "",
    status: "active",
    priority: "first_class",
    monthly_rent_amount: "",
  });

  const [dependents, setDependents] = useState([]);
  const [files, setFiles] = useState({});
  const [existingDocs, setExistingDocs] = useState({});

  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await getBeneficiary(id);
        const b = res.data?.data || res.data;

        setForm({
          beneficiary_type: b.beneficiary_type || b.type || "citizen",
          full_name: b.full_name || b.name || "",
          national_id: b.national_id || "",
          phone: b.phone || "",
          date_of_birth: b.date_of_birth ? String(b.date_of_birth).slice(0, 10) : "",
          place_of_birth: b.place_of_birth || b.birth_place || "",
          nationality: b.nationality || "سعودي",
          profession: b.profession || "",
          city: b.city || "مكة المكرمة",
          district: b.district || "",
          street: b.street || "",
          family_status: b.family_status || "",
          family_members_count: b.family_members_count || 1,
          housing_type: b.housing_type || "rent",
          annual_rent_amount: b.annual_rent_amount || "",
          owns_house: !!b.owns_house,
          has_special_needs: !!b.has_special_needs,
          monthly_salary: b.monthly_salary || "",
          social_security_amount: b.social_security_amount || "",
          citizen_account_amount: b.citizen_account_amount || "",
          retirement_pension: b.retirement_pension || "",
          family_support: b.family_support || "",
          status: b.status || "active",
          priority: b.priority || "first_class",
          monthly_rent_amount: b.monthly_rent_amount || (b.annual_rent_amount ? Math.round(b.annual_rent_amount / 12) : ""),
        });

        // Load dependents if exists
        if (b.dependents && Array.isArray(b.dependents)) {
          setDependents(b.dependents.map(d => ({
            name: d.name || d.full_name || "",
            relationship: d.relationship || "ابن",
            date_of_birth: d.date_of_birth ? String(d.date_of_birth).slice(0, 10) : "",
          })));
        }

        // Store existing document URLs
        setExistingDocs({
          national_id_image: b.national_id_image_url,
          citizen_account_image: b.citizen_account_image_url,
          social_security_image: b.social_security_image_url,
          pension_certificate_image: b.pension_certificate_image_url,
          rental_contract_image: b.rental_contract_image_url,
          national_address_image: b.national_address_image_url,
        });

      } catch (err) {
        console.error("Error loading beneficiary:", err);
        alert("⚠️ تعذر تحميل بيانات المستفيد.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id]);

  const handleChange = (e) => {
    const { name, value, type: t, checked } = e.target;
    setForm((f) => ({ ...f, [name]: t === "checkbox" ? checked : value }));
  };

  const handleFileChange = (e) => {
    const { name, files: fl } = e.target;
    if (fl && fl[0]) {
      setFiles((prev) => ({ ...prev, [name]: fl[0] }));
    }
  };

  // Dependents Handlers
  const addDependent = () => {
    const updated = [...dependents, { ...INITIAL_DEPENDENT }];
    setDependents(updated);
    setForm(f => ({ ...f, family_members_count: updated.length + 1 }));
  };

  const updateDependent = (idx, key, val) => {
    const updated = [...dependents];
    updated[idx][key] = val;
    setDependents(updated);
  };

  const removeDependent = (idx) => {
    const updated = dependents.filter((_, i) => i !== idx);
    setDependents(updated);
    setForm(f => ({ ...f, family_members_count: updated.length + 1 }));
  };

  // Total & Eligible Income Calculation
  const calcResult = useMemo(() => {
    return calculateIncomeAndClassification({
      beneficiaryType: form.beneficiary_type,
      monthlySalary: form.monthly_salary,
      socialSecurityAmount: form.social_security_amount,
      citizenAccountAmount: form.citizen_account_amount,
      retirementPension: form.retirement_pension,
      familySupport: form.family_support,
      housingType: form.housing_type,
      annualRentAmount: form.annual_rent_amount,
      monthlyRentAmount: form.monthly_rent_amount,
      hasSpecialNeeds: form.has_special_needs,
      dateOfBirth: form.date_of_birth,
    });
  }, [form]);

  const totalIncome = calcResult.eligibleIncome;
  const calcCategoryLabel = () => calcResult.categoryLabel;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const fd = new FormData();
      Object.keys(form).forEach((key) => {
        if (form[key] !== null && form[key] !== undefined) {
          if (typeof form[key] === "boolean") {
            fd.append(key, form[key] ? "1" : "0");
          } else {
            fd.append(key, form[key]);
          }
        }
      });

      // Add Dependents Array
      if (dependents.length > 0) {
        dependents.forEach((dep, i) => {
          fd.append(`dependents[${i}][name]`, dep.name || "");
          fd.append(`dependents[${i}][relationship]`, dep.relationship || "");
          if (dep.date_of_birth) {
            fd.append(`dependents[${i}][date_of_birth]`, dep.date_of_birth);
          }
        });
      }

      // Add Files
      Object.entries(files).forEach(([k, fileObj]) => {
        if (fileObj) fd.append(k, fileObj);
      });

      await updateBeneficiary(id, fd);
      alert("✅ تم حفظ وتحديث بيانات المستفيد والوثائق بنجاح.");
      navigate("/beneficiaries");
    } catch (err) {
      console.error("Error updating beneficiary:", err);
      if (err.response?.status === 422) {
        const errs = Object.values(err.response.data?.errors || {}).flat();
        alert("⚠️ تعذر الحفظ بسبب الأخطاء التالية:\n\n• " + errs.join("\n• "));
      } else {
        alert("⚠️ حدث خطأ أثناء حفظ التعديلات.");
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center py-24 gap-3" dir="rtl">
          <Loader2 size={44} className="text-amber-600 animate-spin" />
          <span className="text-gray-600 font-bold text-sm">جاري تحميل بيانات المستفيد...</span>
        </div>
      </MainLayout>
    );
  }

  const inputCls = "w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-500 text-right text-xs bg-white font-medium transition-all";
  const labelCls = "block text-xs font-bold text-gray-700 mb-1.5 text-right";
  const sectionCls = "bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-6";
  const headerCls = "text-base font-extrabold text-amber-900 mb-5 border-b border-amber-100 pb-3 flex items-center justify-between";

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto p-6" dir="rtl">
        
        {/* Top Action Header */}
        <PageHeader
          title="تعديل بيانات المستفيد الشاملة"
          subtitle={`${form.full_name} | رقم الهوية: ${form.national_id}`}
          breadcrumbs={[
            { label: "الرئيسية", href: "/" },
            { label: "إدارة المستفيدين", href: "/beneficiaries" },
            { label: "تعديل مستفيد" }
          ]}
          action={
            <Button variant="outline" size="sm" onClick={() => navigate("/beneficiaries")}>
              ← العودة لقائمة المستفيدين
            </Button>
          }
        />

        {/* Navigation Tabs Bar */}
        <div className="flex border-b border-gray-200 bg-white rounded-2xl p-1.5 mb-6 shadow-xs gap-1 text-xs font-bold overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("basic")}
            className={`flex-1 py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === "basic" ? "bg-amber-600 text-white shadow-xs font-extrabold" : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <User className="w-4 h-4" />
            <span>1. البيانات الأساسية</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("address")}
            className={`flex-1 py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === "address" ? "bg-amber-600 text-white shadow-xs font-extrabold" : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>2. السكن والعنوان</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("family")}
            className={`flex-1 py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === "family" ? "bg-amber-600 text-white shadow-xs font-extrabold" : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>3. الأسرة والتابعين ({dependents.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("financial")}
            className={`flex-1 py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === "financial" ? "bg-amber-600 text-white shadow-xs font-extrabold" : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>4. البيانات المالية</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("documents")}
            className={`flex-1 py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === "documents" ? "bg-amber-600 text-white shadow-xs font-extrabold" : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>5. الوثائق والمرفقات</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* TAB 1: Basic Info */}
          {activeTab === "basic" && (
            <div className={sectionCls}>
              <div className={headerCls}>
                <span className="flex items-center gap-2">
                  <User className="w-5 h-5 text-amber-600" />
                  <span>البيانات الأساسية والهوية الشخصية</span>
                </span>
                <span className="text-xs bg-amber-100 text-amber-900 px-3 py-1 rounded-full font-bold">
                  {form.beneficiary_type === "resident" ? "مقيم" : "مواطن سعودي"}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>الاسم الكامل *</label>
                  <input
                    type="text"
                    name="full_name"
                    value={form.full_name}
                    onChange={handleChange}
                    required
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>رقم الهوية الوطنية / الإقامة *</label>
                  <input
                    type="text"
                    name="national_id"
                    value={form.national_id}
                    onChange={handleChange}
                    required
                    className={inputCls + " font-mono font-bold"}
                  />
                </div>

                <div>
                  <label className={labelCls}>رقم الجوال *</label>
                  <input
                    type="tel"
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    required
                    className={inputCls + " font-mono"}
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className={labelCls}>تاريخ الميلاد</label>
                  <input
                    type="date"
                    name="date_of_birth"
                    value={form.date_of_birth}
                    onChange={handleChange}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>مكان الميلاد</label>
                  <input
                    type="text"
                    name="place_of_birth"
                    value={form.place_of_birth}
                    onChange={handleChange}
                    placeholder="مثال: مكة المكرمة"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>الجنسية</label>
                  <input
                    type="text"
                    name="nationality"
                    value={form.nationality}
                    onChange={handleChange}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>المهنة / الوظيفة الحالية</label>
                  <input
                    type="text"
                    name="profession"
                    value={form.profession}
                    onChange={handleChange}
                    placeholder="مثال: متقاعد / لا يعمل"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>حالة المستفيد بالنظام</label>
                  <select
                    name="status"
                    value={form.status}
                    onChange={handleChange}
                    className={inputCls + " font-bold"}
                  >
                    <option value="active">نشط (مستحق الدعم)</option>
                    <option value="suspended">موقوف مؤقتاً</option>
                    <option value="under_review">قيد التدقيق والتحقق</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Address */}
          {activeTab === "address" && (
            <div className={sectionCls}>
              <div className={headerCls}>
                <span className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-amber-600" />
                  <span>بيانات العنوان الوطني والموقع السكني</span>
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>المدينة</label>
                  <input
                    type="text"
                    name="city"
                    value={form.city}
                    onChange={handleChange}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>الحي السكني *</label>
                  <input
                    type="text"
                    name="district"
                    value={form.district}
                    onChange={handleChange}
                    required
                    placeholder="مثال: الشوقية"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>الشارع / المربع / رقم المبنى</label>
                  <input
                    type="text"
                    name="street"
                    value={form.street}
                    onChange={handleChange}
                    placeholder="مثال: شارع الستين - مبنى 12"
                    className={inputCls}
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Family & Dependents */}
          {activeTab === "family" && (
            <div className={sectionCls}>
              <div className={headerCls}>
                <span className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-amber-600" />
                  <span>البيانات الأسرية والاجتماعية وسجل التابعين</span>
                </span>
                <button
                  type="button"
                  onClick={addDependent}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                >
                  <Plus size={14} />
                  <span>إضافة فرد تابع جديد</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div>
                  <label className={labelCls}>الحالة الاجتماعية</label>
                  <select
                    name="family_status"
                    value={form.family_status}
                    onChange={handleChange}
                    className={inputCls}
                  >
                    <option value="">-- اختر الحالة الاجتماعية --</option>
                    {FAMILY_STATUS_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelCls}>نوع السكن</label>
                  <select
                    name="housing_type"
                    value={form.housing_type}
                    onChange={handleChange}
                    className={inputCls}
                  >
                    <option value="rent">سكن مؤجر (إيجار)</option>
                    <option value="own">سكن ملك خاص</option>
                  </select>
                </div>

                {form.housing_type === "rent" && (
                  <div>
                    <label className={labelCls}>قيمة الإيجار السنوي (ريال)</label>
                    <input
                      type="number"
                      name="annual_rent_amount"
                      value={form.annual_rent_amount}
                      onChange={handleChange}
                      placeholder="مثال: 18000"
                      className={inputCls}
                    />
                  </div>
                )}

                <div>
                  <label className={labelCls}>تصنيف الدرجة الفئوية</label>
                  <select
                    name="priority"
                    value={form.priority}
                    onChange={handleChange}
                    className={inputCls + " font-extrabold text-amber-900"}
                  >
                    <option value="first_class">درجة أولى (أولوية قصوى)</option>
                    <option value="second_class">درجة ثانية (أولوية متوسطة)</option>
                    <option value="special_needs">ذوو الاحتياجات الخاصة (الإعاقة)</option>
                    <option value="elderly">كبار السن والطاعنين في السن</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="has_special_needs"
                    name="has_special_needs"
                    checked={form.has_special_needs}
                    onChange={handleChange}
                    className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500 cursor-pointer"
                  />
                  <label htmlFor="has_special_needs" className="text-xs font-extrabold text-gray-800 cursor-pointer select-none">
                    ♿ مسجل من ذوي الاحتياجات الخاصة (الإعاقة)
                  </label>
                </div>
              </div>

              {/* Dependents Table */}
              <div className="border border-gray-200 rounded-2xl p-4 bg-gray-50/50">
                <h3 className="font-bold text-xs text-gray-800 mb-3 flex items-center justify-between">
                  <span>قائمة الأفراد التابعين للأسرة:</span>
                  <span className="text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full font-mono font-bold text-[11px]">
                    إجمالي التابعين: {dependents.length}
                  </span>
                </h3>

                {dependents.length === 0 ? (
                  <div className="p-6 text-center text-gray-400 text-xs bg-white rounded-xl border border-dashed border-gray-200">
                    لا يوجد تابعين مسجلين حالياً. انقر على "إضافة فرد تابع جديد" بالأعلى لإدراجهم.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {dependents.map((dep, idx) => (
                      <div key={idx} className="bg-white p-3 rounded-xl border border-gray-200 flex flex-wrap md:flex-nowrap items-center gap-3 shadow-2xs">
                        <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-900 font-bold text-xs flex items-center justify-center font-mono">
                          {idx + 1}
                        </span>

                        <input
                          type="text"
                          placeholder="الاسم الكامل للتابع"
                          value={dep.name}
                          onChange={(e) => updateDependent(idx, "name", e.target.value)}
                          className="flex-1 px-3 py-1.5 rounded-lg border text-xs focus:ring-1 focus:ring-amber-500"
                        />

                        <select
                          value={dep.relationship}
                          onChange={(e) => updateDependent(idx, "relationship", e.target.value)}
                          className="w-32 px-2 py-1.5 rounded-lg border text-xs bg-white focus:ring-1 focus:ring-amber-500 font-bold"
                        >
                          {RELATIONSHIP_OPTIONS.map(rel => (
                            <option key={rel} value={rel}>{rel}</option>
                          ))}
                        </select>

                        <input
                          type="date"
                          value={dep.date_of_birth}
                          onChange={(e) => updateDependent(idx, "date_of_birth", e.target.value)}
                          className="w-36 px-2 py-1.5 rounded-lg border text-xs focus:ring-1 focus:ring-amber-500 font-mono"
                        />

                        <button
                          type="button"
                          onClick={() => removeDependent(idx)}
                          className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 cursor-pointer transition-colors"
                          title="حذف التابع"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: Financial Info */}
          {activeTab === "financial" && (
            <div className={sectionCls}>
              <div className={headerCls}>
                <span className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-amber-600" />
                  <span>البيانات المالية ومصادر الدخل الشهري</span>
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div>
                  <label className={labelCls}>الراتب الشهري (ريال)</label>
                  <input
                    type="number"
                    name="monthly_salary"
                    value={form.monthly_salary}
                    onChange={handleChange}
                    placeholder="0"
                    className={inputCls + " font-mono font-bold"}
                  />
                </div>

                <div>
                  <label className={labelCls}>مبلغ الضمان الاجتماعي (ريال)</label>
                  <input
                    type="number"
                    name="social_security_amount"
                    value={form.social_security_amount}
                    onChange={handleChange}
                    placeholder="0"
                    className={inputCls + " font-mono font-bold"}
                  />
                </div>

                <div>
                  <label className={labelCls}>مبلغ حساب المواطن (ريال)</label>
                  <input
                    type="number"
                    name="citizen_account_amount"
                    value={form.citizen_account_amount}
                    onChange={handleChange}
                    placeholder="0"
                    className={inputCls + " font-mono font-bold"}
                  />
                </div>

                <div>
                  <label className={labelCls}>المعاش التقاعدي (ريال)</label>
                  <input
                    type="number"
                    name="retirement_pension"
                    value={form.retirement_pension}
                    onChange={handleChange}
                    placeholder="0"
                    className={inputCls + " font-mono font-bold"}
                  />
                </div>

                <div>
                  <label className={labelCls}>دعم الأسرة والأقارب (ريال)</label>
                  <input
                    type="number"
                    name="family_support"
                    value={form.family_support}
                    onChange={handleChange}
                    placeholder="0"
                    className={inputCls + " font-mono font-bold"}
                  />
                </div>

                {form.housing_type === "rent" && (
                  <div>
                    <label className={labelCls}>مبلغ الإيجار الشهري المقتطع (ريال)</label>
                    <input
                      type="number"
                      name="monthly_rent_amount"
                      value={form.monthly_rent_amount}
                      onChange={handleChange}
                      placeholder="مثال: 1000"
                      className={inputCls + " font-mono font-bold border-amber-300"}
                    />
                    <span className="text-[11px] text-[#6B7280] block mt-1">يُخصم من إجمالي الدخل لتحديد الدخل المحتسب</span>
                  </div>
                )}
              </div>

              {/* Formula & Calculation Box */}
              <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-200 text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-900">
                  <Calculator size={16} />
                  <span>معادلة الاحتساب بعد اقتطاع الإيجار:</span>
                </div>
                <p className="font-mono text-gray-700 bg-white p-2.5 rounded-xl border border-amber-100">{calcResult.formulaText}</p>
              </div>

              {/* Total Income Summary Card */}
              <div className="bg-gradient-to-r from-amber-600 to-amber-700 text-white p-5 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-md">
                <div>
                  <span className="text-xs font-bold block opacity-90 mb-1">إجمالي الدخل الشهري المحسوب بالنظام:</span>
                  <span className="text-2xl font-black font-mono">
                    {totalIncome.toLocaleString()} ريال سعودي
                  </span>
                </div>
                <div className="bg-white/20 backdrop-blur-xs px-4 py-2 rounded-xl text-xs font-extrabold border border-white/30">
                  الفئة المحسوبة: {calcCategoryLabel()}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: Documents */}
          {activeTab === "documents" && (
            <div className={sectionCls}>
              <div className={headerCls}>
                <span className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-600" />
                  <span>إرفاق وتحديث الوثائق والمستندات الرسمية</span>
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FileUploadItem
                  name="national_id_image"
                  label="1. صورة الهوية الوطنية / الإقامة"
                  existingUrl={existingDocs.national_id_image}
                  onChange={handleFileChange}
                />
                <FileUploadItem
                  name="citizen_account_image"
                  label="2. صورة إثبات حساب المواطن / الراتب"
                  existingUrl={existingDocs.citizen_account_image}
                  onChange={handleFileChange}
                />
                <FileUploadItem
                  name="social_security_image"
                  label="3. صورة مشهد الضمان الاجتماعي"
                  existingUrl={existingDocs.social_security_image}
                  onChange={handleFileChange}
                />
                <FileUploadItem
                  name="pension_certificate_image"
                  label="4. صورة مشهد راتب التقاعد"
                  existingUrl={existingDocs.pension_certificate_image}
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileChange}
                />
                <FileUploadItem
                  name="rental_contract_image"
                  label="5. عقد الإيجار / فاتورة الكهرباء"
                  existingUrl={existingDocs.rental_contract_image}
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileChange}
                />
                <FileUploadItem
                  name="national_address_image"
                  label="6. صورة إثبات العنوان الوطني"
                  existingUrl={existingDocs.national_address_image}
                  onChange={handleFileChange}
                />
              </div>
            </div>
          )}

          {/* Form Action Controls */}
          <div className="flex items-center justify-between bg-white p-5 rounded-2xl shadow-sm border border-gray-100 sticky bottom-4 z-10">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => navigate("/beneficiaries")}
              icon={X}
            >
              إلغاء
            </Button>

            <div className="flex items-center gap-3">
              {activeTab !== "documents" && (
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => {
                    const order = ["basic", "address", "family", "financial", "documents"];
                    const nextIdx = order.indexOf(activeTab) + 1;
                    if (nextIdx < order.length) setActiveTab(order[nextIdx]);
                  }}
                >
                  التالي ←
                </Button>
              )}

              <Button
                type="submit"
                variant="gold"
                size="md"
                loading={saving}
                icon={Save}
              >
                {saving ? "جاري حفظ البيانات وتحديث المستندات..." : "حفظ التعديلات والتصنيف"}
              </Button>
            </div>
          </div>

        </form>
      </div>
    </MainLayout>
  );
}

function FileUploadItem({ name, label, existingUrl, onChange, accept = "image/*" }) {
  const [selectedFile, setSelectedFile] = useState(null);

  const handleSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file.name);
      onChange(e);
    }
  };

  const getDocFullUrl = (urlStr) => {
    if (!urlStr) return "";
    if (urlStr.startsWith("http://") || urlStr.startsWith("https://")) return urlStr;
    const clean = urlStr.startsWith("/") ? urlStr.slice(1) : urlStr;
    const path = clean.startsWith("storage/") ? clean : `storage/${clean}`;
    const apiBase = (import.meta.env.VITE_API_URL || "https://ikram-system.onrender.com").replace(/\/api\/?$/, "");
    return `${apiBase}/${path}`;
  };

  return (
    <div className="border-2 border-dashed border-gray-200 rounded-2xl p-4 hover:border-amber-400 transition-colors bg-white flex flex-col justify-between">
      <div>
        <label className="block text-xs font-bold text-gray-800 mb-1">{label}</label>
        
        {existingUrl && !selectedFile && (
          <div className="mb-2 flex items-center justify-between text-[11px] bg-emerald-50 text-emerald-800 border border-emerald-200 p-2 rounded-xl">
            <span className="font-bold">✓ توجد وثيقة مسجلة مسبقاً بالنظام</span>
            <a
              href={getDocFullUrl(existingUrl)}
              target="_blank"
              rel="noreferrer"
              className="text-emerald-900 underline font-bold"
            >
              معاينة
            </a>
          </div>
        )}

        <input
          type="file"
          name={name}
          accept={accept}
          onChange={handleSelect}
          className="block w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:bg-amber-50 file:text-amber-800 file:font-bold cursor-pointer"
        />
      </div>

      {selectedFile && (
        <p className="text-[11px] text-green-700 font-extrabold mt-2 bg-green-50 p-1.5 rounded-lg border border-green-200">
          ✓ تم اختيار ملف جديد: {selectedFile}
        </p>
      )}
    </div>
  );
}