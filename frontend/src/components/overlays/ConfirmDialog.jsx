import React from 'react';
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
  onConfirm,
  title = "تأكيد الإجراء",
  message = "هل أنت متأكد من رغبتك في متابعة هذا الإجراء؟",
  confirmLabel = "تأكيد",
  confirmText,
  cancelLabel = "إلغاء",
  cancelText,
  loading = false,
  type = "danger", // 'danger' | 'warning' | 'info' | 'success'
}) {
  const finalConfirmLabel = confirmText || confirmLabel;
  const finalCancelLabel = cancelText || cancelLabel;

  if (!isOpen) return null;

  const typeConfig = {
    danger: {
      btnBg: "bg-[#C24B3F] hover:bg-red-700",
      iconBg: "bg-red-50 text-red-600 border-red-200",
      Icon: Trash2,
    },
    warning: {
      btnBg: "bg-[#D97706] hover:bg-[#B45309]",
      iconBg: "bg-amber-50 text-amber-700 border-amber-200",
      Icon: AlertTriangle,
    },
    success: {
      btnBg: "bg-[#3F6B3A] hover:bg-[#31542D]",
      iconBg: "bg-green-50 text-green-700 border-green-200",
      Icon: CheckCircle2,
    },
    info: {
      btnBg: "bg-[#C9A24A] hover:bg-[#8A6B24]",
      iconBg: "bg-amber-50 text-[#C9A24A] border-amber-200",
      Icon: AlertTriangle,
    },
  };

  const currentType = typeConfig[type] || typeConfig.danger;
  const ActionIcon = currentType.Icon;

  return (
    <Scrim isOpen={isOpen} onClose={!loading ? onClose : undefined} zIndex="z-50">
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none" dir="rtl">
        {/* Surface */}
        <div
          className="pointer-events-auto relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-[#E5E2D9] overflow-hidden flex flex-col p-6 text-right"
          onClick={(e) => e.stopPropagation()}
          role="alertdialog"
          aria-modal="true"
        >
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className={`p-3 rounded-2xl border flex-shrink-0 ${currentType.iconBg}`}>
              <ActionIcon className="w-6 h-6" />
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer disabled:opacity-50"
              aria-label="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <h3 className="font-extrabold text-lg text-[#111827] mb-1">{title}</h3>
          <p className="text-xs text-[#6B7280] leading-relaxed mb-6">{message}</p>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E5E2D9]">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-bold text-xs hover:bg-gray-200 transition-colors cursor-pointer disabled:opacity-50"
            >
              {finalCancelLabel}
            </button>

            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className={`px-5 py-2.5 rounded-xl text-white font-extrabold text-xs shadow-sm flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 ${currentType.btnBg}`}
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <ActionIcon className="w-4 h-4" />
              )}
              <span>{loading ? "جاري التنفيذ..." : finalConfirmLabel}</span>
            </button>
          </div>
        </div>
      </div>
    </Scrim>
  );
}
