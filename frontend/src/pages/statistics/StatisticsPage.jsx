import { useEffect, useState } from "react";
import beneficiaryApi from "../../api/beneficiaries";
import MainLayout from "../../components/layout/MainLayout";
import { BarChart3, FileSpreadsheet, Printer, Users, HeartHandshake, Award } from "lucide-react";

export default function StatisticsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    beneficiaryApi.list({ per_page: 1000 })
      .then((res) => {
        const raw = res.data?.data?.data ?? res.data?.data ?? res.data ?? [];
        setItems(Array.isArray(raw) ? raw : []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Stats Calculations
  const total = items.length;
  const citizens = items.filter((b) => (b.beneficiary_type || b.type) === "citizen").length;
  const residents = items.filter((b) => (b.beneficiary_type || b.type) === "resident").length;

  const firstClass = items.filter((b) => b.priority === "first_class").length;
  const secondClass = items.filter((b) => b.priority === "second_class").length;
  const specialNeeds = items.filter((b) => b.priority === "special_needs" || b.has_special_needs).length;
  const elderly = items.filter((b) => b.priority === "elderly" || (b.date_of_birth && new Date().getFullYear() - new Date(b.date_of_birth).getFullYear() >= 60)).length;
  const employees = items.filter((b) => b.priority === "employee" || b.is_employee).length;

  const totalMonthlyIncomeSum = items.reduce((sum, b) => {
    const inc = (parseFloat(b.monthly_salary) || 0) +
                (parseFloat(b.citizen_account_amount) || 0) +
                (parseFloat(b.social_security_amount) || 0) +
                (parseFloat(b.retirement_pension) || 0) +
                (parseFloat(b.family_support) || 0);
    return sum + inc;
  }, 0);

  const avgIncome = total > 0 ? (totalMonthlyIncomeSum / total).toFixed(2) : 0;

  // Export to CSV / Excel
  const exportToCSV = () => {
    if (items.length === 0) return alert("لا توجد بيانات للتصدير.");
    
    const headers = ["الاسم الكامل", "رقم الهوية", "الهاتف", "النوع", "التصنيف", "المدينة", "الحي", "الراتب الشهري", "حساب المواطن", "الضمان الاجتماعي"];
    const rows = items.map((b) => [
      `"${b.full_name || b.name || ''}"`,
      `"${b.national_id || ''}"`,
      `"${b.phone || ''}"`,
      `"${(b.beneficiary_type || b.type) === 'citizen' ? 'مواطن' : 'مقيم'}"`,
      `"${b.priority === 'first_class' ? 'درجة أولى' : b.priority === 'second_class' ? 'درجة ثانية' : b.priority === 'special_needs' ? 'ذوو احتياجات' : b.priority === 'elderly' ? 'كبار السن' : b.priority === 'employee' ? 'موظف' : 'غير محدد'}"`,
      `"${b.city || ''}"`,
      `"${b.district || ''}"`,
      b.monthly_salary || 0,
      b.citizen_account_amount || 0,
      b.social_security_amount || 0,
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `تقرير_المستفيدين_إكرام_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export / Print PDF Report
  const handlePrintPDF = () => {
    window.print();
  };

  return (
    <MainLayout>
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      {/* Header & Export Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-amber-600" />
            <span>الإحصائيات والتحليل الشامل للمستفيدين</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">عرض دقيق ومفصل لتصنيفات المستفيدين والدخل المالي والتقارير</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all shadow"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>تصدير Excel (CSV)</span>
          </button>
          <button
            onClick={handlePrintPDF}
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all shadow"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة / تصدير PDF</span>
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500">إجمالي المستفيدين</p>
            <h3 className="text-2xl font-black text-amber-900 mt-1">{total}</h3>
            <p className="text-[11px] text-gray-400 mt-1">{citizens} مواطن | {residents} مقيم</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500">الدرجة الأولى والثانية</p>
            <h3 className="text-2xl font-black text-green-700 mt-1">{firstClass + secondClass}</h3>
            <p className="text-[11px] text-gray-400 mt-1">{firstClass} درجة أولى | {secondClass} درجة ثانية</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-green-700">
            <Award className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500">كبار السن وذوو الاحتياجات</p>
            <h3 className="text-2xl font-black text-purple-700 mt-1">{specialNeeds + elderly}</h3>
            <p className="text-[11px] text-gray-400 mt-1">{specialNeeds} ذوو إعاقة | {elderly} مسن</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center text-purple-700">
            <HeartHandshake className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500">متوسط الدخل الشهري</p>
            <h3 className="text-2xl font-black text-blue-800 mt-1">{avgIncome} <span className="text-xs font-normal">ر.س</span></h3>
            <p className="text-[11px] text-gray-400 mt-1">معدل جميع مصادر الدخل</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-700">
            <BarChart3 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Visual Progress Bar Chart Breakdown */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
        <h2 className="text-base font-bold text-gray-800 mb-4">📊 توزيع فئات المستفيدين النسبة والتناسب</h2>
        <div className="space-y-4">
          {[
            { label: "درجة أولى (الأقل دخلاً)", count: firstClass, color: "bg-green-600", text: "text-green-700" },
            { label: "درجة ثانية (الدخل المتوسط)", count: secondClass, color: "bg-amber-500", text: "text-amber-700" },
            { label: "ذوو الاحتياجات الخاصة", count: specialNeeds, color: "bg-purple-600", text: "text-purple-700" },
            { label: "كبار السن (60 سنة فأكثر)", count: elderly, color: "bg-blue-600", text: "text-blue-700" },
            { label: "موظفو الجمعية", count: employees, color: "bg-gray-600", text: "text-gray-700" },
          ].map((cat, idx) => {
            const pct = total > 0 ? ((cat.count / total) * 100).toFixed(1) : 0;
            return (
              <div key={idx}>
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="font-bold text-gray-700">{cat.label}</span>
                  <span className={`font-bold ${cat.text}`}>{cat.count} مستفيد ({pct}%)</span>
                </div>
                <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden">
                  <div className={`${cat.color} h-full transition-all duration-500`} style={{ width: `${pct}%` }}></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detailed Analysis Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-base font-bold text-gray-800 mb-4">📋 جدول ملخص بيانات المستفيدين والتصنيفات</h2>
        
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right border-collapse">
            <thead>
              <tr className="bg-amber-50 text-amber-900 border-b border-amber-200">
                <th className="p-3 font-bold">التصنيف</th>
                <th className="p-3 font-bold">العدد الإجمالي</th>
                <th className="p-3 font-bold">نسبة المواطنين</th>
                <th className="p-3 font-bold">نسبة المقيمين</th>
                <th className="p-3 font-bold">ملاحظات آلية</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr className="hover:bg-gray-50">
                <td className="p-3 font-bold text-green-800">درجة أولى</td>
                <td className="p-3 font-mono font-bold">{firstClass}</td>
                <td className="p-3">{total > 0 ? ((items.filter(b => b.priority === "first_class" && (b.beneficiary_type || b.type) === "citizen").length / (firstClass || 1)) * 100).toFixed(0) : 0}%</td>
                <td className="p-3">{total > 0 ? ((items.filter(b => b.priority === "first_class" && (b.beneficiary_type || b.type) === "resident").length / (firstClass || 1)) * 100).toFixed(0) : 0}%</td>
                <td className="p-3 text-gray-500">الدخل الكلي أقل أو يساوي الحد الإداري (3000 ر.س)</td>
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="p-3 font-bold text-amber-800">درجة ثانية</td>
                <td className="p-3 font-mono font-bold">{secondClass}</td>
                <td className="p-3">{total > 0 ? ((items.filter(b => b.priority === "second_class" && (b.beneficiary_type || b.type) === "citizen").length / (secondClass || 1)) * 100).toFixed(0) : 0}%</td>
                <td className="p-3">{total > 0 ? ((items.filter(b => b.priority === "second_class" && (b.beneficiary_type || b.type) === "resident").length / (secondClass || 1)) * 100).toFixed(0) : 0}%</td>
                <td className="p-3 text-gray-500">الدخل الكلي بين 3001 إلى 6000 ر.س</td>
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="p-3 font-bold text-purple-800">ذوو الاحتياجات الخاصة</td>
                <td className="p-3 font-mono font-bold">{specialNeeds}</td>
                <td className="p-3">{total > 0 ? ((items.filter(b => (b.priority === "special_needs" || b.has_special_needs) && (b.beneficiary_type || b.type) === "citizen").length / (specialNeeds || 1)) * 100).toFixed(0) : 0}%</td>
                <td className="p-3">{total > 0 ? ((items.filter(b => (b.priority === "special_needs" || b.has_special_needs) && (b.beneficiary_type || b.type) === "resident").length / (specialNeeds || 1)) * 100).toFixed(0) : 0}%</td>
                <td className="p-3 text-gray-500">أولويات التوصيل المباشر للمنزل</td>
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="p-3 font-bold text-blue-800">كبار السن</td>
                <td className="p-3 font-mono font-bold">{elderly}</td>
                <td className="p-3">{total > 0 ? ((items.filter(b => (b.priority === "elderly") && (b.beneficiary_type || b.type) === "citizen").length / (elderly || 1)) * 100).toFixed(0) : 0}%</td>
                <td className="p-3">{total > 0 ? ((items.filter(b => (b.priority === "elderly") && (b.beneficiary_type || b.type) === "resident").length / (elderly || 1)) * 100).toFixed(0) : 0}%</td>
                <td className="p-3 text-gray-500">مستفيدون بعمر 60 سنة وأكثر</td>
              </tr>
              <tr className="hover:bg-gray-50">
                <td className="p-3 font-bold text-gray-800">موظفو الجمعية</td>
                <td className="p-3 font-mono font-bold">{employees}</td>
                <td className="p-3">100%</td>
                <td className="p-3">0%</td>
                <td className="p-3 text-gray-500">صفحة وحسابات الموظفين الخاصة</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
    </MainLayout>
  );
}
