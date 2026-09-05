import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Lock, User, AlertTriangle, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import logoImg from '../../assets/logo.png';

const FAILED_ATTEMPTS_KEY = 'ikram_failed_login_attempts';
const LOCKED_ACCOUNTS_KEY = 'ikram_locked_accounts';

// حساب المشرف العام محمي تماماً من الإيقاف التلقائي
const ADMIN_USERNAMES = ['admin', 'supervisor', 'مدير_النظام', 'المشرف_العام'];

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const getLockedAccounts = () => {
    try {
      return JSON.parse(localStorage.getItem(LOCKED_ACCOUNTS_KEY) || '[]');
    } catch {
      return [];
    }
  };


  const getFailedAttempts = () => {
    try {
      return JSON.parse(localStorage.getItem(FAILED_ATTEMPTS_KEY) || '{}');
    } catch {
      return {};
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const cleanUser = username.trim().toLowerCase();
    const isAdmin = ADMIN_USERNAMES.includes(cleanUser);
    const lockedAccounts = getLockedAccounts();

    // Check if account is locked (المشرف العام لا يقفل حسابه أبداً)
    if (!isAdmin && lockedAccounts.includes(cleanUser)) {
      setError('تم إيقاف الحساب لتجاوز عدد محاولات الدخول المسموحة (3 محاولات). يرجى مراجعة المشرف العام لإعادة تفعيل الحساب.');
      return;
    }

    setIsLoading(true);

    const result = await login(username, password);
    setIsLoading(false);

    if (result.success) {
      // Clear failed attempts on success
      const attempts = getFailedAttempts();
      delete attempts[cleanUser];
      localStorage.setItem(FAILED_ATTEMPTS_KEY, JSON.stringify(attempts));

      navigate('/dashboard');
    } else {
      // إذا كان المستخدم هو المشرف العام، لا يتم زيادة العداد ولا قفل الحساب
      if (isAdmin) {
        setError('اسم المستخدم أو كلمة المرور غير صحيحة. يرجى التحقق وإعادة المحاولة.');
        return;
      }

      // Record failed attempt for non-admin accounts
      const attempts = getFailedAttempts();
      const currentCount = (attempts[cleanUser] || 0) + 1;
      attempts[cleanUser] = currentCount;
      localStorage.setItem(FAILED_ATTEMPTS_KEY, JSON.stringify(attempts));

      if (currentCount >= 3) {
        // Lock account
        const updatedLocked = Array.from(new Set([...lockedAccounts, cleanUser]));
        localStorage.setItem(LOCKED_ACCOUNTS_KEY, JSON.stringify(updatedLocked));
        setError('تم إيقاف الحساب لتجاوز عدد محاولات الدخول المسموحة (3 محاولات). يرجى مراجعة المشرف العام لإعادة تفعيل الحساب.');
      } else {
        // Generic error message without revealing user existence
        setError(`اسم المستخدم أو كلمة المرور غير صحيحة. متبقي لديك ${3 - currentCount} محاولة قبل إيقاف الحساب.`);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F5F0] p-4" dir="rtl">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 border border-[#E5E2D9]">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex items-center justify-center">
            <img
              src={logoImg}
              alt="شعار جمعية إكرام"
              className="h-20 w-auto object-contain drop-shadow-xs"
            />
          </div>
          <h1 className="text-xl font-extrabold text-[#111827]">جمعية إكرام لخدمة ضيوف الرحمن</h1>
          <p className="text-[#6B7280] mt-1.5 text-xs">بوابة الدخول الموحدة لإدارة المستفيدين والعمليات</p>
        </div>



        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-[#FEE2E2] text-[#B91C1C] p-3.5 rounded-2xl text-xs font-bold border border-[#FCA5A5] flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-[#111827] mb-1.5">
              اسم المستخدم
            </label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-[#E5E2D9] focus:border-[#C9A24A] focus:ring-2 focus:ring-[#C9A24A]/20 outline-none transition-all text-right text-xs"
                placeholder="أدخل اسم المستخدم"
                required
                autoComplete="username"
              />
              <User size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#111827] mb-1.5">
              كلمة المرور
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pr-10 pl-10 py-2.5 rounded-xl border border-[#E5E2D9] focus:border-[#C9A24A] focus:ring-2 focus:ring-[#C9A24A]/20 outline-none transition-all text-right text-xs"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
              <Lock size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#D97706] hover:bg-[#B45309] text-white font-extrabold py-3 rounded-xl transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-xs mt-6 text-xs cursor-pointer"
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
        </form>

        <div className="mt-8 text-center text-[11px] text-[#9CA3AF] border-t border-[#E5E2D9] pt-4">
          نظام مشفر ومحمي وفق معايير الحوكمة لجمعية إكرام © 2026
        </div>
      </div>
    </div>
  );
}