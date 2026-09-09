import React from 'react';
import { Inbox } from 'lucide-react';
import Button from './Button';

/**
 * Standardized EmptyState component:
 * - Empty icon with soft rounded container
 * - Title and supporting description
 * - Optional primary action button
 */
export default function EmptyState({
  title = 'لا توجد بيانات متاحة',
  description = 'لم يتم العثور على أية سجلات مطابقة للبحث أو التصفية الحالية.',
  icon: Icon = Inbox,
  actionLabel,
  onAction,
  actionIcon,
  className = '',
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-8 sm:p-12 rounded-2xl bg-white border border-[#E5E2D9] ${className}`}
      dir="rtl"
    >
      <div className="w-14 h-14 rounded-2xl bg-[#FAF8F5] border border-[#E5E2D9] flex items-center justify-center text-[#C9A24A] mb-3 shadow-xs">
        <Icon className="w-7 h-7" />
      </div>
      <h3 className="text-base font-extrabold text-gray-900 mb-1">{title}</h3>
      <p className="text-xs sm:text-sm text-gray-500 max-w-sm mb-5 leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button onClick={onAction} icon={actionIcon} variant="primary" size="sm">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
