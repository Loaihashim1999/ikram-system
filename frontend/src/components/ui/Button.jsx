import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Reusable Standard Button Component for Ikram Design System:
 * Variants:
 * - primary: Action Amber (#D97706) for primary actions, save, submit, confirm
 * - secondary: Brand Green (#3F6B3A) for secondary identity actions
 * - gold: Royal Gold (#C9A24A)
 * - outline: Border with transparent background
 * - ghost: Flat with hover background
 * - danger: Crimson Red (#DC2626) strictly for destructive operations
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon: Icon,
  iconPosition = 'start',
  className = '',
  type = 'button',
  onClick,
  ...props
}) {
  const baseClasses = 'inline-flex items-center justify-center font-bold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none rounded-xl';

  const sizeClasses = {
    xs: 'px-2.5 py-1 text-xs gap-1.5',
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-5 py-2.5 text-base gap-2.5',
  };

  const variantClasses = {
    primary: 'bg-[#D97706] hover:bg-[#B45309] active:bg-[#92400E] text-white shadow-xs focus:ring-[#D97706]',
    secondary: 'bg-[#3F6B3A] hover:bg-[#31542D] active:bg-[#223B1E] text-white shadow-xs focus:ring-[#3F6B3A]',
    gold: 'bg-[#C9A24A] hover:bg-[#B48528] active:bg-[#8C6C26] text-white shadow-xs focus:ring-[#C9A24A]',
    outline: 'bg-white border border-[#E5E2D9] text-[#111827] hover:bg-[#FAF8F5] hover:border-[#C9A24A] active:bg-[#F4EFE3] focus:ring-[#C9A24A]',
    ghost: 'bg-transparent text-[#1F2937] hover:bg-[#FAF8F5] active:bg-[#F4EFE3] focus:ring-[#C9A24A]',
    danger: 'bg-red-600 hover:bg-red-700 active:bg-red-800 text-white shadow-xs focus:ring-red-500',
    dangerOutline: 'bg-white border border-red-200 text-red-700 hover:bg-red-50 hover:border-red-400 focus:ring-red-500',
  };

  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      onClick={onClick}
      className={`${baseClasses} ${sizeClasses[size] || sizeClasses.md} ${variantClasses[variant] || variantClasses.primary} ${className}`}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
      {!loading && Icon && iconPosition === 'start' && <Icon className="w-4 h-4 shrink-0" />}
      <span>{children}</span>
      {!loading && Icon && iconPosition === 'end' && <Icon className="w-4 h-4 shrink-0" />}
    </button>
  );
}
