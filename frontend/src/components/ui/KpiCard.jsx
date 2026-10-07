
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
    amber: 'bg-[var(--status-warning-bg)] text-[var(--color-warning)]',
    green: 'bg-[var(--status-success-bg)] text-[var(--color-success)]',
    gold: 'bg-[var(--color-bg-soft)] text-[var(--color-brand-gold)]',
    blue: 'bg-[var(--status-info-bg)] text-[var(--color-info)]',
    red: 'bg-[var(--status-danger-bg)] text-[var(--color-danger)]',
    purple: 'bg-[var(--color-bg-soft)] text-[var(--color-text-secondary)]',
  };

  return (
    <div
      onClick={onClick}
      className={`ikram-panel p-4 ${onClick ? 'cursor-pointer' : ''} ${className}`}
      dir="rtl"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <span className="text-xs font-bold text-[var(--color-text-muted)] block">{title}</span>
          <div className="text-2xl font-black text-[var(--color-text-primary)] ikram-numeric">
            {value}
          </div>
          {subtitle && (
            <p className="text-xs text-[var(--color-text-muted)] pt-0.5">{subtitle}</p>
          )}
          {trend && (
            <div className="flex items-center gap-1 text-xs font-semibold pt-1">
              <span
                className={
                  trendType === 'up'
                    ? 'text-emerald-600'
                    : trendType === 'down'
                    ? 'text-red-600'
                    : 'text-[var(--color-text-muted)]'
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
