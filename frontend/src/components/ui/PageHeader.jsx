import StatusBadge from './StatusBadge';
import Breadcrumbs from './Breadcrumbs';

/**
 * Standardized PageHeader component for all pages:
 * - Breadcrumbs
 * - Title & Optional Badge
 * - Subtitle / Description
 * - Primary & Secondary Actions Slot
 */
export default function PageHeader({
  title,
  subtitle,
  badge,
  breadcrumbs = [],
  actions,
  action,
  filters,
  className = '',
}) {
  const actionContent = actions ?? action;
  const badgeText = typeof badge === 'object' ? badge.text : badge;
  return (
    <header className={`space-y-3 ${className}`} dir="rtl">
      <div className="ikram-masthead">
      {/* Right side: Breadcrumbs, Title, and Description */}
      <div className="min-w-0 space-y-1">
        {/* Breadcrumbs */}
        <Breadcrumbs items={breadcrumbs} />

        {/* Title & Badge */}
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-xl font-bold tracking-tight text-[var(--color-text-primary)]">
            {title}
          </h1>
          {badge && <StatusBadge status="active" label={badgeText} />}
        </div>

        {/* Subtitle */}
        {subtitle && (
          <p className="text-xs sm:text-sm text-[var(--color-text-muted)]">
            {subtitle}
          </p>
        )}
      </div>

      {/* Left side: Actions Slot */}
      {actionContent && (
        <div className="ikram-actions w-full md:w-auto md:justify-end">
          {actionContent}
        </div>
      )}
      </div>
      {filters && <div className="w-full">{filters}</div>}
    </header>
  );
}
