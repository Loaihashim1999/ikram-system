import React from 'react';
import { Loader2, Inbox, AlertCircle } from 'lucide-react';

/**
 * Reusable DataTable component:
 * - Horizontally scrollable on small screens
 * - Complete UI states: loading, empty, error, success
 * - Responsive layout with clean borders and RTL alignment
 */
export default function DataTable({
  columns = [],
  data = [],
  loading = false,
  error = null,
  emptyMessage = 'لا توجد بيانات متاحة حالياً',
  emptySubMessage = 'لم يتم العثور على أية سجلات مطابقة للبحث أو الفلتر',
  onRetry,
  className = '',
}) {
  return (
    <div className={`w-full bg-white rounded-2xl border border-[#E5E2D9] overflow-hidden shadow-xs ${className}`} dir="rtl">
      <div className="overflow-x-auto w-full">
        <table className="w-full text-right text-xs">
          <thead className="bg-[#FAF8F5] border-b border-[#E5E2D9]">
            <tr>
              {columns.map((col, idx) => (
                <th
                  key={col.key || idx}
                  className={`px-4 py-3.5 font-extrabold text-[#111827] whitespace-nowrap ${col.className || ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-[#E5E2D9]">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="py-16 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-[#C9A24A]">
                    <Loader2 size={36} className="animate-spin" />
                    <span className="text-xs font-bold text-[#6B7280]">جاري تحميل البيانات...</span>
                  </div>
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={columns.length} className="py-14 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-[#C24B3F]">
                    <AlertCircle size={36} />
                    <span className="text-sm font-bold">{error}</span>
                    {onRetry && (
                      <button
                        onClick={onRetry}
                        className="mt-2 px-4 py-1.5 bg-[#FAF8F5] border border-[#E5E2D9] text-[#111827] rounded-xl hover:bg-gray-100 font-bold"
                      >
                        إعادة المحاولة
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-16 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-[#6B7280]">
                    <div className="w-12 h-12 rounded-full bg-[#FAF8F5] flex items-center justify-center text-[#C9A24A]">
                      <Inbox size={26} />
                    </div>
                    <p className="text-sm font-bold text-[#111827]">{emptyMessage}</p>
                    <p className="text-xs text-[#6B7280]">{emptySubMessage}</p>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((row, rowIdx) => (
                <tr
                  key={row.id || rowIdx}
                  className="hover:bg-[#FAF8F5]/80 transition-colors"
                >
                  {columns.map((col, colIdx) => (
                    <td
                      key={col.key || colIdx}
                      className={`px-4 py-3 text-[#1F2937] ${col.cellClassName || ''}`}
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
    </div>
  );
}
