import { Link, useNavigate } from 'react-router-dom';
import MainLayout from '../../components/layout/MainLayout';
import SmartExcelImport from '../../components/common/SmartExcelImport';

export default function BeneficiaryImportPage() {
  const navigate = useNavigate();
  return <MainLayout><div className="p-6 max-w-5xl mx-auto" dir="rtl">
    <div className="flex justify-between items-center mb-6"><div><h1 className="text-2xl font-bold">الاستيراد الذكي للمستفيدين</h1><p className="text-sm text-gray-500 mt-1">طابق أعمدة ملفك مع حقول النظام دون قالب ثابت.</p></div><Link to="/beneficiaries" className="text-amber-700">عودة للقائمة</Link></div>
    <div className="bg-white border rounded-2xl shadow-sm p-6"><SmartExcelImport entity="beneficiaries" onComplete={(r) => r.created > 0 && setTimeout(() => navigate('/beneficiaries'), 1200)} /></div>
  </div></MainLayout>;
}
