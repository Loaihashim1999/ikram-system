import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import staffApi from "../../api/staffApi";
import MainLayout from "../../components/layout/MainLayout";

const RELATIONSHIP_OPTIONS = [
  "ابن", "بنت", "زوجة", "أم", "أب", "أخ", "أخت", "جد", "جدة", "حفيد", "أخرى"
];

const INITIAL_DEPENDENT = { name: "", relationship: "", date_of_birth: "" };

const initialForm = {
  name: "", national_id: "", phone: "", email: "",
  birth_date: "", national_address: "",
  job_title: "", department: "", hire_date: "", salary: "", status: "active",
  family_members_count: 0, wives_count: 0,
  father_status: "alive", mother_status: "alive",
  owns_house: false,
};

export default function AddStaffPage() {
  const navigate = useNavigate();
  const [form, setForm]           = useState(initialForm);
  const [dependents, setDependents] = useState([]);
  const [errors, setErrors]       = useState({});
  const [saving, setSaving]       = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  };

  /* dependents */
  const addDependent    = () => setDependents((d) => [...d, { ...INITIAL_DEPENDENT }]);
  const removeDependent = (i) => setDependents((d) => d.filter((_, j) => j !== i));
  const updateDep       = (i, field, val) =>
    setDependents((d) => d.map((dep, j) => (j === i ? { ...dep, [field]: val } : dep)));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setSaving(true);
    try {
      await staffApi.create({ ...form, dependents });
      navigate("/staff");
    } catch (err) {
      if (err.response?.status === 422) setErrors(err.response.data.errors || {});
      else { console.error(err); alert("حدث خطأ غير متوقع."); }
    } finally {
      setSaving(false);
    }
  };

  const cls = {
    input:  "w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400 text-right",
    select: "w-full rounded-lg border border-gray-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 text-right",
    label:  "block text-sm font-semibold text-gray-700 mb-1",
    card:   "bg-white rounded-2xl shadow-md p-6 mb-4",
    h2:     "text-lg font-bold text-amber-800 mb-4 border-b border-amber-100 pb-2",
  };

  const Err = ({ f }) =>
    errors[f] ? <p className="text-red-500 text-xs mt-1">{errors[f][0]}</p> : null;

  return (
    <MainLayout>
    <div className="p-6 max-w-4xl mx-auto" dir="rtl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">➕ إضافة موظف جديد</h1>
        <Link to="/staff" className="text-amber-700 hover:underline text-sm">← قائمة الموظفين</Link>
      </div>

      <form onSubmit={handleSubmit}>

        {/* البيانات الشخصية */}
        <div className={cls.card}>
          <h2 className={cls.h2}>👤 البيانات الشخصية</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className={cls.label}>اسم الموظف *</label>
              <input name="name" value={form.name} onChange={handleChange} className={cls.input} />
              <Err f="name" />
            </div>
            <div>
              <label className={cls.label}>رقم الهوية *</label>
              <input name="national_id" value={form.national_id} onChange={handleChange} className={cls.input} maxLength={10} />
              <Err f="national_id" />
            </div>
            <div>
              <label className={cls.label}>رقم الهاتف *</label>
              <input name="phone" value={form.phone} onChange={handleChange} className={cls.input} />
              <Err f="phone" />
            </div>
            <div>
              <label className={cls.label}>البريد الإلكتروني</label>
              <input name="email" type="email" value={form.email} onChange={handleChange} className={cls.input} />
              <Err f="email" />
            </div>
            <div>
              <label className={cls.label}>تاريخ الميلاد</label>
              <input name="birth_date" type="date" value={form.birth_date} onChange={handleChange} className={cls.input} />
            </div>
            <div>
              <label className={cls.label}>العنوان الوطني</label>
              <input name="national_address" value={form.national_address} onChange={handleChange} className={cls.input} placeholder="مثال: حي النزهة، الرياض" />
            </div>
          </div>
        </div>

        {/* البيانات الوظيفية */}
        <div className={cls.card}>
          <h2 className={cls.h2}>💼 البيانات الوظيفية</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className={cls.label}>المسمى الوظيفي *</label>
              <input name="job_title" value={form.job_title} onChange={handleChange} className={cls.input} />
              <Err f="job_title" />
            </div>
            <div>
              <label className={cls.label}>القسم</label>
              <input name="department" value={form.department} onChange={handleChange} className={cls.input} />
            </div>
            <div>
              <label className={cls.label}>تاريخ التعيين *</label>
              <input name="hire_date" type="date" value={form.hire_date} onChange={handleChange} className={cls.input} />
              <Err f="hire_date" />
            </div>
            <div>
              <label className={cls.label}>الراتب الشهري (ريال)</label>
              <input name="salary" type="number" min="0" value={form.salary} onChange={handleChange} className={cls.input} />
              <Err f="salary" />
            </div>
            <div>
              <label className={cls.label}>الحالة الوظيفية</label>
              <select name="status" value={form.status} onChange={handleChange} className={cls.select}>
                <option value="active">نشط</option>
                <option value="on_leave">إجازة</option>
                <option value="terminated">منتهية خدمته</option>
              </select>
            </div>
          </div>
        </div>

        {/* البيانات الأسرية */}
        <div className={cls.card}>
          <h2 className={cls.h2}>👨‍👩‍👧 البيانات الأسرية</h2>
          <div className="grid md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className={cls.label}>عدد أفراد الأسرة</label>
              <input name="family_members_count" type="number" min="0"
                value={form.family_members_count} onChange={handleChange} className={cls.input} />
            </div>
            <div>
              <label className={cls.label}>عدد الزوجات</label>
              <input name="wives_count" type="number" min="0" max="4"
                value={form.wives_count} onChange={handleChange} className={cls.input} />
            </div>
            <div>
              <label className={cls.label}>حالة الأب</label>
              <select name="father_status" value={form.father_status} onChange={handleChange} className={cls.select}>
                <option value="alive">على قيد الحياة</option>
                <option value="deceased">متوفى</option>
              </select>
            </div>
            <div>
              <label className={cls.label}>حالة الأم</label>
              <select name="mother_status" value={form.mother_status} onChange={handleChange} className={cls.select}>
                <option value="alive">على قيد الحياة</option>
                <option value="deceased">متوفاة</option>
              </select>
            </div>
            <div className="flex items-center gap-2 mt-6">
              <input type="checkbox" id="owns_house" name="owns_house"
                checked={form.owns_house} onChange={handleChange}
                className="w-4 h-4 accent-amber-600" />
              <label htmlFor="owns_house" className="text-sm font-semibold text-gray-700 cursor-pointer">
                يملك مسكناً
              </label>
            </div>
          </div>

          {/* جدول المعالين */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-700">👶 المعالون (التابعون)</h3>
              <button type="button" onClick={addDependent}
                className="text-sm bg-amber-100 text-amber-800 px-3 py-1 rounded-lg hover:bg-amber-200 font-semibold">
                + إضافة معال
              </button>
            </div>
            {dependents.length === 0 ? (
              <p className="text-gray-400 text-sm py-3 text-center border rounded-lg">
                لا يوجد معالون
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
                        <td className="p-2 text-gray-400">{i + 1}</td>
                        <td className="p-2">
                          <input value={dep.name}
                            onChange={(e) => updateDep(i, "name", e.target.value)}
                            className={cls.input + " py-1"} placeholder="الاسم" />
                        </td>
                        <td className="p-2">
                          <select value={dep.relationship}
                            onChange={(e) => updateDep(i, "relationship", e.target.value)}
                            className={cls.select + " py-1"}>
                            <option value="">-- اختر --</option>
                            {RELATIONSHIP_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </td>
                        <td className="p-2">
                          <input type="date" value={dep.date_of_birth}
                            onChange={(e) => updateDep(i, "date_of_birth", e.target.value)}
                            className={cls.input + " py-1"} />
                        </td>
                        <td className="p-2">
                          <button type="button" onClick={() => removeDependent(i)}
                            className="text-red-500 hover:text-red-700 font-bold text-lg">×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* أخطاء عامة */}
        {Object.keys(errors).length > 0 && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-4">
            <strong>يرجى مراجعة الأخطاء:</strong>
            <ul className="mt-1 list-disc list-inside">
              {Object.values(errors).flat().map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        )}

        <button
          disabled={saving}
          className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-8 py-2.5 rounded-lg disabled:opacity-50 transition-colors"
        >
          {saving ? "⏳ جاري الحفظ..." : "✅ حفظ الموظف"}
        </button>
      </form>
    </div>
    </MainLayout>
  );
}