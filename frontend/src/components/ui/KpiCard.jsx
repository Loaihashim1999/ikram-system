import React from 'react';

/**
 * Standardized KpiCard Component:
 * - Clean white card with soft warm border
 * - Icon in custom rounded container
 * - Title, Value (font-mono for numbers), subtitle/trend
 */
export default function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = 'amber', // 'amber', 'green', 'gold', 'blue', 'red'
  trend,
  trendType = 'neutral', // 'up', 'down', 'neutral'
  className = '',
  onClick,
}) {
  const iconColorStyles = {
    amber: 'bg-[#FEF3C7] text-[#D97706]',
    green: 'bg-[#EBF4EA] text-[#3F6B3A]',
    gold: 'bg-[#F5EDDA] text-[#C9A24A]',
    blue: 'bg-sky-50 text-sky-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl p-5 border border-[#E5E2D9] shadow-xs hover:shadow-card-hover transition-all duration-200 ${onClick ? 'cursor-pointer' : ''} ${className}`}
      dir="rtl"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <span className="text-xs font-bold text-gray-500 block">{title}</span>
          <div className="text-2xl lg:text-3xl font-black text-gray-900 font-mono tracking-tight">
            {value}
          </div>
          {subtitle && (
            <p className="text-xs text-gray-500 pt-0.5">{subtitle}</p>
          )}
          {trend && (
            <div className="flex items-center gap-1 text-xs font-semibold pt-1">
              <span
                className={
                  trendType === 'up'
                    ? 'text-emerald-600'
                    : trendType === 'down'
                    ? 'text-red-600'
                    : 'text-gray-500'
                }
              >
                {trend}
              </span>
            </div>
          )}
        </div>

        {Icon && (
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${iconColorStyles[iconColor] || iconColorStyles.amber}`}
          >
            <Icon className="w-6 h-6" />
          </div>
        )}
      </div>
    </div>
  );
}
