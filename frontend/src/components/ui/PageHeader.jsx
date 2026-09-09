import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

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
  className = '',
}) {
  return (
    <div className={`flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2 border-b border-[#E5E2D9] ${className}`} dir="rtl">
      {/* Right side: Breadcrumbs, Title, and Description */}
      <div className="space-y-1">
        {/* Breadcrumbs */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-1 text-xs text-gray-500 mb-1">
            <Link to="/dashboard" className="hover:text-[#3F6B3A] transition-colors">
              الرئيسية
            </Link>
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={idx}>
                <ChevronLeft className="w-3.5 h-3.5 text-gray-400 shrink-0 rotate-180 md:rotate-0" />
                {crumb.to ? (
                  <Link to={crumb.to} className="hover:text-[#3F6B3A] transition-colors">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-gray-800 font-semibold">{crumb.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}

        {/* Title & Badge */}
        <div className="flex items-center gap-3">
          <h1 className="text-2xl lg:text-3xl font-black text-gray-900 tracking-tight">
            {title}
          </h1>
          {badge && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#EBF4EA] text-[#3F6B3A] border border-[#A5D6A7]">
              {badge}
            </span>
          )}
        </div>

        {/* Subtitle */}
        {subtitle && (
          <p className="text-xs sm:text-sm text-gray-600">
            {subtitle}
          </p>
        )}
      </div>

      {/* Left side: Actions Slot */}
      {actions && (
        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
