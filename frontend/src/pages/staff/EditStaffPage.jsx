import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import staffApi from "../../api/staffApi";
import MainLayout from "../../components/layout/MainLayout";
import {
  Briefcase, Home, Users, FileText, Save, ArrowRight, Plus, Trash2
} from "lucide-react";

const RELATIONSHIP_OPTIONS = [
  "ابن", "بنت", "زوجة", "أم", "أب", "أخ", "أخت", "جد", "جدة", "حفيد", "أخرى"
];

const INITIAL_DEPENDENT = { name: "", relationship: "ابن", date_of_birth: "" };

export default function EditStaffPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("info"); // info, family, dependents, docs

  const [form, setForm] = useState({
    name: "", national_id: "", phone: "", email: "",
    birth_date: "", national_address: "",
    job_title: "", department: "", hire_date: "", salary: 0, status: "active",
    family_members_count: 1, wives_count: 1,
    father_status: "alive", mother_status: "alive",
    owns_house: false,
  });

  const [dependents, setDependents] = useState([]);

  useEffect(() => {
    setLoading(true);
    staffApi
      .get(id)
      .then((res) => {
        const data = res.data?.data ?? res.data;
        if (data) {
          setForm({
            name: data.name || "",
            national_id: data.national_id || "",
            phone: data.phone || "",
            email: data.email || "",
            birth_date: data.birth_date ? data.birth_date.slice(0, 10) : "",
            national_address: data.national_address || "",
            job_title: data.job_title || "",
            department: data.department || "",
            hire_date: data.hire_date ? data.hire_date.slice(0, 10) : "",
            salary: data.salary || 0,
            status: data.status || "active",
            family_members_count: data.family_members_count ?? 1,
            wives_count: data.wives_count ?? 1,
            father_status: data.father_status || "alive",
            mother_status: data.mother_status || "alive",
            owns_house: !!data.owns_house,
          });
          setDependents(
            Array.isArray(data.dependents)
              ? data.dependents.map((d) => ({
                  ...d,
                  date_of_birth: d.date_of_birth ? d.date_of_birth.slice(0, 10) : "",
                }))
              : []
          );
        }
      })
      .catch((err) => {
        console.error(err);
        alert("تعذر تحميل بيانات الموظف.");
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  };

  const addDependent = () => setDependents((d) => [...d, { ...INITIAL_DEPENDENT }]);
  const removeDependent = (idx) => setDependents((d) => d.filter((_, j) => j !== idx));
  const updateDependent = (idx, field, val) =>
    setDependents((d) => d.map((dep, j) => (j === idx ? { ...dep, [field]: val } : dep)));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await staffApi.update(id, {
        ...form,
        dependents,
      });
      alert("تم حفظ تعديلات الموظف بنجاح.");
      navigate("/staff");
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء حفظ التعديلات.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="p-8 text-center text-gray-500 font-bold" dir="rtl">
          جاري تحميل بيانات الموظف للتعديل...
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-6 max-w-4xl mx-auto" dir="rtl">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">✏️ تعديل بيانات الموظف</h1>
            <p className="text-xs text-gray-500 mt-1">{form.name}</p>
          </div>
          <Link
            to="/staff"
            className="text-amber-700 hover:underline text-xs font-bold flex items-center gap-1"
          >
            <ArrowRight className="w-4 h-4" />
            <span>العودة لقائمة الموظفين</span>
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
          {/* 4 Tabs Header */}
          <div className="flex border-b border-gray-200 bg-amber-50/50 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab("info")}
              className={`flex-1 py-3.5 px-4 flex items-center justify-center gap-1.5 transition-all cursor-pointer border-b-2 ${
                activeTab === "info"
                  ? "border-amber-600 text-amber-900 bg-white"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              <Briefcase className="w-4 h-4" />
              <span>بيانات الموظف</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("family")}
              className={`flex-1 py-3.5 px-4 flex items-center justify-center gap-1.5 transition-all cursor-pointer border-b-2 ${
                activeTab === "family"
                  ? "border-amber-600 text-amber-900 bg-white"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              <Home className="w-4 h-4" />
              <span>بيانات الأسرة</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("dependents")}
              className={`flex-1 py-3.5 px-4 flex items-center justify-center gap-1.5 transition-all cursor-pointer border-b-2 ${
                activeTab === "dependents"
                  ? "border-amber-600 text-amber-900 bg-white"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              <Users className="w-4 h-4" />
              <span>بيانات التابعين</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("docs")}
              className={`flex-1 py-3.5 px-4 flex items-center justify-center gap-1.5 transition-all cursor-pointer border-b-2 ${
                activeTab === "docs"
                  ? "border-amber-600 text-amber-900 bg-white"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>الوثائق والمرفقات</span>
            </button>
          </div>

          {/* Tab 1: بيانات الموظف */}
          {activeTab === "info" && (
            <div className="p-6 grid md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">اسم الموظف الكامل *</label>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                  className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">رقم الهوية / الإقامة *</label>
                <input
                  name="national_id"
                  value={form.national_id}
                  onChange={handleChange}
                  maxLength={10}
                  required
                  className="w-full p-2.5 border border-gray-300 rounded-xl font-mono focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">رقم الهاتف *</label>
                <input
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  required
                  className="w-full p-2.5 border border-gray-300 rounded-xl font-mono focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">البريد الإلكتروني</label>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  className="w-full p-2.5 border border-gray-300 rounded-xl font-mono focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">المسمى الوظيفي *</label>
                <input
                  name="job_title"
                  value={form.job_title}
                  onChange={handleChange}
                  required
                  className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 font-bold text-amber-900"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">القسم / الإدارة</label>
                <input
                  name="department"
                  value={form.department}
                  onChange={handleChange}
                  className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">تاريخ التعيين</label>
                <input
                  name="hire_date"
                  type="date"
                  value={form.hire_date}
                  onChange={handleChange}
                  className="w-full p-2.5 border border-gray-300 rounded-xl font-mono focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">تاريخ الميلاد</label>
                <input
                  name="birth_date"
                  type="date"
                  value={form.birth_date}
                  onChange={handleChange}
                  className="w-full p-2.5 border border-gray-300 rounded-xl font-mono focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">الراتب الأساسي (ريال)</label>
                <input
                  name="salary"
                  type="number"
                  value={form.salary}
                  onChange={handleChange}
                  className="w-full p-2.5 border border-gray-300 rounded-xl font-mono focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">الحالة الوظيفية</label>
                <select
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                  className="w-full p-2.5 border border-gray-300 rounded-xl font-bold bg-white focus:ring-2 focus:ring-amber-500"
                >
                  <option value="active">✅ نشط</option>
                  <option value="on_leave">🏖️ إجازة</option>
                  <option value="terminated">⛔ منتهي الخدمة</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block font-bold text-gray-700 mb-1">العنوان الوطني</label>
                <input
                  name="national_address"
                  value={form.national_address}
                  onChange={handleChange}
                  className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          )}

          {/* Tab 2: بيانات الأسرة */}
          {activeTab === "family" && (
            <div className="p-6 grid md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">عدد أفراد الأسرة</label>
                <input
                  name="family_members_count"
                  type="number"
                  min="0"
                  value={form.family_members_count}
                  onChange={handleChange}
                  className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">عدد الزوجات</label>
                <input
                  name="wives_count"
                  type="number"
                  min="0"
                  max="4"
                  value={form.wives_count}
                  onChange={handleChange}
                  className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">حالة الأب</label>
                <select
                  name="father_status"
                  value={form.father_status}
                  onChange={handleChange}
                  className="w-full p-2.5 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-amber-500"
                >
                  <option value="alive">على قيد الحياة</option>
                  <option value="deceased">متوفى</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">حالة الأم</label>
                <select
                  name="mother_status"
                  value={form.mother_status}
                  onChange={handleChange}
                  className="w-full p-2.5 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-amber-500"
                >
                  <option value="alive">على قيد الحياة</option>
                  <option value="deceased">متوفاة</option>
                </select>
              </div>

              <div className="md:col-span-2 flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="owns_house"
                  name="owns_house"
                  checked={form.owns_house}
                  onChange={handleChange}
                  className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                />
                <label htmlFor="owns_house" className="font-bold text-gray-800 cursor-pointer">
                  يمتلك السكن (ملك شخصي)
                </label>
              </div>
            </div>
          )}

          {/* Tab 3: بيانات التابعين */}
          {activeTab === "dependents" && (
            <div className="p-6 text-xs space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-gray-800">قائمة التابعين المعالين للموظف</h4>
                <button
                  type="button"
                  onClick={addDependent}
                  className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة تابع جديد</span>
                </button>
              </div>

              {dependents.length > 0 ? (
                <div className="space-y-3">
                  {dependents.map((dep, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-gray-50 border border-gray-200 rounded-2xl grid md:grid-cols-3 gap-3 items-center"
                    >
                      <div>
                        <label className="block text-[11px] font-bold text-gray-600 mb-1">اسم التابع</label>
                        <input
                          value={dep.name || ""}
                          onChange={(e) => updateDependent(idx, "name", e.target.value)}
                          placeholder="اسم التابع"
                          className="w-full p-2 border border-gray-300 rounded-xl bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-gray-600 mb-1">صلة القرابة</label>
                        <select
                          value={dep.relationship || "ابن"}
                          onChange={(e) => updateDependent(idx, "relationship", e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-xl bg-white"
                        >
                          {RELATIONSHIP_OPTIONS.map((rel) => (
                            <option key={rel} value={rel}>
                              {rel}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <label className="block text-[11px] font-bold text-gray-600 mb-1">تاريخ الميلاد</label>
                          <input
                            type="date"
                            value={dep.date_of_birth || ""}
                            onChange={(e) => updateDependent(idx, "date_of_birth", e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-xl bg-white font-mono"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeDependent(idx)}
                          className="mt-4 p-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-xl font-bold cursor-pointer"
                          title="حذف هذا التابع"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                  لا يوجد تابعون مضافون بعد. اضغط على "+ إضافة تابع جديد" للإضافة.
                </div>
              )}
            </div>
          )}

          {/* Tab 4: الوثائق والمرفقات */}
          {activeTab === "docs" && (
            <div className="p-6 text-xs space-y-4">
              <div className="p-4 bg-amber-50/50 border border-amber-100 rounded-2xl">
                <p className="font-bold text-amber-900 mb-2">📄 الوثائق المرفقة بالموظف:</p>
                <p className="text-gray-600 text-xs">
                  يمكنك استبدال أو تحميل ملفات جديدة لصورة الهوية وعقد العمل الرسمي من خلال هذا التبويب.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl">
                  <label className="block font-bold text-gray-800 mb-2">صورة الهوية الوطنية</label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="w-full text-xs text-gray-500"
                  />
                </div>

                <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl">
                  <label className="block font-bold text-gray-800 mb-2">وثيقة عقد العمل</label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="w-full text-xs text-gray-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Form Actions Footer */}
          <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
            <Link
              to="/staff"
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-300"
            >
              إلغاء
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? "جاري التحديث..." : "حفظ والتحديث"}</span>
            </button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}
