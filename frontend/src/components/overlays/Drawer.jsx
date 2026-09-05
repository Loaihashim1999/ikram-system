import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import Scrim from './Scrim';

/**
 * Reusable Drawer component:
 * - Slide-in from right (RTL default) or left
 * - Integrated with standard Scrim
 * - Escape key to close, backdrop click to close
 */
export default function Drawer({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 'w-80 sm:w-96',
  side = 'right', // 'right' for RTL, 'left' for LTR
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && onClose) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const translateClasses = {
    right: isOpen ? 'translate-x-0' : 'translate-x-full',
    left: isOpen ? 'translate-x-0' : '-translate-x-full',
  };

  const positionClasses = {
    right: 'right-0',
    left: 'left-0',
  };

  return (
    <Scrim isOpen={isOpen} onClose={onClose} zIndex="z-50">
      <div
        className={`fixed top-0 bottom-0 ${positionClasses[side]} ${width} bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out ${translateClasses[side]}`}
        dir="rtl"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-[#E5E2D9] flex items-center justify-between bg-[#FAF8F5]">
          <div>
            <h3 className="font-bold text-sm sm:text-base text-[#111827]">{title}</h3>
            {subtitle && <p className="text-xs text-[#6B7280] mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
            aria-label="إغلاق"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto flex-1 text-xs sm:text-sm text-[#1F2937] space-y-3">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="p-3.5 border-t border-[#E5E2D9] bg-[#FAF8F5] flex items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </Scrim>
  );
}
