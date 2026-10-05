import React from 'react';

/**
 * Accessible, consistent FormField wrapper for text, number, select, and textarea inputs.
 */
export default function FormField({
  label,
  name,
  required = false,
  error,
  helperText,
  children,
  className = '',
  dir = 'rtl',
}) {
  const errorId = error && name ? `${name}-error` : undefined;
  const helperId = helperText && name ? `${name}-helper` : undefined;

  return (
    <div className={`space-y-1.5 text-right ${className}`} dir={dir}>
      {label && (
        <label htmlFor={name} className="block text-xs font-bold text-[var(--color-text-primary)]">
          {label}
          {required && <span className="text-[var(--color-danger)] mr-1" aria-hidden="true">*</span>}
          {required && <span className="sr-only">مطلوب</span>}
        </label>
      )}

      {/* Render children, cloning input to pass accessibility props if needed */}
      {React.isValidElement(children)
        ? React.cloneElement(children, {
            id: children.props.id || name,
            name: children.props.name || name,
            required: children.props.required ?? required,
            'aria-invalid': error ? 'true' : 'false',
            'aria-describedby': [errorId, helperId].filter(Boolean).join(' ') || undefined,
            className: `${children.props.className || ''} ${
              error ? 'border-red-400 focus:border-red-400 focus:ring-red-400/20' : 'border-[var(--color-border)] focus:border-[var(--color-brand-gold)]'
            }`,
          })
        : children}

      {error && (
        <p id={errorId} className="text-xs text-[var(--color-danger)] font-semibold mt-1" role="alert">
          {error}
        </p>
      )}

      {helperText && !error && (
        <p id={helperId} className="text-[11px] text-[var(--color-text-muted)] mt-1">
          {helperText}
        </p>
      )}
    </div>
  );
}
