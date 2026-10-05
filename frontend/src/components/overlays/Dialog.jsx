import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import Scrim from './Scrim';

/**
 * Standard Dialog component conforming to Ikram Design System Spec:
 * - Scrim: fixed inset-0 bg-black/50 backdrop-blur-sm
 * - Container: rounded-2xl bg-white shadow-2xl border border-[var(--color-border)]
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
  const titleId = useId();
  const closeRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const previous = document.activeElement;
    closeRef.current?.focus();
    return () => {
      previous?.focus?.();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <Scrim isOpen={isOpen} onClose={onClose} zIndex="z-50">
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none" dir="rtl">
        {/* Dialog Surface */}
        <div
          className={`ikram-dialog pointer-events-auto relative w-full ${maxWidth} overflow-hidden flex flex-col max-h-[min(90vh,100dvh)] transition-all transform duration-200 scale-100 opacity-100`}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-bg-soft)] flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {Icon && (
                <div className="p-2.5 bg-[var(--color-bg-soft)] text-[var(--color-brand-gold)] rounded-xl border border-[var(--color-border)] flex-shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
              )}
              <div>
                <h3 id={titleId} className="font-extrabold text-base text-[var(--color-text-primary)] leading-tight">{title}</h3>
                {subtitle && <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{subtitle}</p>}
              </div>
            </div>

            <button
              ref={closeRef}
              onClick={onClose}
              className="p-1.5 rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-soft)] transition-colors cursor-pointer"
              title="إغلاق"
              aria-label="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Content Body */}
          <div className="p-6 overflow-y-auto flex-1 text-xs text-[var(--color-text-secondary)] space-y-4">
            {children}
          </div>

          {/* Footer Actions */}
          {footer && (
            <div className="px-6 py-3.5 border-t border-[var(--color-border)] bg-[var(--color-bg-soft)] flex items-center justify-end gap-3">
              {footer}
            </div>
          )}
        </div>
      </div>
    </Scrim>
  );
}
