import React from 'react';
import { X } from 'lucide-react';
import Scrim from './Scrim';

/**
 * Standard Dialog component conforming to Ikram Design System Spec:
 * - Scrim: fixed inset-0 bg-black/50 backdrop-blur-sm
 * - Container: rounded-2xl bg-white shadow-2xl border border-[#E5E2D9]
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
  if (!isOpen) return null;

  return (
    <Scrim isOpen={isOpen} onClose={onClose} zIndex="z-50">
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none" dir="rtl">
        {/* Dialog Surface */}
        <div
          className={`pointer-events-auto relative w-full ${maxWidth} bg-white rounded-2xl shadow-2xl border border-[#E5E2D9] overflow-hidden flex flex-col max-h-[90vh] transition-all transform duration-200 scale-100 opacity-100`}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-[#E5E2D9] bg-[#FAF8F5] flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {Icon && (
                <div className="p-2.5 bg-[#F5EDDA] text-[#C9A24A] rounded-xl border border-[#E5E2D9] flex-shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
              )}
              <div>
                <h3 className="font-extrabold text-base text-[#111827] leading-tight">{title}</h3>
                {subtitle && <p className="text-xs text-[#6B7280] mt-0.5">{subtitle}</p>}
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
              title="إغلاق"
              aria-label="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Content Body */}
          <div className="p-6 overflow-y-auto flex-1 text-xs text-[#1F2937] space-y-4">
            {children}
          </div>

          {/* Footer Actions */}
          {footer && (
            <div className="px-6 py-3.5 border-t border-[#E5E2D9] bg-[#FAF8F5] flex items-center justify-end gap-3">
              {footer}
            </div>
          )}
        </div>
      </div>
    </Scrim>
  );
}
