import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import beneficiaryApi from "../../api/beneficiaries";
import MainLayout from "../../components/layout/MainLayout";
import PageHeader from "../../components/ui/PageHeader";
import Button from "../../components/ui/Button";
import {
  User,
  Users,
  DollarSign,
  FileText,
  Package,
  ExternalLink,
  Edit
} from "lucide-react";
import ReceiptHistoryTimeline from "../../components/common/ReceiptHistoryTimeline";

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

  const getDocUrl = (url) => {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    const clean = url.startsWith("/") ? url.slice(1) : url;
    const path = clean.startsWith("storage/") ? clean : `storage/${clean}`;
    const apiBase = (import.meta.env.VITE_API_URL || "https://ikram-system.onrender.com").replace(/\/api\/?$/, "");
    return `${apiBase}/${path}`;
  };

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
        <PageHeader
          title={`بطاقة بيانات المستفيد: ${fullName}`}
          subtitle={`${isCitizen ? "مواطن سعودي" : `مقيم (${b.nationality || 'غير محدد'})`} | رقم الهوية: ${nationalId}`}
          breadcrumbs={[
            { label: "الرئيسية", href: "/" },
            { label: "إدارة المستفيدين", href: "/beneficiaries" },
            { label: fullName }
          ]}
          action={
            <div className="flex items-center gap-2">
              <Button
                variant="gold"
                size="sm"
                icon={Edit}
                as={Link}
                to={`/beneficiaries/${b.id}/edit`}
              >
                تعديل البيانات
              </Button>
              <Button
                variant="outline"
                size="sm"
                as={Link}
                to="/beneficiaries"
              >
                ← العودة للقائمة
              </Button>
            </div>
          }
        />

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
                <div>
                  <h4 className="font-bold text-gray-800 mb-2">مصادر الدخل المحددة:</h4>
                  <div className="grid md:grid-cols-2 gap-4">
                    {[["salary", "monthly_salary", "الراتب الشهري"], ["social_security", "social_security_amount", "الضمان الاجتماعي"], ["citizen_account", "citizen_account_amount", "حساب المواطن"], ["retirement", "retirement_pension", "المعاش التقاعدي"], ["family_support", "family_support", "دعم الأسرة والأقارب"]]
                      .filter(([source]) => (b.income_sources || []).includes(source))
                      .map(([source, field, label]) => <InfoBox key={source} label={label} value={`${parseFloat(b[field] || 0).toLocaleString()} ريال`} />)
                    }
                    {(!b.income_sources || b.income_sources.length === 0) && <InfoBox label="مصادر الدخل" value="لا توجد مصادر محددة" />}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <InfoBox label="إجمالي الدخل الشهري قبل الإيجار" value={`${parseFloat(b.total_income || 0).toLocaleString()} ريال`} />
                  <InfoBox label="الإيجار السنوي" value={`${parseFloat(b.annual_rent_amount || 0).toLocaleString()} ريال`} />
                  <InfoBox label="الإيجار الشهري" value={`${parseFloat(b.monthly_rent || 0).toLocaleString()} ريال`} />
                  <div className="bg-emerald-50 p-4 rounded-2xl border-2 border-emerald-600">
                    <span className="text-emerald-800 block text-[11px] font-bold">صافي الدخل الشهري بعد الإيجار</span>
                    <strong className="text-xl font-mono text-emerald-800">{parseFloat(b.net_income || 0).toLocaleString()} ريال</strong>
                  </div>
                </div>
                <div className="bg-gradient-to-r from-amber-600 to-amber-700 text-white p-3 rounded-2xl text-xs font-bold">الفئة: {b.priority === "first_class" ? "درجة أولى" : "درجة ثانية"}</div>
              </div>
            )}

            {/* TAB 4: Documents */}
            {activeTab === "documents" && (
              <div className="text-xs">
                {documentsList.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                    لا توجد وثائق مرفقة مسجلة لهذا المستفيد حالياً
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {documentsList.map((doc, i) => (
                      <div key={i} className="border border-gray-200 p-3.5 rounded-2xl bg-gray-50 flex flex-col justify-between">
                        <div>
                          <span className="text-xs font-bold text-gray-800 block mb-2">{doc.label}</span>
                          <div className="w-full h-36 bg-gray-100 rounded-xl overflow-hidden mb-3 border flex items-center justify-center relative">
                            {doc.url.toLowerCase().endsWith(".pdf") ? (
                              <div className="text-center p-4">
                                <FileText className="w-10 h-10 text-amber-600 mx-auto mb-1" />
                                <span className="font-bold text-gray-700 text-xs">مستند بصيغة PDF</span>
                              </div>
                            ) : (
                              <img
                                src={getDocUrl(doc.url)}
                                alt={doc.label}
                                className="w-full h-full object-contain p-1"
                                onError={(e) => {
                                  e.target.style.display = "none";
                                  if (e.target.nextSibling) e.target.nextSibling.style.display = "flex";
                                }}
                              />
                            )}
                            <div className="hidden absolute inset-0 items-center justify-center p-3 bg-amber-50/90 text-center">
                              <span className="font-bold text-amber-900 text-[11px]">📁 يتعذر عرض المعاينة - انقر على الزر أدناه لفتح الوثيقة</span>
                            </div>
                          </div>
                        </div>

                        <a
                          href={getDocUrl(doc.url)}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold py-2 rounded-xl text-center flex items-center justify-center gap-1 transition-colors shadow-xs"
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
              <ReceiptHistoryTimeline
                records={b.distributions || []}
                recipientName={fullName}
                recipientType="beneficiary"
                title={`سجل استلامات المستفيد: ${fullName}`}
              />
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
