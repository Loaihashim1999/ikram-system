import { useState, useEffect } from "react";
import api from "../../api/axios";
import MainLayout from "../../components/layout/MainLayout";
import { Settings, Save, AlertCircle, CheckCircle2 } from "lucide-react";

export default function SystemSettingsPage() {
  const [form, setForm] = useState({
    first_class_max_income: "3000",
    second_class_max_income: "6000",
    elderly_min_age: "60",
    system_name: "نظام إكرام لإدارة المستفيدين والخدمات الاجتماعية",
    organization_name: "جمعية إكرام لخدمة المجتمع",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    api.get("/settings")
      .then((res) => {
        if (res.data?.data) {
          setForm((prev) => ({ ...prev, ...res.data.data }));
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      await api.post("/settings", form);
      setMsg({ type: "success", text: "تم حفظ الإعدادات المالية وشروط التصنيف بنجاح!" });
    } catch (err) {
      console.error(err);
      setMsg({ type: "error", text: "تعذر حفظ الإعدادات. يرجى المحاولة مرة أخرى." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <MainLayout>
    <div className="p-6 max-w-5xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Settings className="w-7 h-7 text-amber-600" />
            <span>إعدادات النظام وضوابط التصنيف المالي</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">تحديد حدود الدخل الشهري للفئة الأولى والثانية وشروط الفئات</p>
        </div>
      </div>

      {msg && (
        <div className={`p-4 rounded-2xl mb-6 flex items-center gap-3 font-semibold text-sm shadow-sm ${
          msg.type === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"
        }`}>
          {msg.type === "success" ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <AlertCircle className="w-5 h-5 text-red-600" />}
          <span>{msg.text}</span>
        </div>
      )}

      {loading ? (
        <div className="bg-white p-12 rounded-2xl shadow-sm text-center text-gray-400">
          جاري تحميل الإعدادات...
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Financial & Classification Thresholds */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-amber-900 border-b border-amber-100 pb-3 mb-4 flex items-center gap-2">
              <span>💰</span> ضوابط الدخل المالي لتصنيف المستفيدين (الدرجة الأولى والثانية)
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  الحد الأقصى للدخل الشهري - الفئة الأولى (ريال) *
                </label>
                <input
                  type="number"
                  name="first_class_max_income"
                  value={form.first_class_max_income}
                  onChange={handleChange}
                  required
                  min="0"
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-amber-400 text-right bg-white"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  إذا كان إجمالي دخل الأسرة (الراتب + الضمان + حساب المواطن + التقاعد) أقل أو يساوي هذا المبلغ يُصنف المستفيد كـ <strong>درجة أولى</strong>.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  الحد الأقصى للدخل الشهري - الفئة الثانية (ريال) *
                </label>
                <input
                  type="number"
                  name="second_class_max_income"
                  value={form.second_class_max_income}
                  onChange={handleChange}
                  required
                  min="0"
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-amber-400 text-right bg-white"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  إذا كان إجمالي الدخل بين حد الفئة الأولى وهذا المبلغ يُصنف المستفيد كـ <strong>درجة ثانية</strong>.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  العمر الأدنى لفئة كبار السن (سنة) *
                </label>
                <input
                  type="number"
                  name="elderly_min_age"
                  value={form.elderly_min_age}
                  onChange={handleChange}
                  required
                  min="50"
                  max="100"
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-amber-400 text-right bg-white"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  المستفيدون الذين تبلغ أعمارهم هذا الحد أو أكثر يُصنفون تلقائياً كـ <strong>كبار السن</strong> لتقديم أولوية التوصيل.
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: General System Information */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-amber-900 border-b border-amber-100 pb-3 mb-4 flex items-center gap-2">
              <span>🏛️</span> البيانات العامة للنظام والجمعية
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">اسم الجمعية / المؤسسة</label>
                <input
                  type="text"
                  name="organization_name"
                  value={form.organization_name}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-amber-400 text-right bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">عنوان النظام الرسمي</label>
                <input
                  type="text"
                  name="system_name"
                  value={form.system_name}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-amber-400 text-right bg-white"
                />
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold px-8 py-3 rounded-xl transition-all shadow-md text-sm disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              <span>{saving ? "جاري الحفظ..." : "حفظ الإعدادات والتحديث"}</span>
            </button>
          </div>
        </form>
      )}
    </div>
    </MainLayout>
  );
}
