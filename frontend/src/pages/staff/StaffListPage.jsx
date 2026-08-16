import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import staffApi from "../../api/staffApi";
import MainLayout from "../../components/layout/MainLayout";

const statusLabel = { active: "نشط", on_leave: "إجازة", terminated: "منتهي" };

export default function StaffListPage() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    staffApi.list()
      .then((res) => {
        const data = res.data?.data?.data ?? res.data?.data ?? res.data ?? [];
        setStaff(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error(err);
        setStaff([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleDelete = async (id) => {
    if (!window.confirm("هل أنت متأكد من حذف هذا الموظف؟")) return;
    await staffApi.remove(id);
    load();
  };

  const staffList = Array.isArray(staff) ? staff : [];

  return (
    <MainLayout>
    <div className="p-6 max-w-7xl mx-auto" dir="rtl">
      <div className="flex flex-wrap gap-3 justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">💼 موظفو الجمعية</h1>
        <div className="flex gap-2">
          <Link to="/staff/add" className="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors shadow">
            + إضافة موظف
          </Link>
          <Link to="/staff/import" className="bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 rounded-xl text-sm transition-colors shadow">
            ↑ استيراد أسماء الموظفين (Excel)
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow overflow-x-auto">
        <table className="w-full text-right text-sm">
          <thead className="bg-amber-50 text-amber-800">
            <tr>
              <th className="p-3">الاسم</th><th className="p-3">رقم الهوية</th>
              <th className="p-3">المسمى الوظيفي</th><th className="p-3">القسم</th>
              <th className="p-3">الهاتف</th><th className="p-3">الحالة</th><th className="p-3">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {staffList.map((s) => (
              <tr key={s.id} className="border-t hover:bg-gray-50 transition-colors">
                <td className="p-3 font-medium">{s.name}</td>
                <td className="p-3">{s.national_id}</td>
                <td className="p-3">{s.job_title}</td>
                <td className="p-3">{s.department || "—"}</td>
                <td className="p-3">{s.phone}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                    {statusLabel[s.status] ?? s.status}
                  </span>
                </td>
                <td className="p-3">
                  <div className="flex gap-3">
                    <Link to={`/staff/${s.id}`} className="text-blue-600 hover:underline">عرض</Link>
                    <button onClick={() => handleDelete(s.id)} className="text-red-600 hover:underline">حذف</button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && staffList.length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-gray-500">لا يوجد موظفون بعد</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
    </MainLayout>
  );
}