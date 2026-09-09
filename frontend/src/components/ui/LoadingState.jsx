import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Standardized LoadingState Component
 */
export function LoadingState({
  message = 'جاري تحميل البيانات...',
  className = '',
  size = 'md',
}) {
  const sizeStyles = {
    sm: 'py-8 text-xs',
    md: 'py-14 text-sm',
    lg: 'py-20 text-base',
  };

  return (
    <div
      className={`w-full flex flex-col items-center justify-center gap-3 text-center ${sizeStyles[size] || sizeStyles.md} ${className}`}
      dir="rtl"
    >
      <div className="w-12 h-12 rounded-2xl bg-[#F5EDDA] flex items-center justify-center text-[#C9A24A] shadow-xs">
        <Loader2 className="w-6 h-6 animate-spin text-[#C9A24A]" />
      </div>
      <p className="font-bold text-gray-700">{message}</p>
    </div>
  );
}

/**
 * Standardized SkeletonLoader Component for tables and cards
 */
export function SkeletonLoader({ rows = 5, className = '' }) {
  return (
    <div className={`w-full space-y-3 p-4 animate-pulse ${className}`} dir="rtl">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <div className="w-10 h-10 bg-gray-200 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded-md w-1/3" />
            <div className="h-3 bg-gray-100 rounded-md w-1/2" />
          </div>
          <div className="w-20 h-6 bg-gray-100 rounded-full shrink-0" />
        </div>
      ))}
    </div>
  );
}

export default LoadingState;
