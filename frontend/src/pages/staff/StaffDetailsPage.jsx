import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import staffApi from "../../api/staffApi";
import MainLayout from "../../components/layout/MainLayout";
import { Briefcase, Home, Users, FileText, ArrowRight, Package } from "lucide-react";

export default function StaffDetailsPage() {
  const { id } = useParams();
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [activeTab, setActiveTab] = useState("info");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    staffApi
      .get(id)
      .then((res) => setSelectedStaff(res.data.data ?? res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <MainLayout>
        <div className="p-12 text-center text-gray-500 font-bold" dir="rtl">
          جاري تحميل بيانات الموظف...
        </div>
      </MainLayout>
    );
  }

  if (!selectedStaff) {
    return (
      <MainLayout>
        <div className="p-12 text-center text-red-500 font-bold" dir="rtl">
          ❌ الموظف غير موجود أو تم حذفه.
          <div className="mt-4">
            <Link to="/staff" className="text-amber-700 underline text-xs">
              ← العودة لقائمة الموظفين
            </Link>
          </div>
        </div>
      </MainLayout>
    );
  }

  const cleanDate = (d) => (d ? String(d).slice(0, 10) : "—");

  return (
    <MainLayout>
      <div className="p-6 max-w-4xl mx-auto" dir="rtl">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">📋 بطاقة الموظف التفصيلية</h1>
          <Link to="/staff" className="text-amber-700 hover:underline text-xs font-bold flex items-center gap-1">
            <ArrowRight className="w-4 h-4" />
            <span>العودة لقائمة الموظفين</span>
          </Link>
        </div>

        {/* ─── Standardized Card Design ─── */}
        <div className="bg-white rounded-3xl max-w-3xl mx-auto shadow-2xl border border-gray-100 overflow-hidden">
          {/* Header Banner */}
          <div className="p-5 bg-gradient-to-r from-amber-600 to-amber-700 text-white rounded-t-3xl flex justify-between items-center">
            <div>
              <h3 className="font-bold text-xl">{selectedStaff.name}</h3>
              <p className="text-xs text-amber-100 mt-0.5">
                {selectedStaff.job_title} | {selectedStaff.department || "عام"}
              </p>
            </div>
            <a
              href={`${import.meta.env.VITE_API_BASE_URL || (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '') : 'https://ikram-system.onrender.com')}/api/documents/staff-receipt/${selectedStaff.id}/pdf`}
              target="_blank"
              rel="noreferrer"
              className="bg-white/20 hover:bg-white/30 text-white px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all border border-white/30 flex items-center gap-1.5"
              title="طباعة مستند وسند الموظف الرسمي (PDF)"
            >
              <FileText className="w-4 h-4" />
              <span>📄 طباعة المستند (PDF)</span>
            </a>
          </div>

          {/* 4 Tabs Navigation Bar */}
          <div className="flex border-b border-gray-200 bg-amber-50/50 text-xs font-bold">
            <button
              onClick={() => setActiveTab("info")}
              className={`flex-1 py-3 px-4 flex items-center justify-center gap-1.5 transition-all cursor-pointer border-b-2 ${
                activeTab === "info"
                  ? "border-amber-600 text-amber-900 bg-white font-extrabold"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              <Briefcase className="w-4 h-4" />
              <span>بيانات الموظف</span>
            </button>

            <button
              onClick={() => setActiveTab("family")}
              className={`flex-1 py-3 px-4 flex items-center justify-center gap-1.5 transition-all cursor-pointer border-b-2 ${
                activeTab === "family"
                  ? "border-amber-600 text-amber-900 bg-white font-extrabold"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              <Home className="w-4 h-4" />
              <span>بيانات الأسرة</span>
            </button>

            <button
              onClick={() => setActiveTab("dependents")}
              className={`flex-1 py-3 px-4 flex items-center justify-center gap-1.5 transition-all cursor-pointer border-b-2 ${
                activeTab === "dependents"
                  ? "border-amber-600 text-amber-900 bg-white font-extrabold"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              <Users className="w-4 h-4" />
              <span>بيانات التابعين</span>
            </button>

            <button
              onClick={() => setActiveTab("docs")}
              className={`flex-1 py-3 px-4 flex items-center justify-center gap-1.5 transition-all cursor-pointer border-b-2 ${
                activeTab === "docs"
                  ? "border-amber-600 text-amber-900 bg-white font-extrabold"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>الوثائق والمرفقات</span>
            </button>

            <button
              onClick={() => setActiveTab("history")}
              className={`flex-1 py-3 px-4 flex items-center justify-center gap-1.5 transition-all cursor-pointer border-b-2 whitespace-nowrap ${
                activeTab === "history"
                  ? "border-amber-600 text-amber-900 bg-white font-extrabold"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              <Package className="w-4 h-4" />
              <span>سجل السلات ({selectedStaff.distributions_count ?? selectedStaff.distributions?.length ?? 0})</span>
            </button>
          </div>

          {/* Tab Content Body */}
          <div className="p-6">
            {/* Tab 1: بيانات الموظف */}
            {activeTab === "info" && (
              <div className="grid md:grid-cols-2 gap-4 text-xs">
                <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100">
                  <span className="text-gray-400 block mb-0.5 font-medium">الاسم الكامل</span>
                  <span className="font-bold text-gray-900 text-sm">{selectedStaff.name}</span>
                </div>

                <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100">
                  <span className="text-gray-400 block mb-0.5 font-medium">رقم الهوية / الإقامة</span>
                  <span className="font-bold font-mono text-gray-900 text-sm">{selectedStaff.national_id || "—"}</span>
                </div>

                <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100">
                  <span className="text-gray-400 block mb-0.5 font-medium">رقم الهاتف</span>
                  <span className="font-bold font-mono text-gray-900 text-sm">{selectedStaff.phone || "—"}</span>
                </div>

                <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100">
                  <span className="text-gray-400 block mb-0.5 font-medium">البريد الإلكتروني</span>
                  <span className="font-mono text-gray-800 text-sm">{selectedStaff.email || "—"}</span>
                </div>

                <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100">
                  <span className="text-gray-400 block mb-0.5 font-medium">المسمى الوظيفي</span>
                  <span className="font-bold text-amber-900 text-sm">{selectedStaff.job_title || "—"}</span>
                </div>

                <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100">
                  <span className="text-gray-400 block mb-0.5 font-medium">القسم / الإدارة</span>
                  <span className="font-bold text-gray-800 text-sm">{selectedStaff.department || "—"}</span>
                </div>

                <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100">
                  <span className="text-gray-400 block mb-0.5 font-medium">تاريخ التعيين</span>
                  <span className="font-bold font-mono text-gray-800 text-sm">{cleanDate(selectedStaff.hire_date)}</span>
                </div>

                <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100">
                  <span className="text-gray-400 block mb-0.5 font-medium">العنوان الوطني</span>
                  <span className="font-bold text-gray-800 text-sm">{selectedStaff.national_address || "—"}</span>
                </div>
              </div>
            )}

            {/* Tab 2: بيانات الأسرة */}
            {activeTab === "family" && (
              <div className="grid md:grid-cols-2 gap-4 text-xs">
                <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-100">
                  <span className="text-amber-800 block mb-1 font-bold">عدد أفراد الأسرة</span>
                  <span className="text-lg font-extrabold text-amber-950">{selectedStaff.family_members_count ?? 1} فرد</span>
                </div>

                <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-100">
                  <span className="text-amber-800 block mb-1 font-bold">عدد الزوجات</span>
                  <span className="text-lg font-extrabold text-amber-950">{selectedStaff.wives_count ?? 1}</span>
                </div>

                <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100">
                  <span className="text-gray-400 block mb-0.5">حالة الأب</span>
                  <span className="font-bold text-gray-900">{selectedStaff.father_status === 'deceased' ? 'متوفى' : 'على قيد الحياة'}</span>
                </div>

                <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100">
                  <span className="text-gray-400 block mb-0.5">حالة الأم</span>
                  <span className="font-bold text-gray-900">{selectedStaff.mother_status === 'deceased' ? 'متوفاة' : 'على قيد الحياة'}</span>
                </div>

                <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100 md:col-span-2">
                  <span className="text-gray-400 block mb-0.5">ملكية السكن</span>
                  <span className="font-bold text-gray-900">{selectedStaff.owns_house ? 'ملك شخصي' : 'إيجار / غير ملك'}</span>
                </div>
              </div>
            )}

            {/* Tab 3: بيانات التابعين */}
            {activeTab === "dependents" && (
              <div className="text-xs">
                {selectedStaff.dependents && selectedStaff.dependents.length > 0 ? (
                  <div className="border border-gray-200 rounded-2xl overflow-hidden">
                    <table className="w-full text-right">
                      <thead className="bg-gray-100 text-gray-700 font-bold">
                        <tr>
                          <th className="p-3">#</th>
                          <th className="p-3">اسم التابع</th>
                          <th className="p-3">صلة القرابة</th>
                          <th className="p-3">تاريخ الميلاد</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {selectedStaff.dependents.map((dep, idx) => (
                          <tr key={dep.id || idx}>
                            <td className="p-3 text-gray-400">{idx + 1}</td>
                            <td className="p-3 font-bold text-gray-900">{dep.name}</td>
                            <td className="p-3 text-gray-700">{dep.relationship || "ابن/ابنة"}</td>
                            <td className="p-3 font-mono text-gray-600">{cleanDate(dep.date_of_birth)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8 text-center text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                    لا يوجد تابعون مسجلون لهذا الموظف
                  </div>
                )}
              </div>
            )}

            {/* Tab 4: الوثائق والمرفقات */}
            {activeTab === "docs" && (
              <div className="text-xs space-y-3">
                {selectedStaff.id_document_url || selectedStaff.contract_doc_url ? (
                  <div className="grid md:grid-cols-2 gap-4">
                    {selectedStaff.id_document_url && (
                      <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 text-center">
                        <p className="font-bold text-gray-800 mb-2">صورة الهوية الوطنية</p>
                        <a
                          href={selectedStaff.id_document_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-amber-700 font-bold hover:underline"
                        >
                          <span>📄 عرض الهوية</span>
                        </a>
                      </div>
                    )}
                    {selectedStaff.contract_doc_url && (
                      <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 text-center">
                        <p className="font-bold text-gray-800 mb-2">وثيقة عقد العمل</p>
                        <a
                          href={selectedStaff.contract_doc_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-amber-700 font-bold hover:underline"
                        >
                          <span>📄 عرض العقد</span>
                        </a>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-8 text-center text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                    لا توجد وثائق مرفقة مسجلة لهذا الموظف
                  </div>
                )}
              </div>
            )}

            {/* Tab 5: سجل السلات */}
            {activeTab === "history" && (
              <div className="text-xs">
                {(!selectedStaff.distributions || selectedStaff.distributions.length === 0) ? (
                  <div className="p-8 text-center text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                    لم يتم تسجيل أي استلام أو صرف سلات لهذا الموظف حتى الآن.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-gray-200 rounded-2xl">
                    <table className="w-full text-xs text-right">
                      <thead className="bg-gray-100 text-gray-700 font-bold">
                        <tr>
                          <th className="p-3">#</th>
                          <th className="p-3">تاريخ الاستلام</th>
                          <th className="p-3">نوع السلة / الدعم</th>
                          <th className="p-3">كود البار كود</th>
                          <th className="p-3">حالة الاستلام</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {selectedStaff.distributions.map((d, idx) => (
                          <tr key={d.id || idx}>
                            <td className="p-3 text-gray-400">{idx + 1}</td>
                            <td className="p-3 font-mono text-gray-800">
                              {d.delivered_at ? String(d.delivered_at).slice(0, 10) : d.scheduled_at ? String(d.scheduled_at).slice(0, 10) : "—"}
                            </td>
                            <td className="p-3 font-bold text-amber-900">
                              {d.basket?.name || d.basket_type || "سلة غذائية شاملة"}
                            </td>
                            <td className="p-3 font-mono text-gray-600">
                              {d.barcode_code || "—"}
                            </td>
                            <td className="p-3">
                              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                                d.status === "delivered"
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                  : "bg-amber-100 text-amber-800 border-amber-300"
                              }`}>
                                {d.status === "delivered" ? "تم التسليم بنجاح ✅" : "قيد المعالجة ⏳"}
                              </span>
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