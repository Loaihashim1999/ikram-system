import { useState } from 'react';
import { Package, Download, Calendar, MapPin, User, Clock } from 'lucide-react';
import StatusBadge from '../ui/StatusBadge';
import { SecondaryButton } from '../ui/Button';
import { exportApiDataToExcel } from '../../utils/excelExport';
import { displayLabel } from '../../utils/displayVocabulary';

/**
 * ReceiptHistoryTimeline:
 * Displays a chronological list and table of distributions/receipts.
 * Supports:
 * - Excel export via SheetJS (xlsx)
 * - PDF print preview
 * - Timeline and table view modes
 */
export default function ReceiptHistoryTimeline({
  records = [],
  title = "سجل الاستلام والتسليم التاريخي",
  recipientName = "",
  recipientType = "beneficiary", // beneficiary | employee | organization
  beneficiaryId = "",
  organizationId = "",
}) {
  const [viewMode, setViewMode] = useState('timeline'); // 'timeline' | 'table'

  const exportToExcel = () => {
    if (!beneficiaryId && !organizationId) {
      alert("تصدير السجل الكامل يحتاج مرجع المستفيد أو الجهة.");
      return;
    }
    exportApiDataToExcel({
      endpoint: '/support/distributions',
      params: { ...(beneficiaryId ? { beneficiary_id: beneficiaryId } : {}), ...(organizationId ? { organization_id: organizationId } : {}) },
      filename: `سجل_استلام_${recipientName || 'المستفيد'}`,
      sheetName: 'سجل الاستلام',
      transform: (row) => ({
        'المستفيد': row.recipient_name || recipientName,
        'مرجع العملية': row.id,
        'طريقة التسليم': displayLabel('fulfillment', row.fulfillment_method),
        'الحالة': displayLabel('status', row.status),
        'تاريخ الإكمال': row.completed_at || '',
      }),
    }).catch((error) => alert(error.message || 'تعذر تصدير السجل.'));
  };

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-5 shadow-xs" dir="rtl">
      {/* Header with Export Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[var(--color-bg-soft)] text-[var(--color-brand-gold)] rounded-xl border border-[var(--color-border)]">
            <Package size={20} />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-[var(--color-text-primary)]">{title}</h3>
            <p className="text-xs text-[var(--color-text-muted)]">
              إجمالي السجلات المسجلة: <span className="font-bold text-[var(--color-brand-green)] font-mono">{records.length}</span> عملية
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex bg-[var(--color-bg-soft)] p-1 rounded-xl border border-[var(--color-border)] text-xs">
            <button
              type="button"
              onClick={() => setViewMode('timeline')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                viewMode === 'timeline' ? 'bg-[var(--color-surface)] shadow-xs text-[var(--color-brand-gold)]' : 'text-[var(--color-text-muted)]'
              }`}
            >
              خط زمني
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                viewMode === 'table' ? 'bg-[var(--color-surface)] shadow-xs text-[var(--color-brand-gold)]' : 'text-[var(--color-text-muted)]'
              }`}
            >
              جدول
            </button>
          </div>

          {/* Export buttons */}
          <SecondaryButton type="button" icon={Download} onClick={exportToExcel}>تصدير Excel</SecondaryButton>
        </div>
      </div>

      {/* Content body */}
      {records.length === 0 ? (
        <div className="text-center py-12 text-[var(--color-text-muted)]">
          <Clock size={32} className="mx-auto mb-2 text-[var(--color-border)]" />
          <p className="font-bold text-xs">لا يوجد سجل استلامات مسجل حتى الآن.</p>
          <p className="text-[11px] text-[#9CA3AF] mt-0.5">يتم تسجيل الاستلامات تلقائياً عند مسح رمز الـ QR أو تأكيد الصرف الميداني.</p>
        </div>
      ) : viewMode === 'timeline' ? (
        <div className="relative pr-6 border-r-2 border-[var(--color-border)] space-y-6">
          {records.map((rec, idx) => {
            const dateStr = rec.received_at || rec.delivered_at || rec.created_at;
            return (
              <div key={rec.id || idx} className="relative group">
                {/* Timeline Dot */}
                <div className="absolute -right-[31px] top-1.5 w-4 h-4 rounded-full bg-[var(--color-brand-gold)] border-4 border-white shadow-xs group-hover:scale-110 transition-transform" />

                <div className="bg-[var(--color-bg-soft)] p-4 rounded-2xl border border-[var(--color-border)] space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-xs text-[var(--color-text-primary)]">
                        {rec.basket?.name || rec.basket_name || rec.type || "سلة دعم مجتمعي"}
                      </span>
                      <StatusBadge status={rec.status || 'delivered'} />
                    </div>
                    <span className="text-[11px] font-mono text-[var(--color-text-muted)] flex items-center gap-1">
                      <Calendar size={13} className="text-[var(--color-brand-gold)]" />
                      {dateStr ? new Date(dateStr).toLocaleString('ar-SA') : '—'}
                    </span>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-2 text-xs text-[var(--color-text-secondary)] pt-1">
                    <div className="flex items-center gap-1.5">
                      <MapPin size={13} className="text-[var(--color-brand-green)]" />
                      <span>موقع الاستلام:</span>
                      <strong className="text-[var(--color-text-primary)]">{rec.pickup_location || "مقر الجمعية الرئيسي"}</strong>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <User size={13} className="text-[var(--color-brand-green)]" />
                      <span>المنفذ / السائق:</span>
                      <strong className="text-[var(--color-text-primary)]">{rec.driver?.full_name || rec.executor?.name || "المشرف الميداني"}</strong>
                    </div>
                  </div>

                  {(rec.qr_code_hash || rec.barcode_code) && (
                    <div className="text-[11px] font-mono text-[var(--color-text-muted)] bg-[var(--color-surface)] p-2 rounded-xl border border-[var(--color-border)] flex items-center justify-between mt-2">
                      <span>رمز العملية (Single-Use QR):</span>
                      <span className="font-bold text-[var(--color-text-primary)]">{rec.qr_code_hash || rec.barcode_code}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-[var(--color-bg-soft)] border-b border-[var(--color-border)]">
              <tr>
                <th className="p-3 font-bold text-[var(--color-text-primary)]">#</th>
                <th className="p-3 font-bold text-[var(--color-text-primary)]">التاريخ والوقت</th>
                <th className="p-3 font-bold text-[var(--color-text-primary)]">نوع السلة</th>
                <th className="p-3 font-bold text-[var(--color-text-primary)]">نقطة الاستلام</th>
                <th className="p-3 font-bold text-[var(--color-text-primary)]">المستخدم المنفذ</th>
                <th className="p-3 font-bold text-[var(--color-text-primary)]">رمز الـ QR</th>
                <th className="p-3 font-bold text-[var(--color-text-primary)]">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {records.map((rec, idx) => (
                <tr key={rec.id || idx} className="hover:bg-[var(--color-bg-soft)]">
                  <td className="p-3 font-mono text-[var(--color-text-muted)]">{idx + 1}</td>
                  <td className="p-3 font-mono text-[var(--color-text-secondary)]">
                    {rec.delivered_at || rec.received_at || rec.created_at
                      ? new Date(rec.delivered_at || rec.received_at || rec.created_at).toLocaleDateString('ar-SA')
                      : '—'}
                  </td>
                  <td className="p-3 font-bold text-[var(--color-text-primary)]">{rec.basket?.name || rec.basket_name || 'سلة دعم'}</td>
                  <td className="p-3 text-[var(--color-text-secondary)]">{rec.pickup_location || 'مقر الجمعية'}</td>
                  <td className="p-3 text-[var(--color-text-secondary)]">{rec.driver?.full_name || rec.executed_by || 'الإدارة'}</td>
                  <td className="p-3 font-mono text-xs">{rec.qr_code_hash || rec.barcode_code || '—'}</td>
                  <td className="p-3">
                    <StatusBadge status={rec.status || 'delivered'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
