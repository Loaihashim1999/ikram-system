import { useState, useCallback } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import beneficiaryApi from "../../api/beneficiaries";
import MainLayout from "../../components/layout/MainLayout";

/* ═══════════════════════ الحالات والخيارات ═══════════════════════ */

const FAMILY_STATUS_OPTIONS = [
  { value: "poor",                    label: "فقير" },
  { value: "widow",                   label: "أرملة" },
  { value: "widow_with_orphans",      label: "أرملة مع أيتام" },
  { value: "divorced",                label: "مطلقة" },
  { value: "divorced_with_children",  label: "مطلقة مع أطفال" },
  { value: "abandoned",               label: "مهجورة" },
];

const CITIZEN_INCOME_OPTIONS = [
  { value: "salary",           label: "راتب" },
  { value: "social_security",  label: "ضمان اجتماعي" },
  { value: "retirement",       label: "معاش تقاعدي" },
  { value: "citizen_account",  label: "حساب المواطن" },
];

const RESIDENT_INCOME_OPTIONS = [
  { value: "salary",         label: "راتب" },
  { value: "family_support", label: "دعم الأسرة من الأقارب" },
];

const RELATIONSHIP_OPTIONS = [
  "ابن", "بنت", "زوجة", "أم", "أب", "أخ", "أخت",
  "جد", "جدة", "حفيد", "أخرى"
];

const INITIAL_DEPENDENT = { name: "", relationship: "", date_of_birth: "" };

const STEPS = [
  { id: 1, label: "البيانات الأساسية" },
  { id: 2, label: "بيانات الأسرة" },
  { id: 3, label: "البيانات المالية" },
  { id: 4, label: "الوثائق" },
];

/* ═══════════════════════ الحالة الابتدائية ═══════════════════════ */

const makeInitialForm = (type) => ({
  beneficiary_type: type,
  full_name: "", national_id: "", phone: "",
  date_of_birth: "", place_of_birth: "", nationality: "", profession: "",
  city: "", district: "", street: "",

  // أسرة
  family_status: "", wives_count: 0,
  family_members_count: 0, working_members_count: 0, non_working_children_count: 0,
  father_status: "alive", mother_status: "alive",
  housing_type: "rent", annual_rent_amount: "",
  owns_house: false,

  // مالية
  income_sources: [],
  monthly_salary: "", citizen_account_amount: "", social_security_amount: "",
  retirement_pension: "", family_support: "",
  bank_name: "", iban: "",
});

/* ═══════════════════════ المكوّن الرئيسي ═══════════════════════ */

export default function AddBeneficiaryPage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const type      = location.pathname.includes("resident") ? "resident" : "citizen";

  const [form, setForm]           = useState(makeInitialForm(type));
  const [dependents, setDependents] = useState([]);
  const [files, setFiles]         = useState({});
  const [step, setStep]           = useState(1);
  const [errors, setErrors]       = useState({});
  const [saving, setSaving]       = useState(false);
  const [idStatus, setIdStatus]   = useState(null); // "checking" | "ok" | "taken"

  /* ─── helpers ─── */

  const handleChange = (e) => {
    const { name, value, type: t, checked } = e.target;
    setForm((f) => ({ ...f, [name]: t === "checkbox" ? checked : value }));
  };

  const handleFile = (e) => {
    const { name, files: fl } = e.target;
    setFiles((f) => ({ ...f, [name]: fl[0] }));
  };

  const toggleIncome = (val) => {
    setForm((f) => ({
      ...f,
      income_sources: f.income_sources.includes(val)
        ? f.income_sources.filter((v) => v !== val)
        : [...f.income_sources, val],
    }));
  };

  /* ─── Dependents CRUD ─── */

  const addDependent = () =>
    setDependents((d) => [...d, { ...INITIAL_DEPENDENT }]);

  const removeDependent = (idx) =>
    setDependents((d) => d.filter((_, i) => i !== idx));

  const updateDependent = (idx, field, val) =>
    setDependents((d) =>
      d.map((dep, i) => (i === idx ? { ...dep, [field]: val } : dep))
    );

  /* ─── Check national ID ─── */

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

  /* ─── Submit ─── */

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (idStatus === "taken") return;
    setSaving(true);
    setErrors({});

    const fd = new FormData();
    
    // Helper function to append values properly
    const appendField = (key, value) => {
      if (value === null || value === undefined || value === "") return;
      if (Array.isArray(value)) {
        // Append arrays with proper indexing
        value.forEach((item, i) => {
          if (typeof item === 'object' && item !== null) {
            // For dependent objects, append each field
            Object.entries(item).forEach(([k, v]) => {
              if (v) fd.append(`${key}[${i}][${k}]`, v);
            });
          } else {
            fd.append(`${key}[${i}]`, item);
          }
        });
      } else if (typeof value === 'boolean') {
        fd.append(key, value ? '1' : '0');
      } else {
        fd.append(key, value);
      }
    };

    // Append all form fields
    Object.entries(form).forEach(([k, v]) => {
      appendField(k, v);
    });

    // Append files (they must come after regular fields)
    Object.entries(files).forEach(([k, f]) => {
      if (f) fd.append(k, f);
    });

    try {
      await beneficiaryApi.create(fd);
      navigate("/beneficiaries");
    } catch (err) {
      console.error('Save error:', err);
      if (err.response?.status === 422) {
        const validationErrors = err.response.data?.errors || {};
        const errorList = Object.values(validationErrors).flat();
        setErrors(validationErrors);
        setStep(1);
        alert("⚠️ تعذر حفظ بيانات المستفيد بسبب الأخطاء التالية:\n\n• " + errorList.join("\n• "));
      } else if (err.response?.status === 500) {
        console.error('Server error:', err.response?.data);
        alert("حدث خطأ في الخادم. يرجى المحاولة مرة أخرى أو التواصل مع المسؤول.");
      } else {
        alert("حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.");
      }
    } finally {
      setSaving(false);
    }
  };

  /* ─── Shared classes ─── */

  const cls = {
    input:   "w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400 text-right",
    select:  "w-full rounded-lg border border-gray-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 text-right",
    label:   "block text-sm font-semibold text-gray-700 mb-1",
    section: "bg-white rounded-2xl shadow-md p-6 mb-4",
    h2:      "text-lg font-bold text-amber-800 mb-4 border-b border-amber-100 pb-2",
  };

  const Err = ({ f }) => {
    const err = errors[f] || errors[f.replace('full_name', 'name')] || errors[f.replace('name', 'full_name')];
    return err ? <p className="text-red-500 text-xs mt-1 font-bold">{err[0]}</p> : null;
  };

  /* ─── Render ─── */

  return (
    <MainLayout>
    <div className="p-6 max-w-5xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">
          {type === "citizen" ? "➕ إضافة مستفيد مواطن" : "➕ إضافة مستفيد مقيم"}
        </h1>
        <Link to="/beneficiaries" className="text-amber-700 hover:underline text-sm">
          ← قائمة المستفيدين
        </Link>
      </div>

      {/* Step Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {STEPS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStep(s.id)}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
              step === s.id
                ? "bg-amber-600 text-white shadow"
                : "bg-gray-100 text-gray-600 hover:bg-amber-50"
            }`}
          >
            {s.id}. {s.label}
          </button>
        ))}
      </div>

      {/* Global errors banner */}
      {Object.keys(errors).length > 0 && (
        <div className="mb-6 p-4 bg-red-50 border-2 border-red-300 rounded-2xl text-red-700 text-sm shadow-sm" dir="rtl">
          <div className="flex items-center gap-2 font-bold text-red-800 text-base mb-1">
            <span>⚠️</span> تنبيه: يرجى تصحيح الأخطاء التالية لإتمام الحفظ:
          </div>
          <ul className="list-disc list-inside space-y-1 mr-2 text-xs font-semibold">
            {Object.values(errors).flat().map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={handleSubmit} encType="multipart/form-data">

        {/* ══════════ STEP 1 – البيانات الأساسية ══════════ */}
        {step === 1 && (
          <>
            <div className={cls.section}>
              <h2 className={cls.h2}>📋 البيانات الشخصية</h2>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className={cls.label}>الاسم الكامل *</label>
                  <input name="full_name" value={form.full_name} onChange={handleChange}
                    className={cls.input} />
                  <Err f="full_name" />
                </div>
                <div>
                  <label className={cls.label}>
                    رقم {type === "citizen" ? "الهوية" : "الإقامة"} *
                  </label>
                  <input
                    name="national_id" value={form.national_id} onChange={handleChange}
                    onBlur={handleNationalIdBlur} maxLength={20}
                    className={`${cls.input} ${
                      idStatus === "taken" ? "border-red-500" : idStatus === "ok" ? "border-green-500" : ""
                    }`}
                  />
                  {idStatus === "checking" && <p className="text-gray-400 text-xs mt-1">⏳ جاري التحقق...</p>}
                  {idStatus === "taken"    && <p className="text-red-500 text-xs mt-1">❌ رقم الهوية مسجل مسبقاً</p>}
                  {idStatus === "ok"       && <p className="text-green-600 text-xs mt-1">✓ رقم الهوية متاح</p>}
                  <Err f="national_id" />
                </div>
                <div>
                  <label className={cls.label}>رقم الهاتف *</label>
                  <input name="phone" value={form.phone} onChange={handleChange}
                    className={cls.input} />
                  <Err f="phone" />
                </div>
                <div>
                  <label className={cls.label}>تاريخ الميلاد</label>
                  <input name="date_of_birth" type="date" value={form.date_of_birth}
                    onChange={handleChange} className={cls.input} />
                </div>
                <div>
                  <label className={cls.label}>مكان الميلاد</label>
                  <input name="place_of_birth" value={form.place_of_birth}
                    onChange={handleChange} className={cls.input} />
                </div>
                {type === "resident" && (
                  <>
                    <div>
                      <label className={cls.label}>الجنسية</label>
                      <input name="nationality" value={form.nationality}
                        onChange={handleChange} className={cls.input} />
                    </div>
                    <div>
                      <label className={cls.label}>المهنة</label>
                      <input name="profession" value={form.profession}
                        onChange={handleChange} className={cls.input} />
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className={cls.section}>
              <h2 className={cls.h2}>📍 بيانات العنوان</h2>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className={cls.label}>المدينة</label>
                  <input name="city" value={form.city} onChange={handleChange} className={cls.input} />
                </div>
                <div>
                  <label className={cls.label}>الحي</label>
                  <input name="district" value={form.district} onChange={handleChange} className={cls.input} />
                </div>
                <div>
                  <label className={cls.label}>الشارع</label>
                  <input name="street" value={form.street} onChange={handleChange} className={cls.input} />
                </div>
              </div>
            </div>
          </>
        )}

        {/* ══════════ STEP 2 – بيانات الأسرة ══════════ */}
        {step === 2 && (
          <>
            <div className={cls.section}>
              <h2 className={cls.h2}>👨‍👩‍👧 بيانات الأسرة</h2>
              <div className="grid md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className={cls.label}>الحالة الأسرية</label>
                  <select name="family_status" value={form.family_status}
                    onChange={handleChange} className={cls.select}>
                    <option value="">-- اختر --</option>
                    {FAMILY_STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={cls.label}>عدد الزوجات</label>
                  <input name="wives_count" type="number" min="0" max="4"
                    value={form.wives_count} onChange={handleChange} className={cls.input} />
                </div>
                <div>
                  <label className={cls.label}>عدد أفراد الأسرة</label>
                  <input name="family_members_count" type="number" min="0"
                    value={form.family_members_count} onChange={handleChange} className={cls.input} />
                </div>
                <div>
                  <label className={cls.label}>عدد العاملين</label>
                  <input name="working_members_count" type="number" min="0"
                    value={form.working_members_count} onChange={handleChange} className={cls.input} />
                </div>
                <div>
                  <label className={cls.label}>الأبناء غير العاملين</label>
                  <input name="non_working_children_count" type="number" min="0"
                    value={form.non_working_children_count} onChange={handleChange} className={cls.input} />
                </div>
                <div>
                  <label className={cls.label}>حالة الأب</label>
                  <select name="father_status" value={form.father_status}
                    onChange={handleChange} className={cls.select}>
                    <option value="alive">على قيد الحياة</option>
                    <option value="deceased">متوفى</option>
                  </select>
                </div>
                <div>
                  <label className={cls.label}>حالة الأم</label>
                  <select name="mother_status" value={form.mother_status}
                    onChange={handleChange} className={cls.select}>
                    <option value="alive">على قيد الحياة</option>
                    <option value="deceased">متوفاة</option>
                  </select>
                </div>
                <div>
                  <label className={cls.label}>نوع السكن</label>
                  <select name="housing_type" value={form.housing_type}
                    onChange={handleChange} className={cls.select}>
                    <option value="rent">إيجار</option>
                    <option value="own">ملك</option>
                  </select>
                </div>
                {form.housing_type === "rent" && (
                  <div>
                    <label className={cls.label}>مبلغ الإيجار السنوي (ريال)</label>
                    <input name="annual_rent_amount" type="number" min="0"
                      value={form.annual_rent_amount} onChange={handleChange} className={cls.input} />
                  </div>
                )}
              </div>
            </div>

            {/* جدول المعالين */}
            <div className={cls.section}>
              <div className="flex items-center justify-between mb-3">
                <h2 className={cls.h2 + " mb-0"}>👶 جدول المعالين (التابعون)</h2>
                <button type="button" onClick={addDependent}
                  className="bg-amber-100 text-amber-800 text-sm px-3 py-1 rounded-lg hover:bg-amber-200 font-semibold">
                  + إضافة معال
                </button>
              </div>
              {dependents.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">
                  لا يوجد معالون. اضغط "+ إضافة معال" لإضافة فرد من الأسرة.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-amber-50 text-amber-800">
                        <th className="p-2 text-right">#</th>
                        <th className="p-2 text-right">الاسم</th>
                        <th className="p-2 text-right">صلة القرابة</th>
                        <th className="p-2 text-right">تاريخ الميلاد</th>
                        <th className="p-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {dependents.map((dep, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-2 text-gray-500">{i + 1}</td>
                          <td className="p-2">
                            <input value={dep.name}
                              onChange={(e) => updateDependent(i, "name", e.target.value)}
                              className={cls.input + " py-1"} placeholder="الاسم الكامل" />
                          </td>
                          <td className="p-2">
                            <select value={dep.relationship}
                              onChange={(e) => updateDependent(i, "relationship", e.target.value)}
                              className={cls.select + " py-1"}>
                              <option value="">-- اختر --</option>
                              {RELATIONSHIP_OPTIONS.map((r) => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2">
                            <input type="date" value={dep.date_of_birth}
                              onChange={(e) => updateDependent(i, "date_of_birth", e.target.value)}
                              className={cls.input + " py-1"} />
                          </td>
                          <td className="p-2">
                            <button type="button" onClick={() => removeDependent(i)}
                              className="text-red-500 hover:text-red-700 text-lg font-bold">×</button>
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

        {/* ══════════ STEP 3 – البيانات المالية ══════════ */}
        {step === 3 && (
          <div className={cls.section}>
            <h2 className={cls.h2}>💰 البيانات المالية</h2>

            {/* مصادر الدخل */}
            <div className="mb-5">
              <label className={cls.label}>مصادر الدخل (يمكن اختيار أكثر من واحد)</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {(type === "citizen" ? CITIZEN_INCOME_OPTIONS : RESIDENT_INCOME_OPTIONS).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleIncome(opt.value)}
                    className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-all ${
                      form.income_sources.includes(opt.value)
                        ? "bg-amber-600 text-white border-amber-600"
                        : "bg-white text-gray-600 border-gray-300 hover:border-amber-400"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {form.income_sources.includes("salary") && (
                <div>
                  <label className={cls.label}>الراتب الشهري (ريال)</label>
                  <input name="monthly_salary" type="number" min="0"
                    value={form.monthly_salary} onChange={handleChange} className={cls.input} />
                </div>
              )}
              {form.income_sources.includes("social_security") && (
                <div>
                  <label className={cls.label}>مبلغ الضمان الاجتماعي (ريال)</label>
                  <input name="social_security_amount" type="number" min="0"
                    value={form.social_security_amount} onChange={handleChange} className={cls.input} />
                </div>
              )}
              {form.income_sources.includes("retirement") && (
                <div>
                  <label className={cls.label}>المعاش التقاعدي (ريال)</label>
                  <input name="retirement_pension" type="number" min="0"
                    value={form.retirement_pension} onChange={handleChange} className={cls.input} />
                </div>
              )}
              {form.income_sources.includes("citizen_account") && (
                <div>
                  <label className={cls.label}>مبلغ حساب المواطن (ريال)</label>
                  <input name="citizen_account_amount" type="number" min="0"
                    value={form.citizen_account_amount} onChange={handleChange} className={cls.input} />
                </div>
              )}
              {form.income_sources.includes("family_support") && (
                <div>
                  <label className={cls.label}>دعم الأسرة من الأقارب (ريال)</label>
                  <input name="family_support" type="number" min="0"
                    value={form.family_support} onChange={handleChange} className={cls.input} />
                </div>
              )}
            </div>

            {/* بيانات البنك والآيبان */}
            <div className="grid md:grid-cols-2 gap-4 mt-5 pt-4 border-t border-gray-100">
              <div>
                <label className={cls.label}>اسم البنك</label>
                <input name="bank_name" value={form.bank_name}
                  onChange={handleChange} className={cls.input}
                  placeholder="مثال: البنك الأهلي السعودي" />
              </div>
              <div>
                <label className={cls.label}>
                  رقم الآيبان (IBAN)
                  <span className="text-xs text-gray-400 font-normal mr-2">يُحفظ مشفراً</span>
                </label>
                <input name="iban" value={form.iban}
                  onChange={handleChange} className={cls.input}
                  placeholder="SA00 0000 0000 0000 0000 0000"
                  maxLength={34}
                  dir="ltr"
                />
              </div>
            </div>
          </div>
        )}

        {/* ══════════ STEP 4 – الوثائق ══════════ */}
        {step === 4 && (
          <div className={cls.section}>
            <h2 className={cls.h2}>📂 الوثائق والمستندات</h2>
            <p className="text-sm text-gray-500 mb-4">
              {type === "citizen"
                ? "للمواطن: صورة الهوية الوطنية، حساب المواطن، الضمان الاجتماعي، شهادة الراتب، العنوان الوطني، عقد الإيجار، أو فاتورة الكهرباء إذا كان السكن ملكاً."
                : "للمقيم: صورة الإقامة، شهادة الراتب، العنوان الوطني، عقد الإيجار."}
            </p>

            <div className="grid md:grid-cols-2 gap-5">
              {type === "citizen" ? (
                <>
                  <FileUpload name="national_id_image"    label="صورة الهوية الوطنية"      onChange={handleFile} />
                  <FileUpload name="citizen_account_image" label="صورة حساب المواطن"         onChange={handleFile} />
                  <FileUpload name="social_security_image" label="صورة الضمان الاجتماعي"     onChange={handleFile} />
                  <FileUpload name="salary_certificate"    label="شهادة الراتب"               onChange={handleFile} accept=".pdf,.jpg,.jpeg,.png" />
                  <FileUpload name="national_address_image" label="صورة العنوان الوطني"       onChange={handleFile} />
                  <FileUpload name="rental_contract_image" label="عقد الإيجار"                onChange={handleFile} accept=".pdf,.jpg,.jpeg,.png" />
                  {form.housing_type === "own" && (
                    <FileUpload name="electricity_bill_image" label="فاتورة الكهرباء (للملاك)" onChange={handleFile} />
                  )}
                </>
              ) : (
                <>
                  <FileUpload name="residence_id_image"   label="صورة الإقامة"               onChange={handleFile} />
                  <FileUpload name="salary_certificate"   label="شهادة الراتب"                onChange={handleFile} accept=".pdf,.jpg,.jpeg,.png" />
                  <FileUpload name="national_address_image" label="صورة العنوان الوطني"       onChange={handleFile} />
                  <FileUpload name="rental_contract_image" label="عقد الإيجار"               onChange={handleFile} accept=".pdf,.jpg,.jpeg,.png" />
                </>
              )}
            </div>
          </div>
        )}

        {/* ══════════ Navigation Buttons ══════════ */}
        <div className="flex justify-between mt-4">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
            className="px-6 py-2 rounded-lg bg-gray-100 text-gray-600 font-semibold disabled:opacity-40 hover:bg-gray-200"
          >
            ← السابق
          </button>

          {step < STEPS.length ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              className="px-6 py-2 rounded-lg bg-amber-500 text-white font-semibold hover:bg-amber-600"
            >
              التالي →
            </button>
          ) : (
            <button
              type="submit"
              disabled={saving || idStatus === "taken"}
              className="px-8 py-2 rounded-lg bg-green-600 text-white font-bold disabled:opacity-50 hover:bg-green-700"
            >
              {saving ? "⏳ جاري الحفظ..." : "✅ حفظ المستفيد"}
            </button>
          )}
        </div>

        {/* Global errors banner */}
        {Object.keys(errors).length > 0 && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            <strong>يرجى مراجعة الأخطاء التالية:</strong>
            <ul className="mt-1 list-disc list-inside">
              {Object.values(errors).flat().map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}
      </form>
    </div>
    </MainLayout>
  );
}

/* ═══════════════════════ مكون رفع الملف ═══════════════════════ */

function FileUpload({ name, label, onChange, accept = "image/*" }) {
  const [preview, setPreview] = useState(null);

  const handleChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPreview(URL.createObjectURL(file));
      onChange(e);
    }
  };

  return (
    <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 hover:border-amber-300 transition-colors">
      <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>
      <input
        type="file"
        name={name}
        accept={accept}
        onChange={handleChange}
        className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-amber-50 file:text-amber-700 file:font-semibold hover:file:bg-amber-100 cursor-pointer"
      />
      {preview && (
        <div className="mt-2">
          {accept.includes("pdf") && preview ? (
            <p className="text-xs text-green-600 font-semibold">✓ تم اختيار الملف</p>
          ) : (
            <img src={preview} alt="معاينة" className="h-20 rounded-lg object-cover mt-1 border" />
          )}
        </div>
      )}
    </div>
  );
}
