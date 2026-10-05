import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import api from '../../api/axios';
import logoImg from '../../assets/logo.png';

export default function FirstAdminSetupPage({ onComplete }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: '', username: '', email: '', password: '', password_confirmation: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/setup-admin', form);
      onComplete();
      navigate('/login', { replace: true });
    } catch (requestError) {
      if ([403, 409].includes(requestError.response?.status)) {
        onComplete();
        navigate('/login', { replace: true });
        return;
      }
      setError(requestError.response?.data?.message || 'تعذر إنشاء حساب المشرف. تحقق من البيانات وحاول مجدداً.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#F7F5F0] p-4" dir="rtl">
      <section className="w-full max-w-lg rounded-3xl border border-[#E5E2D9] bg-white p-7 shadow-xl sm:p-9">
        <img src={logoImg} alt="شعار جمعية إكرام" className="mx-auto mb-4 h-20 w-auto" />
        <div className="text-center">
          <ShieldCheck className="mx-auto mb-2 text-[#356137]" size={34} />
          <h1 className="text-2xl font-extrabold text-[#111827]">إعداد حساب المشرف</h1>
          <p className="mt-2 text-sm leading-6 text-[#6B7280]">قم بإنشاء حساب المشرف الرئيسي للنظام. ستظهر هذه الصفحة مرة واحدة فقط أثناء إعداد النظام.</p>
        </div>

        <form onSubmit={submit} className="mt-7 space-y-4">
          {error && <div className="flex gap-2 rounded-xl border border-red-300 bg-red-50 p-3 text-sm font-bold text-red-700"><AlertTriangle size={20} /><span>{error}</span></div>}
          <Field label="اسم المشرف" name="full_name" value={form.full_name} onChange={update} autoComplete="name" />
          <Field label="اسم المستخدم" name="username" value={form.username} onChange={update} autoComplete="username" dir="ltr" />
          <Field label="البريد الإلكتروني المسجل" name="email" type="email" value={form.email} onChange={update} autoComplete="email" dir="ltr" />
          <Field label="كلمة المرور" name="password" type="password" value={form.password} onChange={update} autoComplete="new-password" dir="ltr" />
          <p className="text-xs leading-5 text-[#6B7280]">12 حرفاً على الأقل، وتتضمن حرفاً كبيراً وصغيراً ورقماً ورمزاً.</p>
          <Field label="تأكيد كلمة المرور" name="password_confirmation" type="password" value={form.password_confirmation} onChange={update} autoComplete="new-password" dir="ltr" />
          <button disabled={loading} className="w-full rounded-xl bg-[#D97706] py-3 font-extrabold text-white hover:bg-[#B45309] disabled:opacity-50">
            {loading ? 'جارٍ إنشاء الحساب...' : 'إنشاء حساب المشرف وإكمال الإعداد'}
          </button>
        </form>
      </section>
    </main>
  );
}

function Field({ label, name, type = 'text', ...props }) {
  return <label className="block text-sm font-bold text-[#111827]">{label}<input required name={name} type={type} {...props} className="mt-1.5 w-full rounded-xl border border-[#D1D5DB] px-4 py-3 outline-none focus:border-[#C9A24A] focus:ring-2 focus:ring-[#C9A24A]/20" /></label>;
}
