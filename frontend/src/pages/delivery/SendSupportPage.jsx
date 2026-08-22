import { useState, useEffect } from "react";
import beneficiaryApi from "../../api/beneficiaries";
import distributionApi from "../../api/distributions";
import api from "../../api/axios";
import MainLayout from "../../components/layout/MainLayout";
import QrWhatsAppCard from "../../components/common/QrWhatsAppCard";

/* Inline QR / Barcode display component */
const QrDisplay = ({ text }) => {
  const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(text)}`;
  return (
    <div className="flex flex-col items-center p-4 border rounded-2xl bg-white shadow-sm">
      <div className="text-xs text-gray-500 font-bold mb-2">رمز الاستلام والـ QR المعتمد</div>
      <img
        src={qrImgUrl}
        alt={`QR Code ${text}`}
        className="w-36 h-36 border-2 border-amber-200 p-1.5 bg-white rounded-xl shadow-xs mb-3"
      />
      <div className="font-mono font-bold text-base tracking-widest text-amber-900 bg-amber-50 px-4 py-1.5 rounded-lg border border-amber-200">
        {text}
      </div>
    </div>
  );
};

const STEPS = ["اختيار المستفيدين", "اختيار سلة الدعم", "تحديد الموعد", "مراجعة وإرسال"];

export default function SendSupportPage() {
  const [step, setStep] = useState(0);
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [baskets, setBaskets] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [basketId, setBasketId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [pickupLocation, setPickupLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [searchQ, setSearchQ] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  /* Fetch beneficiaries and inventory */
  useEffect(() => {
    beneficiaryApi.list({ per_page: 500 }).then((res) => {
      setBeneficiaries(res.data.data?.data ?? res.data.data ?? []);
    });

    api.get("/inventory").then((r) => {
      setBaskets(r.data.data ?? []);
    });
  }, []);

  const filteredBeneficiaries = beneficiaries.filter((b) => {
    const q = searchQ.toLowerCase();
    const matchesQuery =
      !q ||
      (b.full_name || b.name || "").toLowerCase().includes(q) ||
      (b.national_id || "").includes(q);

    if (!matchesQuery) return false;

    if (categoryFilter === "elderly") return b.priority === "elderly" || (b.date_of_birth && new Date().getFullYear() - new Date(b.date_of_birth).getFullYear() >= 60);
    if (categoryFilter === "special_needs") return b.has_special_needs || b.priority === "special_needs";
    if (categoryFilter === "first_class") return b.priority === "first_class";
    if (categoryFilter === "second_class") return b.priority === "second_class";

    return true;
  });

  const toggleSelect = (id) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const toggleAll = () => {
    if (selected.size === filteredBeneficiaries.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredBeneficiaries.map((b) => b.id)));
    }
  };

  const selectedBasket = baskets.find((b) => b.id === basketId);
  const selectedBeneficiaries = beneficiaries.filter((b) => selected.has(b.id));

  const handleSubmit = async () => {
    if (!basketId || !scheduledAt || selected.size === 0) return;
    setSubmitting(true);
    try {
      const res = await distributionApi.create({
        beneficiary_ids: [...selected],
        basket_id: basketId,
        scheduled_at: scheduledAt,
        pickup_location: pickupLocation || null,
      });
      setResult(res.data);
      setStep(4);
    } catch (err) {
      alert(err.response?.data?.message || "حدث خطأ أثناء إرسال الدعم.");
    } finally {
      setSubmitting(false);
    }
  };

  const cls = {
    card: "bg-white rounded-2xl shadow-md p-6 mb-5 border border-gray-100",
    label: "block text-sm font-semibold text-gray-700 mb-1",
    input: "w-full rounded-xl border border-gray-300 px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-400 text-right text-sm",
    btn: "px-6 py-2.5 rounded-xl font-bold transition-all shadow-sm text-sm",
  };

  return (
    <MainLayout>
    <div className="p-6 max-w-6xl mx-auto" dir="rtl">
      {/* Title */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <span>📦</span> صفحة تقديم وإرسال الدعم
          </h1>
          <p className="text-xs text-gray-500 mt-1">تحديد المستفيدين وتخصيص السلال الغذائية وإصدار رموز الاستلام</p>
        </div>
      </div>

      {/* Step Indicator */}
      {step < 4 && (
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center">
              <div
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  i === step
                    ? "bg-amber-600 text-white shadow-md scale-105"
                    : i < step
                    ? "bg-green-100 text-green-700 border border-green-200"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                <span className="w-5 h-5 rounded-full bg-white/30 flex items-center justify-center text-xs">
                  {i < step ? "✓" : i + 1}
                </span>
                {s}
              </div>
              {i < STEPS.length - 1 && <div className="w-6 h-0.5 bg-gray-200 mx-1" />}
            </div>
          ))}
        </div>
      )}

      {/* STEP 0 - Select Beneficiaries */}
      {step === 0 && (
        <div className={cls.card}>
          <h2 className="text-base font-bold text-amber-900 mb-4 flex items-center gap-2">
            <span>🔍</span> الخطوة 1: اختيار قائمة المستفيدين
          </h2>

          {/* Filters */}
          <div className="grid md:grid-cols-2 gap-3 mb-4">
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="بحث بالاسم أو رقم الهوية..."
              className={cls.input}
            />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className={cls.input}
            >
              <option value="all">جميع المستفيدين</option>
              <option value="first_class">الفئة الأولى (أشد حاجة)</option>
              <option value="second_class">الفئة الثانية</option>
              <option value="elderly">كبار السن</option>
              <option value="special_needs">ذوو الاحتياجات الخاصة</option>
            </select>
          </div>

          <div className="overflow-x-auto max-h-96 overflow-y-auto border border-gray-200 rounded-xl">
            <table className="w-full text-xs text-right">
              <thead className="bg-amber-50/70 text-amber-900 sticky top-0 border-b">
                <tr>
                  <th className="p-3">
                    <input
                      type="checkbox"
                      checked={selected.size === filteredBeneficiaries.length && filteredBeneficiaries.length > 0}
                      onChange={toggleAll}
                      className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
                    />
                  </th>
                  <th className="p-3 font-bold">الاسم الكامل</th>
                  <th className="p-3 font-bold">رقم الهوية</th>
                  <th className="p-3 font-bold">الحالة الاجتماعية</th>
                  <th className="p-3 font-bold">المدينة والحي</th>
                  <th className="p-3 font-bold">النوع</th>
                </tr>
              </thead>
              <tbody>
                {filteredBeneficiaries.map((b) => (
                  <tr
                    key={b.id}
                    onClick={() => toggleSelect(b.id)}
                    className={`border-b cursor-pointer transition-colors ${
                      selected.has(b.id) ? "bg-amber-50 font-semibold" : "hover:bg-gray-50"
                    }`}
                  >
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selected.has(b.id)}
                        readOnly
                        className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
                      />
                    </td>
                    <td className="p-3 text-gray-800">{b.full_name || b.name}</td>
                    <td className="p-3 text-gray-600">{b.national_id}</td>
                    <td className="p-3 text-gray-600">{b.family_status || "—"}</td>
                    <td className="p-3 text-gray-600">{b.city ? `${b.city} - ${b.district || ''}` : "—"}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${b.beneficiary_type === 'citizen' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                        {b.beneficiary_type === "citizen" ? "مواطن" : "مقيم"}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredBeneficiaries.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-400">لا توجد نتائج مطابقة للشروط</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex justify-between items-center text-xs text-gray-500">
            <span>تم تحديد <strong>{selected.size}</strong> مستفيد من أصل {filteredBeneficiaries.length}</span>
          </div>
        </div>
      )}

      {/* STEP 1 - Select Basket */}
      {step === 1 && (
        <div className={cls.card}>
          <h2 className="text-base font-bold text-amber-900 mb-4 flex items-center gap-2">
            <span>🎁</span> الخطوة 2: اختيار السلة أو مادة الدعم من المستودع
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {baskets.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setBasketId(b.id)}
                className={`p-5 rounded-2xl border-2 text-right transition-all cursor-pointer ${
                  basketId === b.id
                    ? "border-amber-500 bg-amber-50/70 shadow-md"
                    : "border-gray-200 hover:border-amber-300 bg-white"
                }`}
              >
                <div className="font-bold text-gray-800 text-base mb-1">{b.name}</div>
                <div className="text-xs text-gray-500 mb-3">{b.description || "سلة دعم مخصصة للمستفيدين"}</div>
                <div className="flex justify-between items-center text-xs border-t pt-2 mt-2">
                  <span className="text-gray-600">الكمية المتوفرة:</span>
                  <span className={`font-bold text-sm ${ (b.quantity ?? b.stock_quantity ?? 0) < selected.size ? "text-red-600" : "text-green-600"}`}>
                    {b.quantity ?? b.stock_quantity ?? 0} وحدة
                  </span>
                </div>
              </button>
            ))}
            {baskets.length === 0 && (
              <p className="text-gray-400 col-span-3 text-center py-6">لا توجد مواد سلال مسجلة في المستودع</p>
            )}
          </div>
          {selectedBasket && (selectedBasket.quantity ?? selectedBasket.stock_quantity ?? 0) < selected.size && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold">
              ⚠️ تنبيه: الكمية المتاحة في المستودع ({selectedBasket.quantity ?? selectedBasket.stock_quantity}) أقل من عدد المستفيدين المحدد ({selected.size}).
            </div>
          )}
        </div>
      )}

      {/* STEP 2 - Date & Schedule */}
      {step === 2 && (
        <div className={cls.card}>
          <h2 className="text-base font-bold text-amber-900 mb-4 flex items-center gap-2">
            <span>📅</span> الخطوة 3: تحديد موعد ومكان الاستلام
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className={cls.label}>تاريخ التوزيع والاحتساب *</label>
              <input
                type="date"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className={cls.input}
                min={new Date().toISOString().split("T")[0]}
              />
            </div>
            <div>
              <label className={cls.label}>مقر الاستلام / النقطة (اختياري)</label>
              <input
                type="text"
                value={pickupLocation}
                onChange={(e) => setPickupLocation(e.target.value)}
                className={cls.input}
                placeholder="مثال: مقر الجمعية الرئيسي - صالة التوزيع"
              />
            </div>
          </div>
        </div>
      )}

      {/* STEP 3 - Review */}
      {step === 3 && (
        <div className={cls.card}>
          <h2 className="text-base font-bold text-amber-900 mb-4 flex items-center gap-2">
            <span>📋</span> الخطوة 4: مراجعة وتأكيد إرسال الدعم
          </h2>
          <div className="grid md:grid-cols-3 gap-4 mb-6 text-center">
            <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4">
              <div className="text-3xl font-bold text-amber-800">{selected.size}</div>
              <div className="text-xs text-gray-600 mt-1">عدد المستفيدين المحددين</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
              <div className="text-base font-bold text-green-800">{selectedBasket?.name || "—"}</div>
              <div className="text-xs text-gray-600 mt-1">نوع السلة المختارة</div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
              <div className="text-base font-bold text-blue-800">
                {scheduledAt ? new Date(scheduledAt).toLocaleDateString("ar-SA") : "—"}
              </div>
              <div className="text-xs text-gray-600 mt-1">موعد التوزيع</div>
            </div>
          </div>

          <h4 className="font-bold text-gray-700 text-xs mb-2">قائمة المستفيدين المشمولين في هذه الدفعة:</h4>
          <div className="max-h-52 overflow-y-auto border border-gray-200 rounded-xl mb-3">
            <table className="w-full text-xs text-right">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="p-2.5">#</th>
                  <th className="p-2.5">الاسم</th>
                  <th className="p-2.5">رقم الهوية</th>
                  <th className="p-2.5">رقم الهاتف</th>
                </tr>
              </thead>
              <tbody>
                {selectedBeneficiaries.map((b, i) => (
                  <tr key={b.id} className="border-b">
                    <td className="p-2.5 text-gray-400">{i + 1}</td>
                    <td className="p-2.5 font-medium">{b.full_name || b.name}</td>
                    <td className="p-2.5">{b.national_id}</td>
                    <td className="p-2.5">{b.phone}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-amber-800 bg-amber-50 p-3 rounded-xl border border-amber-200">
            ℹ️ بمجرد التأكيد: سيتم إنشاء أمر إرسال للدعم وتوليد رمز باركود لكل مستفيد وخصم الكمية تلقائياً من المستودع.
          </p>
        </div>
      )}

      {/* STEP 4 - Confirmation Result */}
      {step === 4 && result && (
        <div className={cls.card}>
          <div className="text-center mb-6">
            <div className="text-5xl mb-2">✅</div>
            <h2 className="text-xl font-bold text-green-800">{result.message}</h2>
            <p className="text-xs text-gray-500 mt-1">تم تخصيص الدعم وتحديث رصيد المستودع بنجاح.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(result.distributions || []).map((d) => {
              const b = selectedBeneficiaries.find((item) => item.id === d.beneficiary_id);
              const code = d.barcode_code || d.qr_code || "IKRAM-SUPPORT";
              const basketName = selectedBasket?.name || "سلة دعم مخصصة";
              const dateStr = scheduledAt || new Date().toISOString().split("T")[0];
              const locStr = pickupLocation || "توصيل للمنزل / مقر الجمعية";

              const textMsg = `مرحباً ${b?.full_name || b?.name || "المستفيد"}،
تسر جمعية إكرام الجود إفادتكم بتأكيد موعد وتخصيص السلة الغذائية:
👤 *اسم المستفيد:* ${b?.full_name || b?.name || "المستفيد"}
🪪 *رقم الهوية:* ${b?.national_id || "—"}
📦 *سلة الدعم:* ${basketName}
🔑 *رمز الاستلام والـ QR:* ${code}
📅 *تاريخ التوزيع:* ${dateStr}
📍 *موقع الاستلام:* ${locStr}

يمكنكم حفظ صورة الـ QR وإبرازها عند الاستلام. شكراً لكم.`;

              return (
                <div key={d.id} className="flex flex-col justify-between">
                  <QrWhatsAppCard
                    text={code}
                    recipientName={b?.full_name || b?.name}
                    phone={b?.phone}
                    detailsMessage={textMsg}
                    title={`المستفيد: ${b?.full_name || b?.name}`}
                  />
                </div>
              );
            })}
          </div>
          <div className="text-center mt-8">
            <button
              onClick={() => {
                setStep(0);
                setSelected(new Set());
                setResult(null);
                setBasketId("");
                setScheduledAt("");
              }}
              className={cls.btn + " bg-amber-600 text-white hover:bg-amber-700"}
            >
              إرسال دفعة دعم جديدة
            </button>
          </div>
        </div>
      )}

      {/* Wizard controls */}
      {step < 4 && (
        <div className="flex justify-between mt-4">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className={cls.btn + " bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40"}
          >
            ← السابق
          </button>
          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={
                (step === 0 && selected.size === 0) ||
                (step === 1 && !basketId) ||
                (step === 2 && !scheduledAt)
              }
              className={cls.btn + " bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-40"}
            >
              التالي →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className={cls.btn + " bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"}
            >
              {submitting ? "⏳ جاري الاعتماد والتوزيع..." : "✅ تأكيد واعتماد الدعم"}
            </button>
          )}
        </div>
      )}
    </div>
    </MainLayout>
  );
}
