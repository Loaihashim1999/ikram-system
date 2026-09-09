import React from 'react';
import LoadingState from './LoadingState';
import EmptyState from './EmptyState';
import TablePagination from './TablePagination';
import { AlertCircle, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

/**
 * Standardized DataTable component for Ikram System:
 * - Horizontally scrollable on small screens
 * - Complete UI states: loading, empty, error, success
 * - Integrated Pagination
 * - Sorting support
 * - Clean borders, warm surface, and RTL alignment
 */
export default function DataTable({
  columns = [],
  data = [],
  loading = false,
  error = null,
  emptyMessage = 'لا توجد بيانات متاحة حالياً',
  emptySubMessage = 'لم يتم العثور على أية سجلات مطابقة للبحث أو الفلتر',
  emptyActionLabel,
  onEmptyAction,
  onRetry,
  // Pagination
  pagination = false,
  currentPage = 1,
  totalPages = 1,
  totalItems = 0,
  pageSize = 10,
  onPageChange,
  onPageSizeChange,
  // Sorting
  sortColumn,
  sortDirection, // 'asc' | 'desc'
  onSort,
  // Additional
  className = '',
  rowKey = 'id',
  onRowClick,
}) {
  return (
    <div className={`w-full bg-white rounded-2xl border border-[#E5E2D9] overflow-hidden shadow-xs ${className}`} dir="rtl">
      <div className="overflow-x-auto w-full">
        <table className="w-full text-right text-xs">
          <thead className="bg-[#FAF8F5] border-b border-[#E5E2D9]">
            <tr>
              {columns.map((col, idx) => {
                const isSortable = col.sortable && onSort;
                const isCurrentSort = sortColumn === col.key;

                return (
                  <th
                    key={col.key || idx}
                    onClick={() => isSortable && onSort(col.key)}
                    className={`px-4 py-3.5 font-black text-[#111827] whitespace-nowrap select-none ${
                      isSortable ? 'cursor-pointer hover:bg-[#F5EDDA]/50 transition-colors' : ''
                    } ${col.className || ''}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{col.header}</span>
                      {isSortable && (
                        <span className="text-gray-400">
                          {isCurrentSort ? (
                            sortDirection === 'asc' ? (
                              <ArrowUp className="w-3.5 h-3.5 text-[#3F6B3A]" />
                            ) : (
                              <ArrowDown className="w-3.5 h-3.5 text-[#3F6B3A]" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3.5 h-3.5 opacity-50" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-[#E5E2D9]">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="p-0">
                  <LoadingState message="جاري تحميل السجلات..." size="md" />
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={columns.length} className="py-12 px-4 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-red-600">
                    <AlertCircle size={36} />
                    <span className="text-sm font-bold text-gray-900">{error}</span>
                    {onRetry && (
                      <button
                        onClick={onRetry}
                        className="mt-2 px-4 py-1.5 bg-[#FAF8F5] border border-[#E5E2D9] text-[#111827] rounded-xl hover:bg-gray-100 font-bold transition-colors"
                      >
                        إعادة المحاولة
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-0">
                  <EmptyState
                    title={emptyMessage}
                    description={emptySubMessage}
                    actionLabel={emptyActionLabel}
                    onAction={onEmptyAction}
                  />
                </td>
              </tr>
            ) : (
              data.map((row, rowIdx) => (
                <tr
                  key={row[rowKey] || rowIdx}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={`hover:bg-[#FAF8F5]/90 transition-colors ${
                    onRowClick ? 'cursor-pointer' : ''
                  }`}
                >
                  {columns.map((col, colIdx) => (
                    <td
                      key={col.key || colIdx}
                      className={`px-4 py-3.5 text-[#1F2937] ${col.cellClassName || ''}`}
                    >
                      {col.render ? col.render(row, rowIdx) : row[col.key] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      {pagination && !loading && !error && data.length > 0 && (
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </div>
  );
}
