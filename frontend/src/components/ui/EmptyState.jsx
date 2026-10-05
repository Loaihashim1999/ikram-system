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
      className={`flex flex-col items-center justify-center text-center p-6 rounded-[var(--radius-panel)] bg-[var(--color-surface)] border border-[var(--color-border)] ${className}`}
      dir="rtl"
    >
      <div className="w-14 h-14 rounded-2xl bg-[var(--color-bg-soft)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-brand-gold)] mb-3 shadow-xs">
        <Icon className="w-7 h-7" />
      </div>
      <h3 className="text-base font-extrabold text-[var(--color-text-primary)] mb-1">{title}</h3>
      <p className="text-xs sm:text-sm text-[var(--color-text-muted)] max-w-sm mb-5 leading-relaxed">
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
