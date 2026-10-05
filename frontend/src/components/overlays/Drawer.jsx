import { useEffect } from 'react';
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
        className={`ikram-dialog fixed top-0 bottom-0 ${positionClasses[side]} ${width} z-50 flex flex-col transition-transform duration-300 ease-in-out ${translateClasses[side]}`}
        dir="rtl"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-[var(--color-border)] flex items-center justify-between bg-[var(--color-bg-soft)]">
          <div>
            <h3 className="font-bold text-sm sm:text-base text-[var(--color-text-primary)]">{title}</h3>
            {subtitle && <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-soft)] transition-colors cursor-pointer"
            aria-label="إغلاق"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto flex-1 text-xs sm:text-sm text-[var(--color-text-secondary)] space-y-3">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="p-3.5 border-t border-[var(--color-border)] bg-[var(--color-bg-soft)] flex items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </Scrim>
  );
}
