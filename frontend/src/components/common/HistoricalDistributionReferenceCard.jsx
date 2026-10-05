// Historical reference only. QR generation and manual WhatsApp were retired in Phase 2B.
export default function HistoricalDistributionReferenceCard({ text, recipientName }) {
  return <section className="bg-white border rounded-xl p-4" dir="rtl"><h3 className="font-bold">مرجع توزيع تاريخي</h3><p>{recipientName}</p><p className="font-mono break-all">{text}</p><p>هذا المرجع ليس رمز تحقق للاستلام.</p><a className="inline-block border rounded-lg px-4 py-3 mt-3" href="/support-delivery">تسليم الدعم الموحد</a></section>;
}
