
/**
 * Standardized Tabs Component:
 * - Tabs bar with active indicator
 * - Variants: 'pills' (rounded buttons) | 'underline' (bottom border)
 * - Badges/counts support on tabs
 */
export default function Tabs({
  tabs = [], // [{ id, label, icon: Icon, count }]
  activeTab,
  onChange,
  variant = 'pills',
  className = '',
}) {
  return (
    <div
      className={`flex items-center gap-1.5 overflow-x-auto pb-1 select-none scrollbar-none ${className}`}
      dir="rtl"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;

        if (variant === 'underline') {
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              data-testid={tab.testId}
              onClick={() => onChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-colors ${
                isActive
                  ? 'border-[var(--color-brand-green)] text-[var(--color-brand-green)]'
                  : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border)]'
              }`}
            >
              {Icon && <Icon className="w-4 h-4 shrink-0" />}
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                    isActive
                      ? 'bg-[#EBF4EA] text-[var(--color-brand-green)]'
                      : 'bg-[var(--color-bg-soft)] text-[var(--color-text-muted)]'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        }

        // 'pills' variant
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            data-testid={tab.testId}
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all duration-150 ${
              isActive
                ? 'bg-[var(--color-brand-green)] text-white shadow-xs'
                : 'bg-white border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-soft)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            {Icon && <Icon className="w-4 h-4 shrink-0" />}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-[var(--color-bg-soft)] text-[var(--color-text-muted)] border border-[var(--color-border)]'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
