import { useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  width = 'w-full sm:w-[90vw] lg:w-[min(760px,calc(100vw-19rem))]',
  side = 'left',
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

  return createPortal(
    <Scrim isOpen={isOpen} onClose={onClose} zIndex="z-[60]">
      <div
        className={`ikram-dialog fixed top-0 bottom-0 ${positionClasses[side]} ${width} z-[60] flex max-w-full flex-col ${translateClasses[side]}`}
        dir="rtl"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg-soft)] p-4">
          <div className="min-w-0 text-right">
            <h2 className="text-base font-bold text-[var(--color-text-primary)]">{title}</h2>
            {subtitle && <p className="mt-1 text-xs leading-6 text-[var(--color-text-muted)]">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ikram-btn ikram-btn-ghost h-11 w-11 shrink-0 p-0"
            aria-label="إغلاق"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4 text-sm text-[var(--color-text-secondary)]">
          {children}
        </div>

        {footer && (
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[var(--color-border)] bg-[var(--color-bg-soft)] p-4">
            {footer}
          </div>
        )}
      </div>
    </Scrim>,
    document.body,
  );
}
