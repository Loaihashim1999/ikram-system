import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Package, Download, Printer, Calendar, MapPin, User, CheckCircle2, Clock } from 'lucide-react';
import StatusBadge from '../ui/StatusBadge';

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
}) {
  const [viewMode, setViewMode] = useState('timeline'); // 'timeline' | 'table'

  const exportToExcel = () => {
    if (!records || records.length === 0) {
      alert("لا توجد سجلات استلام لتصديرها.");
      return;
    }

    const rows = records.map((rec, idx) => ({
      "م": idx + 1,
      "تاريخ الاستلام": rec.received_at || rec.delivered_at || rec.created_at ? new Date(rec.received_at || rec.delivered_at || rec.created_at).toLocaleDateString('ar-SA') : '—',
      "نوع السلة / الدعم": rec.basket?.name || rec.basket_name || rec.type || "سلة غذائية",
      "نقطة الاستلام / التوصيل": rec.pickup_location || rec.location || "مقر الجمعية",
      "المستخدم المنفذ / السائق": rec.driver?.full_name || rec.executor?.name || rec.executed_by || "الإدارة",
      "رمز الـ QR / الكود": rec.qr_code_hash || rec.barcode_code || rec.code || "—",
      "حالة التسليم": rec.status === 'delivered' ? 'تم التسليم' : 'مجدول',
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "سجل الاستلامات");
    XLSX.writeFile(workbook, `سجل_استلام_${recipientName || 'المستفيد'}_${Date.now()}.xlsx`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-white rounded-2xl border border-[#E5E2D9] p-5 shadow-xs" dir="rtl">
      {/* Header with Export Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-[#E5E2D9]">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#FAF8F5] text-[#C9A24A] rounded-xl border border-[#E5E2D9]">
            <Package size={20} />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-[#111827]">{title}</h3>
            <p className="text-xs text-[#6B7280]">
              إجمالي السجلات المسجلة: <span className="font-bold text-[#D97706] font-mono">{records.length}</span> عملية
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex bg-[#FAF8F5] p-1 rounded-xl border border-[#E5E2D9] text-xs">
            <button
              type="button"
              onClick={() => setViewMode('timeline')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                viewMode === 'timeline' ? 'bg-white shadow-xs text-[#C9A24A]' : 'text-[#6B7280]'
              }`}
            >
              خط زمني
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                viewMode === 'table' ? 'bg-white shadow-xs text-[#C9A24A]' : 'text-[#6B7280]'
              }`}
            >
              جدول
            </button>
          </div>

          {/* Export buttons */}
          <button
            type="button"
            onClick={exportToExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#E6F4EC] text-[#2E7D32] hover:bg-green-100 rounded-xl text-xs font-bold transition-colors border border-[#A5D6A7]"
            title="تصدير السجل إلى ملف Excel"
          >
            <Download size={14} />
            <span>Excel</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FAF8F5] text-[#111827] hover:bg-gray-100 rounded-xl text-xs font-bold transition-colors border border-[#E5E2D9]"
            title="طباعة / حفظ كـ PDF"
          >
            <Printer size={14} />
            <span>PDF</span>
          </button>
        </div>
      </div>

      {/* Content body */}
      {records.length === 0 ? (
        <div className="text-center py-12 text-[#6B7280]">
          <Clock size={32} className="mx-auto mb-2 text-[#E5E2D9]" />
          <p className="font-bold text-xs">لا يوجد سجل استلامات مسجل حتى الآن.</p>
          <p className="text-[11px] text-[#9CA3AF] mt-0.5">يتم تسجيل الاستلامات تلقائياً عند مسح رمز الـ QR أو تأكيد الصرف الميداني.</p>
        </div>
      ) : viewMode === 'timeline' ? (
        <div className="relative pr-6 border-r-2 border-[#E5E2D9] space-y-6">
          {records.map((rec, idx) => {
            const dateStr = rec.received_at || rec.delivered_at || rec.created_at;
            return (
              <div key={rec.id || idx} className="relative group">
                {/* Timeline Dot */}
                <div className="absolute -right-[31px] top-1.5 w-4 h-4 rounded-full bg-[#C9A24A] border-4 border-white shadow-xs group-hover:scale-110 transition-transform" />

                <div className="bg-[#FAF8F5] p-4 rounded-2xl border border-[#E5E2D9] space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-xs text-[#111827]">
                        {rec.basket?.name || rec.basket_name || rec.type || "سلة دعم مجتمعي"}
                      </span>
                      <StatusBadge status={rec.status || 'delivered'} />
                    </div>
                    <span className="text-[11px] font-mono text-[#6B7280] flex items-center gap-1">
                      <Calendar size={13} className="text-[#C9A24A]" />
                      {dateStr ? new Date(dateStr).toLocaleString('ar-SA') : '—'}
                    </span>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-2 text-xs text-[#4B5563] pt-1">
                    <div className="flex items-center gap-1.5">
                      <MapPin size={13} className="text-[#D97706]" />
                      <span>موقع الاستلام:</span>
                      <strong className="text-[#111827]">{rec.pickup_location || "مقر الجمعية الرئيسي"}</strong>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <User size={13} className="text-[#3F6B3A]" />
                      <span>المنفذ / السائق:</span>
                      <strong className="text-[#111827]">{rec.driver?.full_name || rec.executor?.name || "المشرف الميداني"}</strong>
                    </div>
                  </div>

                  {(rec.qr_code_hash || rec.barcode_code) && (
                    <div className="text-[11px] font-mono text-[#6B7280] bg-white p-2 rounded-xl border border-[#E5E2D9] flex items-center justify-between mt-2">
                      <span>رمز العملية (Single-Use QR):</span>
                      <span className="font-bold text-[#111827]">{rec.qr_code_hash || rec.barcode_code}</span>
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
            <thead className="bg-[#FAF8F5] border-b border-[#E5E2D9]">
              <tr>
                <th className="p-3 font-bold text-[#111827]">#</th>
                <th className="p-3 font-bold text-[#111827]">التاريخ والوقت</th>
                <th className="p-3 font-bold text-[#111827]">نوع السلة</th>
                <th className="p-3 font-bold text-[#111827]">نقطة الاستلام</th>
                <th className="p-3 font-bold text-[#111827]">المستخدم المنفذ</th>
                <th className="p-3 font-bold text-[#111827]">رمز الـ QR</th>
                <th className="p-3 font-bold text-[#111827]">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E2D9]">
              {records.map((rec, idx) => (
                <tr key={rec.id || idx} className="hover:bg-[#FAF8F5]">
                  <td className="p-3 font-mono text-gray-500">{idx + 1}</td>
                  <td className="p-3 font-mono text-gray-700">
                    {rec.delivered_at || rec.received_at || rec.created_at
                      ? new Date(rec.delivered_at || rec.received_at || rec.created_at).toLocaleDateString('ar-SA')
                      : '—'}
                  </td>
                  <td className="p-3 font-bold text-[#111827]">{rec.basket?.name || rec.basket_name || 'سلة دعم'}</td>
                  <td className="p-3 text-[#4B5563]">{rec.pickup_location || 'مقر الجمعية'}</td>
                  <td className="p-3 text-[#4B5563]">{rec.driver?.full_name || rec.executed_by || 'الإدارة'}</td>
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
