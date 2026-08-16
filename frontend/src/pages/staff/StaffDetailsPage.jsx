import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import staffApi from "../../api/staffApi";
import MainLayout from "../../components/layout/MainLayout";

export default function StaffDetailsPage() {
  const { id } = useParams();
  const [staff, setStaff] = useState(null);

  useEffect(() => {
    staffApi.get(id)
      .then((res) => setStaff(res.data.data ?? res.data))
      .catch(console.error);
  }, [id]);

  if (!staff) return <p className="p-6">جارٍ التحميل...</p>;

  const Item = ({ label, value }) => (
    <div><p className="text-gray-500 text-sm">{label}</p><p className="font-bold">{value ?? "—"}</p></div>
  );

  return (
    <MainLayout>
    <div className="p-6" dir="rtl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">تفاصيل الموظف</h1>
        <Link to="/staff" className="text-amber-700 hover:underline">← قائمة الموظفين</Link>
      </div>

      <div className="bg-white rounded-2xl shadow p-6 grid md:grid-cols-3 gap-6">
        <Item label="الاسم" value={staff.name} />
        <Item label="رقم الهوية" value={staff.national_id} />
        <Item label="رقم الهاتف" value={staff.phone} />
        <Item label="البريد الإلكتروني" value={staff.email} />
        <Item label="المسمى الوظيفي" value={staff.job_title} />
        <Item label="القسم" value={staff.department} />
        <Item label="تاريخ التعيين" value={staff.hire_date} />
        <Item label="الراتب" value={`${staff.salary ?? 0} ريال`} />
        <Item label="الحالة" value={staff.status} />
      </div>
    </div>
    </MainLayout>
  );
}