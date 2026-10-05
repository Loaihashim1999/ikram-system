import { Link, useNavigate } from 'react-router-dom';
import MainLayout from '../../components/layout/MainLayout';
import SmartExcelImport from '../../components/common/SmartExcelImport';

export default function StaffImportPage() {
  const navigate = useNavigate();
  return <MainLayout><div className="p-6 max-w-5xl mx-auto" dir="rtl">
    <div className="flex justify-between items-center mb-6"><div><h1 className="text-2xl font-bold">الاستيراد الذكي للموظفين</h1><p className="text-sm text-gray-500 mt-1">يدعم اختلاف أسماء الأعمدة وترتيبها وأوراق العمل.</p></div><Link to="/staff" className="text-amber-700">عودة للقائمة</Link></div>
    <div className="bg-white border rounded-2xl shadow-sm p-6"><SmartExcelImport entity="staff" onComplete={(r) => r.created > 0 && setTimeout(() => navigate('/staff'), 1200)} /></div>
  </div></MainLayout>;
}
