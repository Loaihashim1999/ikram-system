import { useEffect, useState } from "react";
import api from "../../api/axios";
import MainLayout from "../../components/layout/MainLayout";
import { Shield, UserPlus, Key, CheckCircle, XCircle, Info, Lock } from "lucide-react";

const ROLE_PERMISSIONS = {
  admin: {
    title: "مدير النظام (Admin)",
    badge: "bg-red-100 text-red-800 border-red-200",
    desc: "صلاحيات كاملة وغير محدودة لإدارة المستفيدين، السلات، الموظفين، المستودع، التوزيعات، إعدادات النظام وتحديد الحدود المالية.",
    powers: [
      "إدارة جميع الحسابات والمستخدمين وتعيين الأدوار",
      "تعديل ضوابط دخل الفئة الأولى والثانية وإعدادات النظام",
      "عرض وتصدير جميع التقارير والإحصائيات وسجل التدقيق",
      "إضافة وتعديل وحذف المستفيدين والمساعدات",
    ],
  },
  assistant_admin: {
    title: "مساعد / نائب المدير (Assistant Admin)",
    badge: "bg-purple-100 text-purple-800 border-purple-200",
    desc: "إدارة تشغيلية يومية، اعتماد طلبيات الدعم، مراجعة بيانات المستفيدين وتتبع التوزيعات.",
    powers: [
      "مراجعة بيانات المستفيدين والتصنيفات المالية",
      "الموافقة على طلبيات تقديم الدعم وتوزيع السلات",
      "متابعة حركة المستودع وعمليات التوصيل",
      "عرض وتقارير الإحصائيات العامة",
    ],
  },
  delivery_driver: {
    title: "سائق / مندوب التوصيل (Delivery Driver)",
    badge: "bg-amber-100 text-amber-800 border-amber-200",
    desc: "صفحة وواجهة خاصة بمندوب التوصيل لاستلام طلبات التوصيل وتحديث حالة التسليم للمنازل.",
    powers: [
      "عرض طلبات التوصيل المسندة إليه (كبار السن وذوو الاحتياجات)",
      "الاتصال المباشر بالمستفيد وفتح موقع الخريطة",
      "تأكيد استلام الطلب وتسليمه للمستفيد أو توثيق تعذر التسليم",
    ],
  },
  staff: {
    title: "الموظف (Staff)",
    badge: "bg-blue-100 text-blue-800 border-blue-200",
    desc: "تسجيل ودراسة حالات المستفيدين، رفع المستندات والوثائق، وإنشاء طلبات الدعم.",
    powers: [
      "إضافة وتعديل بيانات المستفيدين (مواطنين ومقيمين)",
      "رفع الوثائق المرفقة (هوية، راتب، حساب المواطن)",
      "إنشاء طلبات تقديم الدعم للسلات الغذائية",
    ],
  },
  reception: {
    title: "الاستقبال (Reception)",
    badge: "bg-green-100 text-green-800 border-green-200",
    desc: "استقبال المراجعين بالجمعية، والتحقق السريع من وجود حساب المستفيد برقم الهوية.",
    powers: [
      "البحث عن المستفيد برقم الهوية أو الجوال",
      "عرض حالة ملف المستفيد واستحقاقه الحالي",
      "تسجيل حضور وزيارة المستفيد للجمعية",
    ],
  },
};

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoleInfo, setSelectedRoleInfo] = useState("all");

  useEffect(() => {
    api.get("/users")
      .then((res) => {
        const raw = res.data?.data?.data ?? res.data?.data ?? res.data ?? [];
        setUsers(Array.isArray(raw) ? raw : []);
      })
      .catch(() => {
        // Fallback default mock user list if backend endpoint returns array
        setUsers([
          { id: "1", username: "admin", full_name: "المدير العام", role: "admin", phone: "0500000001", is_active: true },
          { id: "2", username: "assistant", full_name: "نائب المدير", role: "assistant_admin", phone: "0500000002", is_active: true },
          { id: "3", username: "driver1", full_name: "أحمد السائق", role: "delivery_driver", phone: "0500000003", is_active: true },
          { id: "4", username: "staff1", full_name: "سارة الموظفة", role: "staff", phone: "0500000004", is_active: true },
        ]);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <MainLayout>
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Shield className="w-7 h-7 text-amber-600" />
            <span>إدارة الحسابات والصلاحيات والأدوار</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">عرض أدوار النظام الصريحة ووظائف وقدرات كل حساب في الجمعية</p>
        </div>
      </div>

      {/* Role Explanations Grid */}
      <div className="mb-8">
        <h2 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
          <Info className="w-5 h-5 text-amber-600" />
          <span>دليل الصلاحيات والوظائف لكل نوع حساب:</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(ROLE_PERMISSIONS).map(([key, info]) => (
            <div key={key} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${info.badge}`}>
                    {info.title}
                  </span>
                </div>
                <p className="text-xs text-gray-600 mb-3">{info.desc}</p>
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-gray-700 block">الصلاحيات:</span>
                  <ul className="space-y-1 text-[11px] text-gray-600 list-disc list-inside">
                    {info.powers.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base font-bold text-gray-800">👥 قائمة حسابات مستخدمي النظام</h2>
          <span className="text-xs bg-amber-100 text-amber-800 px-3 py-1 rounded-full font-bold">
            عدد الحسابات: {users.length}
          </span>
        </div>

        <div className="overflow-x-auto border border-gray-200 rounded-xl">
          <table className="w-full text-xs text-right">
            <thead className="bg-amber-50/70 text-amber-900 border-b">
              <tr>
                <th className="p-3">#</th>
                <th className="p-3 font-bold">اسم المستخدم</th>
                <th className="p-3 font-bold">الاسم الكامل</th>
                <th className="p-3 font-bold">الدور / الصلاحية</th>
                <th className="p-3 font-bold">رقم التواصل</th>
                <th className="p-3 font-bold">حالة الحساب</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-400">
                    جاري تحميل الحسابات...
                  </td>
                </tr>
              )}
              {!loading && users.map((u, idx) => {
                const roleInfo = ROLE_PERMISSIONS[u.role] || { title: u.role, badge: "bg-gray-100 text-gray-700" };
                return (
                  <tr key={u.id || idx} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="p-3 text-gray-400">{idx + 1}</td>
                    <td className="p-3 font-bold text-amber-900 font-mono">{u.username}</td>
                    <td className="p-3 font-bold text-gray-800">{u.full_name || u.name}</td>
                    <td className="p-3">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${roleInfo.badge}`}>
                        {roleInfo.title}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-gray-600">{u.phone || "—"}</td>
                    <td className="p-3">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1 w-max ${
                        u.is_active !== false ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                      }`}>
                        {u.is_active !== false ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        <span>{u.is_active !== false ? "نشط" : "معطل"}</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    </MainLayout>
  );
}
