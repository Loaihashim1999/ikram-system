import { useState, useCallback } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import beneficiaryApi from "../../api/beneficiaries";
import MainLayout from "../../components/layout/MainLayout";
import { CheckCircle2, AlertCircle, Info, Shield, Save, FileText, UserCheck, MapPin, DollarSign, Users } from "lucide-react";

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
  { id: 4, label: "الوثائق المرفقة" },
  { id: 5, label: "مراجعة وتأكيد الحفظ" },
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
  has_special_needs: false,

  // مالية
  income_sources: [],
  monthly_salary: "", citizen_account_amount: "", social_security_amount: "",
  retirement_pension: "", family_support: "",
  bank_name: "", iban: "",
});

export default function AddBeneficiaryPage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const type      = location.pathname.includes("resident") ? "resident" : "citizen";

  const [form, setForm]             = useState(makeInitialForm(type));
  const [dependents, setDependents]   = useState([]);
  const [files, setFiles]           = useState({});
  const [step, setStep]             = useState(1);
  const [errors, setErrors]         = useState({});
  const [saving, setSaving]         = useState(false);
  const [idStatus, setIdStatus]     = useState(null);
  const [toast, setToast]           = useState(null);

  const handleChange = (e) => {
    const { name, value, type: t, checked } = e.target;
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

  // Calculate live total income & expected priority for Step 5 Review
  const calculateTotalIncome = () => {
    return (
      (parseFloat(form.monthly_salary) || 0) +
      (parseFloat(form.citizen_account_amount) || 0) +
      (parseFloat(form.social_security_amount) || 0) +
      (parseFloat(form.retirement_pension) || 0) +
      (parseFloat(form.family_support) || 0)
    );
  };

  const predictPriority = () => {
    if (form.has_special_needs) return { label: "ذوي الاحتياجات الخاصة (Priority 1)", badge: "bg-purple-100 text-purple-800" };
    const total = calculateTotalIncome();
    if (total <= 3000) return { label: "الدرجة الأولى (≤ 3000 ريال)", badge: "bg-amber-100 text-amber-900 border-amber-300 font-bold" };
    if (total <= 6000) return { label: "الدرجة الثانية (≤ 6000 ريال)", badge: "bg-blue-100 text-blue-900 border-blue-300 font-bold" };
    return { label: "الدرجة الثانية (أعلى من الحد)", badge: "bg-gray-100 text-gray-800" };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (idStatus === "taken") return alert("رقم الهوية/الإقامة مسجل مسبقاً في النظام.");
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

    Object.entries(form).forEach(([k, v]) => appendField(k, v));

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
      setToast("✅ تم حفظ وتصنيف بيانات المستفيد بنجاح!");
      setTimeout(() => {
        navigate("/beneficiaries");
      }, 1500);
    } catch (err) {
      if (err.response?.status === 422) {
        const validationErrors = err.response.data?.errors || {};
        const errorList = Object.values(validationErrors).flat();
        setErrors(validationErrors);
        setStep(1);
        alert("⚠️ تعذر حفظ بيانات المستفيد بسبب الأخطاء التالية:\n\n• " + errorList.join("\n• "));
      } else {
        alert("حدث خطأ أثناء حفظ المستفيد. يرجى المحاولة مرة أخرى.");
      }
    } finally {
      setSaving(false);
    }
  };

  const cls = {
    input:   "w-full rounded-xl border border-gray-300 px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400 text-right text-sm bg-white",
    select:  "w-full rounded-xl border border-gray-300 px-3.5 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 text-right text-sm font-bold",
    label:   "block text-xs font-bold text-gray-700 mb-1",
    helper:  "text-[11px] text-gray-400 mt-1 block",
    section: "bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-5",
    h2:      "text-base font-bold text-amber-900 mb-4 border-b border-amber-100 pb-2 flex items-center gap-2",
  };

  const Err = ({ f }) => {
    const err = errors[f] || errors[f.replace('full_name', 'name')];
    return err ? <p className="text-red-500 text-xs mt-1 font-bold">⚠️ {err[0]}</p> : null;
  };

  return (
    <MainLayout>
    <div className="p-6 max-w-5xl mx-auto" dir="rtl">
      {/* Toast notification */}
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 bg-green-700 text-white font-bold px-6 py-3 rounded-2xl shadow-2xl z-50 flex items-center gap-2 text-sm animate-bounce">
          <CheckCircle2 className="w-5 h-5" />
          <span>{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            {type === "citizen" ? "➕ إضافة مستفيد مواطن جديد" : "➕ إضافة مستفيد مقيم جديد"}
          </h1>
          <p className="text-xs text-gray-500 mt-1">تعبئة البيانات الأسرية والمالية وتصنيف المستفيد آلياً</p>
        </div>
        <Link to="/beneficiaries" className="text-amber-700 hover:underline text-xs font-bold">
          ← العودة لقائمة المستفيدين
        </Link>
      </div>

      {/* Step Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {STEPS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStep(s.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              step === s.id
                ? "bg-amber-600 text-white shadow-md"
                : "bg-gray-100 text-gray-600 hover:bg-amber-50"
            }`}
          >
            {s.id}. {s.label}
          </button>
        ))}
      </div>

      {/* Global Errors Banner */}
      {Object.keys(errors).length > 0 && (
        <div className="mb-6 p-4 bg-red-50 border-2 border-red-300 rounded-2xl text-red-800 text-xs shadow-sm">
          <div className="flex items-center gap-2 font-bold text-sm mb-1 text-red-900">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span>تنبيه: يرجى تصحيح المدخلات التالية لإتمام الحفظ:</span>
          </div>
          <ul className="list-disc list-inside space-y-1 mr-2 font-semibold">
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
              <h2 className={cls.h2}>📋 البيانات الشخصية والمعلومات الأساسية</h2>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className={cls.label}>الاسم الكامل *</label>
                  <input name="full_name" value={form.full_name} onChange={handleChange} className={cls.input} placeholder="الاسم الرباعي المكتوب بالهوية" />
                  <span className={cls.helper}>أدخل الاسم الرباعي كما هو مدون في الهوية الوطنية أو الإقامة</span>
                  <Err f="full_name" />
                </div>

                <div>
                  <label className={cls.label}>رقم {type === "citizen" ? "الهوية الوطنية" : "الإقامة (Iqama)"} *</label>
                  <input
                    name="national_id" value={form.national_id} onChange={handleChange}
                    onBlur={handleNationalIdBlur} maxLength={20}
                    className={`${cls.input} ${
                      idStatus === "taken" ? "border-red-500" : idStatus === "ok" ? "border-green-500" : ""
                    }`}
                    placeholder={type === "citizen" ? "10XXXXXXXX" : "20XXXXXXXX"}
                  />
                  <span className={cls.helper}>يتكون من 10 أرقام (تبدأ بـ 1 للمواطن أو 2 للمقيم)</span>
                  {idStatus === "checking" && <p className="text-gray-400 text-xs mt-1">⏳ جاري التحقق من الهوية...</p>}
                  {idStatus === "taken"    && <p className="text-red-500 text-xs mt-1 font-bold">❌ رقم الهوية مسجل مسبقاً في النظام</p>}
                  {idStatus === "ok"       && <p className="text-green-600 text-xs mt-1 font-bold">✓ رقم الهوية متاح للتسجيل</p>}
                  <Err f="national_id" />
                </div>

                <div>
                  <label className={cls.label}>رقم الجوال الفعال *</label>
                  <input name="phone" value={form.phone} onChange={handleChange} className={cls.input} placeholder="05XXXXXXXX" />
                  <span className={cls.helper}>يُستخدم لإرسال رموز الواتساب والباركود</span>
                  <Err f="phone" />
                </div>

                <div>
                  <label className={cls.label}>تاريخ الميلاد</label>
                  <input name="date_of_birth" type="date" value={form.date_of_birth} onChange={handleChange} className={cls.input} />
                  <span className={cls.helper}>تاريخ الميلاد باحتساب فئة كبار السن تلقائياً عند بلوغ 60 سنة</span>
                </div>

                <div>
                  <label className={cls.label}>مكان الميلاد</label>
                  <input name="place_of_birth" value={form.place_of_birth} onChange={handleChange} className={cls.input} />
                  <span className={cls.helper}>المدينة أو المحافظة المدونة بالوثائق الرسمية</span>
                </div>

                {type === "resident" && (
                  <>
                    <div>
                      <label className={cls.label}>الجنسية</label>
                      <input name="nationality" value={form.nationality} onChange={handleChange} className={cls.input} placeholder="سوداني، يمني، مصري..." />
                      <span className={cls.helper}>جنسية المقيم المسجلة بالإقامة</span>
                    </div>
                    <div>
                      <label className={cls.label}>المهنة الحالية</label>
                      <input name="profession" value={form.profession} onChange={handleChange} className={cls.input} />
                      <span className={cls.helper}>المهنة حسب كارت العمل أو الإقامة</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className={cls.section}>
              <h2 className={cls.h2}>📍 بيانات العنوان الوطني والسكن التفصيلي</h2>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className={cls.label}>المدينة *</label>
                  <input name="city" value={form.city} onChange={handleChange} className={cls.input} placeholder="مكة المكرمة" />
                  <span className={cls.helper}>المدينة التي يقطنها المستفيد</span>
                </div>
                <div>
                  <label className={cls.label}>اسم الحي السكني *</label>
                  <input name="district" value={form.district} onChange={handleChange} className={cls.input} placeholder="حي الشرائع مخطط 9" />
                  <span className={cls.helper}>اسم الحي للربط مع مناديب الأحياء والتوصيل</span>
                </div>
                <div>
                  <label className={cls.label}>اسم الشارع أو المربع</label>
                  <input name="street" value={form.street} onChange={handleChange} className={cls.input} placeholder="شارع الملك فهد" />
                  <span className={cls.helper}>معلم بارز أو اسم الشارع الرئيسي بالحي</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ══════════ STEP 2 – بيانات الأسرة ══════════ */}
        {step === 2 && (
          <>
            <div className={cls.section}>
              <h2 className={cls.h2}>👨‍👩‍👧 البيانات الأسرية والاجتماعية</h2>
              <div className="grid md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className={cls.label}>الحالة الأسرية والاجتماعية</label>
                  <select name="family_status" value={form.family_status} onChange={handleChange} className={cls.select}>
                    <option value="">-- اختر الحالة --</option>
                    {FAMILY_STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <span className={cls.helper}>تحديد الوضع الأسري لرعاية الأيتام والمطلقات والفقراء</span>
                </div>

                <div>
                  <label className={cls.label}>عدد أفراد الأسرة المقيمين بنفس السكن</label>
                  <input name="family_members_count" type="number" min="0" value={form.family_members_count} onChange={handleChange} className={cls.input} />
                  <span className={cls.helper}>إجمالي الأفراد المشمولين بالدعم بالمنزل</span>
                </div>

                <div>
                  <label className={cls.label}>ذوو الاحتياجات الخاصة (الإعاقة)</label>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="has_special_needs"
                      name="has_special_needs"
                      checked={form.has_special_needs}
                      onChange={handleChange}
                      className="w-4 h-4 rounded text-amber-600 focus:ring-amber-400"
                    />
                    <label htmlFor="has_special_needs" className="text-xs font-bold text-purple-900 cursor-pointer">
                      تفعيل فئة ذوي الاحتياجات الخاصة لتأكيد أولوية التوصيل
                    </label>
                  </div>
                </div>

                <div>
                  <label className={cls.label}>نوع السكن الحالي</label>
                  <select name="housing_type" value={form.housing_type} onChange={handleChange} className={cls.select}>
                    <option value="rent">إيجار</option>
                    <option value="own">ملك</option>
                  </select>
                </div>

                {form.housing_type === "rent" && (
                  <div>
                    <label className={cls.label}>مبلغ الإيجار السنوي (ريال)</label>
                    <input name="annual_rent_amount" type="number" min="0" value={form.annual_rent_amount} onChange={handleChange} className={cls.input} />
                    <span className={cls.helper}>قيمة إيجار العقار السنوي حسب عقد الإيجار</span>
                  </div>
                )}
              </div>
            </div>

            {/* المعالون */}
            <div className={cls.section}>
              <div className="flex items-center justify-between mb-3">
                <h2 className={cls.h2 + " mb-0"}>👶 جدول الأفراد المعالين (التابعين)</h2>
                <button type="button" onClick={addDependent} className="bg-amber-100 text-amber-900 text-xs px-3 py-1.5 rounded-lg font-bold hover:bg-amber-200">
                  + إضافة معال
                </button>
              </div>
              {dependents.length === 0 ? (
                <p className="text-gray-400 text-xs text-center py-4">اضغط "+ إضافة معال" لإضافة الأبناء أو الوالدين التابعين.</p>
              ) : (
                <div className="overflow-x-auto border border-gray-200 rounded-xl">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-amber-50 text-amber-800">
                        <th className="p-2 text-right">#</th>
                        <th className="p-2 text-right">الاسم الكامل</th>
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
                            <input value={dep.name} onChange={(e) => updateDependent(i, "name", e.target.value)} className={cls.input + " py-1"} placeholder="اسم التابع" />
                          </td>
                          <td className="p-2">
                            <select value={dep.relationship} onChange={(e) => updateDependent(i, "relationship", e.target.value)} className={cls.select + " py-1"}>
                              <option value="">-- اختر --</option>
                              {RELATIONSHIP_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                            </select>
                          </td>
                          <td className="p-2">
                            <input type="date" value={dep.date_of_birth} onChange={(e) => updateDependent(i, "date_of_birth", e.target.value)} className={cls.input + " py-1"} />
                          </td>
                          <td className="p-2">
                            <button type="button" onClick={() => removeDependent(i)} className="text-red-600 font-bold hover:underline">إزالة</button>
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

        {/* ══════════ STEP 3 – البيانات المالية وتصنيف الدخل ══════════ */}
        {step === 3 && (
          <div className={cls.section}>
            <h2 className={cls.h2}>💰 مصادر الدخل والدخل الشهري الكلي</h2>
            <div className="mb-5">
              <label className={cls.label}>حدد مصادر الدخل المتوفرة لجمع مجموع الدخل الشهري آلياً:</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {(type === "citizen" ? CITIZEN_INCOME_OPTIONS : RESIDENT_INCOME_OPTIONS).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleIncome(opt.value)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                      form.income_sources.includes(opt.value)
                        ? "bg-amber-600 text-white border-amber-600 shadow-sm"
                        : "bg-white text-gray-700 border-gray-300 hover:border-amber-400"
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
                  <label className={cls.label}>الراتب الشهري الفعلي (ريال)</label>
                  <input name="monthly_salary" type="number" min="0" value={form.monthly_salary} onChange={handleChange} className={cls.input} />
                  <span className={cls.helper}>المبلغ التقريبي للراتب الفعلي قبل الخصم</span>
                </div>
              )}
              {form.income_sources.includes("social_security") && (
                <div>
                  <label className={cls.label}>مبلغ الضمان الاجتماعي (ريال)</label>
                  <input name="social_security_amount" type="number" min="0" value={form.social_security_amount} onChange={handleChange} className={cls.input} />
                  <span className={cls.helper}>مبلغ الدعم الشهري المقدم من الضمان الاجتماعي المطور</span>
                </div>
              )}
              {form.income_sources.includes("retirement") && (
                <div>
                  <label className={cls.label}>المعاش التقاعدي (ريال)</label>
                  <input name="retirement_pension" type="number" min="0" value={form.retirement_pension} onChange={handleChange} className={cls.input} />
                  <span className={cls.helper}>المعاش التقاعدي المستلم شهرياً</span>
                </div>
              )}
              {form.income_sources.includes("citizen_account") && (
                <div>
                  <label className={cls.label}>مبلغ حساب المواطن (ريال)</label>
                  <input name="citizen_account_amount" type="number" min="0" value={form.citizen_account_amount} onChange={handleChange} className={cls.input} />
                  <span className={cls.helper}>مبلغ الاستحقاق من برنامج حساب المواطن</span>
                </div>
              )}
              {form.income_sources.includes("family_support") && (
                <div>
                  <label className={cls.label}>دعم الأسرة والأقارب (ريال)</label>
                  <input name="family_support" type="number" min="0" value={form.family_support} onChange={handleChange} className={cls.input} />
                  <span className={cls.helper}>الدعم المالي المستلم من الأقارب والمحسنين</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════ STEP 4 – الوثائق ══════════ */}
        {step === 4 && (
          <div className={cls.section}>
            <h2 className={cls.h2}>📂 رفع الوثائق والمستندات المرفقة المطلوبة</h2>
            <p className="text-xs text-gray-500 mb-4 font-semibold">
              {type === "citizen"
                ? "الوثائق المطلوبة للمواطن: هوية مواطن، حساب المواطن، إثبات الراتب، الضمان الاجتماعي، راتب التقاعد، عقد الإيجار/فاتورة الكهرباء، والعنوان الوطني."
                : "الوثائق المطلوبة للمقيم: هوية مقيم (الإقامة)، إثبات الراتب، عقد الإيجار/فاتورة الكهرباء، والعنوان الوطني."}
            </p>

            <div className="grid md:grid-cols-2 gap-4">
              {type === "citizen" ? (
                <>
                  <FileUpload name="national_id_image" label="1. صورة هوية مواطن *" onChange={handleFile} />
                  <FileUpload name="citizen_account_image" label="2. صورة إثبات حساب المواطن" onChange={handleFile} />
                  <FileUpload name="salary_certificate" label="3. صورة إثبات الراتب" onChange={handleFile} accept=".pdf,.jpg,.jpeg,.png" />
                  <FileUpload name="social_security_image" label="4. صورة مشهد الضمان الاجتماعي" onChange={handleFile} />
                  <FileUpload name="pension_certificate_image" label="5. صورة راتب التقاعد" onChange={handleFile} accept=".pdf,.jpg,.jpeg,.png" />
                  <FileUpload name="rental_contract_image" label="6. عقد الإيجار أو فاتورة الكهرباء" onChange={handleFile} accept=".pdf,.jpg,.jpeg,.png" />
                  <FileUpload name="national_address_image" label="7. صورة إثبات العنوان الوطني" onChange={handleFile} />
                </>
              ) : (
                <>
                  <FileUpload name="residence_id_image" label="1. صورة هوية مقيم (الإقامة) *" onChange={handleFile} />
                  <FileUpload name="salary_certificate" label="2. صورة إثبات الراتب" onChange={handleFile} accept=".pdf,.jpg,.jpeg,.png" />
                  <FileUpload name="rental_contract_image" label="3. عقد الإيجار أو فاتورة الكهرباء" onChange={handleFile} accept=".pdf,.jpg,.jpeg,.png" />
                  <FileUpload name="national_address_image" label="4. صورة إثبات العنوان الوطني" onChange={handleFile} />
                </>
              )}
            </div>
          </div>
        )}

        {/* ══════════ STEP 5 – مراجعة وتأكيد الحفظ ══════════ */}
        {step === 5 && (
          <div className={cls.section}>
            <h2 className={cls.h2}>🔎 الخطوة الأخيرة: مراجعة البيانات وتأكيد التوثيق والتصنيف</h2>
            
            <p className="text-xs text-amber-900 bg-amber-50 p-3 rounded-xl border border-amber-200 mb-5 font-semibold">
              ⚠️ <strong>تنبيه هام:</strong> لا يتم حفظ المستفيد في النظام إلا بعد الضغط الصريح على زر <strong>"✅ حفظ وتصنيف المستفيد"</strong> أسفل هذا التقرير.
            </p>

            {/* Predicted Classification Badge */}
            <div className="bg-gradient-to-r from-amber-50 to-amber-100/60 p-4 rounded-2xl border border-amber-200 mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-xs text-gray-500 font-bold block mb-1">التصنيف المحسوب آلياً للمستفيد:</span>
                <span className={`px-4 py-1.5 rounded-full text-xs font-bold shadow-sm ${predictPriority().badge}`}>
                  {predictPriority().label}
                </span>
              </div>
              <div className="text-left">
                <span className="text-xs text-gray-500 font-bold block mb-1">مجموع الدخل الشهري الكلي:</span>
                <span className="text-lg font-bold text-amber-900 font-mono">
                  {calculateTotalIncome().toLocaleString()} ريال سعودي
                </span>
              </div>
            </div>

            {/* Complete Data Summary Grid */}
            <div className="space-y-4 text-xs">
              {/* Basic Info */}
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200">
                <h3 className="font-bold text-amber-900 text-sm mb-2 flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-amber-600" />
                  <span>البيانات الأساسية والهوية</span>
                </h3>
                <div className="grid md:grid-cols-3 gap-3">
                  <div><strong>الاسم الكامل:</strong> {form.full_name || "—"}</div>
                  <div><strong>رقم الهوية/الإقامة:</strong> <span className="font-mono">{form.national_id || "—"}</span></div>
                  <div><strong>رقم الجوال:</strong> <span className="font-mono">{form.phone || "—"}</span></div>
                  <div><strong>تاريخ الميلاد:</strong> {form.date_of_birth || "—"}</div>
                  <div><strong>مكان الميلاد:</strong> {form.place_of_birth || "—"}</div>
                  <div><strong>نوع المستفيد:</strong> {type === 'citizen' ? 'مواطن سعودي' : `مقيم (${form.nationality || 'غير محدد'})`}</div>
                </div>
              </div>

              {/* National Address */}
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200">
                <h3 className="font-bold text-amber-900 text-sm mb-2 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-amber-600" />
                  <span>العنوان الوطني والسكن التفصيلي</span>
                </h3>
                <div className="grid md:grid-cols-3 gap-3">
                  <div><strong>المدينة:</strong> {form.city || "—"}</div>
                  <div><strong>اسم الحي:</strong> {form.district || "—"}</div>
                  <div><strong>الشارع / المعلم:</strong> {form.street || "—"}</div>
                  <div><strong>نوع السكن:</strong> {form.housing_type === 'rent' ? 'إيجار' : 'ملك'}</div>
                  {form.housing_type === 'rent' && (
                    <div><strong>مبلغ الإيجار السنوي:</strong> {form.annual_rent_amount ? `${form.annual_rent_amount} ريال` : "—"}</div>
                  )}
                </div>
              </div>

              {/* Family & Dependents */}
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200">
                <h3 className="font-bold text-amber-900 text-sm mb-2 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-amber-600" />
                  <span>بيانات الأسرة والتابعين ({dependents.length} معالين)</span>
                </h3>
                <div className="grid md:grid-cols-3 gap-3 mb-3">
                  <div><strong>الحالة الاجتماعية:</strong> {form.family_status || "—"}</div>
                  <div><strong>إجمالي أفراد الأسرة:</strong> {form.family_members_count || 0}</div>
                  <div><strong>ذوو الاحتياجات الخاصة:</strong> {form.has_special_needs ? "نعم (مفعل)" : "لا"}</div>
                </div>

                {dependents.length > 0 && (
                  <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                    <table className="w-full text-xs text-right">
                      <thead className="bg-amber-50 text-amber-900 border-b">
                        <tr>
                          <th className="p-2">#</th>
                          <th className="p-2 font-bold">الاسم</th>
                          <th className="p-2 font-bold">صلة القرابة</th>
                          <th className="p-2 font-bold">تاريخ الميلاد</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dependents.map((dep, idx) => (
                          <tr key={idx} className="border-b">
                            <td className="p-2 text-gray-400">{idx + 1}</td>
                            <td className="p-2 font-bold">{dep.name}</td>
                            <td className="p-2">{dep.relationship || "—"}</td>
                            <td className="p-2 font-mono">{dep.date_of_birth || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Uploaded Documents List */}
              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200">
                <h3 className="font-bold text-amber-900 text-sm mb-2 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-amber-600" />
                  <span>الوثائق المرفقة المجهزة للحفظ</span>
                </h3>
                {Object.keys(files).length === 0 ? (
                  <p className="text-gray-400 text-xs">لم يتم اختيار أي وثائق مرفقة بعد.</p>
                ) : (
                  <ul className="space-y-1 text-xs">
                    {Object.entries(files).map(([k, f]) => (
                      <li key={k} className="text-green-700 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{k}: {f.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex justify-between mt-4">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
            className="px-6 py-2.5 rounded-xl bg-gray-100 text-gray-600 font-bold text-xs disabled:opacity-40 hover:bg-gray-200"
          >
            ← السابق
          </button>

          {step < STEPS.length ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              className="px-6 py-2.5 rounded-xl bg-amber-600 text-white font-bold text-xs hover:bg-amber-700 shadow-sm"
            >
              التالي →
            </button>
          ) : (
            <button
              type="submit"
              disabled={saving || idStatus === "taken"}
              className="px-8 py-2.5 rounded-xl bg-green-600 text-white font-bold text-xs disabled:opacity-50 hover:bg-green-700 shadow-md flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? "⏳ جاري الحفظ والتصنيف..." : "✅ حفظ وتصنيف المستفيد"}</span>
            </button>
          )}
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
    <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 hover:border-amber-300 transition-colors bg-white">
      <label className="block text-xs font-bold text-gray-700 mb-2">{label}</label>
      <input type="file" name={name} accept={accept} onChange={handleChange} className="block w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-amber-50 file:text-amber-700 file:font-bold cursor-pointer" />
      {fileName && <p className="text-[11px] text-green-600 font-bold mt-2">✓ تم اختيار: {fileName}</p>}
    </div>
  );
}
