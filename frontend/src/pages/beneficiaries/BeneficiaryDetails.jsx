import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import beneficiaryApi from "../../api/beneficiaries";
import MainLayout from "../../components/layout/MainLayout";

export default function BeneficiaryDetailsPage() {
  const { id } = useParams();
  const [b, setB] = useState(null);

  useEffect(() => {
    beneficiaryApi.get(id)
      .then((res) => setB(res.data.data ?? res.data))
      .catch(console.error);
  }, [id]);

  if (!b) return <p className="p-6">جارٍ التحميل...</p>;

  const Item = ({ label, value }) => (
    <div><p className="text-gray-500 text-sm">{label}</p><p className="font-bold">{value ?? "—"}</p></div>
  );

  return (
    <MainLayout>
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">تفاصيل المستفيد</h1>
        <Link to="/beneficiaries" className="text-amber-700 hover:underline">← قائمة المستفيدين</Link>
      </div>

      <div className="bg-white rounded-2xl shadow p-6 grid md:grid-cols-3 gap-6">
        <Item label="الاسم" value={b.name} />
        <Item label="رقم الهوية" value={b.national_id} />
        <Item label="رقم الهاتف" value={b.phone} />
        <Item label="تاريخ الميلاد" value={b.birth_date} />
        <Item label="مكان الميلاد" value={b.birth_place} />
        <Item label="المدينة" value={b.city} />
        <Item label="الحي" value={b.district} />
        <Item label="الشارع" value={b.street} />
      </div>

      <div className="bg-white rounded-2xl shadow p-6 grid md:grid-cols-5 gap-6">
        <Item label="عدد أفراد الأسرة" value={b.family_members_count} />
        <Item label="عدد العاملين" value={b.working_count} />
        <Item label="الأبناء غير العاملين" value={b.non_working_children} />
        <Item label="حالة الأب" value={b.father_status} />
        <Item label="حالة الأم" value={b.mother_status} />
      </div>

      <div className="bg-white rounded-2xl shadow p-6 grid md:grid-cols-4 gap-6">
        <Item label="الراتب الشهري" value={`${b.monthly_salary ?? 0} ريال`} />
        <Item label="حساب المواطن" value={`${b.citizen_account ?? 0} ريال`} />
        <Item label="الضمان الاجتماعي" value={`${b.social_security ?? 0} ريال`} />
        <Item label="إجمالي الدخل" value={`${b.total_income ?? 0} ريال`} />
      </div>
    </div>
    </MainLayout>
  );
}