import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import MainLayout from '../components/layout/MainLayout';
import api from '../api/axios';
import {
  UserPlus,
  Users,
  Briefcase,
  MapPin,
  BarChart3,
  Package,
  Truck,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    beneficiariesCount: 0,
    distributedCount: 0,
    pendingCount: 0,
    deliveredCount: 0,
    loading: true,
  });

  useEffect(() => {
    Promise.all([
      api.get('/beneficiaries').catch(() => ({ data: { data: [] } })),
      api.get('/distributions').catch(() => ({ data: { data: [] } })),
    ]).then(([bRes, dRes]) => {
      const beneficiaries = Array.isArray(bRes.data?.data) ? bRes.data.data : bRes.data?.data?.data || [];
      const distributions = Array.isArray(dRes.data?.data) ? dRes.data.data : dRes.data?.data?.data || [];

      const distributedCount = distributions.length;
      const pendingCount = distributions.filter(
        (d) => d.status === 'pending' || d.status === 'preparing' || d.status === 'ready'
      ).length;
      const deliveredCount = distributions.filter((d) => d.status === 'delivered').length;

      setStats({
        beneficiariesCount: beneficiaries.length,
        distributedCount,
        pendingCount,
        deliveredCount,
        loading: false,
      });
    }).catch(() => {
      setStats((prev) => ({ ...prev, loading: false }));
    });
  }, []);

  const cards = [
    {
      title: 'إضافة مستفيد جديد',
      description: 'تسجيل مستفيد مواطن أو مقيم جديد',
      icon: UserPlus,
      color: '#C9A24A',
      bgColor: '#F5EDDA',
      path: '/beneficiaries/add-citizen',
    },
    {
      title: 'قائمة المستفيدين',
      description: 'عرض وإدارة جميع المستفيدين',
      icon: Users,
      color: '#7C8D42',
      bgColor: '#E8EDD8',
      path: '/beneficiaries',
    },
    {
      title: 'موظفو الجمعية',
      description: 'إدارة موظفي الجمعية وسللهم',
      icon: Briefcase,
      color: '#4A90C9',
      bgColor: '#E3F0FB',
      path: '/staff',
    },
    {
      title: 'مناديب الأحياء',
      description: 'إدارة مناديب الأحياء والتوثيق',
      icon: MapPin,
      color: '#D89A2E',
      bgColor: '#FEF3D6',
      path: '/representatives',
    },
    {
      title: 'الإحصائيات',
      description: 'عرض تقارير وإحصائيات شاملة',
      icon: BarChart3,
      color: '#3B8A5E',
      bgColor: '#E6F4EC',
      path: '/statistics',
    },
    {
      title: 'المستودع',
      description: 'إدارة المخزون والسلل',
      icon: Package,
      color: '#C24B3F',
      bgColor: '#FCE8E6',
      path: '/warehouse',
    },
    {
      title: 'التوصيل المباشر',
      description: 'توصيل السلل لذوي الاحتياجات الخاصة',
      icon: Truck,
      color: '#546027',
      bgColor: '#E8EDD8',
      path: '/delivery',
    },
  ];

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto">
        {/* الترحيب */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#546027]">
            مرحباً، {user?.full_name} 👋
          </h1>
          <p className="text-[#6B6B66] mt-2">
            اختر من الأقسام أدناه للبدء في إدارة النظام
          </p>
        </div>

        {/* البطاقات السبع */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cards.map((card, index) => (
            <div
              key={index}
              onClick={() => navigate(card.path)}
              className="bg-white rounded-2xl shadow-md border border-[#E5E2D9] p-6 cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
            >
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                style={{ backgroundColor: card.bgColor }}
              >
                <card.icon size={32} style={{ color: card.color }} />
              </div>
              <h3 className="text-lg font-bold text-[#111111] mb-2">
                {card.title}
              </h3>
              <p className="text-sm text-[#6B6B66] mb-4">{card.description}</p>
              <div className="flex items-center gap-2 text-sm font-medium" style={{ color: card.color }}>
                <span>دخول</span>
                <ArrowLeft size={16} />
              </div>
            </div>
          ))}
        </div>

        {/* بطاقة الإحصائيات الحية المربوطة بالـ API */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-[#E5E2D9] p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#6B6B66] mb-1">إجمالي المستفيدين</p>
                <p className="text-3xl font-bold text-[#C9A24A]">
                  {stats.loading ? (
                    <Loader2 className="w-6 h-6 animate-spin text-[#C9A24A]" />
                  ) : (
                    stats.beneficiariesCount.toLocaleString('ar-SA')
                  )}
                </p>
              </div>
              <Users size={40} className="text-[#C9A24A]/20" />
            </div>
            <p className="text-xs text-[#3B8A5E] mt-2">بيانات مباشرة حية</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-[#E5E2D9] p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#6B6B66] mb-1">إجمالي التوزيعات</p>
                <p className="text-3xl font-bold text-[#7C8D42]">
                  {stats.loading ? (
                    <Loader2 className="w-6 h-6 animate-spin text-[#7C8D42]" />
                  ) : (
                    stats.distributedCount.toLocaleString('ar-SA')
                  )}
                </p>
              </div>
              <Package size={40} className="text-[#7C8D42]/20" />
            </div>
            <p className="text-xs text-[#3B8A5E] mt-2">بيانات مباشرة حية</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-[#E5E2D9] p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#6B6B66] mb-1">قيد الانتظار</p>
                <p className="text-3xl font-bold text-[#D89A2E]">
                  {stats.loading ? (
                    <Loader2 className="w-6 h-6 animate-spin text-[#D89A2E]" />
                  ) : (
                    stats.pendingCount.toLocaleString('ar-SA')
                  )}
                </p>
              </div>
              <BarChart3 size={40} className="text-[#D89A2E]/20" />
            </div>
            <p className="text-xs text-[#D89A2E] mt-2">حالات جاهزة للتوثيق</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-[#E5E2D9] p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#6B6B66] mb-1">تم التوصيل والإنهاء</p>
                <p className="text-3xl font-bold text-[#3B8A5E]">
                  {stats.loading ? (
                    <Loader2 className="w-6 h-6 animate-spin text-[#3B8A5E]" />
                  ) : (
                    stats.deliveredCount.toLocaleString('ar-SA')
                  )}
                </p>
              </div>
              <Truck size={40} className="text-[#3B8A5E]/20" />
            </div>
            <p className="text-xs text-[#3B8A5E] mt-2">عمليات مسلمة بنجاح</p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}