import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import beneficiaryApi from "../../api/beneficiaries";
import MainLayout from "../../components/layout/MainLayout";
import {
  User,
  MapPin,
  Users,
  DollarSign,
  FileText,
  Package,
  ExternalLink,
  ArrowRight
} from "lucide-react";

export default function BeneficiaryDetailsPage() {
  const { id } = useParams();
  const [b, setB] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("basic");

  useEffect(() => {
    setLoading(true);
    beneficiaryApi.get(id)
      .then((res) => {
        const raw = res.data?.data ?? res.data;
        setB(raw);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <MainLayout>
        <div className="p-12 text-center text-gray-500" dir="rtl">
          <div className="inline-block w-8 h-8 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mb-2" />
          <p className="font-bold text-sm">جاري تحميل بيانات المستفيد...</p>
        </div>
      </MainLayout>
    );
  }

  if (!b) {
    return (
      <MainLayout>
        <div className="p-12 text-center text-red-500 font-bold" dir="rtl">
          ❌ لم يتم العثور على المستفيد أو تم حذفه.
          <div className="mt-4">
            <Link to="/beneficiaries" className="text-amber-700 underline text-xs">العودة لقائمة المستفيدين</Link>
          </div>
        </div>
      </MainLayout>
    );
  }

  const cleanDate = (d) => (d ? String(d).substring(0, 10) : "—");

  const fullName = b.full_name || b.name || "مستفيد غير معنون";
  const nationalId = b.national_id || "—";
  const phone = b.phone || "—";
  const dateOfBirth = cleanDate(b.date_of_birth || b.birth_date);
  const placeOfBirth = b.place_of_birth || b.birth_place || "—";

  const isCitizen = (b.beneficiary_type || b.type) === "citizen";

  const documentsList = [
    { label: "صورة الهوية الوطنية / الإقامة", url: b.national_id_image_url || b.residence_id_image_url },
    { label: "إثبات حساب المواطن / الراتب", url: b.citizen_account_image_url || b.salary_certificate_url },
    { label: "مشهد الضمان الاجتماعي", url: b.social_security_image_url },
    { label: "صورة راتب التقاعد", url: b.pension_certificate_image_url },
    { label: "عقد الإيجار / فاتورة الكهرباء", url: b.rental_contract_image_url || b.electricity_bill_image_url },
    { label: "إثبات العنوان الوطني", url: b.national_address_image_url },
  ].filter(d => !!d.url);

  return (
    <MainLayout>
      <div className="p-6 max-w-4xl mx-auto" dir="rtl">
        {/* Page Top Action Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">📋 بطاقة بيانات المستفيد الشاملة</h1>
          <div className="flex items-center gap-2">
            <Link
              to={`/beneficiaries/${b.id}/edit`}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-sm transition-all"
            >
              تعديل البيانات
            </Link>
            <Link
              to="/beneficiaries"
              className="text-amber-700 hover:underline text-xs font-bold flex items-center gap-1"
            >
              <ArrowRight className="w-4 h-4" />
              <span>العودة لقائمة المستفيدين</span>
            </Link>
          </div>
        </div>

        {/* ─── Standardized Amber Card Container ─── */}
        <div className="bg-white rounded-3xl max-w-3xl mx-auto shadow-2xl border border-gray-100 overflow-hidden">
          {/* Amber Header Banner */}
          <div className="p-5 bg-gradient-to-r from-amber-600 to-amber-700 text-white rounded-t-3xl flex justify-between items-center">
            <div>
              <h3 className="font-bold text-xl">{fullName}</h3>
              <p className="text-xs text-amber-100 mt-0.5">
                {isCitizen ? "مواطن سعودي" : `مقيم (${b.nationality || 'غير محدد'})`} | رقم الهوية: {nationalId}
              </p>
            </div>
            <div className="bg-white/20 backdrop-blur-xs px-3 py-1 rounded-xl text-xs font-bold border border-white/30">
              {b.priority === "first_class" ? "درجة أولى" : b.priority === "second_class" ? "درجة ثانية" : "مستفيد"}
            </div>
          </div>

          {/* Navigation Tabs Bar */}
          <div className="flex border-b border-gray-200 bg-amber-50/50 text-xs font-bold overflow-x-auto">
            <button
              onClick={() => setActiveTab("basic")}
              className={`flex-1 py-3.5 px-3 flex items-center justify-center gap-1.5 transition-all cursor-pointer border-b-2 whitespace-nowrap ${
                activeTab === "basic"
                  ? "border-amber-600 text-amber-900 bg-white font-extrabold"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              <User className="w-4 h-4" />
              <span>بيانات المستفيد</span>
            </button>

            <button
              onClick={() => setActiveTab("family")}
              className={`flex-1 py-3.5 px-3 flex items-center justify-center gap-1.5 transition-all cursor-pointer border-b-2 whitespace-nowrap ${
                activeTab === "family"
                  ? "border-amber-600 text-amber-900 bg-white font-extrabold"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              <Users className="w-4 h-4" />
              <span>الأسرة والتابعين</span>
            </button>

            <button
              onClick={() => setActiveTab("financial")}
              className={`flex-1 py-3.5 px-3 flex items-center justify-center gap-1.5 transition-all cursor-pointer border-b-2 whitespace-nowrap ${
                activeTab === "financial"
                  ? "border-amber-600 text-amber-900 bg-white font-extrabold"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              <DollarSign className="w-4 h-4" />
              <span>البيانات المالية والدخل</span>
            </button>

            <button
              onClick={() => setActiveTab("documents")}
              className={`flex-1 py-3.5 px-3 flex items-center justify-center gap-1.5 transition-all cursor-pointer border-b-2 whitespace-nowrap ${
                activeTab === "documents"
                  ? "border-amber-600 text-amber-900 bg-white font-extrabold"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>الوثائق والمرفقات</span>
            </button>

            <button
              onClick={() => setActiveTab("history")}
              className={`flex-1 py-3.5 px-3 flex items-center justify-center gap-1.5 transition-all cursor-pointer border-b-2 whitespace-nowrap ${
                activeTab === "history"
                  ? "border-amber-600 text-amber-900 bg-white font-extrabold"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              <Package className="w-4 h-4" />
              <span>سجل السلات ({b.distributions?.length || 0})</span>
            </button>
          </div>

          {/* Tab Content Body */}
          <div className="p-6">
            {/* TAB 1: Basic & National Address */}
            {activeTab === "basic" && (
              <div className="grid md:grid-cols-2 gap-4 text-xs">
                <InfoBox label="الاسم الكامل" value={fullName} />
                <InfoBox label="رقم الهوية الوطنية / الإقامة" value={nationalId} isMono />
                <InfoBox label="رقم الهاتف الفعال" value={phone} isMono />
                <InfoBox label="تاريخ الميلاد" value={dateOfBirth} />
                <InfoBox label="مكان الميلاد" value={placeOfBirth} />
                <InfoBox label="نوع المستفيد" value={isCitizen ? "مواطن" : "مقيم"} />
                {!isCitizen && (
                  <>
                    <InfoBox label="الجنسية" value={b.nationality} />
                    <InfoBox label="المهنة الحالية" value={b.profession} />
                  </>
                )}
                <InfoBox label="المدينة" value={b.city} />
                <InfoBox label="اسم الحي السكني" value={b.district} />
                <InfoBox label="الشارع / المعلم" value={b.street} />
              </div>
            )}

            {/* TAB 2: Family & Dependents */}
            {activeTab === "family" && (
              <div className="space-y-4 text-xs">
                <div className="grid md:grid-cols-2 gap-4">
                  <InfoBox label="الحالة الاجتماعية" value={b.family_status} />
                  <InfoBox label="إجمالي أفراد الأسرة" value={b.family_members_count} />
                  <InfoBox label="عدد العاملين بالأسرة" value={b.working_members_count || b.working_count} />
                  <InfoBox label="عدد الأبناء غير العاملين" value={b.non_working_children_count || b.non_working_children} />
                  <InfoBox label="ذوو الاحتياجات الخاصة (الإعاقة)" value={b.has_special_needs ? "نعم (مفعل)" : "لا"} />
                  <InfoBox label="نوع السكن الحالي" value={b.housing_type === "rent" ? "إيجار" : "ملك"} />
                  {b.housing_type === "rent" && (
                    <InfoBox label="مبلغ الإيجار السنوي" value={b.annual_rent_amount ? `${b.annual_rent_amount} ريال` : "—"} />
                  )}
                </div>

                <div className="pt-2">
                  <h4 className="font-bold text-gray-800 mb-2">جدول المعالين والتابعين المباشرين:</h4>
                  {(!b.dependents || b.dependents.length === 0) ? (
                    <div className="p-6 text-center text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                      لا يوجد معالون مضافون بهذا الحساب.
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-gray-200 rounded-2xl">
                      <table className="w-full text-xs text-right">
                        <thead className="bg-gray-100 text-gray-700 font-bold">
                          <tr>
                            <th className="p-3">#</th>
                            <th className="p-3">اسم التابع الكامل</th>
                            <th className="p-3">صلة القرابة</th>
                            <th className="p-3">تاريخ الميلاد</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {b.dependents.map((dep, idx) => (
                            <tr key={dep.id || idx}>
                              <td className="p-3 text-gray-400">{idx + 1}</td>
                              <td className="p-3 font-bold text-gray-900">{dep.name}</td>
                              <td className="p-3 text-gray-700">{dep.relationship || "—"}</td>
                              <td className="p-3 font-mono text-gray-600">{cleanDate(dep.date_of_birth)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: Financial & Income */}
            {activeTab === "financial" && (
              <div className="space-y-4 text-xs">
                <div className="grid md:grid-cols-2 gap-4">
                  <InfoBox label="الراتب الشهري الفعلي" value={b.monthly_salary ? `${b.monthly_salary} ريال` : "0 ريال"} />
                  <InfoBox label="مبلغ الضمان الاجتماعي" value={b.social_security_amount ? `${b.social_security_amount} ريال` : "0 ريال"} />
                  <InfoBox label="مبلغ حساب المواطن" value={b.citizen_account_amount ? `${b.citizen_account_amount} ريال` : "0 ريال"} />
                  <InfoBox label="المعاش التقاعدي" value={b.retirement_pension ? `${b.retirement_pension} ريال` : "0 ريال"} />
                  <InfoBox label="دعم الأسرة والأقارب" value={b.family_support ? `${b.family_support} ريال` : "0 ريال"} />
                  <InfoBox label="اسم البنك" value={b.bank_name} />
                </div>

                <div className="bg-gradient-to-r from-amber-600 to-amber-700 text-white p-4 rounded-2xl flex items-center justify-between shadow-md">
                  <div>
                    <span className="text-[11px] font-bold block opacity-90">إجمالي الدخل الشهري المحسوب بالنظام:</span>
                    <span className="text-xl font-bold font-mono">
                      {parseFloat(b.total_income || 0).toLocaleString()} ريال سعودي
                    </span>
                  </div>
                  <div className="bg-white/20 px-3 py-1.5 rounded-xl text-xs font-bold border border-white/30">
                    الفئة: {b.priority === "first_class" ? "درجة أولى" : "درجة ثانية"}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: Documents */}
            {activeTab === "documents" && (
              <div className="text-xs">
                {documentsList.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                    لا توجد وثائق مرفقة مسجلة لهذا المستفيد
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {documentsList.map((doc, i) => (
                      <div key={i} className="border border-gray-200 p-3.5 rounded-2xl bg-gray-50 flex flex-col justify-between">
                        <div>
                          <span className="text-xs font-bold text-gray-800 block mb-2">{doc.label}</span>
                          <div className="w-full h-32 bg-gray-200 rounded-xl overflow-hidden mb-3 border flex items-center justify-center">
                            <img
                              src={`/storage/${doc.url}`}
                              alt={doc.label}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = "/assets/ekram-letterhead.jpeg";
                              }}
                            />
                          </div>
                        </div>

                        <a
                          href={`/storage/${doc.url}`}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold py-2 rounded-xl text-center flex items-center justify-center gap-1 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>فتح وتنزيل المستند</span>
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 5: History */}
            {activeTab === "history" && (
              <div className="text-xs">
                {(!b.distributions || b.distributions.length === 0) ? (
                  <div className="p-8 text-center text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                    لم يقم المستفيد باستلام أي سلال غذائية حتى الآن.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-gray-200 rounded-2xl">
                    <table className="w-full text-xs text-right">
                      <thead className="bg-gray-100 text-gray-700 font-bold">
                        <tr>
                          <th className="p-3">#</th>
                          <th className="p-3">تاريخ الاستلام</th>
                          <th className="p-3">نوع السلة</th>
                          <th className="p-3">السائق المسلم</th>
                          <th className="p-3">حالة الاستلام</th>
                          <th className="p-3 text-center">إجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {b.distributions.map((d, i) => (
                          <tr key={d.id || i}>
                            <td className="p-3 text-gray-400">{i + 1}</td>
                            <td className="p-3 font-mono text-gray-800">{cleanDate(d.delivered_at || d.created_at)}</td>
                            <td className="p-3 font-bold text-amber-900">{d.basket_type || "سلة غذائية شاملة"}</td>
                            <td className="p-3 text-gray-700">{d.driver_name || d.driver?.name || "السائق الرسمي"}</td>
                            <td className="p-3 font-bold text-emerald-700">تم التسليم بنجاح ✅</td>
                            <td className="p-3 text-center">
                              <a
                                href={`${import.meta.env.VITE_API_BASE_URL || (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '') : 'https://ikram-system.onrender.com')}/api/documents/individual-receipt/${d.id}/pdf`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-amber-700 hover:underline font-bold"
                              >
                                📄 طباعة السند
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

function InfoBox({ label, value, isMono = false }) {
  return (
    <div className="bg-gray-50/90 p-3.5 rounded-2xl border border-gray-100">
      <span className="text-gray-400 block mb-0.5 font-medium text-[11px]">{label}</span>
      <span className={`text-xs font-bold text-gray-900 block ${isMono ? 'font-mono' : ''}`}>
        {value !== null && value !== undefined && value !== "" ? value : "—"}
      </span>
    </div>
  );
}