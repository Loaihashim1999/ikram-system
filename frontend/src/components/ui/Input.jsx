import React from 'react';

/**
 * Standardized Input Component for Ikram System:
 * - Clean white background with soft warm border
 * - Focus ring with Royal Gold (#C9A24A)
 * - Optional prefix/suffix icons
 * - Clear button
 */
export default function Input({
  type = 'text',
  value,
  onChange,
  placeholder,
  icon: Icon,
  error,
  disabled = false,
  className = '',
  id,
  name,
  ...props
}) {
  return (
    <div className="relative w-full" dir="rtl">
      {Icon && (
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400">
          <Icon className="w-4 h-4" />
        </div>
      )}

      <input
        type={type}
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full h-10 px-3 ${Icon ? 'pr-9' : 'pr-3'} pl-3 bg-white border ${
          error ? 'border-red-400 focus:ring-red-400' : 'border-[#E5E2D9] focus:ring-[#C9A24A]'
        } rounded-xl text-xs sm:text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all disabled:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
        {...props}
      />
    </div>
  );
}
