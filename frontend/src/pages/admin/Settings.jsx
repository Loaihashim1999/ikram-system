import { useState, useEffect } from "react";
import MainLayout from "../../components/layout/MainLayout";
import api from "../../api/axios";

/* ─── Default classification thresholds ─── */
const DEFAULTS = {
  first_class_max_income:  3000,
  second_class_max_income: 6000,
};

export default function SettingsPage() {
  const [settings, setSettings] = useState(DEFAULTS);
  const [loading, setSaving]    = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState(null);

  // Load settings from backend (key-value store)
  useEffect(() => {
    api.get("/settings")
      .then((res) => {
        const data = res.data?.data ?? res.data ?? [];
        const map = {};
        (Array.isArray(data) ? data : Object.entries(data)).forEach((item) => {
          if (Array.isArray(item)) {
            map[item[0]] = item[1];
          } else if (item.key) {
            map[item.key] = item.value;
          }
        });
        setSettings((prev) => ({ ...prev, ...map }));
      })
      .catch(() => {}); // silently ignore if settings endpoint not set up
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await api.post("/settings", settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.response?.data?.message || "حدث خطأ أثناء الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const Field = ({ label, name, help }) => (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min="0"
          value={settings[name] ?? ""}
          onChange={(e) => setSettings((s) => ({ ...s, [name]: e.target.value }))}
          className="w-48 rounded-xl border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400 text-right font-bold text-amber-800"
        />
        <span className="text-gray-500 text-sm">ريال / شهر</span>
      </div>
      {help && <p className="text-xs text-gray-400 mt-1">{help}</p>}
    </div>
  );

  return (
    <MainLayout>
      <div className="p-6 max-w-3xl mx-auto" dir="rtl">

        <div className="mb-8">
          <h1 className="text-2xl font-black text-gray-800 mb-1">⚙️ إعدادات النظام</h1>
          <p className="text-sm text-gray-500">ضبط حدود التصنيف ومعايير الأهلية</p>
        </div>

        <form onSubmit={handleSave} className="space-y-6">

          {/* Classification thresholds */}
          <div className="bg-white rounded-2xl shadow-md p-6 border border-gray-100">
            <h2 className="font-bold text-amber-800 text-base mb-5 border-b border-amber-50 pb-3">
              🏷️ حدود تصنيف المستفيدين (الدخل الشهري)
            </h2>
            <p className="text-sm text-gray-600 mb-5 bg-amber-50 rounded-xl p-3 border border-amber-100">
              يتم حساب الدخل من مجموع: <strong>الراتب + حساب المواطن + الضمان الاجتماعي + المعاش التقاعدي</strong>.
              يُصنَّف المستفيد تلقائياً بناءً على هذه الحدود.
            </p>

            <div className="space-y-5">

              {/* Visual classification guide */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {[
                  { label: "درجة أولى", desc: `دخل ≤ ${settings.first_class_max_income} ﷼`, color: "#16a34a", bg: "#dcfce7" },
                  { label: "درجة ثانية", desc: `دخل ≤ ${settings.second_class_max_income} ﷼`, color: "#d97706", bg: "#fef3c7" },
                  { label: "ذوو احتياجات خاصة", desc: "بصرف النظر عن الدخل", color: "#7c3aed", bg: "#ede9fe" },
                  { label: "كبار السن", desc: "فوق 60 سنة", color: "#0369a1", bg: "#e0f2fe" },
                ].map((c, i) => (
                  <div key={i} className="rounded-xl p-3 text-center border"
                    style={{ backgroundColor: c.bg, borderColor: c.color + "40" }}>
                    <p className="font-bold text-sm" style={{ color: c.color }}>{c.label}</p>
                    <p className="text-xs text-gray-500 mt-1">{c.desc}</p>
                  </div>
                ))}
              </div>

              <Field
                label="الحد الأقصى لدخل الدرجة الأولى"
                name="first_class_max_income"
                help="المستفيدون الذين يقل دخلهم عن هذا المبلغ يُصنَّفون درجة أولى (الأحوج)"
              />
              <Field
                label="الحد الأقصى لدخل الدرجة الثانية"
                name="second_class_max_income"
                help="المستفيدون بين حد الدرجة الأولى وهذا المبلغ يُصنَّفون درجة ثانية"
              />
            </div>
          </div>

          {/* Error / success */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              ⚠️ {error}
            </div>
          )}
          {saved && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm font-bold">
              ✅ تم حفظ الإعدادات بنجاح!
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-8 py-2.5 rounded-xl shadow disabled:opacity-50 transition-all"
            >
              {loading ? "⏳ جاري الحفظ..." : "💾 حفظ الإعدادات"}
            </button>
          </div>
        </form>

        {/* Classification guide info box */}
        <div className="mt-8 bg-white rounded-2xl shadow-md p-6 border border-gray-100">
          <h2 className="font-bold text-amber-800 text-base mb-4 border-b border-amber-50 pb-3">
            📘 كيفية تصنيف المستفيدين
          </h2>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700 leading-relaxed">
            <li>
              عند إضافة مستفيد، يُحسب <strong>إجمالي الدخل</strong> = (الراتب + حساب المواطن + الضمان الاجتماعي + المعاش التقاعدي + دعم الأسرة).
            </li>
            <li>
              إذا كان الدخل أقل من حد الدرجة الأولى → يُصنَّف <strong className="text-green-700">درجة أولى</strong>.
            </li>
            <li>
              إذا كان الدخل بين الحدين → يُصنَّف <strong className="text-amber-700">درجة ثانية</strong>.
            </li>
            <li>
              إذا كان المستفيد ذا احتياجات خاصة → يُصنَّف <strong className="text-purple-700">ذوو احتياجات خاصة</strong> بصرف النظر عن الدخل.
            </li>
            <li>
              يمكن تعديل التصنيف يدوياً من قائمة المستفيدين في أي وقت.
            </li>
          </ol>
        </div>

      </div>
    </MainLayout>
  );
}
