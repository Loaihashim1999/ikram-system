import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';

export default function ChangePasswordPage() {
  const { logout } = useAuth();
  const [form, setForm] = useState({ current_password: '', password: '', password_confirmation: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/change-password', form);
      await logout();
    } catch (err) {
      setError(Object.values(err.response?.data?.errors || {}).flat().join(' ') || err.response?.data?.message || 'تعذر تغيير كلمة المرور. حاول مرة أخرى.');
    } finally {
      setSaving(false);
    }
  }
  return <main dir="rtl" className="min-h-screen flex items-center justify-center bg-[var(--color-bg-page)] p-4">
    <form onSubmit={submit} className="w-full max-w-md bg-white rounded-2xl p-6 space-y-4">
      <h1 className="text-xl font-bold">تغيير كلمة المرور المؤقتة</h1>
      <p>يجب تعيين كلمة مرور شخصية قبل استخدام النظام. استخدم 12 حرفاً على الأقل مع حرف كبير وصغير ورقم ورمز.</p>
      {error && <p role="alert" className="text-[var(--color-danger)]">{error}</p>}
      {Object.entries({ current_password: 'كلمة المرور المؤقتة', password: 'كلمة المرور الجديدة', password_confirmation: 'تأكيد كلمة المرور الجديدة' }).map(([key, label]) => <label key={key} className="block text-sm font-bold" htmlFor={key}>{label}<input id={key} required type="password" autoComplete={key === 'current_password' ? 'current-password' : 'new-password'} value={form[key]} onChange={event => setForm({ ...form, [key]: event.target.value })} dir="ltr" className="ikram-control mt-1" /></label>)}
      <button disabled={saving} className="ikram-btn ikram-btn-primary w-full">{saving ? 'جاري الحفظ...' : 'حفظ كلمة المرور وتسجيل الدخول مجدداً'}</button>
      <button type="button" onClick={logout} className="ikram-btn ikram-btn-ghost w-full">تسجيل الخروج</button>
    </form>
  </main>;
}
