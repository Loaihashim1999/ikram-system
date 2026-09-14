import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api from '../../api/axios';

export default function ResetPasswordPage() {
  const { token } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: params.get('email') || '', password: '', password_confirmation: '' });
  const [error, setError] = useState('');
  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault(); setError('');
    try { await api.post('/reset-password', { ...form, token }); navigate('/login', { replace: true }); }
    catch (requestError) { setError(requestError.response?.data?.message || 'تعذر تحديث كلمة المرور.'); }
  };
  return <main className="min-h-screen flex items-center justify-center bg-[#F7F5F0] p-4" dir="rtl"><section className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl"><h1 className="text-2xl font-extrabold">تعيين كلمة مرور جديدة</h1>{error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}<form onSubmit={submit} className="mt-6 space-y-4"><input required name="email" type="email" value={form.email} onChange={update} placeholder="البريد الإلكتروني" dir="ltr" className="w-full rounded-xl border px-4 py-3"/><input required name="password" type="password" value={form.password} onChange={update} placeholder="كلمة المرور الجديدة" dir="ltr" className="w-full rounded-xl border px-4 py-3"/><input required name="password_confirmation" type="password" value={form.password_confirmation} onChange={update} placeholder="تأكيد كلمة المرور" dir="ltr" className="w-full rounded-xl border px-4 py-3"/><p className="text-xs text-gray-600">12 حرفاً على الأقل، مع أحرف كبيرة وصغيرة ورقم ورمز.</p><button className="w-full rounded-xl bg-[#D97706] py-3 font-bold text-white">تحديث كلمة المرور</button></form></section></main>;
}
