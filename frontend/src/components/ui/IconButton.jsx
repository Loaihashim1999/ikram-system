import React from 'react';

/**
 * Standardized IconButton for DataTables and action bars.
 * Variants:
 * - default: subtle neutral hover
 * - primary: amber action icon
 * - secondary: green identity icon
 * - danger: red delete/reject icon
 * - info: blue view/inspect icon
 */
export default function IconButton({
  icon: Icon,
  onClick,
  title,
  variant = 'default',
  size = 'md',
  disabled = false,
  className = '',
  type = 'button',
  ...props
}) {
  const sizeClasses = {
    sm: 'w-7 h-7 p-1 text-xs',
    md: 'w-8 h-8 p-1.5 text-sm',
    lg: 'w-9 h-9 p-2 text-base',
  };

  const variantClasses = {
    default: 'text-gray-600 hover:text-gray-900 hover:bg-[#FAF8F5] border border-transparent hover:border-[#E5E2D9]',
    primary: 'text-[#D97706] hover:bg-[#FEF3C7] border border-transparent hover:border-[#FCD34D]',
    secondary: 'text-[#3F6B3A] hover:bg-[#EBF4EA] border border-transparent hover:border-[#A5D6A7]',
    gold: 'text-[#C9A24A] hover:bg-[#F5EDDA] border border-transparent hover:border-[#FCD34D]',
    danger: 'text-red-600 hover:bg-red-50 hover:text-red-800 border border-transparent hover:border-red-200',
    info: 'text-sky-600 hover:bg-sky-50 hover:text-sky-800 border border-transparent hover:border-sky-200',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-lg transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#C9A24A]/40 ${sizeClasses[size] || sizeClasses.md} ${variantClasses[variant] || variantClasses.default} ${className}`}
      {...props}
    >
      {Icon && <Icon className="w-full h-full shrink-0" />}
    </button>
  );
}
