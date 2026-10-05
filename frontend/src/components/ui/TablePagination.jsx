import { ChevronRight, ChevronLeft } from 'lucide-react';

/**
 * Standardized TablePagination Component:
 * - Current page indicator
 * - Rows per page selector
 * - Previous/Next page buttons
 * - Total records count
 */
export default function TablePagination({
  currentPage = 1,
  totalPages = 1,
  totalItems = 0,
  pageSize = 10,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  className = '',
}) {
  const startIdx = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIdx = Math.min(currentPage * pageSize, totalItems);

  return (
    <div
      className={`flex flex-col items-stretch justify-between gap-3 border-t border-[var(--color-border)] bg-[var(--color-bg-soft)] px-3 py-3 text-xs text-[var(--color-text-secondary)] select-none sm:flex-row sm:items-center sm:px-4 ${className}`}
      dir="rtl"
    >
      {/* Right side: Item range info */}
      <div className="flex items-center gap-2 font-medium">
        <span>عرض</span>
        <span className="font-bold font-mono text-[var(--color-text-primary)]">{startIdx}</span>
        <span>إلى</span>
        <span className="font-bold font-mono text-[var(--color-text-primary)]">{endIdx}</span>
        <span>من إجمالي</span>
        <span className="font-bold font-mono text-[var(--color-brand-green)]">{totalItems}</span>
        <span>سجل</span>
      </div>

      {/* Center/Left: Page Size & Pagination Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
        {/* Page size selector */}
        {onPageSizeChange && (
          <div className="flex items-center gap-1.5">
            <span className="text-[var(--color-text-muted)]">لكل صفحة:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="px-2 py-1 bg-white border border-[var(--color-border)] rounded-lg text-xs font-bold text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-gold)]"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Page buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="p-1.5 rounded-lg border border-[var(--color-border)] bg-white text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-soft)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="الصفحة السابقة"
            aria-label="الصفحة السابقة"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <span className="px-2.5 py-1 text-xs font-bold font-mono text-[var(--color-text-primary)]">
            {currentPage} / {totalPages || 1}
          </span>

          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="p-1.5 rounded-lg border border-[var(--color-border)] bg-white text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-soft)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="الصفحة التالية"
            aria-label="الصفحة التالية"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
