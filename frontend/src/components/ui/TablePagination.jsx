import React from 'react';
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
      className={`flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 bg-[#FAF8F5] border-t border-[#E5E2D9] text-xs text-gray-700 select-none ${className}`}
      dir="rtl"
    >
      {/* Right side: Item range info */}
      <div className="flex items-center gap-2 font-medium">
        <span>عرض</span>
        <span className="font-bold font-mono text-gray-900">{startIdx}</span>
        <span>إلى</span>
        <span className="font-bold font-mono text-gray-900">{endIdx}</span>
        <span>من إجمالي</span>
        <span className="font-bold font-mono text-[#3F6B3A]">{totalItems}</span>
        <span>سجل</span>
      </div>

      {/* Center/Left: Page Size & Pagination Buttons */}
      <div className="flex items-center gap-4">
        {/* Page size selector */}
        {onPageSizeChange && (
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500">لكل صفحة:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="px-2 py-1 bg-white border border-[#E5E2D9] rounded-lg text-xs font-bold text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#C9A24A]"
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
            className="p-1.5 rounded-lg border border-[#E5E2D9] bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="الصفحة السابقة"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <span className="px-2.5 py-1 text-xs font-bold font-mono text-gray-800">
            {currentPage} / {totalPages || 1}
          </span>

          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="p-1.5 rounded-lg border border-[#E5E2D9] bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="الصفحة التالية"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
