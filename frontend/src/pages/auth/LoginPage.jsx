import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Lock, User, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import logoImg from '../../assets/logo.png';
import ErrorButton from '../../components/ErrorButton';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const result = await login(username, password);
      if (result.success) {
        navigate(result.user?.must_change_password ? '/change-password' : '/dashboard');
      } else {
        setError(result.message || 'تعذر تسجيل الدخول. حاول مرة أخرى.');
      }
    } catch {
      setError('تعذر الاتصال بالخادم. حاول مرة أخرى.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="ikram-auth" dir="rtl">
      <section className="ikram-auth-brand">
        <img src={logoImg} alt="" className="h-16 w-auto self-start rounded-xl bg-[var(--color-bg-page)] p-3 object-contain" />
        <p className="text-3xl font-extrabold">جمعية إكرام</p>
        <p>لخدمة ضيوف الرحمن</p>
      </section>
      <section className="ikram-auth-panel">
      <div className="ikram-auth-card">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex items-center justify-center">
            <img
              src={logoImg}
              alt="شعار جمعية إكرام"
              className="h-20 w-auto object-contain drop-shadow-xs"
            />
          </div>
          <h1 className="text-xl font-extrabold text-[var(--color-text-primary)]">جمعية إكرام لخدمة ضيوف الرحمن</h1>
          <p className="text-[var(--color-text-muted)] mt-1.5 text-xs">بوابة الدخول الموحدة لإدارة المستفيدين والعمليات</p>
        </div>



        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div role="alert" className="bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] p-3.5 rounded-[var(--radius-panel)] text-xs font-bold border border-[var(--color-border)] flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          <div>
            <label htmlFor="login-username" className="block text-xs font-bold text-[var(--color-text-primary)] mb-1.5">
              اسم المستخدم
            </label>
            <div className="relative">
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full min-h-12 pr-10 pl-4 py-2.5 rounded-xl border border-[var(--color-border)] focus:border-[var(--color-brand-gold)] focus:ring-2 focus:ring-[var(--color-brand-gold)]/20 outline-none transition-all text-right text-base"
                placeholder="أدخل اسم المستخدم"
                required
                autoComplete="username"
              />
              <User size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            </div>
          </div>

          <div>
            <label htmlFor="login-password" className="block text-xs font-bold text-[var(--color-text-primary)] mb-1.5">
              كلمة المرور
            </label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full min-h-12 pr-10 pl-10 py-2.5 rounded-xl border border-[var(--color-border)] focus:border-[var(--color-brand-gold)] focus:ring-2 focus:ring-[var(--color-brand-gold)]/20 outline-none transition-all text-right text-base"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
              <Lock size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-[var(--color-text-muted)]"
                aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="ikram-btn ikram-btn-primary w-full mt-6"
          >
            {isLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin ml-2"></span>
                جاري التحقق والدخول...
              </>
            ) : (
              'تسجيل الدخول الآمن'
            )}
          </button>
          <Link to="/forgot-password" className="block text-center text-xs font-bold text-[var(--color-brand-green)] hover:underline">نسيت كلمة المرور؟</Link>
        </form>

        <div className="mt-4 flex justify-center">
          {import.meta.env.DEV && <ErrorButton />}
        </div>

        <div className="mt-8 text-center text-[11px] text-[#9CA3AF] border-t border-[var(--color-border)] pt-4">
          نظام مشفر ومحمي وفق معايير الحوكمة لجمعية إكرام © 2026
        </div>
      </div>
      </section>
    </div>
  );
}
