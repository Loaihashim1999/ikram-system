import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

export default function Breadcrumbs({ items = [] }) {
  if (!items.length) return null;
  return (
    <nav aria-label="مسار الصفحة" className="mb-1 flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
      <Link to="/dashboard" className="hover:text-[var(--color-brand-green)]">الرئيسية</Link>
      {items.map((crumb, index) => (
        <Fragment key={`${crumb.label}-${index}`}>
          <ChevronLeft className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {crumb.to ? (
            <Link to={crumb.to} className="hover:text-[var(--color-brand-green)]">{crumb.label}</Link>
          ) : (
            <span className="font-semibold text-[var(--color-text-primary)]">{crumb.label}</span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
