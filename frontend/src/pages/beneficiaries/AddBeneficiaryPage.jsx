import { useState, useCallback, useEffect, useMemo } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import beneficiaryApi from "../../api/beneficiaries";
import api from "../../api/axios";
import MainLayout from "../../components/layout/MainLayout";
import { calculateIncomeAndClassification } from "../../utils/financialCalculations";
import PageHeader from "../../components/ui/PageHeader";
import Button from "../../components/ui/Button";
import {
  CheckCircle2, AlertCircle, Info, Shield, Save, FileText,
  UserCheck, MapPin, DollarSign, Users, Calculator, ArrowRight,
  Home, HelpCircle
} from "lucide-react";

/* ═══════════════════════ خيارات وحالات الأسرة ═══════════════════════ */

const FAMILY_STATUS_OPTIONS = [
  { value: "poor",                    label: "فقير" },
  { value: "widow",                   label: "أرملة" },
  { value: "widow_with_orphans",      label: "أرملة مع أيتام" },
  { value: "divorced",                label: "مطلقة" },
  { value: "divorced_with_children",  label: "مطلقة مع أطفال" },
  { value: "abandoned",               label: "مهجورة" },
];

const CITIZEN_INCOME_OPTIONS = [
  { value: "salary",           label: "راتب شهري" },
  { value: "social_security",  label: "ضمان اجتماعي" },
  { value: "retirement",       label: "معاش تقاعدي" },
  { value: "citizen_account",  label: "حساب المواطن" },
];

const RESIDENT_INCOME_OPTIONS = [
  { value: "salary",         label: "راتب شهري" },
  { value: "family_support", label: "دعم الأسرة من الأقارب" },
];

const HOUSING_TYPE_OPTIONS = [
  { value: "rent",                label: "إيجار (يتم خصمه من الدخل)" },
  { value: "own",                 label: "ملك خاص" },
  { value: "charitable_housing",  label: "سكن خيري" },
];

const RELATIONSHIP_OPTIONS = [
  "ابن", "بنت", "زوجة", "أم", "أب", "أخ", "أخت",
  "جد", "جدة", "حفيد", "أخرى"
];

const INITIAL_DEPENDENT = { name: "", relationship: "", date_of_birth: "" };

const STEPS = [
  { id: 1, label: "البيانات الأساسية" },
  { id: 2, label: "بيانات الأسرة والسكن" },
  { id: 3, label: "البيانات المالية والاحتساب" },
  { id: 4, label: "الوثائق والمرفقات" },
  { id: 5, label: "مراجعة وتأكيد الحفظ والتصنيف" },
];

/* ═══════════════════════ الحالة الابتدائية (خالية تماماً من البيانات البنكية) ═══════════════════════ */

const makeInitialForm = (type) => ({
  beneficiary_type: type,
  full_name: "",
  national_id: "",
  phone: "",
  date_of_birth: "",
  place_of_birth: "",
  nationality: type === "citizen" ? "سعودي" : "",
  profession: "",
  city: "مكة المكرمة",
  district: "",
  street: "",

  // الأسرة والسكن
  family_status: "",
  family_members_count: 1,
  has_special_needs: false,
  housing_type: "rent",
  monthly_rent_amount: "",
  annual_rent_amount: "",

  // البيانات المالية
  income_sources: [],
  monthly_salary: "",
  social_security_amount: "",
  retirement_pension: "",
  citizen_account_amount: "",
  family_support: "",

  // التصنيف
  priority: "",
  manual_override: false,
  category_override_reason: "",
});

export default function AddBeneficiaryPage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const type      = location.pathname.includes("resident") ? "resident" : "citizen";

  const [form, setForm]             = useState(makeInitialForm(type));
  const [dependents, setDependents] = useState([]);
  const [files, setFiles]           = useState({});
  const [step, setStep]             = useState(1);
  const [errors, setErrors]         = useState({});
  const [saving, setSaving]         = useState(false);
  const [idStatus, setIdStatus]     = useState(null);
  const [toast, setToast]           = useState(null);

  // Dynamic thresholds loaded from settings
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
            residentDegreeThreshold: parseFloat(res.data.data.resident_degree_threshold) || 3000,
            elderlyMinAge: parseFloat(res.data.data.elderly_min_age) || 60,
          });
        }
      })
      .catch(() => {});
  }, []);

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

  const handleFile = (e) => {
    const { name, files: fl } = e.target;
    if (fl && fl[0]) {
      setFiles((f) => ({ ...f, [name]: fl[0] }));
    }
  };

  const toggleIncome = (val) => {
    setForm((f) => ({
      ...f,
      income_sources: f.income_sources.includes(val)
        ? f.income_sources.filter((v) => v !== val)
        : [...f.income_sources, val],
    }));
  };

  const addDependent = () => setDependents((d) => [...d, { ...INITIAL_DEPENDENT }]);
  const removeDependent = (idx) => setDependents((d) => d.filter((_, i) => i !== idx));
  const updateDependent = (idx, field, val) =>
    setDependents((d) => d.map((dep, i) => (i === idx ? { ...dep, [field]: val } : dep)));

  const handleNationalIdBlur = useCallback(async () => {
    if (!form.national_id || form.national_id.length < 8) return;
    setIdStatus("checking");
    try {
      const res = await beneficiaryApi.checkNationalId(form.national_id);
      setIdStatus(res.data.exists ? "taken" : "ok");
    } catch {
      setIdStatus(null);
    }
  }, [form.national_id]);

  // Live Financial Calculation & Classification using utility
  const calcResult = useMemo(() => {
    return calculateIncomeAndClassification({
      beneficiaryType: type,
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
      thresholds,
    });
  }, [form, type, thresholds]);

  // Validation function for steps
  const validateCurrentStep = (targetStep) => {
    const newErrors = {};

    if (step === 1) {
      if (!form.full_name.trim()) newErrors.full_name = ["الاسم الكامل لرب الأسرة مطلوب."];
      if (!form.national_id.trim()) newErrors.national_id = ["رقم الهوية الوطنية أو الإقامة مطلوب."];
      if (!form.phone.trim()) newErrors.phone = ["رقم الجوال الفعال مطلوب للتواصل."];
      if (!form.date_of_birth) newErrors.date_of_birth = ["تاريخ الميلاد مطلوب."];
      if (!form.city.trim()) newErrors.city = ["المدينة مطلوبة."];
      if (!form.district.trim()) newErrors.district = ["اسم الحي السكني مطلوب."];
      if (!form.street.trim()) newErrors.street = ["الشارع أو المعلم مطلوب."];
      if (type === "resident" && !form.nationality.trim()) newErrors.nationality = ["الجنسية مطلوبة للمقيم."];
    } else if (step === 2) {
      if (!form.family_status) newErrors.family_status = ["يرجى تحديد الحالة الاجتماعية للأسرة."];
      if (!form.family_members_count || form.family_members_count < 1) newErrors.family_members_count = ["عدد أفراد الأسرة يجب أن يكون 1 على الأقل."];
      if (!form.housing_type) newErrors.housing_type = ["يرجى تحديد نوع السكن."];
      if (form.housing_type === "rent" && !form.monthly_rent_amount && !form.annual_rent_amount) {
        newErrors.monthly_rent_amount = ["يرجى إدخال قيمة الإيجار الشهري أو السنوي لاحتساب خصم الإيجار."];
      }
    } else if (step === 4) {
      if (type === "citizen") {
        if (!files.national_id_image) newErrors.national_id_image = ["صورة الهوية الوطنية مطلوبة للمواطن."];
        if (!files.national_address_image) newErrors.national_address_image = ["صورة العنوان الوطني مطلوبة."];
        if (!files.rental_contract_image) newErrors.rental_contract_image = ["عقد الإيجار أو فاتورة الكهرباء مطلوبة."];
      } else {
        if (!files.residence_id_image) newErrors.residence_id_image = ["صورة هوية مقيم (الإقامة) مطلوبة."];
        if (!files.national_address_image) newErrors.national_address_image = ["صورة العنوان الوطني مطلوبة."];
        if (!files.rental_contract_image) newErrors.rental_contract_image = ["عقد الإيجار أو فاتورة الكهرباء مطلوبة."];
        // Salary certificate is OPTIONAL for residents as per prompt rule
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNextStep = () => {
    if (validateCurrentStep(step)) {
      setStep((s) => s + 1);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (idStatus === "taken") return alert("رقم الهوية/الإقامة مسجل مسبقاً في النظام.");

    // Final validation
    if (!validateCurrentStep(step)) return;

    setSaving(true);
    setErrors({});

    const fd = new FormData();
    const appendField = (key, value) => {
      if (value === null || value === undefined || value === "") return;
      if (Array.isArray(value)) {
        value.forEach((item, i) => fd.append(`${key}[${i}]`, item));
      } else if (typeof value === 'boolean') {
        fd.append(key, value ? '1' : '0');
      } else {
        fd.append(key, value);
      }
    };

    // Calculate total and eligible income
    const finalPayload = {
      ...form,
      total_income: calcResult.eligibleIncome, // Calculated income after rent deduction
      gross_income: calcResult.totalGrossIncome,
      monthly_rent: calcResult.monthlyRent,
      net_income: calcResult.eligibleIncome,
      priority: form.manual_override && form.priority ? form.priority : calcResult.priority,
      category: form.manual_override && form.priority ? form.priority : calcResult.category,
    };

    // Explicitly delete any banking info from payload to prevent sending
    delete finalPayload.bank_name;
    delete finalPayload.iban;

    Object.entries(finalPayload).forEach(([k, v]) => appendField(k, v));

    dependents.forEach((dep, i) => {
      Object.entries(dep).forEach(([k, v]) => {
        if (v) fd.append(`dependents[${i}][${k}]`, v);
      });
    });

    Object.entries(files).forEach(([k, f]) => {
      if (f) fd.append(k, f);
    });

    try {
      await beneficiaryApi.create(fd);
      setToast("✅ تم حفظ وتصنيف المستفيد بنجاح!");
      setTimeout(() => {
        navigate("/beneficiaries");
      }, 1200);
    } catch (err) {
      if (err.response?.status === 422) {
        const validationErrors = err.response.data?.errors || {};
        const errorList = Object.values(validationErrors).flat();
        setErrors(validationErrors);
        setStep(1);
        alert("⚠️ تعذر حفظ بيانات المستفيد بسبب الأخطاء التالية:\n\n• " + errorList.join("\n• "));
      } else {
        alert(err.response?.data?.message || "حدث خطأ أثناء حفظ المستفيد. يرجى المحاولة مرة أخرى.");
      }
    } finally {
      setSaving(false);
    }
  };

  const cls = {
    input:   "w-full rounded-xl border border-[#E5E2D9] px-3.5 py-2.5 focus:outline-none focus:border-[#C9A24A] text-right text-xs bg-white",
    select:  "w-full rounded-xl border border-[#E5E2D9] px-3.5 py-2.5 bg-white focus:outline-none focus:border-[#C9A24A] text-right text-xs font-bold",
    label:   "block text-xs font-bold text-[#111827] mb-1",
    helper:  "text-[11px] text-[#6B7280] mt-1 block",
    section: "bg-white rounded-2xl border border-[#E5E2D9] p-5 mb-5 shadow-xs",
    h2:      "text-sm font-extrabold text-[#111827] mb-4 border-b border-[#E5E2D9] pb-2.5 flex items-center gap-2",
  };

  const Err = ({ f }) => {
    const err = errors[f];
    return err ? <p className="text-[#C24B3F] text-xs mt-1 font-bold">⚠️ {err[0]}</p> : null;
  };

  return (
    <MainLayout>
      <div className="p-4 lg:p-6 max-w-5xl mx-auto" dir="rtl">
        {/* Toast */}
        {toast && (
          <div className="fixed top-5 left-1/2 -translate-x-1/2 bg-[#3F6B3A] text-white font-extrabold px-6 py-3 rounded-2xl shadow-2xl z-50 flex items-center gap-2 text-xs">
            <CheckCircle2 className="w-5 h-5" />
            <span>{toast}</span>
          </div>
        )}

        {/* Top Header */}
        <PageHeader
          title={type === "citizen" ? "تسجيل مستفيد مواطن جديد" : "تسجيل مستفيد مقيم جديد"}
          subtitle="تعبئة البيانات، اقتطاع الإيجار، والتصنيف التلقائي (خالي تماماً من الحقول البنكية)"
          breadcrumbs={[
            { label: "الرئيسية", href: "/" },
            { label: "إدارة المستفيدين", href: "/beneficiaries" },
            { label: type === "citizen" ? "تسجيل مواطن" : "تسجيل مقيم" }
          ]}
          action={
            <Button variant="outline" size="sm" onClick={() => navigate("/beneficiaries")}>
              ← العودة للقائمة
            </Button>
          }
        />

        {/* Step Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {STEPS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                if (s.id < step || validateCurrentStep(step)) {
                  setStep(s.id);
                }
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                step === s.id
                  ? "bg-[#D97706] text-white shadow-xs"
                  : s.id < step
                  ? "bg-[#FAF8F5] text-[#3F6B3A] border border-[#3F6B3A]/30"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {s.id}. {s.label}
            </button>
          ))}
        </div>

        {/* Global Errors Banner */}
        {Object.keys(errors).length > 0 && (
          <div className="mb-6 p-4 bg-[#FEE2E2] border border-[#FCA5A5] rounded-2xl text-[#B91C1C] text-xs shadow-xs">
            <div className="flex items-center gap-2 font-bold text-xs mb-1">
              <AlertCircle className="w-4 h-4" />
              <span>يرجى تعبئة الحقول الإلزامية المطلوبة للمتابعة:</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 mr-2 font-medium">
              {Object.values(errors).flat().map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        <form onSubmit={handleSubmit} encType="multipart/form-data">
          {/* ══════════ STEP 1: البيانات الأساسية ══════════ */}
          {step === 1 && (
            <div className={cls.section}>
              <h2 className={cls.h2}>📋 البيانات الشخصية والمعلومات الأساسية (جميع الحقول إلزامية)</h2>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className={cls.label}>الاسم الرباعي الكامل *</label>
                  <input name="full_name" value={form.full_name} onChange={handleChange} className={cls.input} placeholder="الاسم الرباعي كما في الهوية" required />
                  <Err f="full_name" />
                </div>

                <div>
                  <label className={cls.label}>رقم {type === "citizen" ? "الهوية الوطنية" : "الإقامة"} *</label>
                  <input
                    name="national_id" value={form.national_id} onChange={handleChange}
                    onBlur={handleNationalIdBlur} maxLength={20} required
                    className={`${cls.input} font-mono ${
                      idStatus === "taken" ? "border-red-500" : idStatus === "ok" ? "border-green-500" : ""
                    }`}
                    placeholder={type === "citizen" ? "10XXXXXXXX" : "20XXXXXXXX"}
                  />
                  {idStatus === "checking" && <p className="text-gray-400 text-[11px] mt-1">⏳ جاري التحقق من الهوية...</p>}
                  {idStatus === "taken"    && <p className="text-[#C24B3F] text-[11px] mt-1 font-bold">❌ رقم الهوية مسجل مسبقاً في النظام</p>}
                  {idStatus === "ok"       && <p className="text-[#3F6B3A] text-[11px] mt-1 font-bold">✓ متاح للتسجيل</p>}
                  <Err f="national_id" />
                </div>

                <div>
                  <label className={cls.label}>رقم الجوال المعتمد *</label>
                  <input name="phone" value={form.phone} onChange={handleChange} className={cls.input + " font-mono"} placeholder="05XXXXXXXX" required />
                  <Err f="phone" />
                </div>

                <div>
                  <label className={cls.label}>تاريخ الميلاد *</label>
                  <input name="date_of_birth" type="date" value={form.date_of_birth} onChange={handleChange} className={cls.input + " font-mono"} required />
                  <Err f="date_of_birth" />
                </div>

                <div>
                  <label className={cls.label}>مكان الميلاد</label>
                  <input name="place_of_birth" value={form.place_of_birth} onChange={handleChange} className={cls.input} placeholder="مثال: مكة المكرمة" />
                </div>

                {type === "resident" && (
                  <div>
                    <label className={cls.label}>الجنسية *</label>
                    <input name="nationality" value={form.nationality} onChange={handleChange} className={cls.input} placeholder="مثال: يمني / مصري / سوداني" required />
                    <Err f="nationality" />
                  </div>
                )}

                <div>
                  <label className={cls.label}>المدينة *</label>
                  <input name="city" value={form.city} onChange={handleChange} className={cls.input} required />
                  <Err f="city" />
                </div>

                <div>
                  <label className={cls.label}>اسم الحي السكني *</label>
                  <input name="district" value={form.district} onChange={handleChange} className={cls.input} placeholder="مثال: النوارية / الشرائع / الجموم" required />
                  <Err f="district" />
                </div>

                <div>
                  <label className={cls.label}>الشارع أو أقرب معلم *</label>
                  <input name="street" value={form.street} onChange={handleChange} className={cls.input} placeholder="مثال: بجوار جامع الفرقان" required />
                  <Err f="street" />
                </div>
              </div>
            </div>
          )}

          {/* ══════════ STEP 2: الأسرة والسكن ══════════ */}
          {step === 2 && (
            <>
              <div className={cls.section}>
                <h2 className={cls.h2}>👨‍👩‍👧 البيانات الأسرية والاجتماعية وحالة السكن (إلزامية)</h2>
                <div className="grid md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className={cls.label}>الحالة الاجتماعية للأسرة *</label>
                    <select name="family_status" value={form.family_status} onChange={handleChange} className={cls.select} required>
                      <option value="">-- اختر الحالة الأسرية --</option>
                      {FAMILY_STATUS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    <Err f="family_status" />
                  </div>

                  <div>
                    <label className={cls.label}>إجمالي عدد أفراد الأسرة بالمنزل *</label>
                    <input name="family_members_count" type="number" min="1" value={form.family_members_count} onChange={handleChange} className={cls.input + " font-mono"} required />
                    <Err f="family_members_count" />
                  </div>

                  <div>
                    <label className={cls.label}>فئة ذوي الاحتياجات الخاصة</label>
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="has_special_needs"
                        name="has_special_needs"
                        checked={form.has_special_needs}
                        onChange={handleChange}
                        className="w-4 h-4 rounded text-[#D97706] accent-[#D97706]"
                      />
                      <label htmlFor="has_special_needs" className="text-xs font-bold text-purple-900 cursor-pointer">
                        تفعيل أولوية ذوي الاحتياجات الخاصة
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className={cls.label}>نوع السكن الحالي *</label>
                    <select name="housing_type" value={form.housing_type} onChange={handleChange} className={cls.select} required>
                      {HOUSING_TYPE_OPTIONS.map((h) => (
                        <option key={h.value} value={h.value}>{h.label}</option>
                      ))}
                    </select>
                  </div>

                  {form.housing_type === "rent" && (
                    <>
                      <div>
                        <label className={cls.label}>مبلغ الإيجار الشهري (ريال) *</label>
                        <input
                          name="monthly_rent_amount"
                          type="number"
                          min="0"
                          value={form.monthly_rent_amount}
                          onChange={handleChange}
                          className={cls.input + " font-mono border-amber-300"}
                          placeholder="مثال: 1000"
                        />
                        <span className={cls.helper}>يتم خصم هذا المبلغ بالكامل من إجمالي الدخل الشهري.</span>
                        <Err f="monthly_rent_amount" />
                      </div>

                      <div>
                        <label className={cls.label}>أو مبلغ الإيجار السنوي (ريال)</label>
                        <input
                          name="annual_rent_amount"
                          type="number"
                          min="0"
                          value={form.annual_rent_amount}
                          onChange={handleChange}
                          className={cls.input + " font-mono"}
                          placeholder="مثال: 12000"
                        />
                        <span className={cls.helper}>إذا لم يتوفر إيجار شهري، يُقسم السنوي على 12.</span>
                      </div>

                      <div className="col-span-full bg-amber-50 p-3 rounded-xl border border-amber-200 text-xs flex items-center justify-between font-bold text-amber-900">
                        <span>احتساب خصم السكن:</span>
                        <span className="font-mono">
                          الإيجار السنوي: {(parseFloat(form.annual_rent_amount) || (parseFloat(form.monthly_rent_amount) ? Math.round(parseFloat(form.monthly_rent_amount) * 12) : 0)).toLocaleString()} ريال ← الإيجار الشهري المحتسب: {(parseFloat(form.monthly_rent_amount) || (parseFloat(form.annual_rent_amount) ? Math.round((parseFloat(form.annual_rent_amount) / 12) * 100) / 100 : 0)).toLocaleString()} ريال
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Dependents Table */}
              <div className={cls.section}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className={cls.h2 + " mb-0"}>👶 قائمة المعالين والتابعين للأسرة</h2>
                  <button type="button" onClick={addDependent} className="bg-[#FAF8F5] text-[#C9A24A] border border-[#E5E2D9] text-xs px-3 py-1.5 rounded-xl font-bold hover:bg-amber-50">
                    + إضافة تابع
                  </button>
                </div>
                {dependents.length === 0 ? (
                  <p className="text-[#6B7280] text-xs text-center py-4">اضغط "+ إضافة تابع" لإضافة الأبناء أو التابعين بالمنزل.</p>
                ) : (
                  <div className="overflow-x-auto border border-[#E5E2D9] rounded-xl">
                    <table className="w-full text-xs text-right">
                      <thead className="bg-[#FAF8F5]">
                        <tr>
                          <th className="p-2.5">#</th>
                          <th className="p-2.5">الاسم</th>
                          <th className="p-2.5">صلة القرابة</th>
                          <th className="p-2.5">تاريخ الميلاد</th>
                          <th className="p-2.5"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5E2D9]">
                        {dependents.map((dep, i) => (
                          <tr key={i}>
                            <td className="p-2.5 text-gray-400 font-mono">{i + 1}</td>
                            <td className="p-2.5">
                              <input value={dep.name} onChange={(e) => updateDependent(i, "name", e.target.value)} className={cls.input + " py-1"} placeholder="اسم التابع" />
                            </td>
                            <td className="p-2.5">
                              <select value={dep.relationship} onChange={(e) => updateDependent(i, "relationship", e.target.value)} className={cls.select + " py-1"}>
                                <option value="">-- اختر --</option>
                                {RELATIONSHIP_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                              </select>
                            </td>
                            <td className="p-2.5">
                              <input type="date" value={dep.date_of_birth} onChange={(e) => updateDependent(i, "date_of_birth", e.target.value)} className={cls.input + " py-1 font-mono"} />
                            </td>
                            <td className="p-2.5">
                              <button type="button" onClick={() => removeDependent(i)} className="text-[#C24B3F] font-bold hover:underline">إزالة</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ══════════ STEP 3: البيانات المالية واحتساب الدخل ══════════ */}
          {step === 3 && (
            <div className={cls.section}>
              <h2 className={cls.h2}>💰 البيانات المالية واقتطاع الإيجار والتصنيف الآلي</h2>

              {/* Note: Banking Information Completely Excluded as per Prompt Mandate */}

              <div className="mb-5">
                <label className={cls.label}>حدد مصادر الدخل المتوفرة للأسرة:</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(type === "citizen" ? CITIZEN_INCOME_OPTIONS : RESIDENT_INCOME_OPTIONS).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleIncome(opt.value)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        form.income_sources.includes(opt.value)
                          ? "bg-[#D97706] text-white border-[#D97706] shadow-xs"
                          : "bg-white text-gray-700 border-[#E5E2D9] hover:border-[#C9A24A]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4 mb-6">
                {form.income_sources.includes("salary") && (
                  <div>
                    <label className={cls.label}>الراتب الشهري الفعلي (ريال)</label>
                    <input name="monthly_salary" type="number" min="0" value={form.monthly_salary} onChange={handleChange} className={cls.input + " font-mono"} placeholder="0" />
                  </div>
                )}
                {form.income_sources.includes("social_security") && (
                  <div>
                    <label className={cls.label}>مبلغ الضمان الاجتماعي (ريال)</label>
                    <input name="social_security_amount" type="number" min="0" value={form.social_security_amount} onChange={handleChange} className={cls.input + " font-mono"} placeholder="0" />
                  </div>
                )}
                {form.income_sources.includes("retirement") && (
                  <div>
                    <label className={cls.label}>المعاش التقاعدي (ريال)</label>
                    <input name="retirement_pension" type="number" min="0" value={form.retirement_pension} onChange={handleChange} className={cls.input + " font-mono"} placeholder="0" />
                  </div>
                )}
                {form.income_sources.includes("citizen_account") && (
                  <div>
                    <label className={cls.label}>مبلغ حساب المواطن (ريال)</label>
                    <input name="citizen_account_amount" type="number" min="0" value={form.citizen_account_amount} onChange={handleChange} className={cls.input + " font-mono"} placeholder="0" />
                  </div>
                )}
                {form.income_sources.includes("family_support") && (
                  <div>
                    <label className={cls.label}>دعم الأسرة والأقارب (ريال)</label>
                    <input name="family_support" type="number" min="0" value={form.family_support} onChange={handleChange} className={cls.input + " font-mono"} placeholder="0" />
                  </div>
                )}
              </div>

              {/* LIVE FORMULA & CLASSIFICATION CARD */}
              <div className="p-4 bg-[#FAF8F5] rounded-2xl border-2 border-[#C9A24A] space-y-3">
                <div className="flex items-center gap-2 font-extrabold text-sm text-[#111827]">
                  <Calculator className="w-5 h-5 text-[#C9A24A]" />
                  <span>معادلة الاحتساب والتصنيف الآلي:</span>
                </div>

                <div className="bg-white p-3 rounded-xl border border-[#E5E2D9] font-mono text-xs text-[#1F2937] leading-relaxed">
                  <p className="font-bold text-[#D97706] mb-1">📐 المعادلة الحسابية:</p>
                  <p>{calcResult.formulaText}</p>
                </div>

                <div className="grid sm:grid-cols-3 gap-3 pt-1">
                  <div className="bg-white p-3 rounded-xl border border-[#E5E2D9]">
                    <span className="text-[11px] text-[#6B7280] block font-bold">إجمالي الدخل الشهري</span>
                    <strong className="text-sm font-mono text-[#111827]">{calcResult.totalGrossIncome.toLocaleString()} ريال</strong>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-[#E5E2D9]">
                    <span className="text-[11px] text-[#6B7280] block font-bold">الإيجار الشهري</span>
                    <strong className="text-sm font-mono text-[#C24B3F]">{calcResult.monthlyRent.toLocaleString()} ريال</strong>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-[#3F6B3A]">
                    <span className="text-[11px] text-[#3F6B3A] font-bold block">صافي الدخل بعد الإيجار</span>
                    <strong className="text-sm font-mono text-[#3F6B3A]">{calcResult.eligibleIncome.toLocaleString()} ريال</strong>
                  </div>
                </div>

                <div className="p-3 bg-white rounded-xl border border-[#E5E2D9] flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-xs text-[#6B7280] block">التصنيف المحسوب آلياً:</span>
                    <span className="text-sm font-extrabold text-[#3F6B3A]">{calcResult.categoryLabel}</span>
                    <p className="text-[11px] text-[#6B7280] mt-0.5">{calcResult.reason}</p>
                  </div>

                  {/* Manual Override Control */}
                  <div className="text-left">
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, manual_override: !f.manual_override }))}
                      className="text-xs text-[#D97706] font-bold hover:underline"
                    >
                      {form.manual_override ? "إلغاء التعديل اليدوي" : "⚙️ تعديل يدوي للتصنيف (صلاحية خاصة)"}
                    </button>
                  </div>
                </div>

                {form.manual_override && (
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-2">
                    <label className={cls.label}>اختر التصنيف اليدوي البديل:</label>
                    <select
                      name="priority"
                      value={form.priority || calcResult.category}
                      onChange={handleChange}
                      className={cls.select}
                    >
                      <option value="first_class">الدرجة الأولى (الأشد حاجة)</option>
                      <option value="second_class">الدرجة الثانية (الدخل المتوسط)</option>
                    </select>

                    <label className={cls.label}>سبب التعديل اليدوي (مطلوب لأغراض الحوكمة والتدقيق):</label>
                    <input
                      type="text"
                      name="category_override_reason"
                      value={form.category_override_reason}
                      onChange={handleChange}
                      required={form.manual_override}
                      placeholder="اكتب مبرر تغيير التصنيف الآلي..."
                      className={cls.input}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════ STEP 4: الوثائق المرفقة ══════════ */}
          {step === 4 && (
            <div className={cls.section}>
              <h2 className={cls.h2}>📂 رفع الوثائق والمستندات الرسمية المرفقة</h2>
              <p className="text-xs text-[#6B7280] mb-4 font-semibold">
                {type === "citizen"
                  ? "المستندات الإلزامية للمواطن: صورة الهوية الوطنية، العنوان الوطني، وعقد الإيجار/فاتورة الكهرباء."
                  : "المستندات الإلزامية للمقيم: صورة الإقامة، العنوان الوطني، وعقد الإيجار (مشهد الراتب اختياري للمقيمين)."}
              </p>

              <div className="grid md:grid-cols-2 gap-4">
                {type === "citizen" ? (
                  <>
                    <FileUpload name="national_id_image" label="1. صورة الهوية الوطنية *" required onChange={handleFile} />
                    <FileUpload name="national_address_image" label="2. صورة العنوان الوطني *" required onChange={handleFile} />
                    <FileUpload name="rental_contract_image" label="3. عقد الإيجار أو فاتورة الكهرباء *" required onChange={handleFile} accept=".pdf,.jpg,.jpeg,.png" />
                    <FileUpload name="salary_certificate" label="4. مشهد إثبات الراتب" onChange={handleFile} accept=".pdf,.jpg,.jpeg,.png" />
                    <FileUpload name="social_security_image" label="5. مشهد الضمان الاجتماعي" onChange={handleFile} />
                    <FileUpload name="citizen_account_image" label="6. إثبات حساب المواطن" onChange={handleFile} />
                    <FileUpload name="pension_certificate_image" label="7. شهادة المعاش التقاعدي" onChange={handleFile} accept=".pdf,.jpg,.jpeg,.png" />
                  </>
                ) : (
                  <>
                    <FileUpload name="residence_id_image" label="1. صورة هوية مقيم (الإقامة) *" required onChange={handleFile} />
                    <FileUpload name="national_address_image" label="2. صورة العنوان الوطني *" required onChange={handleFile} />
                    <FileUpload name="rental_contract_image" label="3. عقد الإيجار أو فاتورة الكهرباء *" required onChange={handleFile} accept=".pdf,.jpg,.jpeg,.png" />
                    <FileUpload name="salary_certificate" label="4. مشهد الراتب (اختياري للمقيم)" onChange={handleFile} accept=".pdf,.jpg,.jpeg,.png" />
                  </>
                )}
              </div>
            </div>
          )}

          {/* ══════════ STEP 5: مراجعة وتأكيد الحفظ ══════════ */}
          {step === 5 && (
            <div className={cls.section}>
              <h2 className={cls.h2}>🔎 مراجعة البيانات وتأكيد التوثيق والتصنيف النهائي</h2>

              {/* Calculated Summary Card */}
              <div className="bg-[#FAF8F5] p-4 rounded-2xl border-2 border-[#C9A24A] mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-xs text-[#6B7280] font-bold block mb-1">التصنيف النهائي للمستفيد:</span>
                  <span className="px-4 py-1 rounded-full text-xs font-extrabold bg-[#3F6B3A] text-white">
                    {form.manual_override ? `تعديل يدوي: ${form.priority === 'first_class' ? 'درجة أولى' : 'درجة ثانية'}` : calcResult.categoryLabel}
                  </span>
                  <p className="text-[11px] text-[#6B7280] mt-1">{calcResult.reason}</p>
                </div>
                <div className="text-left font-mono">
                  <span className="text-xs text-[#6B7280] font-bold block mb-0.5">الدخل الشهري المحتسب:</span>
                  <span className="text-lg font-extrabold text-[#D97706]">
                    {calcResult.eligibleIncome.toLocaleString()} ريال
                  </span>
                  <span className="text-[10px] text-gray-400 block">(بعد اقتطاع {calcResult.monthlyRent} ريال إيجار)</span>
                </div>
              </div>

              {/* Summary Lists */}
              <div className="space-y-4 text-xs">
                <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200">
                  <h3 className="font-bold text-[#111827] mb-2 flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-[#C9A24A]" />
                    <span>البيانات الأساسية</span>
                  </h3>
                  <div className="grid md:grid-cols-3 gap-2">
                    <div><strong>الاسم:</strong> {form.full_name}</div>
                    <div><strong>الهوية:</strong> <span className="font-mono">{form.national_id}</span></div>
                    <div><strong>الجوال:</strong> <span className="font-mono">{form.phone}</span></div>
                    <div><strong>المدينة:</strong> {form.city}</div>
                    <div><strong>الحي:</strong> {form.district}</div>
                    <div><strong>نوع السكن:</strong> {form.housing_type === 'rent' ? 'إيجار' : form.housing_type === 'charitable_housing' ? 'سكن خيري' : 'ملك'}</div>
                  </div>
                </div>

                <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200">
                  <h3 className="font-bold text-[#111827] mb-2 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-[#3F6B3A]" />
                    <span>الأسرة والمعالون ({dependents.length} أفراد)</span>
                  </h3>
                  <p><strong>الحالة الاجتماعية:</strong> {form.family_status || '—'} | <strong>أفراد الأسرة:</strong> {form.family_members_count}</p>
                </div>

                <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200">
                  <h3 className="font-bold text-[#111827] mb-2 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-[#D97706]" />
                    <span>المستندات المرفقة ({Object.keys(files).length})</span>
                  </h3>
                  <ul className="list-disc list-inside space-y-0.5 text-green-700 font-bold">
                    {Object.entries(files).map(([k, f]) => (
                      <li key={k}>{f.name}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex justify-between items-center mt-6 pt-4 border-t border-[#E5E2D9]">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step === 1}
            >
              ← السابق
            </Button>

            {step < STEPS.length ? (
              <Button
                type="button"
                variant="gold"
                size="md"
                onClick={handleNextStep}
              >
                التالي →
              </Button>
            ) : (
              <Button
                type="submit"
                variant="secondary"
                size="md"
                disabled={idStatus === "taken"}
                loading={saving}
                icon={Save}
              >
                حفظ وتصنيف المستفيد
              </Button>
            )}
          </div>
        </form>
      </div>
    </MainLayout>
  );
}

function FileUpload({ name, label, onChange, accept = "image/*", required = false }) {
  const [fileName, setFileName] = useState(null);

  const handleChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFileName(file.name);
      onChange(e);
    }
  };

  return (
    <div className="border border-dashed border-[#E5E2D9] rounded-xl p-3.5 hover:border-[#C9A24A] transition-colors bg-white">
      <label className="block text-xs font-bold text-[#111827] mb-2">
        {label} {required && <span className="text-[#C24B3F]">*</span>}
      </label>
      <input
        type="file"
        name={name}
        accept={accept}
        onChange={handleChange}
        className="block w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:bg-[#FAF8F5] file:text-[#C9A24A] file:font-bold cursor-pointer"
      />
      {fileName && <p className="text-[11px] text-[#3F6B3A] font-bold mt-2">✓ تم اختيار: {fileName}</p>}
    </div>
  );
}
