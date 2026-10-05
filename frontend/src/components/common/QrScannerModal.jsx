import { useEffect, useRef, useState } from "react";
import { Search, X, Camera, AlertCircle } from "lucide-react";

export default function QrScannerModal({ isOpen, onClose, onScanSuccess }) {
  const [manualCode, setManualCode] = useState("");
  const [cameraError, setCameraError] = useState(null);
  const [cameraLoading, setCameraLoading] = useState(false);
  const cancelScannerRef = useRef(() => {});
  const onScanSuccessRef = useRef(onScanSuccess);

  useEffect(() => {
    onScanSuccessRef.current = onScanSuccess;
  }, [onScanSuccess]);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    let delivered = false;
    let scanner = null;
    let stopping = null;
    const stopScanner = () => {
      if (stopping) return stopping;
      if (!scanner?.isScanning) return Promise.resolve();
      stopping = scanner.stop().catch(console.error);
      return stopping;
    };
    const cancel = () => {
      cancelled = true;
      void stopScanner();
    };
    cancelScannerRef.current = cancel;

    const startScanner = async () => {
      setCameraError(null);
      setCameraLoading(true);
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        scanner = new Html5Qrcode("reader");
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          async (decodedText) => {
            if (cancelled || delivered) return;
            delivered = true;
            await stopScanner();
            if (!cancelled) onScanSuccessRef.current(decodedText);
          },
          () => { /* Ignore individual frame decoding errors. */ }
        );
        // Camera permission can resolve after the modal has been closed.
        if (cancelled) await stopScanner();
      } catch (err) {
        if (!cancelled) {
          console.error("Camera access error:", err);
          setCameraError("لم نتمكن من الوصول لكاميرا الجهاز. يرجى إعطاء صلاحية الكاميرا للمتصفح أو إدخال الرمز يدوياً.");
        }
      } finally {
        if (!cancelled) setCameraLoading(false);
      }
    };

    void startScanner();
    return cancel;
  }, [isOpen]);

  if (!isOpen) return null;

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    cancelScannerRef.current();
    onScanSuccess(manualCode.trim());
    setManualCode("");
  };

  const handleClose = () => {
    cancelScannerRef.current();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-[var(--color-border)] animate-in fade-in zoom-in duration-200">
        <div className="bg-gradient-to-r from-amber-800 to-amber-900 text-white p-5 flex justify-between items-center">
          <h3 className="font-bold text-base flex items-center gap-2">
            <Camera className="w-5 h-5 text-amber-400" />
            <span>مسح الباركود بالكاميرا الحية (Live QR Scanner)</span>
          </h3>
          <button aria-label="إغلاق الماسح" onClick={handleClose} className="p-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 text-center">
          {/* Live Video Camera View */}
          <div className="relative w-full min-h-[260px] bg-gray-900 rounded-2xl overflow-hidden border-2 border-amber-500 shadow-inner flex items-center justify-center">
            <div id="reader" className="w-full text-white font-bold text-xs" dir="ltr"></div>

            {cameraLoading && !cameraError && (
              <p role="status" className="absolute text-white text-xs">جاري تشغيل الكاميرا...</p>
            )}

            {cameraError && (
              <div className="absolute inset-0 bg-gray-900/95 p-5 flex flex-col items-center justify-center text-center text-red-400">
                <AlertCircle className="w-10 h-10 mb-2 text-red-500" />
                <p className="text-xs font-bold leading-relaxed">{cameraError}</p>
              </div>
            )}
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-[var(--color-border)]"></div>
            <span className="flex-shrink mx-4 text-xs font-bold text-[var(--color-text-muted)]">أو إدخال الرمز يدوياً</span>
            <div className="flex-grow border-t border-[var(--color-border)]"></div>
          </div>

          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="أدخل رمز الاستلام (مثال: REP-XYZ123)..."
              className="flex-1 rounded-xl border border-[var(--color-border)] px-3.5 py-2.5 text-xs text-right focus:ring-2 focus:ring-[var(--color-brand-gold)]"
            />
            <button
              type="submit"
              className="bg-[var(--color-brand-green)] hover:bg-[var(--color-brand-green-hover)] text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1 shadow-sm"
            >
              <Search className="w-4 h-4" />
              <span>بحث</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
