import React, { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Standard Dialog component conforming to Ikram Design System Spec:
 * - Scrim: fixed inset-0 bg-slate-950/45 backdrop-blur-[3px] z-50
 * - Container: rounded-2xl bg-white shadow-2xl border border-gray-100
 * - Animation: scale & fade transitions
 * - RTL First layout
 */
export default function Dialog({
  isOpen,
  onClose,
  title,
  subtitle,
  icon: Icon,
  children,
  footer,
  maxWidth = 'max-w-2xl',
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
      {/* Scrim Overlay */}
      <div
        className="fixed inset-0 bg-slate-950/45 backdrop-blur-[3px] transition-opacity duration-200"
        onClick={onClose}
      />

      {/* Dialog Surface */}
      <div
        className={`relative z-10 w-full ${maxWidth} bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh] transition-all transform duration-200 scale-100 opacity-100`}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 bg-amber-50/40 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="p-2.5 bg-amber-100/80 text-amber-800 rounded-xl border border-amber-200 flex-shrink-0">
                <Icon className="w-5 h-5" />
              </div>
            )}
            <div>
              <h3 className="font-extrabold text-base text-gray-900 leading-tight">{title}</h3>
              {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 overflow-y-auto flex-1 text-xs text-gray-700 space-y-4">
          {children}
        </div>

        {/* Footer Actions */}
        {footer && (
          <div className="px-6 py-3.5 border-t border-gray-100 bg-gray-50/60 flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
