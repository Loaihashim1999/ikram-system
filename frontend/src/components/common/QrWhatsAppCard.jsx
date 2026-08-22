import { useState, useEffect } from "react";
import QRCode from "qrcode";
import toast from "react-hot-toast";
import { MessageSquare, Copy, Check } from "lucide-react";

export default function QrWhatsAppCard({ text, recipientName, phone, detailsMessage, title = "رمز الاستلام والـ QR" }) {
  const [dataUrl, setDataUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (text) {
      QRCode.toDataURL(text, { width: 300, margin: 2 })
        .then((url) => setDataUrl(url))
        .catch((err) => console.error("QR Code Error:", err));
    }
  }, [text]);

  const rawPhone = (phone || "").replace(/[^0-9]/g, "");
  let phoneNum = rawPhone;
  if (phoneNum.startsWith("0")) phoneNum = "966" + phoneNum.slice(1);
  else if (!phoneNum.startsWith("966") && phoneNum.length === 9) phoneNum = "966" + phoneNum;
  if (!phoneNum) phoneNum = "966574917155";

  const fullMessage = detailsMessage || `مرحباً ${recipientName || "المستفيد"}،\nتسر جمعية إكرام الجود إفادتكم بتأكيد موعد السلة الغذائية.\n🔑 *رمز الاستلام والـ QR:* ${text}\nشكراً لكم.`;
  const waUrl = `https://api.whatsapp.com/send?phone=${phoneNum}&text=${encodeURIComponent(fullMessage)}`;

  const handleOpenWhatsApp = (e) => {
    e.preventDefault();
    try {
      const win = window.open(waUrl, "_blank", "noopener,noreferrer");
      if (!win || win.closed || typeof win.closed === "undefined") {
        window.location.href = waUrl;
      }
    } catch {
      window.location.href = waUrl;
    }
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(fullMessage)
      .then(() => {
        setCopied(true);
        toast.success("تم نسخ تفاصيل الرمز والرسالة بنجاح!");
        setTimeout(() => setCopied(false), 2500);
      })
      .catch(() => toast.error("تعذر نسخ النص"));
  };

  return (
    <div className="bg-white border border-amber-200 rounded-2xl p-4 shadow-sm flex flex-col items-center text-center space-y-3" dir="rtl">
      <div className="text-xs font-bold text-amber-900">{title}</div>

      {dataUrl ? (
        <img
          src={dataUrl}
          alt={`QR ${text}`}
          className="w-40 h-40 border-2 border-amber-300 p-2 bg-white rounded-xl shadow-xs"
        />
      ) : (
        <div className="w-40 h-40 bg-amber-50 border-2 border-amber-200 rounded-xl flex items-center justify-center text-xs text-amber-800 animate-pulse">
          جاري توليد الـ QR...
        </div>
      )}

      <div className="font-mono font-extrabold text-lg text-amber-900 tracking-wider bg-amber-50 px-4 py-1.5 rounded-xl border border-amber-200">
        {text}
      </div>

      <div className="flex flex-col w-full gap-2 pt-1">
        <a
          href={waUrl}
          onClick={handleOpenWhatsApp}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
        >
          <MessageSquare className="w-4 h-4" />
          <span>إرسال عبر واتساب 💬</span>
        </a>

        <button
          type="button"
          onClick={handleCopyText}
          className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-gray-200"
        >
          {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-gray-500" />}
          <span>{copied ? "تم نسخ الرسالة ✓" : "نسخ نص التفاصيل والرمز 📋"}</span>
        </button>
      </div>
    </div>
  );
}
