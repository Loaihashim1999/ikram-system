import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

/**
 * Destructive Confirmation Dialog conforming to Ikram Design System Spec:
 * - Red action button for dangerous/destructive actions
 * - Warning icon header
 * - Loading indicator state while processing
 */
export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = "تأكيد الحذف النهائي",
  message = "هل أنت متأكد من رغبتك في حذف هذا السجل؟ لا يمكن التراجع عن هذا الإجراء بعد إتمامه.",
  confirmLabel = "حذف نهائياً",
  cancelLabel = "إلغاء",
  loading = false,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
      {/* Scrim Overlay */}
      <div
        className="fixed inset-0 bg-slate-950/45 backdrop-blur-[3px] transition-opacity duration-200"
        onClick={!loading ? onClose : undefined}
      />

      {/* Surface */}
      <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl border border-red-100 overflow-hidden flex flex-col p-6 text-right">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="p-3 bg-red-100/80 text-red-700 rounded-2xl border border-red-200 flex-shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <h3 className="font-extrabold text-lg text-gray-900 mb-1">{title}</h3>
        <p className="text-xs text-gray-600 leading-relaxed mb-6">{message}</p>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-bold text-xs hover:bg-gray-200 transition-colors cursor-pointer disabled:opacity-50"
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs shadow-sm flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            <span>{loading ? "جاري الحذف..." : confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
