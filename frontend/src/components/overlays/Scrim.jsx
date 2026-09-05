import React, { useEffect } from 'react';

/**
 * Standard Scrim / Backdrop overlay component conforming to Ikram UX/UI rules:
 * - fixed inset-0 bg-black/50 backdrop-blur-sm
 * - Disables body scroll while active
 * - Supports Escape key and click-to-close
 * - Prevents interaction with the background content
 */
export default function Scrim({
  isOpen = false,
  onClose,
  zIndex = 'z-40',
  className = '',
  children,
}) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-200 ${zIndex} ${className}`}
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) {
          onClose();
        }
      }}
      aria-modal="true"
      role="presentation"
    >
      {children}
    </div>
  );
}
