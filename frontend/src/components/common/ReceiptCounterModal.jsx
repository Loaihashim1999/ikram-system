import { useState, useEffect } from "react";
import api from "../../api/axios";
import { X, PackageCheck, Calendar, FileText } from "lucide-react";

export default function ReceiptCounterModal({ isOpen, onClose, recipient, recipientType = 'beneficiary' }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && recipient?.id) {
      setLoading(true);
      if (recipientType === 'representative') {
        api.get(`/neighborhood-reps/${recipient.id}`)
          .then(async (res) => {
            const data = res.data?.data;
            let list = data?.representative?.rep_distributions || data?.representative?.repDistributions || [];
            if (!list || list.length === 0) {
              const benList = data?.linked_beneficiaries || [];
              const benIds = benList.map(b => b.id).filter(Boolean);
              if (benIds.length > 0) {
                const distsRes = await api.get("/distributions").catch(() => ({ data: { data: [] } }));
                const allDists = distsRes.data?.data?.data ?? distsRes.data?.data ?? [];
                list = allDists.filter(d => benIds.includes(d.beneficiary_id));
              }
            }
            setHistory(Array.isArray(list) ? list : []);
          })
          .catch(console.error)
          .finally(() => setLoading(false));
      } else {
        api.get("/distributions", { params: { beneficiary_id: recipient.id } })
          .then((res) => {
            const raw = res.data?.data?.data ?? res.data?.data ?? res.data ?? [];
            setHistory(Array.isArray(raw) ? raw : []);
          })
          .catch(console.error)
          .finally(() => setLoading(false));
      }
    }
  }, [isOpen, recipient, recipientType]);

  if (!isOpen || !recipient) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden border border-amber-100 animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-800 to-amber-900 text-white p-5 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-lg flex items-center gap-2">
              <PackageCheck className="w-6 h-6 text-amber-400" />
              <span>سجل الاستلام وعدّاد السلال</span>
            </h3>
            <p className="text-xs text-amber-200 mt-1">
              المستفيد: {recipient.full_name || recipient.name} | رقم الهوية: {recipient.national_id || "—"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrim Overlay Content */}
        <div className="p-6">
          {/* Summary Box */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 mb-5 flex justify-around text-center">
            <div>
              <div className="text-xs font-semibold text-gray-500">عدد مرات الاستلام الكلي</div>
              <div className="text-3xl font-black text-amber-900 mt-1">{history.length} مرة</div>
            </div>
            <div className="border-r border-amber-200"></div>
            <div>
              <div className="text-xs font-semibold text-gray-500">حالة الدفعة الأخيرة</div>
              <div className="text-base font-bold text-green-700 mt-2">
                {history[0]?.status === 'delivered' ? '✓ تم تسليمها' : history[0] ? '⏳ قيد التوصيل' : 'لا يوجد استلام سابق'}
              </div>
            </div>
          </div>

          <h4 className="font-bold text-gray-800 text-xs mb-3 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-amber-600" />
            <span>تفاصيل السلال المستلمة سابقاً:</span>
          </h4>

          <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-xl">
            <table className="w-full text-xs text-right">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3 font-bold">نوع السلة / المادة</th>
                  <th className="p-3 font-bold">تاريخ الاستلام</th>
                  <th className="p-3 font-bold">رمز الباركود</th>
                  <th className="p-3 font-bold">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={5} className="p-6 text-center text-gray-400">جاري التحميل...</td></tr>
                )}
                {!loading && history.map((d, idx) => (
                  <tr key={d.id || idx} className="border-b hover:bg-gray-50">
                    <td className="p-3 text-gray-400">{idx + 1}</td>
                    <td className="p-3 font-bold text-gray-800">{d.basket?.name || "سلة مساعدة"}</td>
                    <td className="p-3 text-gray-600">{d.scheduled_at ? new Date(d.scheduled_at).toLocaleDateString("ar-SA") : "—"}</td>
                    <td className="p-3 font-mono font-bold text-amber-800">{d.barcode_code}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${d.status === 'delivered' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'}`}>
                        {d.status === 'delivered' ? 'تم الاستلام' : 'قيد التوزيع'}
                      </span>
                    </td>
                  </tr>
                ))}
                {!loading && history.length === 0 && (
                  <tr><td colSpan={5} className="p-6 text-center text-gray-400">لم يسبق للمستفيد استلام سلال حتى الآن</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex justify-between items-center">
            <a
              href={`${import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'}/api/documents/total-delivery/${recipient.id}/pdf`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-sm"
            >
              <FileText className="w-4 h-4" />
              <span>تصدير سند الاستلام الشامل (PDF)</span>
            </a>

            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-gray-100 text-gray-700 font-bold text-xs hover:bg-gray-200"
            >
              إغلاق
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
