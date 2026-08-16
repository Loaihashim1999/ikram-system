import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import beneficiaryApi from "../../api/beneficiaries";
import distributionApi from "../../api/distributions";
import api from "../../api/axios";

/* ─── QR code helper (canvas-based, no external lib) ─────────────── */
// We use a simple canvas-based approach for the QR code display.
// For production use, install: npm install qrcode.react
// Then replace QrCell with: import { QRCodeCanvas } from 'qrcode.react';

/* ─── Inline QR fallback — text box with code, styled clearly ─────── */
const QrDisplay = ({ text }) => (
  <div className="flex flex-col items-center p-2 border rounded-lg bg-white">
    <div className="text-xs text-gray-500 mb-1">رمز الاستلام</div>
    <div className="font-mono font-bold text-lg tracking-widest text-amber-800 bg-amber-50 px-3 py-1 rounded">
      {text}
    </div>
  </div>
);

const STEPS = ["اختيار المستفيدين", "اختيار الدعم", "تحديد الموعد", "مراجعة وإرسال"];

export default function DistributionPage() {
  const [step, setStep]              = useState(0);
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [baskets, setBaskets]        = useState([]);
  const [selected, setSelected]      = useState(new Set());
  const [basketId, setBasketId]      = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [pickupLocation, setPickupLocation] = useState("");
  const [loading, setLoading]        = useState(false);
  const [submitting, setSubmitting]  = useState(false);
  const [result, setResult]          = useState(null);
  const [searchQ, setSearchQ]        = useState("");
  const [distributions, setDistributions] = useState([]);
  const [distLoading, setDistLoading] = useState(true);

  /* load data */
  useEffect(() => {
    Promise.all([
      beneficiaryApi.list({ per_page: 200 }),
      api.get("/categories"),
    ]).then(([bRes]) => {
      setBeneficiaries(bRes.data.data?.data ?? bRes.data.data ?? []);
    });

    api.get("/inventory").then((r) => {
      const items = r.data.data ?? [];
      setBaskets(items);
    });

    distributionApi.list({ per_page: 50 }).then((r) => {
      setDistributions(r.data.data?.data ?? r.data.data ?? []);
      setDistLoading(false);
    });
  }, []);

  const filteredBeneficiaries = beneficiaries.filter((b) => {
    const q = searchQ.toLowerCase();
    return (
      !q ||
      (b.full_name || b.name || "").toLowerCase().includes(q) ||
      (b.national_id || "").includes(q)
    );
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
        basket_id:       basketId,
        scheduled_at:    scheduledAt,
        pickup_location: pickupLocation || null,
      });
      setResult(res.data);
      setStep(4);

      // Refresh distributions list
      distributionApi.list({ per_page: 50 }).then((r) => {
        setDistributions(r.data.data?.data ?? r.data.data ?? []);
      });
    } catch (err) {
      alert(err.response?.data?.message || "حدث خطأ أثناء الإرسال.");
    } finally {
      setSubmitting(false);
    }
  };

  const markReceived = async (id) => {
    await distributionApi.markReceived(id);
    setDistributions((d) =>
      d.map((dist) => (dist.id === id ? { ...dist, status: "delivered" } : dist))
    );
  };

  const resendWhatsapp = async (id) => {
    await distributionApi.sendWhatsapp(id);
    alert("تم إعادة إرسال رسالة واتساب.");
  };

  /* ─── Step Classes ─── */
  const cls = {
    card:  "bg-white rounded-2xl shadow-md p-6 mb-5",
    label: "block text-sm font-semibold text-gray-700 mb-1",
    input: "w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400 text-right",
    btn:   "px-5 py-2 rounded-lg font-semibold transition-all",
  };

  return (
    <div className="p-6 max-w-6xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">📦 صفحة إرسال الدعم</h1>
      </div>

      {/* Step Indicator */}
      {step < 4 && (
        <div className="flex items-center gap-0 mb-6 overflow-x-auto pb-2">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center">
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-semibold whitespace-nowrap ${
                  i === step
                    ? "bg-amber-600 text-white"
                    : i < step
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                <span className="w-5 h-5 rounded-full bg-white/30 flex items-center justify-center text-xs font-bold">
                  {i < step ? "✓" : i + 1}
                </span>
                {s}
              </div>
              {i < STEPS.length - 1 && (
                <div className="w-6 h-0.5 bg-gray-200 mx-1" />
              )}
            </div>
          ))}
        </div>
      )}

      {/* ══ STEP 0 – اختيار المستفيدين ══ */}
      {step === 0 && (
        <div className={cls.card}>
          <h2 className="text-lg font-bold text-amber-800 mb-4">🔍 اختر المستفيدين</h2>
          <input
            value={searchQ} onChange={(e) => setSearchQ(e.target.value)}
            placeholder="بحث بالاسم أو رقم الهوية..."
            className={cls.input + " mb-3"}
          />
          <div className="overflow-x-auto max-h-96 overflow-y-auto border rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-amber-50 sticky top-0">
                <tr>
                  <th className="p-2 text-right">
                    <input type="checkbox"
                      checked={selected.size === filteredBeneficiaries.length && filteredBeneficiaries.length > 0}
                      onChange={toggleAll}
                    />
                  </th>
                  <th className="p-2 text-right">الاسم</th>
                  <th className="p-2 text-right">رقم الهوية</th>
                  <th className="p-2 text-right">المدينة</th>
                  <th className="p-2 text-right">النوع</th>
                </tr>
              </thead>
              <tbody>
                {filteredBeneficiaries.map((b) => (
                  <tr
                    key={b.id}
                    onClick={() => toggleSelect(b.id)}
                    className={`border-t cursor-pointer hover:bg-amber-50 ${selected.has(b.id) ? "bg-amber-50" : ""}`}
                  >
                    <td className="p-2">
                      <input type="checkbox" checked={selected.has(b.id)} readOnly />
                    </td>
                    <td className="p-2 font-medium">{b.full_name || b.name}</td>
                    <td className="p-2">{b.national_id}</td>
                    <td className="p-2">{b.city || "—"}</td>
                    <td className="p-2">{b.beneficiary_type === "citizen" ? "مواطن" : "مقيم"}</td>
                  </tr>
                ))}
                {filteredBeneficiaries.length === 0 && (
                  <tr><td colSpan={5} className="p-4 text-center text-gray-400">لا توجد نتائج</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-gray-500 mt-2">تم اختيار {selected.size} مستفيد</p>
        </div>
      )}

      {/* ══ STEP 1 – اختيار السلة/الدعم ══ */}
      {step === 1 && (
        <div className={cls.card}>
          <h2 className="text-lg font-bold text-amber-800 mb-4">📦 اختر نوع الدعم</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {baskets.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setBasketId(b.id)}
                className={`p-4 rounded-xl border-2 text-right transition-all ${
                  basketId === b.id
                    ? "border-amber-500 bg-amber-50"
                    : "border-gray-200 hover:border-amber-300"
                }`}
              >
                <div className="font-bold text-gray-800">{b.name}</div>
                <div className="text-sm text-gray-500 mt-1">
                  المتوفر: <span className={`font-bold ${b.quantity <= 5 ? "text-red-600" : "text-green-600"}`}>
                    {b.quantity ?? b.stock_quantity ?? 0}
                  </span>
                </div>
              </button>
            ))}
            {baskets.length === 0 && (
              <p className="text-gray-400 col-span-3">لا توجد مواد في المستودع.</p>
            )}
          </div>
          {selectedBasket && selected.size > (selectedBasket.quantity ?? selectedBasket.stock_quantity ?? 0) && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              ⚠️ الكمية المتاحة ({selectedBasket.quantity ?? selectedBasket.stock_quantity}) أقل من عدد المستفيدين المختارين ({selected.size}).
            </div>
          )}
        </div>
      )}

      {/* ══ STEP 2 – تحديد الموعد ══ */}
      {step === 2 && (
        <div className={cls.card}>
          <h2 className="text-lg font-bold text-amber-800 mb-4">📅 تحديد موعد الاستلام</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className={cls.label}>تاريخ الاستلام *</label>
              <input
                type="date" value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className={cls.input} min={new Date().toISOString().split("T")[0]}
              />
            </div>
            <div>
              <label className={cls.label}>مكان الاستلام (اختياري)</label>
              <input
                type="text" value={pickupLocation}
                onChange={(e) => setPickupLocation(e.target.value)}
                className={cls.input} placeholder="مثال: مستودع جمعية إكرام - حي النزهة"
              />
            </div>
          </div>
        </div>
      )}

      {/* ══ STEP 3 – مراجعة وإرسال ══ */}
      {step === 3 && (
        <div className={cls.card}>
          <h2 className="text-lg font-bold text-amber-800 mb-4">📋 مراجعة قبل الإرسال</h2>
          <div className="grid md:grid-cols-3 gap-4 mb-4 text-center">
            <div className="bg-amber-50 rounded-xl p-4">
              <div className="text-3xl font-bold text-amber-700">{selected.size}</div>
              <div className="text-sm text-gray-500 mt-1">مستفيد مختار</div>
            </div>
            <div className="bg-green-50 rounded-xl p-4">
              <div className="text-lg font-bold text-green-700">{selectedBasket?.name || "—"}</div>
              <div className="text-sm text-gray-500 mt-1">نوع الدعم</div>
            </div>
            <div className="bg-blue-50 rounded-xl p-4">
              <div className="text-lg font-bold text-blue-700">
                {scheduledAt ? new Date(scheduledAt).toLocaleDateString("ar-SA") : "—"}
              </div>
              <div className="text-sm text-gray-500 mt-1">تاريخ الاستلام</div>
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-2 text-right">#</th>
                  <th className="p-2 text-right">الاسم</th>
                  <th className="p-2 text-right">رقم الهوية</th>
                  <th className="p-2 text-right">الهاتف</th>
                </tr>
              </thead>
              <tbody>
                {selectedBeneficiaries.map((b, i) => (
                  <tr key={b.id} className="border-t">
                    <td className="p-2 text-gray-400">{i + 1}</td>
                    <td className="p-2">{b.full_name || b.name}</td>
                    <td className="p-2">{b.national_id}</td>
                    <td className="p-2">{b.phone}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            سيتم إرسال رسالة واتساب لكل مستفيد برمز الاستلام وتاريخه، وخصم {selected.size} وحدة من المستودع.
          </p>
        </div>
      )}

      {/* ══ STEP 4 – نتيجة الإرسال ══ */}
      {step === 4 && result && (
        <div className={cls.card}>
          <div className="text-center mb-6">
            <div className="text-5xl mb-3">✅</div>
            <h2 className="text-xl font-bold text-green-700">{result.message}</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(result.distributions || []).map((d) => (
              <div key={d.id} className="border rounded-xl p-4 bg-gray-50 text-center">
                <div className="font-semibold text-gray-700 mb-2">
                  {selectedBeneficiaries.find((b) => b.id === d.beneficiary_id)?.full_name || d.beneficiary_id}
                </div>
                <QrDisplay text={d.barcode_code} />
              </div>
            ))}
          </div>
          <div className="text-center mt-6">
            <button
              onClick={() => { setStep(0); setSelected(new Set()); setResult(null); setBasketId(""); setScheduledAt(""); }}
              className={cls.btn + " bg-amber-100 text-amber-800 hover:bg-amber-200"}
            >
              إرسال دفعة جديدة
            </button>
          </div>
        </div>
      )}

      {/* Navigation */}
      {step < 4 && (
        <div className="flex justify-between mt-4">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className={cls.btn + " bg-gray-100 text-gray-600 disabled:opacity-40 hover:bg-gray-200"}
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
              className={cls.btn + " bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-40"}
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
              {submitting ? "⏳ جاري الإرسال..." : "✅ إرسال الدعم"}
            </button>
          )}
        </div>
      )}

      {/* ══ Distribution History ══ */}
      <div className={cls.card + " mt-8"}>
        <h2 className="text-lg font-bold text-amber-800 mb-4">📋 سجل التوزيعات</h2>
        {distLoading ? (
          <p className="text-gray-400 text-center py-4">جاري التحميل...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-amber-50 text-amber-800">
                <tr>
                  <th className="p-2 text-right">المستفيد</th>
                  <th className="p-2 text-right">نوع الدعم</th>
                  <th className="p-2 text-right">التاريخ</th>
                  <th className="p-2 text-right">رمز الاستلام</th>
                  <th className="p-2 text-right">الحالة</th>
                  <th className="p-2 text-right">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {distributions.map((d) => (
                  <tr key={d.id} className="border-t">
                    <td className="p-2">
                      {d.beneficiary?.full_name || d.beneficiary?.name || "—"}
                    </td>
                    <td className="p-2">{d.basket?.name || "—"}</td>
                    <td className="p-2">
                      {d.scheduled_at
                        ? new Date(d.scheduled_at).toLocaleDateString("ar-SA")
                        : "—"}
                    </td>
                    <td className="p-2 font-mono font-bold">{d.barcode_code}</td>
                    <td className="p-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          d.status === "delivered"
                            ? "bg-green-100 text-green-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {d.status === "delivered" ? "✓ مستلم" : "⏳ بانتظار الاستلام"}
                      </span>
                    </td>
                    <td className="p-2 flex gap-2 flex-wrap">
                      {d.status !== "delivered" && (
                        <button
                          onClick={() => markReceived(d.id)}
                          className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200 font-semibold"
                        >
                          تأكيد الاستلام
                        </button>
                      )}
                      <button
                        onClick={() => resendWhatsapp(d.id)}
                        className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded hover:bg-blue-100 font-semibold"
                      >
                        إعادة إرسال
                      </button>
                    </td>
                  </tr>
                ))}
                {distributions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-gray-400">
                      لا توجد توزيعات بعد
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
