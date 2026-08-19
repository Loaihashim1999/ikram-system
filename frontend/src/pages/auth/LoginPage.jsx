import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// 1. استيراد صورة الشعار (تأكد أن اسم الملف يطابق ما وضعته في مجلد assets)


export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await login(username, password);
    setIsLoading(false);

    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F5F0] p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-[#E5E2D9]">
        
        {/* 2. قسم الشعار والعنوان */}
        <div className="text-center mb-8">
         <img
                src="/1.png"
                alt="شعار جمعية إكرام الجود"
                className="w-62 h-62 mx-auto mb-4 object-contain drop-shadow-md"
                />
          <h1 className="text-2xl font-bold text-[#546027]"> جمعية إكرام الجود لخدمة ضيوف الرحمن</h1>
          <p className="text-[#6B6B66] mt-2 text-sm">نظام إدارة المستفيدين</p>
        </div>

        {/* نموذج تسجيل الدخول */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="bg-[#FCE8E6] text-[#C24B3F] p-3 rounded-lg text-sm text-center border border-[#C24B3F]/20 flex items-center justify-center gap-2">
              <span>⚠️</span> {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[#111111] mb-2">
              اسم المستخدم
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-[#E5E2D9] focus:border-[#C9A24A] focus:ring-2 focus:ring-[#C9A24A]/20 outline-none transition-all text-right"
              placeholder="أدخل اسم المستخدم"
              required
              autoComplete="username"
              dir="rtl"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#111111] mb-2">
              كلمة المرور
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-[#E5E2D9] focus:border-[#C9A24A] focus:ring-2 focus:ring-[#C9A24A]/20 outline-none transition-all text-right"
              placeholder="••••••••"
              required
              autoComplete="current-password"
              dir="rtl"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#C9A24A] hover:bg-[#8A6B24] text-white font-bold py-3 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-md mt-6"
          >
            {isLoading ? (
              <>
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin ml-2"></span>
                جاري الدخول...
              </>
            ) : (
              'دخول'
            )}
          </button>
        </form>
        
        <div className="mt-6 text-center text-xs text-[#9A9A94]">
          © 2026  .جمعية إكرام الجود لخدمة ضيوف الرحمن  جميع الحقوق محفوظة
        </div>
      </div>
    </div>
  );
}