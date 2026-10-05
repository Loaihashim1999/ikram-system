import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';

const RESEND_COOLDOWN = 60;

export default function ForgotPasswordPage() {
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [recoveryToken, setRecoveryToken] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const timer = useRef(null);

  useEffect(() => () => clearInterval(timer.current), []);

  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN);
    clearInterval(timer.current);
    timer.current = setInterval(() => setCooldown((current) => {
      if (current <= 1) { clearInterval(timer.current); return 0; }
      return current - 1;
    }), 1000);
  };

  const requestCode = async (event) => {
    event.preventDefault(); setLoading(true); setError(''); setMessage('');
    try {
      const { data } = await api.post('/forgot-password', { username });
      setMessage(data.message); setStep(2); startCooldown();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'تعذر إرسال طلب الاستعادة.');
    } finally { setLoading(false); }
  };

  const resend = async () => {
    if (cooldown > 0 || loading) return;
    setLoading(true); setError(''); setMessage('');
    try {
      const { data } = await api.post('/forgot-password', { username });
      setMessage(data.message); startCooldown();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'تعذر إعادة إرسال الرمز.');
    } finally { setLoading(false); }
  };

  const verify = async (event) => {
    event.preventDefault(); setLoading(true); setError('');
    try {
      const { data } = await api.post('/forgot-password/verify', { username, code });
      setRecoveryToken(data.recovery_token); setMessage(''); setStep(3);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'تعذر التحقق من الرمز.');
    } finally { setLoading(false); }
  };

  const reset = async (event) => {
    event.preventDefault(); setLoading(true); setError('');
    try {
      const { data } = await api.post('/reset-password', { username, recovery_token: recoveryToken, password, password_confirmation: passwordConfirmation });
      setMessage(data.message); setStep(4);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'تعذر تحديث كلمة المرور.');
    } finally { setLoading(false); }
  };


  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--color-bg-page)] p-4" dir="rtl">
      <section className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-8 shadow-xl">
        <h1 className="text-2xl font-extrabold">نسيت كلمة المرور</h1>
        {step === 1 && <p className="mt-2 text-sm text-[var(--color-text-muted)]">أدخل اسم المستخدم لإرسال رمز تحقق إلى رقم الجوال المسجل في الحساب.</p>}
        {message && <p className="mt-4 rounded-xl bg-[var(--color-bg-soft)] p-3 text-sm font-bold text-[var(--color-text-secondary)]" role="status">{message}</p>}
        {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700" role="alert">{error}</p>}

        {step === 1 && (
          <form onSubmit={requestCode} className="mt-6 space-y-4">
            <label className="block text-sm font-bold" htmlFor="recovery-username">اسم المستخدم
              <input id="recovery-username" required type="text" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} className="ikram-control mt-1" />
            </label>
            <button disabled={loading} className="w-full rounded-xl bg-[var(--color-brand-green)] py-3 font-bold text-white disabled:opacity-50">{loading ? 'جارٍ الإرسال...' : 'إرسال رمز التحقق'}</button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={verify} className="mt-6 space-y-4">
            <p className="text-sm text-[var(--color-text-muted)]">أدخل رمز التحقق المكون من 6 أرقام المرسل إلى الجوال المسجل.</p>
            <label className="block text-sm font-bold" htmlFor="recovery-code">رمز التحقق
              <input id="recovery-code" required type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value.replace(/[^0-9]/g, '').slice(0, 6))} dir="ltr" className="ikram-control ikram-numeric mt-1 text-center tracking-[0.4em]" />
            </label>
            <button disabled={loading || code.length !== 6} className="w-full rounded-xl bg-[var(--color-brand-green)] py-3 font-bold text-white disabled:opacity-50">{loading ? 'جارٍ التحقق...' : 'تحقق من الرمز'}</button>
            <button type="button" onClick={resend} disabled={cooldown > 0 || loading} className="w-full rounded-xl border py-3 font-bold text-[var(--color-brand-green)] disabled:opacity-50">
              {cooldown > 0 ? `إعادة إرسال الرمز بعد ${cooldown} ثانية` : 'إعادة إرسال الرمز'}
            </button>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={reset} className="mt-6 space-y-4">
            <label className="block text-sm font-bold" htmlFor="recovery-password">كلمة المرور الجديدة
              <input id="recovery-password" required type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} dir="ltr" className="ikram-control mt-1" />
            </label>
            <label className="block text-sm font-bold" htmlFor="recovery-password-confirm">تأكيد كلمة المرور
              <input id="recovery-password-confirm" required type="password" autoComplete="new-password" value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} dir="ltr" className="ikram-control mt-1" />
            </label>
            <p className="text-xs text-[var(--color-text-muted)]">12 حرفاً على الأقل، مع أحرف كبيرة وصغيرة ورقم ورمز.</p>
            <button disabled={loading} className="w-full rounded-xl bg-[var(--color-brand-green)] py-3 font-bold text-white disabled:opacity-50">{loading ? 'جارٍ التحديث...' : 'تغيير كلمة المرور'}</button>
          </form>
        )}

        {step === 4 && (
          <div className="mt-6 space-y-4 text-center">
            <p className="rounded-xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800" role="status">تم تغيير كلمة المرور بنجاح</p>
            <Link to="/login" className="block rounded-xl bg-[var(--color-brand-green)] py-3 font-bold text-white">تسجيل الدخول</Link>
          </div>
        )}

        {step < 4 && <Link to="/login" className="mt-5 block text-center text-sm font-bold text-[var(--color-brand-green)]">العودة لتسجيل الدخول</Link>}
      </section>
    </main>
  );
}
