import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import StatusBadge from './StatusBadge';

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
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="مسار الصفحة" className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] mb-1">
            <Link to="/dashboard" className="hover:text-[var(--color-brand-green)] transition-colors">
              الرئيسية
            </Link>
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={idx}>
                <ChevronLeft className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" aria-hidden="true" />
                {crumb.to ? (
                  <Link to={crumb.to} className="hover:text-[var(--color-brand-green)] transition-colors">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-[var(--color-text-primary)] font-semibold">{crumb.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}

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
