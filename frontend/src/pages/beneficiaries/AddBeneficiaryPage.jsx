import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import beneficiaryApi from "../../api/beneficiaries";
import api from "../../api/axios";
import MainLayout from "../../components/layout/MainLayout";
import { calculateIncomeAndClassification } from "../../utils/financialCalculations";
import { displayLabel } from "../../utils/displayVocabulary";
import PageShell from "../../components/ui/PageShell";
import SectionCard from "../../components/ui/SectionCard";
import Tabs from "../../components/ui/Tabs";
import FormField from "../../components/ui/FormField";
import { PrimaryButton, SecondaryButton } from "../../components/ui/Button";
import StatusBadge from "../../components/ui/StatusBadge";
import EmptyState from "../../components/ui/EmptyState";
import ErrorState from "../../components/ui/ErrorState";
import KpiCard from "../../components/ui/KpiCard";
import { Save } from "lucide-react";

/* ═══════════════════════ خيارات وحالات الأسرة ═══════════════════════ */

const FAMILY_STATUS_VALUES = ["poor", "widow", "widow_with_orphans", "divorced", "divorced_with_children", "abandoned"];

const CITIZEN_INCOME_OPTIONS = [
  { value: "salary",           label: "راتب شهري" },
  { value: "social_security",  label: "ضمان اجتماعي" },
  { value: "retirement",       label: "معاش تقاعدي" },
  { value: "citizen_account",  label: "حساب المواطن" },
  { value: "family_support",   label: "دعم الأسرة من الأقارب" },
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
  { id: 2, label: "الأسرة والتابعون" },
  { id: 3, label: "البيانات المالية" },
  { id: 4, label: "الوثائق" },
  { id: 5, label: "المراجعة" },
  { id: 6, label: "تأكيد وحفظ المستفيد" },
];

const DOCUMENT_LABELS = {
  national_id_image: "صورة الهوية الوطنية",
  residence_id_image: "صورة الإقامة",
  national_address_image: "العنوان الوطني",
  rental_contract_image: "عقد الإيجار أو فاتورة الكهرباء",
  salary_certificate: "مشهد الراتب",
  social_security_image: "مشهد الضمان الاجتماعي",
  citizen_account_image: "إثبات حساب المواطن",
  pension_certificate_image: "شهادة المعاش التقاعدي",
};

/* ═══════════════════════ الحالة الابتدائية (خالية تماماً من البيانات البنكية) ═══════════════════════ */

const classifyNationality = (value) => {
  const trimmed = String(value || "").trim();
  if (trimmed === "سعودي") return "citizen";
  if (trimmed) return "resident";
  return null;
};

const makeInitialForm = (type) => ({
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
  const routeType = location.pathname.includes("resident") ? "resident" : "citizen";

  const [form, setForm]             = useState(makeInitialForm(routeType));
  const [dependents, setDependents] = useState([]);
  const [files, setFiles]           = useState({});
  const [step, setStep]             = useState(1);
  const [errors, setErrors]         = useState({});
  const [saving, setSaving]         = useState(false);
  const [idStatus, setIdStatus]     = useState(null);
  const submitLock = useRef(false);
  const [reviewed, setReviewed] = useState(false);
  const classification = classifyNationality(form.nationality);
  useEffect(() => { setReviewed(false); }, [form, dependents, files, step]);
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
            residentDegreeThreshold: parseFloat(res.data.data.resident_need_threshold) || parseFloat(res.data.data.resident_degree_threshold) || 3000,
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
    if (name === "nationality") {
      const nextClass = classifyNationality(value);
      const allowed = nextClass === "citizen"
        ? CITIZEN_INCOME_OPTIONS.map((option) => option.value)
        : nextClass === "resident"
          ? RESIDENT_INCOME_OPTIONS.map((option) => option.value)
          : [];
      setForm((current) => {
        const income_sources = current.income_sources.filter((source) => allowed.includes(source));
        return {
          ...current,
          nationality: value,
          income_sources,
          manual_override: nextClass === "citizen" ? current.manual_override : false,
          social_security_amount: income_sources.includes("social_security") ? current.social_security_amount : "",
          retirement_pension: income_sources.includes("retirement") ? current.retirement_pension : "",
          citizen_account_amount: income_sources.includes("citizen_account") ? current.citizen_account_amount : "",
        };
      });
      setFiles((current) => {
        const next = { ...current };
        if (nextClass !== "citizen") {
          delete next.national_id_image;
          delete next.social_security_image;
          delete next.citizen_account_image;
          delete next.pension_certificate_image;
        }
        if (nextClass !== "resident") delete next.residence_id_image;
        return next;
      });
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
    const amountFields = {
      salary: "monthly_salary", social_security: "social_security_amount",
      retirement: "retirement_pension", citizen_account: "citizen_account_amount",
      family_support: "family_support",
    };
    setForm((f) => {
      const removing = f.income_sources.includes(val);
      return {
        ...f,
        income_sources: removing ? f.income_sources.filter((v) => v !== val) : [...f.income_sources, val],
        ...(removing ? { [amountFields[val]]: "" } : {}),
      };
    });
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
    if (!classification) return null;
    return calculateIncomeAndClassification({
      beneficiaryType: classification,
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
  }, [form, classification, thresholds]);

  // Validation function for steps
  const validateCurrentStep = (targetStep) => {
    const newErrors = {};

    if (targetStep === 1) {
      if (!form.full_name.trim()) newErrors.full_name = ["الاسم الكامل لرب الأسرة مطلوب."];
      if (!form.national_id.trim()) newErrors.national_id = ["رقم الهوية الوطنية أو الإقامة مطلوب."];
      if (!form.phone.trim()) newErrors.phone = ["رقم الجوال الفعال مطلوب للتواصل."];
      if (!form.date_of_birth) newErrors.date_of_birth = ["تاريخ الميلاد مطلوب."];
      if (!form.city.trim()) newErrors.city = ["المدينة مطلوبة."];
      if (!form.district.trim()) newErrors.district = ["اسم الحي السكني مطلوب."];
      if (!form.street.trim()) newErrors.street = ["الشارع أو المعلم مطلوب."];
      const nationality = form.nationality.trim();
      if (!nationality) newErrors.nationality = ["الجنسية مطلوبة."];
      else if (nationality.length > 100) newErrors.nationality = ["الجنسية يجب ألا تتجاوز 100 حرفاً."];
    } else if (targetStep === 2) {
      if (!form.family_status) newErrors.family_status = ["يرجى تحديد الحالة الاجتماعية للأسرة."];
      if (!form.family_members_count || form.family_members_count < 1) newErrors.family_members_count = ["عدد أفراد الأسرة يجب أن يكون 1 على الأقل."];
      if (!form.housing_type) newErrors.housing_type = ["يرجى تحديد نوع السكن."];
      if (form.housing_type === "rent" && !form.monthly_rent_amount && !form.annual_rent_amount) {
        newErrors.monthly_rent_amount = ["يرجى إدخال قيمة الإيجار الشهري أو السنوي لاحتساب خصم الإيجار."];
      }
    } else if (targetStep === 4) {
      if (!classification) newErrors.nationality = ["الجنسية مطلوبة."];
      else if (classification === "citizen") {
        if (!files.national_id_image) newErrors.national_id_image = ["صورة الهوية الوطنية مطلوبة للمواطن."];
        if (!files.national_address_image) newErrors.national_address_image = ["صورة العنوان الوطني مطلوبة."];
        if (form.housing_type === 'rent' && !files.rental_contract_image) newErrors.rental_contract_image = ["عقد الإيجار أو فاتورة الكهرباء مطلوبة."];
      } else {
        if (!files.residence_id_image) newErrors.residence_id_image = ["صورة هوية مقيم (الإقامة) مطلوبة."];
        if (!files.national_address_image) newErrors.national_address_image = ["صورة العنوان الوطني مطلوبة."];
        if (form.housing_type === 'rent' && !files.rental_contract_image) newErrors.rental_contract_image = ["عقد الإيجار أو فاتورة الكهرباء مطلوبة."];
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
    if (step !== STEPS.length || !reviewed || !classification || !calcResult || submitLock.current) return;
    if (idStatus === "taken") return alert("رقم الهوية/الإقامة مسجل مسبقاً في النظام.");

    // Final validation
    for (let reviewStep = 1; reviewStep < STEPS.length; reviewStep += 1) {
      if (!validateCurrentStep(reviewStep)) { setStep(reviewStep); setReviewed(false); return; }
    }

    submitLock.current = true;
    setSaving(true);
    setErrors({});

    const fd = new FormData();
    fd.append("reviewed_confirmation", "1");
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
      nationality: form.nationality.trim(),
      total_income: calcResult.eligibleIncome, // Calculated income after rent deduction
      gross_income: calcResult.totalGrossIncome,
      monthly_rent: calcResult.monthlyRent,
      net_income: calcResult.eligibleIncome,
      priority: calcResult.priority,
      category: calcResult.category,
    };

    delete finalPayload.bank_name;
    delete finalPayload.iban;
    delete finalPayload.beneficiary_type;
    delete finalPayload.type;
    if (classification !== "citizen") {
      finalPayload.income_sources = form.income_sources.filter((source) => source === "salary" || source === "family_support");
      delete finalPayload.social_security_amount;
      delete finalPayload.retirement_pension;
      delete finalPayload.citizen_account_amount;
      finalPayload.manual_override = false;
    }

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
      navigate("/beneficiaries");
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
      submitLock.current = false;
      setSaving(false);
    }
  };

  const errorText = Object.values(errors).flat().filter(Boolean).join(" ");
  const incomeOptions = classification === "citizen" ? CITIZEN_INCOME_OPTIONS : classification === "resident" ? RESIDENT_INCOME_OPTIONS : [];
  const registrationTitle = classification === "citizen" ? "تسجيل مستفيد مواطن جديد" : classification === "resident" ? "تسجيل مستفيد مقيم جديد" : "تسجيل مستفيد جديد";
  const onReview = step >= 5;

  const openStep = (id) => {
    const next = Number(id);
    if (next === step) return;
    if (next < step || validateCurrentStep(step)) setStep(next);
  };

  return (
    <MainLayout>
      <div dir="rtl">
        <PageShell
          breadcrumbs={[
            { label: "الرئيسية", href: "/" },
            { label: "إدارة المستفيدين", href: "/beneficiaries" },
            { label: classification === "citizen" ? "تسجيل مواطن" : classification === "resident" ? "تسجيل مقيم" : "تسجيل مستفيد" },
          ]}
          title={onReview ? "مراجعة بيانات المستفيد" : registrationTitle}
          description={onReview ? "راجع البيانات قبل تأكيد وحفظ المستفيد." : "تعبئة البيانات، اقتطاع الإيجار، والتصنيف التلقائي."}
          secondaryActions={<SecondaryButton type="button" onClick={() => navigate("/beneficiaries")}>العودة للقائمة</SecondaryButton>}
        >
          {toast && <StatusBadge tone="success" label={toast} />}
          <Tabs
            tabs={STEPS.map((item) => ({ id: String(item.id), label: item.label, testId: `registration-step-${item.id}` }))}
            activeTab={String(step)}
            onChange={openStep}
          />
          {errorText && <ErrorState title="يرجى تعبئة الحقول الإلزامية المطلوبة للمتابعة" description={errorText} />}

          <form onSubmit={handleSubmit} encType="multipart/form-data" className="space-y-5">
            {step === 1 && (
              <SectionCard title="البيانات الأساسية">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <FormField label="الاسم الرباعي الكامل" name="full_name" required error={errors.full_name?.[0]}>
                    <input name="full_name" value={form.full_name} onChange={handleChange} className="ikram-control w-full" placeholder="الاسم الرباعي كما في الهوية" required />
                  </FormField>
                  <FormField label={classification === "citizen" ? "رقم الهوية الوطنية" : classification === "resident" ? "رقم الإقامة" : "رقم الهوية أو الإقامة"} name="national_id" required error={errors.national_id?.[0]} helperText={idStatus === "checking" ? "جاري التحقق من الهوية..." : idStatus === "taken" ? "رقم الهوية مسجل مسبقاً في النظام" : idStatus === "ok" ? "متاح للتسجيل" : undefined}>
                    <input name="national_id" value={form.national_id} onChange={handleChange} onBlur={handleNationalIdBlur} maxLength={20} required className="ikram-control w-full font-mono" placeholder={classification === "citizen" ? "10XXXXXXXX" : classification === "resident" ? "20XXXXXXXX" : ""} />
                  </FormField>
                  <FormField label="رقم الجوال المعتمد" name="phone" required error={errors.phone?.[0]}>
                    <input name="phone" value={form.phone} onChange={handleChange} className="ikram-control w-full font-mono" placeholder="05XXXXXXXX" required />
                  </FormField>
                  <FormField label="تاريخ الميلاد" name="date_of_birth" required error={errors.date_of_birth?.[0]}>
                    <input name="date_of_birth" type="date" value={form.date_of_birth} onChange={handleChange} className="ikram-control w-full font-mono" required />
                  </FormField>
                  <FormField label="مكان الميلاد" name="place_of_birth">
                    <input name="place_of_birth" value={form.place_of_birth} onChange={handleChange} className="ikram-control w-full" placeholder="مثال: مكة المكرمة" />
                  </FormField>
                  <FormField label="الجنسية" name="nationality" required error={errors.nationality?.[0]} helperText={classification === "citizen" ? "التصنيف: مواطن" : classification === "resident" ? "التصنيف: مقيم. أي جنسية غير سعودي تُسجَّل مقيماً." : "اكتب الجنسية. سعودي = مواطن، وأي جنسية أخرى = مقيم."}>
                    <input name="nationality" value={form.nationality} onChange={handleChange} className="ikram-control w-full" placeholder="سعودي، أو جنسية أخرى" maxLength={100} required />
                  </FormField>
                  <FormField label="المدينة" name="city" required error={errors.city?.[0]}>
                    <input name="city" value={form.city} onChange={handleChange} className="ikram-control w-full" required />
                  </FormField>
                  <FormField label="اسم الحي السكني" name="district" required error={errors.district?.[0]}>
                    <input name="district" value={form.district} onChange={handleChange} className="ikram-control w-full" placeholder="مثال: النوارية" required />
                  </FormField>
                  <FormField label="الشارع أو أقرب معلم" name="street" required error={errors.street?.[0]}>
                    <input name="street" value={form.street} onChange={handleChange} className="ikram-control w-full" placeholder="مثال: بجوار جامع الفرقان" required />
                  </FormField>
                </div>
              </SectionCard>
            )}

            {step === 2 && (
              <>
                <SectionCard title="الأسرة والتابعون">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <FormField label="الحالة الاجتماعية للأسرة" name="family_status" required error={errors.family_status?.[0]}>
                      <select name="family_status" value={form.family_status} onChange={handleChange} className="ikram-control w-full" required>
                        <option value="">اختر الحالة الأسرية</option>
                        {FAMILY_STATUS_VALUES.map((value) => (
                          <option key={value} value={value}>{displayLabel("family", value)}</option>
                        ))}
                      </select>
                    </FormField>
                    <FormField label="إجمالي عدد أفراد الأسرة بالمنزل" name="family_members_count" required error={errors.family_members_count?.[0]}>
                      <input name="family_members_count" type="number" min="1" value={form.family_members_count} onChange={handleChange} className="ikram-control w-full font-mono" required />
                    </FormField>
                    <FormField label="فئة ذوي الاحتياجات الخاصة" name="has_special_needs">
                      <label className="flex min-h-11 items-center gap-2 text-sm font-bold text-[var(--color-text-primary)]">
                        <input type="checkbox" id="has_special_needs" name="has_special_needs" checked={form.has_special_needs} onChange={handleChange} />
                        تفعيل أولوية ذوي الاحتياجات الخاصة
                      </label>
                    </FormField>
                    <FormField label="نوع السكن الحالي" name="housing_type" required error={errors.housing_type?.[0]}>
                      <select name="housing_type" value={form.housing_type} onChange={handleChange} className="ikram-control w-full" required>
                        {HOUSING_TYPE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                      </select>
                    </FormField>
                    {form.housing_type === "rent" && (
                      <>
                        <FormField label="مبلغ الإيجار الشهري (ريال)" name="monthly_rent_amount" required error={errors.monthly_rent_amount?.[0]} helperText="يتم خصم هذا المبلغ بالكامل من إجمالي الدخل الشهري.">
                          <input name="monthly_rent_amount" type="number" min="0" value={form.monthly_rent_amount} onChange={handleChange} className="ikram-control w-full font-mono" placeholder="مثال: 1000" />
                        </FormField>
                        <FormField label="أو مبلغ الإيجار السنوي (ريال)" name="annual_rent_amount" helperText="إذا لم يتوفر إيجار شهري، يُقسم السنوي على 12.">
                          <input name="annual_rent_amount" type="number" min="0" value={form.annual_rent_amount} onChange={handleChange} className="ikram-control w-full font-mono" placeholder="مثال: 12000" />
                        </FormField>
                      </>
                    )}
                  </div>
                  {form.housing_type === "rent" && (
                    <p className="mt-4 text-xs font-bold text-[var(--color-text-secondary)]">
                      الإيجار السنوي: {(parseFloat(form.annual_rent_amount) || (parseFloat(form.monthly_rent_amount) ? Math.round(parseFloat(form.monthly_rent_amount) * 12) : 0)).toLocaleString()} ريال — الإيجار الشهري المحتسب: {(parseFloat(form.monthly_rent_amount) || (parseFloat(form.annual_rent_amount) ? Math.round((parseFloat(form.annual_rent_amount) / 12) * 100) / 100 : 0)).toLocaleString()} ريال
                    </p>
                  )}
                </SectionCard>
                <SectionCard title="قائمة المعالين والتابعين" actions={<SecondaryButton type="button" onClick={addDependent}>إضافة تابع</SecondaryButton>}>
                  {dependents.length === 0 ? (
                    <EmptyState title="لا يوجد تابعون" description="أضف الأبناء أو التابعين في المنزل عند الحاجة." />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-[var(--color-bg-soft)]">
                          <tr>
                            <th className="p-2.5">#</th>
                            <th className="p-2.5">الاسم</th>
                            <th className="p-2.5">صلة القرابة</th>
                            <th className="p-2.5">تاريخ الميلاد</th>
                            <th className="p-2.5"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {dependents.map((dep, index) => (
                            <tr key={index}>
                              <td className="p-2.5 font-mono text-[var(--color-text-muted)]">{index + 1}</td>
                              <td className="p-2.5"><input aria-label={`اسم التابع ${index + 1}`} value={dep.name} onChange={(e) => updateDependent(index, "name", e.target.value)} className="ikram-control w-full" placeholder="اسم التابع" /></td>
                              <td className="p-2.5">
                                <select aria-label={`صلة قرابة التابع ${index + 1}`} value={dep.relationship} onChange={(e) => updateDependent(index, "relationship", e.target.value)} className="ikram-control w-full">
                                  <option value="">اختر</option>
                                  {RELATIONSHIP_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
                                </select>
                              </td>
                              <td className="p-2.5"><input aria-label={`ميلاد التابع ${index + 1}`} type="date" value={dep.date_of_birth} onChange={(e) => updateDependent(index, "date_of_birth", e.target.value)} className="ikram-control w-full font-mono" /></td>
                              <td className="p-2.5"><SecondaryButton type="button" onClick={() => removeDependent(index)}>إزالة</SecondaryButton></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </SectionCard>
              </>
            )}

            {step === 3 && (
              <SectionCard title="البيانات المالية">
                <p className="mb-3 text-xs font-bold text-[var(--color-text-primary)]">حدد مصادر الدخل المتوفرة للأسرة</p>
                <div className="mb-5 flex flex-wrap gap-2">
                  {incomeOptions.map((option) => (
                    <SecondaryButton key={option.value} type="button" onClick={() => toggleIncome(option.value)} aria-pressed={form.income_sources.includes(option.value)}>
                      {option.label}
                    </SecondaryButton>
                  ))}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {form.income_sources.includes("salary") && (
                    <FormField label="الراتب الشهري الفعلي (ريال)" name="monthly_salary">
                      <input name="monthly_salary" type="number" min="0" value={form.monthly_salary} onChange={handleChange} className="ikram-control w-full font-mono" placeholder="0" />
                    </FormField>
                  )}
                  {form.income_sources.includes("social_security") && (
                    <FormField label="مبلغ الضمان الاجتماعي (ريال)" name="social_security_amount">
                      <input name="social_security_amount" type="number" min="0" value={form.social_security_amount} onChange={handleChange} className="ikram-control w-full font-mono" placeholder="0" />
                    </FormField>
                  )}
                  {form.income_sources.includes("retirement") && (
                    <FormField label="المعاش التقاعدي (ريال)" name="retirement_pension">
                      <input name="retirement_pension" type="number" min="0" value={form.retirement_pension} onChange={handleChange} className="ikram-control w-full font-mono" placeholder="0" />
                    </FormField>
                  )}
                  {form.income_sources.includes("citizen_account") && (
                    <FormField label="مبلغ حساب المواطن (ريال)" name="citizen_account_amount">
                      <input name="citizen_account_amount" type="number" min="0" value={form.citizen_account_amount} onChange={handleChange} className="ikram-control w-full font-mono" placeholder="0" />
                    </FormField>
                  )}
                  {form.income_sources.includes("family_support") && (
                    <FormField label="دعم الأسرة والأقارب (ريال)" name="family_support">
                      <input name="family_support" type="number" min="0" value={form.family_support} onChange={handleChange} className="ikram-control w-full font-mono" placeholder="0" />
                    </FormField>
                  )}
                </div>
                {!calcResult && <p className="mt-4 text-xs font-bold text-[var(--color-text-primary)]">أدخل الجنسية أولاً. القيمة الفارغة ليست سعودياً.</p>}
                {calcResult && (
                  <div className="mt-5 space-y-4">
                    <p className="text-sm font-bold text-[var(--color-text-primary)]">معادلة الاحتساب والتصنيف الآلي</p>
                    <p className="text-xs text-[var(--color-text-secondary)]">{calcResult.formulaText}</p>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <KpiCard title="إجمالي الدخل الشهري" value={`${calcResult.totalGrossIncome.toLocaleString()} ريال`} />
                      <KpiCard title="الإيجار الشهري" value={`${calcResult.monthlyRent.toLocaleString()} ريال`} />
                      <KpiCard title="صافي الدخل بعد الإيجار" value={`${calcResult.eligibleIncome.toLocaleString()} ريال`} />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs text-[var(--color-text-muted)]">التصنيف المحسوب آلياً</p>
                        <StatusBadge tone="success" label={calcResult.categoryLabel} />
                        <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">{calcResult.reason}</p>
                        {classification === "resident" && calcResult.needLevelLabel && <StatusBadge tone="warning" label={`مستوى الاحتياج: ${calcResult.needLevelLabel}`} />}
                      </div>
                      {classification === "citizen" && (
                        <SecondaryButton type="button" onClick={() => setForm((current) => ({ ...current, manual_override: !current.manual_override }))}>
                          {form.manual_override ? "إلغاء التعديل اليدوي" : "تعديل يدوي للتصنيف"}
                        </SecondaryButton>
                      )}
                    </div>
                    {classification === "citizen" && form.manual_override && (
                      <div className="grid gap-4">
                        <FormField label="اختر التصنيف اليدوي البديل" name="priority">
                          <select name="priority" value={form.priority || calcResult.category} onChange={handleChange} className="ikram-control w-full">
                            <option value="first_class">الدرجة الأولى (الأشد حاجة)</option>
                            <option value="second_class">الدرجة الثانية (الدخل المتوسط)</option>
                          </select>
                        </FormField>
                        <FormField label="سبب التعديل اليدوي" name="category_override_reason">
                          <input type="text" name="category_override_reason" value={form.category_override_reason} onChange={handleChange} required={form.manual_override} placeholder="اكتب مبرر تغيير التصنيف الآلي..." className="ikram-control w-full" />
                        </FormField>
                      </div>
                    )}
                  </div>
                )}
              </SectionCard>
            )}

            {step === 4 && (
              <SectionCard title="الوثائق" description={classification === "citizen" ? "المستندات الإلزامية للمواطن: صورة الهوية الوطنية، العنوان الوطني، وعقد الإيجار أو فاتورة الكهرباء عند السكن بالإيجار." : classification === "resident" ? "المستندات الإلزامية للمقيم: صورة الإقامة، العنوان الوطني، وعقد الإيجار عند السكن بالإيجار. مشهد الراتب اختياري." : "أدخل الجنسية أولاً. القيمة الفارغة لا تُعامل كسعودي."}>
                <div className="grid gap-4 md:grid-cols-2">
                  {classification === "citizen" && (
                    <>
                      <FileUpload name="national_id_image" label="صورة الهوية الوطنية" required onChange={handleFile} error={errors.national_id_image?.[0]} />
                      <FileUpload name="national_address_image" label="صورة العنوان الوطني" required onChange={handleFile} error={errors.national_address_image?.[0]} />
                      {form.housing_type === "rent" && <FileUpload name="rental_contract_image" label="عقد الإيجار أو فاتورة الكهرباء" required onChange={handleFile} accept=".pdf,.jpg,.jpeg,.png" error={errors.rental_contract_image?.[0]} />}
                      {form.income_sources.includes("salary") && <FileUpload name="salary_certificate" label="مشهد إثبات الراتب" onChange={handleFile} accept=".pdf,.jpg,.jpeg,.png" />}
                      {form.income_sources.includes("social_security") && <FileUpload name="social_security_image" label="مشهد الضمان الاجتماعي" onChange={handleFile} />}
                      {form.income_sources.includes("citizen_account") && <FileUpload name="citizen_account_image" label="إثبات حساب المواطن" onChange={handleFile} />}
                      {form.income_sources.includes("retirement") && <FileUpload name="pension_certificate_image" label="شهادة المعاش التقاعدي" onChange={handleFile} accept=".pdf,.jpg,.jpeg,.png" />}
                    </>
                  )}
                  {classification === "resident" && (
                    <>
                      <FileUpload name="residence_id_image" label="صورة هوية مقيم" required onChange={handleFile} error={errors.residence_id_image?.[0]} />
                      <FileUpload name="national_address_image" label="صورة العنوان الوطني" required onChange={handleFile} error={errors.national_address_image?.[0]} />
                      {form.housing_type === "rent" && <FileUpload name="rental_contract_image" label="عقد الإيجار أو فاتورة الكهرباء" required onChange={handleFile} accept=".pdf,.jpg,.jpeg,.png" error={errors.rental_contract_image?.[0]} />}
                      {form.income_sources.includes("salary") && <FileUpload name="salary_certificate" label="مشهد الراتب" onChange={handleFile} accept=".pdf,.jpg,.jpeg,.png" />}
                    </>
                  )}
                </div>
              </SectionCard>
            )}

            {step === 5 && (
              <>
                <SectionCard title="ملخص التسجيل">
                  <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <Fact label="اسم المستفيد" value={form.full_name} />
                    <Fact label="نوع المستفيد" value={classification === "citizen" ? "مواطن" : classification === "resident" ? "مقيم" : "غير محدد"} />
                    <Fact label="المدينة" value={form.city} />
                    <Fact label="الحي" value={form.district} />
                    <Fact label="الحالة الأسرية" value={displayLabel("family", form.family_status)} />
                  </dl>
                </SectionCard>
                <SectionCard title="البيانات الأساسية" actions={<SecondaryButton type="button" onClick={() => setStep(1)}>تعديل</SecondaryButton>}>
                  <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <Fact label="الاسم" value={form.full_name} />
                    <Fact label="رقم الهوية" value={form.national_id} />
                    <Fact label="الجوال" value={form.phone} />
                    <Fact label="المدينة" value={form.city} />
                    <Fact label="الحي" value={form.district} />
                    <Fact label="نوع السكن" value={displayLabel("housing", form.housing_type)} />
                  </dl>
                </SectionCard>
                <SectionCard title="الأسرة والتابعون" actions={<SecondaryButton type="button" onClick={() => setStep(2)}>تعديل</SecondaryButton>}>
                  <dl className="grid gap-3 sm:grid-cols-2">
                    <Fact label="الحالة الأسرية" value={displayLabel("family", form.family_status)} />
                    <Fact label="أفراد الأسرة" value={form.family_members_count} />
                    <Fact label="عدد التابعين" value={dependents.length} />
                  </dl>
                  {dependents.length === 0 ? <EmptyState title="لا يوجد تابعون" description="لم تُضف بيانات تابعين في هذا التسجيل." /> : dependents.map((dep, index) => (
                    <p key={index} className="mt-2 text-sm text-[var(--color-text-primary)]">{dep.name || "تابع بدون اسم"} — {dep.relationship || "غير محدد"}</p>
                  ))}
                </SectionCard>
                <SectionCard title="البيانات المالية" actions={<SecondaryButton type="button" onClick={() => setStep(3)}>تعديل</SecondaryButton>}>
                  {calcResult ? (
                    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <Fact label="مصادر الدخل" value={form.income_sources.map((source) => incomeOptions.find((option) => option.value === source)?.label).filter(Boolean).join("، ") || "غير محدد"} />
                      <Fact label="إجمالي الدخل" value={`${calcResult.totalGrossIncome.toLocaleString()} ريال`} />
                      <Fact label="صافي الدخل بعد الإيجار" value={`${calcResult.eligibleIncome.toLocaleString()} ريال`} />
                      <Fact label="التصنيف" value={form.manual_override ? (form.priority === "first_class" ? "درجة أولى" : "درجة ثانية") : calcResult.categoryLabel} />
                    </dl>
                  ) : <EmptyState title="لا توجد بيانات مالية" description="أدخل الجنسية حتى يُحتسب التصنيف." />}
                </SectionCard>
                <SectionCard title="الوثائق" actions={<SecondaryButton type="button" onClick={() => setStep(4)}>تعديل</SecondaryButton>}>
                  {Object.keys(files).length === 0 ? <EmptyState title="لا توجد وثائق مختارة" description="أرفق المستندات المطلوبة قبل التأكيد." /> : (
                    <ul className="space-y-1 text-sm text-[var(--color-text-primary)]">
                      {Object.entries(files).map(([key, file]) => <li key={key}>{DOCUMENT_LABELS[key] || "مرفق"}: {file.name}</li>)}
                    </ul>
                  )}
                </SectionCard>
              </>
            )}

            {step === 6 && (
              <SectionCard title="تأكيد التسجيل" description="هذا الإجراء ينشئ سجل المستفيد ويحفظه بشكل نهائي بعد المراجعة. لن يُعتمد المستفيد قبل هذا التأكيد.">
                <label className="flex items-start gap-3 text-sm font-bold text-[var(--color-text-primary)]">
                  <input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} />
                  راجعت بيانات المستفيد والأسرة والمستندات وأؤكد حفظها
                </label>
                <div className="mt-4 flex flex-wrap gap-3">
                  <PrimaryButton type="submit" disabled={idStatus === "taken" || !reviewed || saving} loading={saving} icon={Save}>تأكيد وحفظ المستفيد</PrimaryButton>
                  <SecondaryButton type="button" onClick={() => setStep(1)}>العودة للتعديل</SecondaryButton>
                </div>
              </SectionCard>
            )}

            {step < STEPS.length && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <SecondaryButton type="button" onClick={() => setStep((current) => Math.max(1, current - 1))} disabled={step === 1}>السابق</SecondaryButton>
                <PrimaryButton type="button" onClick={handleNextStep}>التالي</PrimaryButton>
              </div>
            )}
          </form>
        </PageShell>
      </div>
    </MainLayout>
  );
}

function Fact({ label, value }) {
  return (
    <div>
      <dt className="text-xs text-[var(--color-text-muted)]">{label}</dt>
      <dd className="text-sm font-bold text-[var(--color-text-primary)]">{value || "غير محدد"}</dd>
    </div>
  );
}

function FileUpload({ name, label, onChange, accept = "image/*", required = false, error }) {
  const [fileName, setFileName] = useState(null);
  const handleChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFileName(file.name);
      onChange(e);
    }
  };
  return (
    <div>
      <FormField label={label} name={name} required={required} error={error}>
        <input id={name} type="file" name={name} accept={accept} onChange={handleChange} className="ikram-control w-full" />
      </FormField>
      {fileName && <p className="text-[11px] font-bold text-[var(--color-text-secondary)]">تم اختيار: {fileName}</p>}
    </div>
  );
}
