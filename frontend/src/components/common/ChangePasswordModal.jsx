import { useState } from 'react';
import Dialog from '../overlays/Dialog';
import FormField from '../ui/FormField';
import api from '../../api/axios';
import { Lock, Eye, EyeOff, ShieldCheck, AlertCircle } from 'lucide-react';

export default function ChangePasswordModal({
  isOpen,
  onClose,
  isForced = false,
  onSuccess,
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const passwordPolicy = 'استخدم 12 حرفاً على الأقل مع حرف كبير وصغير ورقم ورمز.';
  const validatePassword = (pwd) => {
    if (Array.from(pwd).length < 12) return 'يجب أن لا تقل كلمة المرور عن 12 خانة.';
    if (!/\p{Lu}/u.test(pwd) || !/\p{Ll}/u.test(pwd)) return 'يجب أن تحتوي كلمة المرور على حرف كبير وحرف صغير.';
    if (!/\p{N}/u.test(pwd)) return 'يجب أن تحتوي كلمة المرور على رقم واحد على الأقل.';
    if (!/[\p{Z}\p{S}\p{P}]/u.test(pwd)) return 'يجب أن تحتوي كلمة المرور على رمز واحد على الأقل.';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading || successMsg) return;
    setError('');
    setFieldErrors({});
    const invalid = {};
    if (!currentPassword) invalid.current_password = 'يرجى إدخال كلمة المرور الحالية.';
    const valErr = validatePassword(newPassword);
    if (valErr) invalid.password = valErr;
    else if (newPassword === currentPassword) invalid.password = 'يجب أن تختلف كلمة المرور الجديدة عن الحالية.';
    if (newPassword !== confirmPassword) invalid.password_confirmation = 'كلمة المرور الجديدة وتأكيدها غير متطابقين.';
    if (!confirmPassword) invalid.password_confirmation = 'يرجى تأكيد كلمة المرور الجديدة.';
    if (Object.keys(invalid).length) {
      setFieldErrors(invalid);
      return;
    }

    setLoading(true);
    try {
      await api.post('/change-password', {
        current_password: currentPassword,
        password: newPassword,
        password_confirmation: confirmPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccessMsg('تم تغيير كلمة المرور. سجل الدخول بكلمة المرور الجديدة.');
      setTimeout(() => {
        onSuccess?.();
        onClose?.();
      }, 1200);
    } catch (err) {
      // Never render or log the Axios request/config: it contains credentials.
      const data = err.response?.status === 422 ? err.response.data : null;
      const errors = {};
      if (data?.errors?.current_password) errors.current_password = 'يرجى التحقق من كلمة المرور الحالية.';
      if (data?.errors?.password) errors.password = passwordPolicy;
      if (data?.errors?.password_confirmation) errors.password_confirmation = 'كلمة المرور الجديدة وتأكيدها غير متطابقين.';
      if (data?.message === 'كلمة المرور الحالية غير صحيحة.') errors.current_password = data.message;
      setFieldErrors(errors);
      if (!Object.keys(errors).length) {
        setError(data?.message === 'انتهت صلاحية كلمة المرور المؤقتة. اطلب من المدير إصدار كلمة جديدة.'
          ? data.message : 'تعذر تغيير كلمة المرور. حاول مرة أخرى.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={isForced ? undefined : onClose}
      title={isForced ? "🔒 إلزامية تغيير كلمة المرور عند أول دخول" : "🔑 تغيير كلمة المرور"}
      subtitle={isForced ? "تم إصدار كلمة مرور مؤقتة لحسابك، يرجى تعيين كلمة مرور جديدة قوية وخاصة بك لمتابعة استخدام النظام." : "قم بتعيين كلمة مرور جديدة قوية لحماية حسابك"}
      icon={Lock}
      maxWidth="max-w-md"
    >
      <form noValidate onSubmit={handleSubmit} className="space-y-4" dir="rtl">
        {error && (
          <div role="alert" className="p-3 bg-red-50 text-[#C24B3F] rounded-xl border border-red-200 text-xs font-bold flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div role="status" className="p-3 bg-green-50 text-[#2E7D32] rounded-xl border border-green-200 text-xs font-bold flex items-center gap-2">
            <ShieldCheck size={16} />
            <span>{successMsg}</span>
          </div>
        )}

        <FormField label={isForced ? 'كلمة المرور المؤقتة' : 'كلمة المرور الحالية'} name="current_password" error={fieldErrors.current_password} required>
            <div id="current_password-control" className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                id="current_password"
                name="current_password"
                autoComplete="current-password"
                aria-invalid={fieldErrors.current_password ? 'true' : 'false'}
                aria-describedby={fieldErrors.current_password ? 'current_password-error' : undefined}
                disabled={loading || Boolean(successMsg)}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--color-border)] text-xs text-right pr-3 pl-10 focus:outline-none focus:border-[var(--color-brand-gold)]"
                placeholder="أدخل كلمة المرور الحالية"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-muted)]"
                tabIndex={-1}
              >
                {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
        </FormField>

        <FormField
          label="كلمة المرور الجديدة"
          name="password"
          required
          error={fieldErrors.password}
          helperText={passwordPolicy}
        >
          <div id="password-control" className="relative">
            <input
              type={showNew ? 'text' : 'password'}
                id="password"
                name="password"
                autoComplete="new-password"
                aria-invalid={fieldErrors.password ? 'true' : 'false'}
                aria-describedby={fieldErrors.password ? 'password-error' : 'password-helper'}
                disabled={loading || Boolean(successMsg)}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--color-border)] text-xs text-right pr-3 pl-10 focus:outline-none focus:border-[var(--color-brand-gold)]"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-muted)]"
              tabIndex={-1}
            >
              {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </FormField>

        <FormField label="تأكيد كلمة المرور الجديدة" name="password_confirmation" error={fieldErrors.password_confirmation} required>
          <div id="password_confirmation-control" className="relative">
            <input
              type={showConfirm ? 'text' : 'password'}
                id="password_confirmation"
                name="password_confirmation"
                autoComplete="new-password"
                aria-invalid={fieldErrors.password_confirmation ? 'true' : 'false'}
                aria-describedby={fieldErrors.password_confirmation ? 'password_confirmation-error' : undefined}
                disabled={loading || Boolean(successMsg)}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--color-border)] text-xs text-right pr-3 pl-10 focus:outline-none focus:border-[var(--color-brand-gold)]"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-muted)]"
              tabIndex={-1}
            >
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </FormField>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
          {!isForced && (
            <button
              type="button"
              onClick={onClose}
              disabled={loading || Boolean(successMsg)}
              className="px-4 py-2 bg-[var(--color-bg-soft)] text-[var(--color-text-secondary)] rounded-xl font-bold text-xs hover:bg-[var(--color-bg-soft)]"
            >
              إلغاء
            </button>
          )}

          <button
            type="submit"
            disabled={loading || Boolean(successMsg)}
            className="px-5 py-2.5 bg-[var(--color-brand-green)] hover:bg-[var(--color-brand-green-hover)] text-white rounded-xl font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Lock size={14} />}
            <span>حفظ كلمة المرور الجديدة</span>
          </button>
        </div>
      </form>
    </Dialog>
  );
}
