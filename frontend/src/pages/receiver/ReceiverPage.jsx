import { useState } from "react";
import api from "../../api/axios";
import MainLayout from "../../components/layout/MainLayout";
import PageHeader from "../../components/ui/PageHeader";
import Button from "../../components/ui/Button";
import QrScannerModal from "../../components/common/QrScannerModal";
import StatusBadge from "../../components/ui/StatusBadge";
import { QrCode, Search, CheckCircle2, FileText, UserCheck, ShieldAlert, ArrowRight, AlertTriangle, XCircle, Clock } from "lucide-react";

export default function ReceiverPage() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState(null);
  const [codeStatus, setCodeStatus] = useState("active"); // active, used, expired, revoked
  const [previousDeliveryDate, setPreviousDeliveryDate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(null);
  const [showScanner, setShowScanner] = useState(false);

  // Check if code was marked used locally or on backend
  const checkCodeStatus = (itemData, targetCode) => {
    try {
      const storedUsed = JSON.parse(localStorage.getItem("ikram_used_qr_codes") || "{}");
      if (storedUsed[targetCode]) {
        return {
          status: "used",
          deliveredAt: storedUsed[targetCode].delivered_at,
        };
      }
    } catch {}

    const backendStatus = String(itemData?.status || "").toLowerCase();
    if (backendStatus === "delivered" || backendStatus === "used") {
      return {
        status: "used",
        deliveredAt: itemData.delivered_at || itemData.updated_at || new Date().toISOString(),
      };
    }
    if (backendStatus === "revoked" || backendStatus === "cancelled") {
      return { status: "revoked", deliveredAt: null };
    }
    if (backendStatus === "expired" || (itemData.expires_at && new Date(itemData.expires_at) < new Date())) {
      return { status: "expired", deliveredAt: null };
    }

    return { status: "active", deliveredAt: null };
  };

  const handleSearch = async (scanCode) => {
    const targetCode = scanCode || code;
    if (!targetCode.trim()) return;
    setLoading(true);
    setResult(null);
    setConfirmed(null);
    setPreviousDeliveryDate(null);

    try {
      const res = await api.get(`/receiver/scan/${targetCode.trim()}`);
      const data = res.data?.data || res.data;
      setResult(res.data);

      const statusCheck = checkCodeStatus(data, targetCode.trim());
      setCodeStatus(statusCheck.status);
      setPreviousDeliveryDate(statusCheck.deliveredAt);
    } catch (err) {
      alert(err.response?.data?.message || "لم يتم العثور على رمز الاستلام أو الباركود.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    const barcode = result?.data?.barcode_code || code;
    if (!barcode) return;

    if (codeStatus === "used") {
      alert("عذراً، هذا الرمز مستخدم مسبقاً ولا يمكن إعادة تسليمه.");
      return;
    }

    setConfirming(true);
    try {
      const res = await api.post(`/receiver/confirm/${barcode}`);
      setConfirmed(res.data);
      setCodeStatus("used");

      // Save locally to guarantee single-use enforcement even on immediate re-scan
      try {
        const storedUsed = JSON.parse(localStorage.getItem("ikram_used_qr_codes") || "{}");
        storedUsed[barcode] = {
          delivered_at: new Date().toISOString(),
          recipient: recipient?.full_name || recipient?.name || "مستفيد",
        };
        localStorage.setItem("ikram_used_qr_codes", JSON.stringify(storedUsed));
      } catch {}
    } catch (err) {
      alert(err.response?.data?.message || "حدث خطأ أثناء تأكيد الاستلام.");
    } finally {
      setConfirming(false);
    }
  };

  const recipient = result?.data?.beneficiary || result?.data?.representative;

  return (
    <MainLayout>
      <div className="space-y-6 max-w-4xl mx-auto" dir="rtl">
        {/* Page Header */}
        <PageHeader
          title="التحقق والاستلام برمز الاستجابة السريعة (QR)"
          subtitle="مسح أو إدخال رمز الاستلام لتوثيق التسليم للمستفيد أو الجهة وتأكيد الصرف المعتمد"
          badge="التحقق الفوري"
          breadcrumbs={[{ label: "التحقق والاستلام" }]}
        />

        {/* Scanner & Code Search Box */}
        <div className="bg-white rounded-2xl shadow-xs border border-[#E5E2D9] p-6 text-center">
          <div className="flex flex-col sm:flex-row gap-3 max-w-xl mx-auto">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="أدخل رمز الباركود / QR (مثال: REP-A1B2C3)..."
              className="flex-1 h-11 rounded-xl border border-[#E5E2D9] px-4 text-sm text-right font-mono focus:outline-none focus:ring-2 focus:ring-[#C9A24A] bg-[#FAF8F5]"
            />
            
            <Button
              variant="primary"
              size="md"
              icon={Search}
              loading={loading}
              onClick={() => handleSearch()}
            >
              بحث بالرمز
            </Button>

            <Button
              variant="secondary"
              size="md"
              icon={QrCode}
              onClick={() => setShowScanner(true)}
            >
              فتح الكاميرا
            </Button>
          </div>
        </div>

      {/* Result Display */}
      {result && !confirmed && (
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 space-y-6 animate-in fade-in zoom-in duration-200">
          {/* Header Card with Recipient and Code Status */}
          <div className="bg-primary-50/60 border border-primary-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <UserCheck className="w-8 h-8 text-primary-700" />
              <div>
                <h3 className="font-bold text-base text-gray-800">{recipient?.full_name || recipient?.name || "المستفيد"}</h3>
                <p className="text-xs text-gray-600">
                  {recipient?.national_id ? `رقم الهوية: ${recipient.national_id}` : `نوع الجهة: ${recipient?.organization_type || "جهة مستفيدة"}`} | الجوال: <span className="font-mono">{recipient?.phone || "—"}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="bg-primary-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold font-mono">
                {result.data.barcode_code}
              </span>
              <StatusBadge status={codeStatus} />
            </div>
          </div>

          {/* Rejection Alert If Code is Already Used */}
          {codeStatus === "used" && (
            <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-5 text-red-900 space-y-2 animate-in shake duration-300">
              <div className="flex items-center gap-2 font-black text-sm text-red-700">
                <XCircle className="w-5 h-5 text-red-600" />
                <span>⚠️ تم رفض العملية: رمز الاستلام مستخدم مسبقاً (Single-Use Only)</span>
              </div>
              <p className="text-xs text-red-800 leading-relaxed">
                هذا الرمز مخصص للاستخدام لمرة واحدة فقط وتم إثبات صرفه وتسليمه في عملية سابقة، ولا يسمح النظام بتكرار الصرف لنفس الرمز.
              </p>
              {previousDeliveryDate && (
                <div className="bg-red-100/80 p-2.5 rounded-xl text-xs font-bold text-red-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-red-700" />
                  <span>تاريخ ووقت الاستلام السابق: </span>
                  <span className="font-mono">{new Date(previousDeliveryDate).toLocaleString('ar-SA')}</span>
                </div>
              )}
            </div>
          )}

          {/* Rejection Alert If Code is Expired */}
          {codeStatus === "expired" && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 text-amber-900 space-y-2">
              <div className="flex items-center gap-2 font-black text-sm text-amber-800">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <span>⚠️ تنبيه: رمز الاستلام منتهي الصلاحية</span>
              </div>
              <p className="text-xs text-amber-800">
                لقد تجاوز هذا الرمز التاريخ المحدد للصرف. يرجى التواصل مع إدارة الجمعية لإعادة الجدولة.
              </p>
            </div>
          )}

          {/* Details Grid */}
          <div className="grid md:grid-cols-2 gap-4 text-xs">
            <div className="bg-gray-50 p-4 rounded-xl space-y-2 border border-gray-200">
              <div><strong>نوع الدعم / السلة:</strong> {result.data.basket?.name || "سلة دعم غذائية"}</div>
              <div><strong>نقطة التسليم:</strong> {result.data.pickup_location || "مقر الجمعية الرئيسي"}</div>
            </div>

            <div className="bg-gray-50 p-4 rounded-xl space-y-2 border border-gray-200">
              <div><strong>تاريخ الموعد:</strong> {result.data.scheduled_at ? new Date(result.data.scheduled_at).toLocaleDateString('ar-SA') : "اليوم"}</div>
              <div className="flex items-center gap-2">
                <strong>حالة الرمز:</strong>
                <StatusBadge status={codeStatus} />
              </div>
            </div>
          </div>

          {/* Action Button: Only enabled if code is active */}
          <div className="pt-4 border-t flex justify-center">
            {codeStatus === "active" ? (
              <button
                onClick={handleConfirm}
                disabled={confirming}
                className="bg-primary-700 hover:bg-primary-800 text-white font-black px-10 py-4 rounded-2xl text-base shadow-xl hover:shadow-2xl transition-all flex items-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-6 h-6" />
                <span>{confirming ? "⏳ جاري التوثيق والإشعار..." : "✅ تأكيد وتسليم الدعم للمستفيد (صرف لمرة واحدة)"}</span>
              </button>
            ) : (
              <div className="text-center p-3 bg-gray-100 rounded-xl text-gray-500 font-bold text-xs border border-gray-300">
                ⛔ تم تعطيل زر التسليم لأن الرمز ({codeStatus === "used" ? "مستخدم مسبقاً" : codeStatus === "expired" ? "منتهي الصلاحية" : "ملغى"})
              </div>
            )}
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
            <div className="mt-2 flex items-center justify-center gap-2">
              <span className="text-xs text-green-800">حالة الرمز الآن:</span>
              <StatusBadge status="used" label="تم التسليم بنجاح" />
            </div>
            <p className="text-xs text-green-700 mt-2 font-mono">
              تاريخ التسليم: {new Date().toLocaleString('ar-SA')}
            </p>
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
                <span>📄 طباعة سند الاستلام (PDF)</span>
              </a>
            )}

            <button
              onClick={() => {
                setResult(null);
                setConfirmed(null);
                setCode("");
                setCodeStatus("active");
                setPreviousDeliveryDate(null);
              }}
              className="bg-primary-700 hover:bg-primary-800 text-white font-bold px-6 py-3 rounded-2xl text-xs shadow-md transition-all cursor-pointer"
            >
              مسح رمز استلام آخر
            </button>
          </div>
        </div>
      )}

      {/* Camera QR Scanner Modal */}
      <QrScannerModal
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onScanSuccess={(decodedText) => {
          setCode(decodedText);
          setShowScanner(false);
          handleSearch(decodedText);
        }}
      />
    </div>
    </MainLayout>
  );
}
