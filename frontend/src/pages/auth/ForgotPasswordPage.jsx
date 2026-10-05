import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault(); setLoading(true); setMessage('');
    try {
      const { data } = await api.post('/forgot-password', { email });
      setMessage(data.message);
    } catch (error) {
      setMessage(error.response?.data?.message || 'تعذر إرسال طلب الاستعادة.');
    } finally { setLoading(false); }
  };

  return <main className="min-h-screen flex items-center justify-center bg-[#F7F5F0] p-4" dir="rtl"><section className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl"><h1 className="text-2xl font-extrabold">استعادة كلمة مرور المشرف</h1><p className="mt-2 text-sm text-gray-600">أدخل البريد المسجل لحساب المشرف لإرسال رابط استعادة آمن.</p>{message && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-800">{message}</p>}<form onSubmit={submit} className="mt-6 space-y-4"><input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="البريد الإلكتروني" dir="ltr" className="w-full rounded-xl border px-4 py-3"/><button disabled={loading} className="w-full rounded-xl bg-[#D97706] py-3 font-bold text-white disabled:opacity-50">{loading ? 'جارٍ الإرسال...' : 'إرسال رابط الاستعادة'}</button></form><Link to="/login" className="mt-5 block text-center text-sm font-bold text-[#356137]">العودة لتسجيل الدخول</Link></section></main>;
}
