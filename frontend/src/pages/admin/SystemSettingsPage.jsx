import { useState, useEffect } from "react";
import api from "../../api/axios";
import MainLayout from "../../components/layout/MainLayout";
import PageHeader from "../../components/ui/PageHeader";
import Button from "../../components/ui/Button";
import { Save, AlertCircle, CheckCircle2, Package, ShieldCheck } from "lucide-react";

import CommunicationsSettings from './CommunicationsSettings';
import BeneficiaryPolicySettings from './BeneficiaryPolicySettings';
import { useAuth } from '../../context/AuthContext';

export default function SystemSettingsPage() {
  const { user } = useAuth();
  const [form, setForm] = useState({
    first_class_max_income: "3000",
    second_class_max_income: "6000",
    resident_need_threshold: "3000",
    elderly_min_age: "60",
    warehouse_alert_threshold_days: "10",
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
          setForm((prev) => {
            const next = Object.fromEntries(Object.keys(prev).map((key) => [key, res.data.data[key] ?? prev[key]]));
            // Canonical key is resident_need_threshold; migrate the legacy
            // resident_degree_threshold value if the canonical key is unset.
            const legacy = res.data.data.resident_degree_threshold;
            if (res.data.data.resident_need_threshold == null && legacy != null) {
              next.resident_need_threshold = legacy;
            }
            delete next.resident_degree_threshold;
            return next;
          });
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
      setMsg({ type: "success", text: "تم حفظ الإعدادات المالية وضوابط المستودع بنجاح!" });
    } catch (err) {
      console.error(err);
      setMsg({ type: "error", text: "تعذر حفظ الإعدادات. يرجى المحاولة مرة أخرى." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <MainLayout>
      <div className="p-4 lg:p-6 max-w-5xl mx-auto" dir="rtl">
        <PageHeader
          title="إعدادات النظام وضوابط التصنيف المالي والمستودع"
          subtitle="تحديد حدود الدخل الشهري للفئات، أيام تنبيه الصلاحية، ومعايير الحوكمة"
          breadcrumbs={[
            { label: "الرئيسية", href: "/" },
            { label: "لوحة التحكم", href: "/admin/users" },
            { label: "إعدادات النظام" }
          ]}
        />

        {msg && (
          <div className={`p-4 rounded-2xl mb-6 flex items-center gap-3 font-semibold text-xs shadow-xs ${
            msg.type === "success" ? "bg-[#E6F4EC] text-[#2E7D32] border border-[#A5D6A7]" : "bg-[#FEE2E2] text-[#B91C1C] border border-[#FCA5A5]"
          }`}>
            {msg.type === "success" ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span>{msg.text}</span>
          </div>
        )}

        {loading ? (
          <div className="ikram-panel p-12 text-center text-[var(--color-text-muted)]">
            جاري تحميل الإعدادات...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Section 1: Financial & Classification Thresholds */}
            <div className="ikram-panel p-4 sm:p-6">
              <h2 className="text-sm font-extrabold text-[var(--color-text-primary)] border-b border-[var(--color-border)] pb-3 mb-4 flex items-center gap-2">
                <span>💰</span> ضوابط الدخل المالي لتصنيف المستفيدين (الدرجة الأولى والثانية)
              </h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-[var(--color-text-primary)] mb-1">
                    الحد الأقصى للدخل الشهري - الفئة الأولى للمواطنين (ريال) *
                  </label>
                  <input
                    type="number"
                    name="first_class_max_income"
                    value={form.first_class_max_income}
                    onChange={handleChange}
                    required
                    min="0"
                    className="w-full rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-xs text-right bg-white focus:border-[var(--color-brand-gold)]"
                  />
                  <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                    إذا كان الدخل المحتسب (بعد خصم الإيجار) أقل أو يساوي هذا المبلغ يُصنف المواطن كـ <strong>درجة أولى</strong>.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--color-text-primary)] mb-1">
                    الحد الأقصى للدخل الشهري - الفئة الثانية للمواطنين (ريال) *
                  </label>
                  <input
                    type="number"
                    name="second_class_max_income"
                    value={form.second_class_max_income}
                    onChange={handleChange}
                    required
                    min="0"
                    className="w-full rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-xs text-right bg-white focus:border-[var(--color-brand-gold)]"
                  />
                  <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                    المواطنون أصحاب الدخل بين الفئة الأولى وهذا الحد يُصنفون كـ <strong>درجة ثانية</strong>.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--color-text-primary)] mb-1">
                    حد الاحتياج للمقيمين - شديد الاحتياج مقابل عادي الاحتياج (ريال) *
                  </label>
                  <input
                    type="number"
                    name="resident_need_threshold"
                    value={form.resident_need_threshold}
                    onChange={handleChange}
                    required
                    min="0"
                    className="w-full rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-xs text-right bg-white focus:border-[var(--color-brand-gold)]"
                  />
                  <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                    المقيمون دائماً <strong>درجة ثانية</strong>؛ إذا كان دخلهم المحتسب (بعد خصم الإيجار) أقل من أو يساوي هذا الحد يُصنفون <strong>احتياج شديد</strong>، وإلا <strong>احتياج عادي</strong>.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--color-text-primary)] mb-1">
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
                    className="w-full rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-xs text-right bg-white focus:border-[var(--color-brand-gold)]"
                  />
                  <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                    المستفيدون الذين تبلغ أعمارهم هذا الحد أو أكثر يُمنحون أولوية <strong>كبار السن</strong>.
                  </p>
                </div>
              </div>
            </div>

            {/* Section 2: Warehouse Expiration Alert Configuration */}
            <div className="ikram-panel p-4 sm:p-6">
              <h2 className="text-sm font-extrabold text-[var(--color-text-primary)] border-b border-[var(--color-border)] pb-3 mb-4 flex items-center gap-2">
                <Package className="w-5 h-5 text-[var(--color-brand-green)]" />
                <span>إعدادات تنبيهات صلاحية المستودع والمخزون</span>
              </h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-[var(--color-text-primary)] mb-1">
                    فترة التنبيه المسبق قبل انتهاء الصلاحية (بالأيام) *
                  </label>
                  <input
                    type="number"
                    name="warehouse_alert_threshold_days"
                    value={form.warehouse_alert_threshold_days}
                    onChange={handleChange}
                    required
                    min="1"
                    max="90"
                    className="w-full rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-xs text-right bg-white focus:border-[var(--color-brand-gold)]"
                  />
                  <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                    القيمة الافتراضية <strong>10 أيام</strong>. سيتم إرسال إشعارات وتنبيهات فورية للمدير والمساعد عند وصول أي صنف لهذا الحد.
                  </p>
                </div>
              </div>
            </div>

            {/* Section 3: General System Info */}
            <div className="ikram-panel p-4 sm:p-6">
              <h2 className="text-sm font-extrabold text-[var(--color-text-primary)] border-b border-[var(--color-border)] pb-3 mb-4 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[var(--color-brand-green)]" />
                <span>البيانات العامة للمنظومة</span>
              </h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-[var(--color-text-primary)] mb-1">اسم الجمعية / المؤسسة</label>
                  <input
                    type="text"
                    name="organization_name"
                    value={form.organization_name}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-xs text-right bg-white focus:border-[var(--color-brand-gold)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--color-text-primary)] mb-1">عنوان النظام الرسمي</label>
                  <input
                    type="text"
                    name="system_name"
                    value={form.system_name}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-xs text-right bg-white focus:border-[var(--color-brand-gold)]"
                  />
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-4">
              <Button
                type="submit"
                variant="secondary"
                size="md"
                loading={saving}
                icon={Save}
              >
                حفظ الإعدادات والتحديث
              </Button>
            </div>
          </form>
        )}
      </div>
      {user?.role === 'admin' && <div className="max-w-5xl mx-auto px-4 pb-8"><CommunicationsSettings /></div>}
      {(user?.role === 'admin' || user?.permissions?.beneficiary_policy?.view) && <BeneficiaryPolicySettings />}
    </MainLayout>
  );
}
