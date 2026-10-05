import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getApiBaseUrl } from '../../utils/documentUrl';
import { getBeneficiary, updateBeneficiary } from '../../api/beneficiaries';
import api from '../../api/axios';
import MainLayout from '../../components/layout/MainLayout';
import { calculateIncomeAndClassification } from '../../utils/financialCalculations';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import { 
  Loader2, Save, X, User, MapPin, Users, DollarSign, FileText, 
  Plus, Trash2, Calculator
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
    income_sources: [],
  });

  const [dependents, setDependents] = useState([]);
  const [files, setFiles] = useState({});
  const [existingDocs, setExistingDocs] = useState({});

  // Dynamic thresholds loaded from settings (mirrors AddBeneficiaryPage)
  const [thresholds, setThresholds] = useState({
    firstClassMaxIncome: 3000,
    secondClassMaxIncome: 6000,
    residentDegreeThreshold: 3000,
    elderlyMinAge: 60,
  });

  useEffect(() => {
    api.get("/settings")
      .then((res) => {
        if (res.data?.data) {
          setThresholds({
            firstClassMaxIncome: parseFloat(res.data.data.first_class_max_income) || 3000,
            secondClassMaxIncome: parseFloat(res.data.data.second_class_max_income) || 6000,
            residentDegreeThreshold: parseFloat(res.data.data.resident_need_threshold) || parseFloat(res.data.data.resident_degree_threshold) || 3000,
            elderlyMinAge: parseFloat(res.data.data.elderly_min_age) || 60,
          });
        }
      })
      .catch(() => {});
  }, []);

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
          monthly_rent_amount: b.monthly_rent || (b.annual_rent_amount ? Math.round(b.annual_rent_amount / 12) : ""),
          income_sources: Array.isArray(b.income_sources) ? b.income_sources : [
            b.monthly_salary > 0 && "salary", b.social_security_amount > 0 && "social_security",
            b.citizen_account_amount > 0 && "citizen_account", b.retirement_pension > 0 && "retirement",
            b.family_support > 0 && "family_support",
          ].filter(Boolean),
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
    if (name === "annual_rent_amount") {
      const annual = Math.max(0, parseFloat(value) || 0);
      const monthly = annual > 0 ? Math.round((annual / 12) * 100) / 100 : "";
      setForm((f) => ({
        ...f,
        annual_rent_amount: value,
        monthly_rent_amount: monthly,
      }));
      return;
    }
    if (name === "monthly_rent_amount") {
      const monthly = Math.max(0, parseFloat(value) || 0);
      const annual = monthly > 0 ? Math.round(monthly * 12 * 100) / 100 : "";
      setForm((f) => ({
        ...f,
        monthly_rent_amount: value,
        annual_rent_amount: annual,
      }));
      return;
    }
    setForm((f) => ({ ...f, [name]: t === "checkbox" ? checked : value }));
  };

  const handleFileChange = (e) => {
    const { name, files: fl } = e.target;
    if (fl && fl[0]) {
      setFiles((prev) => ({ ...prev, [name]: fl[0] }));
    }
  };

  const toggleIncome = (source) => {
    const fields = { salary: "monthly_salary", social_security: "social_security_amount", citizen_account: "citizen_account_amount", retirement: "retirement_pension", family_support: "family_support" };
    setForm((current) => {
      const removing = current.income_sources.includes(source);
      return { ...current, income_sources: removing ? current.income_sources.filter((item) => item !== source) : [...current.income_sources, source], ...(removing ? { [fields[source]]: "" } : {}) };
    });
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
      selectedIncomeSources: form.income_sources,
      housingType: form.housing_type,
      annualRentAmount: form.annual_rent_amount,
      monthlyRentAmount: form.monthly_rent_amount,
      hasSpecialNeeds: form.has_special_needs,
      dateOfBirth: form.date_of_birth,
      thresholds,
    });
  }, [form, thresholds]);

  const totalIncome = calcResult.eligibleIncome;
  const calcCategoryLabel = () => calcResult.categoryLabel;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const fd = new FormData();
      const payload = {
        ...form,
        total_income: calcResult.eligibleIncome,
        gross_income: calcResult.totalGrossIncome,
        monthly_rent: calcResult.monthlyRent,
        net_income: calcResult.eligibleIncome,
      };
      // Append fields — arrays use indexed keys so Laravel receives a real array
      // (same serialization as AddBeneficiaryPage; raw append stringifies arrays).
      Object.keys(payload).forEach((key) => {
        const value = payload[key];
        if (value === null || value === undefined) return;
        if (Array.isArray(value)) {
          value.forEach((item, i) => fd.append(`${key}[${i}]`, item));
        } else if (typeof value === "boolean") {
          fd.append(key, value ? "1" : "0");
        } else {
          fd.append(key, value);
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
          <span className="text-[var(--color-text-muted)] font-bold text-sm">جاري تحميل بيانات المستفيد...</span>
        </div>
      </MainLayout>
    );
  }

  const inputCls = "ikram-control";
  const labelCls = "ikram-label";
  const sectionCls = "ikram-panel p-4 sm:p-6 mb-6";
  const headerCls = "text-base font-extrabold text-amber-900 mb-5 border-b border-[var(--color-border)] pb-3 flex items-center justify-between";

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
        <div className="ikram-panel mb-6 flex gap-1 overflow-x-auto p-1.5 text-xs font-bold" role="tablist" aria-label="أقسام تعديل المستفيد">
          <button
            type="button"
            onClick={() => setActiveTab("basic")}
            className={`flex-1 py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === "basic" ? "bg-[var(--color-brand-green)] text-white shadow-xs font-extrabold" : "text-amber-900 hover:bg-[var(--color-bg-soft)]"
            }`}
          >
            <User className="w-4 h-4" />
            <span>1. البيانات الأساسية</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("address")}
            className={`flex-1 py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === "address" ? "bg-[var(--color-brand-green)] text-white shadow-xs font-extrabold" : "text-amber-900 hover:bg-[var(--color-bg-soft)]"
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>2. السكن والعنوان</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("family")}
            className={`flex-1 py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === "family" ? "bg-[var(--color-brand-green)] text-white shadow-xs font-extrabold" : "text-amber-900 hover:bg-[var(--color-bg-soft)]"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>3. الأسرة والتابعين ({dependents.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("financial")}
            className={`flex-1 py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === "financial" ? "bg-[var(--color-brand-green)] text-white shadow-xs font-extrabold" : "text-amber-900 hover:bg-[var(--color-bg-soft)]"
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>4. البيانات المالية</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("documents")}
            className={`flex-1 py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === "documents" ? "bg-[var(--color-brand-green)] text-white shadow-xs font-extrabold" : "text-amber-900 hover:bg-[var(--color-bg-soft)]"
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
                  className="bg-[var(--color-brand-green)] hover:bg-[var(--color-brand-green-hover)] text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                >
                  <Plus size={14} />
                  <span>إضافة فرد تابع جديد</span>
                </button>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                {(form.beneficiary_type === "resident" ? [["salary", "راتب شهري"], ["family_support", "دعم الأسرة"]] : [["salary", "راتب شهري"], ["social_security", "ضمان اجتماعي"], ["citizen_account", "حساب المواطن"], ["retirement", "معاش تقاعدي"], ["family_support", "دعم الأسرة"]]).map(([source, label]) => (
                  <button key={source} type="button" onClick={() => toggleIncome(source)} className={`px-3 py-2 rounded-xl border text-xs font-bold ${form.income_sources.includes(source) ? "bg-[var(--color-brand-green)] text-white" : "bg-white"}`}>{label}</button>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {[["salary", "monthly_salary", "الراتب الشهري"], ["social_security", "social_security_amount", "الضمان الاجتماعي"], ["citizen_account", "citizen_account_amount", "حساب المواطن"], ["retirement", "retirement_pension", "المعاش التقاعدي"], ["family_support", "family_support", "دعم الأسرة والأقارب"]].map(([source, field, label]) => form.income_sources.includes(source) && (
                  <div key={source}><label className={labelCls}>{label} (ريال)</label><input type="number" min="0" name={field} value={form[field]} onChange={handleChange} placeholder="0" className={inputCls + " font-mono font-bold"} /></div>
                ))}
                {form.housing_type === "rent" && (
                  <>
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

                    <div>
                      <label className={labelCls}>أو مبلغ الإيجار الشهري (ريال)</label>
                      <input
                        type="number"
                        name="monthly_rent_amount"
                        value={form.monthly_rent_amount}
                        onChange={handleChange}
                        placeholder="مثال: 1500"
                        className={inputCls}
                      />
                    </div>

                    <div className="col-span-full bg-[var(--color-bg-soft)] p-3 rounded-xl border border-[var(--color-border)] text-xs flex items-center justify-between font-bold text-amber-900">
                      <span>احتساب خصم السكن:</span>
                      <span className="font-mono">
                        الإيجار السنوي: {(parseFloat(form.annual_rent_amount) || (parseFloat(form.monthly_rent_amount) ? Math.round(parseFloat(form.monthly_rent_amount) * 12) : 0)).toLocaleString()} ريال ← الإيجار الشهري المحتسب: {(parseFloat(form.monthly_rent_amount) || (parseFloat(form.annual_rent_amount) ? Math.round((parseFloat(form.annual_rent_amount) / 12) * 100) / 100 : 0)).toLocaleString()} ريال
                      </span>
                    </div>
                  </>
                )}

                <div>
                  <label className={labelCls}>تصنيف الدرجة الفئوية</label>
                  <div className={inputCls + " font-extrabold text-amber-900 bg-[var(--color-bg-soft)]"}>{calcResult.categoryLabel}</div>
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="has_special_needs"
                    name="has_special_needs"
                    checked={form.has_special_needs}
                    onChange={handleChange}
                    className="w-4 h-4 text-amber-600 rounded focus:ring-[var(--color-brand-gold)] cursor-pointer"
                  />
                  <label htmlFor="has_special_needs" className="text-xs font-extrabold text-[var(--color-text-primary)] cursor-pointer select-none">
                    ♿ مسجل من ذوي الاحتياجات الخاصة (الإعاقة)
                  </label>
                </div>
              </div>

              {/* Dependents Table */}
              <div className="border border-[var(--color-border)] rounded-2xl p-4 bg-[var(--color-bg-soft)]/50">
                <h3 className="font-bold text-xs text-[var(--color-text-primary)] mb-3 flex items-center justify-between">
                  <span>قائمة الأفراد التابعين للأسرة:</span>
                  <span className="text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full font-mono font-bold text-[11px]">
                    إجمالي التابعين: {dependents.length}
                  </span>
                </h3>

                {dependents.length === 0 ? (
                  <div className="p-6 text-center text-[var(--color-text-muted)] text-xs bg-white rounded-xl border border-dashed border-[var(--color-border)]">
                    لا يوجد تابعين مسجلين حالياً. انقر على "إضافة فرد تابع جديد" بالأعلى لإدراجهم.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {dependents.map((dep, idx) => (
                      <div key={idx} className="bg-white p-3 rounded-xl border border-[var(--color-border)] flex flex-wrap md:flex-nowrap items-center gap-3 shadow-2xs">
                        <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-900 font-bold text-xs flex items-center justify-center font-mono">
                          {idx + 1}
                        </span>

                        <input
                          type="text"
                          placeholder="الاسم الكامل للتابع"
                          value={dep.name}
                          onChange={(e) => updateDependent(idx, "name", e.target.value)}
                          className="flex-1 px-3 py-1.5 rounded-lg border text-xs focus:ring-1 focus:ring-[var(--color-brand-gold)]"
                        />

                        <select
                          value={dep.relationship}
                          onChange={(e) => updateDependent(idx, "relationship", e.target.value)}
                          className="w-32 px-2 py-1.5 rounded-lg border text-xs bg-white focus:ring-1 focus:ring-[var(--color-brand-gold)] font-bold"
                        >
                          {RELATIONSHIP_OPTIONS.map(rel => (
                            <option key={rel} value={rel}>{rel}</option>
                          ))}
                        </select>

                        <input
                          type="date"
                          value={dep.date_of_birth}
                          onChange={(e) => updateDependent(idx, "date_of_birth", e.target.value)}
                          className="w-36 px-2 py-1.5 rounded-lg border text-xs focus:ring-1 focus:ring-[var(--color-brand-gold)] font-mono"
                        />

                        <button
                          type="button"
                          onClick={() => removeDependent(idx)}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-control)] text-[var(--color-danger)]"
                          title="حذف التابع"
                          aria-label="حذف التابع"
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
                    <span className="text-[11px] text-[var(--color-text-muted)] block mt-1">يُخصم من إجمالي الدخل لتحديد الدخل المحتسب</span>
                  </div>
                )}
              </div>

              {/* Formula & Calculation Box */}
              <div className="p-4 bg-[var(--color-bg-soft)] rounded-2xl border border-[var(--color-border)] text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-900">
                  <Calculator size={16} />
                  <span>معادلة الاحتساب بعد اقتطاع الإيجار:</span>
                </div>
                <p className="font-mono text-[var(--color-text-secondary)] bg-white p-2.5 rounded-xl border border-[var(--color-border)]">{calcResult.formulaText}</p>
              </div>

              {/* Financial Summary Cards */}
              <div className="grid sm:grid-cols-3 gap-3 pt-2">
                <div className="bg-white p-4 rounded-2xl border border-[var(--color-border)] shadow-2xs">
                  <span className="text-xs text-[var(--color-text-muted)] block font-bold mb-1">إجمالي الدخل الشهري</span>
                  <strong className="text-base font-mono text-[var(--color-text-primary)]">{calcResult.totalGrossIncome.toLocaleString()} ريال</strong>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-[var(--color-border)] shadow-2xs">
                  <span className="text-xs text-[var(--color-text-muted)] block font-bold mb-1">الإيجار الشهري</span>
                  <strong className="text-base ikram-numeric text-[var(--color-danger)]">{calcResult.monthlyRent.toLocaleString()} ريال</strong>
                </div>

                <div className="bg-white p-4 rounded-2xl border-2 border-emerald-500 shadow-2xs">
                  <span className="text-xs text-[var(--color-success)] font-bold block mb-1">صافي الدخل بعد الإيجار</span>
                  <strong className="text-base ikram-numeric text-[var(--color-success)]">{calcResult.eligibleIncome.toLocaleString()} ريال</strong>
                </div>
              </div>

              {/* Total Income Summary Card */}
              <div className="bg-gradient-to-r from-amber-600 to-amber-700 text-white p-5 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-md">
                <div>
                  <span className="text-xs font-bold block opacity-90 mb-1">صافي الدخل المعتمد للأهلية والتصنيف:</span>
                  <span className="text-2xl font-black font-mono">
                    {totalIncome.toLocaleString()} ريال سعودي
                  </span>
                </div>
                <div className="bg-white/20 backdrop-blur-xs px-4 py-2 rounded-xl text-xs font-extrabold border border-white/30 flex items-center gap-2">
                  <span>الفئة المحسوبة: {calcCategoryLabel()}</span>
                  {form.beneficiary_type === 'resident' && calcResult.needLevelLabel && (
                    <span className="bg-white/30 px-2 py-0.5 rounded-md text-[11px]">مستوى الاحتياج: {calcResult.needLevelLabel}</span>
                  )}
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
                {(form.income_sources?.includes("citizen_account") || existingDocs.citizen_account_image) && (
                  <FileUploadItem
                    name="citizen_account_image"
                    label="2. صورة إثبات حساب المواطن"
                    existingUrl={existingDocs.citizen_account_image}
                    onChange={handleFileChange}
                  />
                )}
                {(form.income_sources?.includes("social_security") || existingDocs.social_security_image) && (
                  <FileUploadItem
                    name="social_security_image"
                    label="3. صورة مشهد الضمان الاجتماعي"
                    existingUrl={existingDocs.social_security_image}
                    onChange={handleFileChange}
                  />
                )}
                {(form.income_sources?.includes("retirement") || existingDocs.pension_certificate_image) && (
                  <FileUploadItem
                    name="pension_certificate_image"
                    label="4. صورة مشهد راتب التقاعد"
                    existingUrl={existingDocs.pension_certificate_image}
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileChange}
                  />
                )}
                {(form.housing_type === "rent" || existingDocs.rental_contract_image) && (
                  <FileUploadItem
                    name="rental_contract_image"
                    label="5. عقد الإيجار / فاتورة الكهرباء"
                    existingUrl={existingDocs.rental_contract_image}
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileChange}
                  />
                )}
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
          <div className="ikram-panel sticky bottom-4 z-10 flex flex-col items-stretch justify-between gap-3 p-4 sm:flex-row sm:items-center sm:p-5">
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
    const target = new URL(urlStr, `${getApiBaseUrl()}/`);
    if (!/^\/api\/beneficiaries\/[^/]+\/documents\/[a-z_]+$/.test(target.pathname)) return "";
    const apiBase = getApiBaseUrl();
    return `${apiBase}${target.pathname}${target.search}`;
  };

  return (
    <div className="border-2 border-dashed border-[var(--color-border)] rounded-2xl p-4 hover:border-[var(--color-brand-gold)] transition-colors bg-white flex flex-col justify-between">
      <div>
        <label className="block text-xs font-bold text-[var(--color-text-primary)] mb-1">{label}</label>
        
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
          className="block w-full text-xs text-slate-700 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:bg-[var(--color-bg-soft)] file:text-[var(--color-text-secondary)] file:font-bold cursor-pointer"
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
