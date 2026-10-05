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
        <label htmlFor={name} className="block text-xs font-bold text-[#111827]">
          {label}
          {required && <span className="text-red-600 mr-1" aria-hidden="true">*</span>}
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
              error ? 'border-red-400 focus:border-red-400 focus:ring-red-400/20' : 'border-[#E5E2D9] focus:border-[#C9A24A]'
            }`,
          })
        : children}

      {error && (
        <p id={errorId} className="text-xs text-red-600 font-semibold mt-1" role="alert">
          {error}
        </p>
      )}

      {helperText && !error && (
        <p id={helperId} className="text-[11px] text-[#6B7280] mt-1">
          {helperText}
        </p>
      )}
    </div>
  );
}
