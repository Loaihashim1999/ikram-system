import { useEffect, useState } from 'react';
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
  getRowProps,
}) {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia('(max-width: 767px)');
    const update = () => setNarrow(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const stackColumns = columns.filter((col) => col.stack !== false);
  const renderCell = (row, col, rowIdx) => (col.render ? col.render(row, rowIdx) : row[col.key] ?? '—');

  return (
    <div className={`ikram-panel w-full overflow-hidden ${className}`} dir="rtl">
      {narrow && (
      <div className="p-3">
        {loading ? <LoadingState message="جاري تحميل السجلات..." size="md" /> : error ? (
          <p className="text-sm font-bold text-[var(--color-danger)]">{error}</p>
        ) : data.length === 0 ? (
          <EmptyState title={emptyMessage} description={emptySubMessage} actionLabel={emptyActionLabel} onAction={onEmptyAction} />
        ) : data.map((row, rowIdx) => (
          <article key={(typeof rowKey === 'function' ? rowKey(row, rowIdx) : row[rowKey]) || rowIdx} className="mb-3 border-b border-[var(--color-border)] pb-3 last:mb-0">
            {stackColumns.map((col, colIdx) => (
              <div key={col.key || colIdx} className="grid grid-cols-[7rem_1fr] gap-2 py-1 text-sm">
                <span className="text-[var(--color-text-muted)]">{col.header}</span>
                <span className={col.numeric ? 'ikram-numeric' : ''}>{renderCell(row, col, rowIdx)}</span>
              </div>
            ))}
          </article>
        ))}
      </div>
      )}
      {!narrow && (
      <div className="ikram-table-wrap">
        <table className="ikram-table ikram-table-fluid">
          <thead className="bg-[var(--color-bg-soft)] border-b border-[var(--color-border)]">
            <tr>
              {columns.map((col, idx) => {
                const isSortable = col.sortable && onSort;
                const isCurrentSort = sortColumn === col.key;

                return (
                  <th
                    key={col.key || idx}
                    onClick={() => isSortable && onSort(col.key)}
                    scope="col"
                    aria-sort={isCurrentSort ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={`px-4 py-3 font-black text-[var(--color-text-primary)] whitespace-nowrap select-none ${
                      isSortable ? 'cursor-pointer hover:bg-[var(--color-bg-soft)]/50 transition-colors' : ''
                    } ${col.className || ''}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{col.header}</span>
                      {isSortable && (
                        <span className="text-[var(--color-text-muted)]">
                          {isCurrentSort ? (
                            sortDirection === 'asc' ? (
                              <ArrowUp className="w-3.5 h-3.5 text-[var(--color-brand-green)]" />
                            ) : (
                              <ArrowDown className="w-3.5 h-3.5 text-[var(--color-brand-green)]" />
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

          <tbody className="divide-y divide-[var(--color-border)]">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="p-0">
                  <LoadingState message="جاري تحميل السجلات..." size="md" />
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={columns.length} className="py-12 px-4 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-[var(--color-danger)]">
                    <AlertCircle size={36} />
                    <span className="text-sm font-bold text-[var(--color-text-primary)]">{error}</span>
                    {onRetry && (
                      <button
                        onClick={onRetry}
                        className="mt-2 px-4 py-1.5 bg-[var(--color-bg-soft)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-xl hover:bg-[var(--color-bg-soft)] font-bold transition-colors"
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
                  key={(typeof rowKey === 'function' ? rowKey(row, rowIdx) : row[rowKey]) || rowIdx}
                  {...(getRowProps ? getRowProps(row, rowIdx) : {})}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={`hover:bg-[var(--color-bg-soft)]/90 transition-colors ${
                    onRowClick ? 'cursor-pointer' : ''
                  }`}
                >
                  {columns.map((col, colIdx) => (
                    <td
                      key={col.key || colIdx}
                      className={`px-4 py-3 text-[var(--color-text-secondary)] ${col.cellClassName || ''}`}
                    >
                      <span className={col.numeric ? 'ikram-numeric' : ''}>{renderCell(row, col, rowIdx)}</span>
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      )}

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
