import { AlertTriangle, Trash2, X, CheckCircle2 } from 'lucide-react';
import Scrim from './Scrim';

/**
 * Confirmation Dialog for destructive/important actions:
 * - Supports types: 'danger' (delete), 'warning' (disable/suspend), 'success' (reactivate/confirm)
 * - Uses standard Scrim: fixed inset-0 bg-black/50 backdrop-blur-sm
 * - Loading indicator state while processing
 */
export default function ConfirmDialog({
  isOpen,
  onClose,
  onCancel,
  onConfirm,
  title = "تأكيد الإجراء",
  message = "هل أنت متأكد من رغبتك في متابعة هذا الإجراء؟",
  confirmLabel = "تأكيد",
  confirmText,
  cancelLabel = "إلغاء",
  cancelText,
  loading = false,
  isLoading,
  type = "danger", // 'danger' | 'warning' | 'info' | 'success'
}) {
  const close = onClose ?? onCancel;
  const busy = isLoading ?? loading;
  const finalConfirmLabel = confirmText || confirmLabel;
  const finalCancelLabel = cancelText || cancelLabel;

  if (!isOpen) return null;

  const typeConfig = {
    danger: {
      btnBg: "bg-[var(--color-danger)] hover:bg-[var(--color-danger)]",
      iconBg: "bg-red-50 text-red-600 border-red-200",
      Icon: Trash2,
    },
    warning: {
      btnBg: "bg-[var(--color-brand-green)] hover:bg-[var(--color-brand-green-hover)]",
      iconBg: "bg-[var(--color-bg-soft)] text-amber-700 border-[var(--color-border)]",
      Icon: AlertTriangle,
    },
    success: {
      btnBg: "bg-[var(--color-brand-green)] hover:bg-[var(--color-brand-green-hover)]",
      iconBg: "bg-green-50 text-green-700 border-green-200",
      Icon: CheckCircle2,
    },
    info: {
      btnBg: "bg-[var(--color-brand-gold)] hover:bg-[#8A6B24]",
      iconBg: "bg-[var(--color-bg-soft)] text-[var(--color-brand-gold)] border-[var(--color-border)]",
      Icon: AlertTriangle,
    },
  };

  const currentType = typeConfig[type] || typeConfig.danger;
  const ActionIcon = currentType.Icon;

  return (
    <Scrim isOpen={isOpen} onClose={!busy ? close : undefined} zIndex="z-50">
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none" dir="rtl">
        {/* Surface */}
        <div
          className="ikram-dialog pointer-events-auto relative w-full max-w-md overflow-hidden flex flex-col p-6 text-right"
          onClick={(e) => e.stopPropagation()}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          aria-describedby="confirm-dialog-message"
        >
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className={`p-3 rounded-2xl border flex-shrink-0 ${currentType.iconBg}`}>
              <ActionIcon className="w-6 h-6" />
            </div>
            <button
              onClick={close}
              disabled={busy}
              className="p-1.5 rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-soft)] transition-colors cursor-pointer disabled:opacity-50"
              aria-label="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <h3 id="confirm-dialog-title" className="font-extrabold text-base text-[var(--color-text-primary)] mb-1">{title}</h3>
          <p id="confirm-dialog-message" className="text-xs text-[var(--color-text-muted)] leading-relaxed mb-6">{message}</p>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--color-border)]">
            <button
              type="button"
              onClick={close}
              disabled={busy}
              className="px-4 py-2.5 rounded-xl bg-[var(--color-bg-soft)] text-[var(--color-text-secondary)] font-bold text-xs hover:bg-[var(--color-bg-soft)] transition-colors cursor-pointer disabled:opacity-50"
            >
              {finalCancelLabel}
            </button>

            <button
              type="button"
              onClick={onConfirm}
              disabled={busy}
              className={`px-5 py-2.5 rounded-xl text-white font-extrabold text-xs shadow-sm flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 ${currentType.btnBg}`}
            >
              {busy ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <ActionIcon className="w-4 h-4" />
              )}
              <span>{busy ? "جاري التنفيذ..." : finalConfirmLabel}</span>
            </button>
          </div>
        </div>
      </div>
    </Scrim>
  );
}
