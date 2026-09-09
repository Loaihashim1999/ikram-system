import React from 'react';

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
              onClick={() => onChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-colors ${
                isActive
                  ? 'border-[#3F6B3A] text-[#3F6B3A]'
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
              }`}
            >
              {Icon && <Icon className="w-4 h-4 shrink-0" />}
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                    isActive
                      ? 'bg-[#EBF4EA] text-[#3F6B3A]'
                      : 'bg-gray-100 text-gray-600'
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
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all duration-150 ${
              isActive
                ? 'bg-[#3F6B3A] text-white shadow-xs'
                : 'bg-white border border-[#E5E2D9] text-gray-700 hover:bg-[#FAF8F5] hover:text-gray-900'
            }`}
          >
            {Icon && <Icon className="w-4 h-4 shrink-0" />}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-[#FAF8F5] text-gray-600 border border-[#E5E2D9]'
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
