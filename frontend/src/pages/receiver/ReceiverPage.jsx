import { useState } from "react";
import api from "../../api/axios";
import MainLayout from "../../components/layout/MainLayout";
import QrScannerModal from "../../components/common/QrScannerModal";
import { QrCode, Search, CheckCircle2, FileText, UserCheck, ShieldAlert, ArrowRight } from "lucide-react";

export default function ReceiverPage() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(null);
  const [showScanner, setShowScanner] = useState(false);

  const handleSearch = async (scanCode) => {
    const targetCode = scanCode || code;
    if (!targetCode.trim()) return;
    setLoading(true);
    setResult(null);
    setConfirmed(null);
    try {
      const res = await api.get(`/receiver/scan/${targetCode.trim()}`);
      setResult(res.data);
    } catch (err) {
      alert(err.response?.data?.message || "لم يتم العثور على رمز الاستلام أو الباركود.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!result?.data?.barcode_code) return;
    setConfirming(true);
    try {
      const res = await api.post(`/receiver/confirm/${result.data.barcode_code}`);
      setConfirmed(res.data);
    } catch (err) {
      alert(err.response?.data?.message || "حدث خطأ أثناء تأكيد الاستلام.");
    } finally {
      setConfirming(false);
    }
  };

  const recipient = result?.data?.beneficiary || result?.data?.representative;

  return (
    <MainLayout>
    <div className="p-6 max-w-4xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-black text-amber-900 flex items-center justify-center gap-2">
          <QrCode className="w-8 h-8 text-amber-600" />
          <span>صفحة الاستلام ومسح الـ QR (Receiver Page)</span>
        </h1>
        <p className="text-xs text-gray-500 mt-2">
          مسح أو إدخال رمز الاستلام المكون من الباركود لتوثيق التسليم للمستفيد أو مندوب الحي وتوليد السند المعتمد
        </p>
      </div>

      {/* Scanner & Code Search Box */}
      <div className="bg-white rounded-3xl shadow-md border border-amber-100 p-6 mb-8 text-center">
        <div className="flex flex-col md:flex-row gap-3 max-w-xl mx-auto">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="أدخل رمز الباركود / QR (مثال: REP-A1B2C3)..."
            className="flex-1 rounded-2xl border-2 border-amber-200 px-4 py-3 text-sm text-right font-mono focus:ring-2 focus:ring-amber-400 bg-amber-50/40"
          />
          
          <button
            onClick={() => handleSearch()}
            disabled={loading}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-6 py-3 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-md transition-all"
          >
            <Search className="w-4 h-4" />
            <span>{loading ? "جاري البحث..." : "بحث بالرمز"}</span>
          </button>

          <button
            onClick={() => setShowScanner(true)}
            className="bg-green-600 hover:bg-green-700 text-white font-bold px-5 py-3 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-md transition-all"
          >
            <QrCode className="w-4 h-4" />
            <span>فتح الكاميرا 📷</span>
          </button>
        </div>
      </div>

      {/* Result Display */}
      {result && !confirmed && (
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 space-y-6 animate-in fade-in zoom-in duration-200">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <UserCheck className="w-7 h-7 text-amber-700" />
              <div>
                <h3 className="font-bold text-base text-amber-900">{recipient?.full_name || recipient?.name}</h3>
                <p className="text-xs text-amber-700">رقم الهوية: {recipient?.national_id || "—"} | الجوال: {recipient?.phone || "—"}</p>
              </div>
            </div>
            <span className="bg-amber-600 text-white px-3 py-1 rounded-full text-xs font-bold font-mono">
              {result.data.barcode_code}
            </span>
          </div>

          <div className="grid md:grid-cols-2 gap-4 text-xs">
            <div className="bg-gray-50 p-4 rounded-xl space-y-2 border">
              <div><strong>نوع الدعم / السلة:</strong> {result.data.basket?.name || "سلة دعم غذائية"}</div>
              <div><strong>نقطة التسليم:</strong> {result.data.pickup_location || "مقر الجمعية الرئيسي"}</div>
            </div>

            <div className="bg-gray-50 p-4 rounded-xl space-y-2 border">
              <div><strong>تاريخ الموعد:</strong> {result.data.scheduled_at ? new Date(result.data.scheduled_at).toLocaleDateString('ar-SA') : "اليوم"}</div>
              <div><strong>الحالة الحالية:</strong> <span className="font-bold text-amber-700">{result.data.status === 'delivered' ? 'مُسلم مسبقاً' : 'قيد التسليم'}</span></div>
            </div>
          </div>

          <div className="pt-4 border-t flex justify-center">
            <button
              onClick={handleConfirm}
              disabled={confirming}
              className="bg-green-600 hover:bg-green-700 text-white font-black px-10 py-4 rounded-2xl text-base shadow-xl hover:shadow-2xl transition-all flex items-center gap-2"
            >
              <CheckCircle2 className="w-6 h-6" />
              <span>{confirming ? "⏳ جاري التوثيق والإشعار..." : "✅ تأكيد وتسليم الدعم للمستفيد"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Completed View */}
      {confirmed && (
        <div className="bg-green-50 border-2 border-green-300 rounded-3xl p-8 text-center space-y-6 shadow-xl animate-in zoom-in duration-200">
          <div className="w-16 h-16 bg-green-600 text-white rounded-full flex items-center justify-center mx-auto text-3xl shadow-lg">
            ✓
          </div>
          <div>
            <h2 className="text-xl font-bold text-green-900">{confirmed.message}</h2>
            <p className="text-xs text-green-700 mt-1">تم إشعار المشرف العام وتحديث السجل في قاعدة البيانات</p>
          </div>

          <div className="flex justify-center gap-4 pt-2">
            {confirmed.pdf_url && (
              <a
                href={confirmed.pdf_url}
                target="_blank"
                rel="noreferrer"
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-6 py-3 rounded-2xl text-xs shadow-md inline-flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                <span>طباعة وتصدير سند الاستلام المعتمد (PDF)</span>
              </a>
            )}

            <button
              onClick={() => {
                setResult(null);
                setConfirmed(null);
                setCode("");
              }}
              className="bg-white text-gray-700 font-bold px-6 py-3 rounded-2xl text-xs border hover:bg-gray-100"
            >
              استلام آخر 🔄
            </button>
          </div>
        </div>
      )}

      {/* Camera QR Modal */}
      <QrScannerModal
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onScanSuccess={(scannedCode) => {
          setShowScanner(false);
          setCode(scannedCode);
          handleSearch(scannedCode);
        }}
      />
    </div>
    </MainLayout>
  );
}
