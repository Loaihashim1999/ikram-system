import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

/**
 * Toast Notification Feedback Component matching Ikram Design Spec Section 12
 */
export default function Toast({
  isOpen,
  onClose,
  type = 'success', // 'success' | 'error' | 'warning' | 'info'
  message,
  duration = 4000,
}) {
  useEffect(() => {
    if (isOpen && duration) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isOpen, duration, onClose]);

  if (!isOpen) return null;

  const styles = {
    success: 'bg-emerald-900 text-white border-emerald-700 shadow-emerald-950/20',
    error: 'bg-red-900 text-white border-red-700 shadow-red-950/20',
    warning: 'bg-amber-900 text-white border-amber-700 shadow-amber-950/20',
    info: 'bg-blue-900 text-white border-blue-700 shadow-blue-950/20',
  };

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />,
    info: <Info className="w-5 h-5 text-blue-400 flex-shrink-0" />,
  };

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-xl transition-all transform duration-200 text-xs font-bold"
      dir="rtl"
    >
      <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${styles[type]}`}>
        {icons[type]}
        <span>{message}</span>
        <button
          onClick={onClose}
          className="mr-2 p-1 text-gray-300 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
