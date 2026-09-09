import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../components/layout/MainLayout';
import PageHeader from '../components/ui/PageHeader';
import KpiCard from '../components/ui/KpiCard';
import Button from '../components/ui/Button';
import api from '../api/axios';
import {
  UserPlus,
  Users,
  Briefcase,
  Building2,
  Package,
  Truck,
  ArrowLeft,
  UserCheck,
  ShieldCheck,
  QrCode,
  ScrollText,
  Clock,
  HeartHandshake,
} from 'lucide-react';

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

  const roleLabel =
    user?.role === 'admin'
      ? 'المدير العام'
      : user?.role === 'assistant_admin'
      ? 'مساعد المدير'
      : 'السائق الميداني';

  const actionCards = [
    {
      title: 'إدارة وقوائم المستفيدين',
      description: 'عرض وتصنيف وفلترة جميع المستفيدين الدائمين وأسرهم',
      icon: Users,
      badge: 'دائم',
      color: 'green',
      path: '/beneficiaries',
    },
    {
      title: 'المستفيدون اليوميون',
      description: 'إدارة الحالات الطارئة والزيارات اليومية وسندات الصرف',
      icon: UserCheck,
      badge: 'طارئ',
      color: 'amber',
      path: '/daily-beneficiaries',
    },
    {
      title: 'تسليم مساعدات اليوميين',
      description: 'صرف فوري للمواد مع طباعة سند الاستلام المعتمد',
      icon: HeartHandshake,
      badge: 'صرف فوري',
      color: 'gold',
      path: '/daily-beneficiaries/receiving',
    },
    {
      title: 'المستودع والمخزون العام',
      description: 'إدارة السلال الغذائية، التبرعات، وحركات الإدخال والصرف',
      icon: Package,
      badge: 'عام',
      color: 'green',
      path: '/warehouse',
    },
    {
      title: 'مستودع المستفيدين اليوميين',
      description: 'إدارة الأصناف اليومية المستقلة ومتابعة تواريخ الصلاحية',
      icon: Building2,
      badge: 'صلاحيات',
      color: 'amber',
      path: '/daily-beneficiaries/inventory',
    },
    {
      title: 'إدارة موظفي الجمعية',
      description: 'متابعة سجلات الموظفين وسلف السلال الشهرية',
      icon: Briefcase,
      badge: 'إداري',
      color: 'blue',
      path: '/staff',
    },
    {
      title: 'إدارة وتوصيل المنازل',
      description: 'جدولة ومتابعة مسارات سيارات التوصيل الميداني',
      icon: Truck,
      badge: 'لوجستي',
      color: 'green',
      path: '/delivery',
    },
    {
      title: 'الحوكمة والتحليلات الشاملة',
      description: 'تقارير أداء شاملة ورسوم بيانية وتصدير رسمي Landscape',
      icon: ShieldCheck,
      badge: 'حوكمة',
      color: 'gold',
      path: '/governance',
    },
    {
      title: 'نقطة الاستلام والمسح (QR)',
      description: 'التحقق السريع وتسليم المساعدات عبر كاميرا الباركود',
      icon: QrCode,
      badge: 'فوري',
      color: 'blue',
      path: '/receiver',
    },
  ];

  return (
    <MainLayout>
      {/* Header */}
      <PageHeader
        title={`مرحباً بك، ${user?.full_name || user?.name || 'مدير النظام'}`}
        subtitle="نظام إدارة جمعية إكرام — لوحة المؤشرات التشغيلية والوصول السريع للأقسام"
        badge={roleLabel}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={UserPlus}
              onClick={() => navigate('/beneficiaries/add-citizen')}
            >
              تسجيل مستفيد
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={HeartHandshake}
              onClick={() => navigate('/daily-beneficiaries/receiving')}
            >
              تسليم مساعدة سريعة
            </Button>
          </div>
        }
      />

      {/* Top Real-time Live KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="إجمالي المستفيدين"
          value={stats.loading ? '—' : stats.beneficiariesCount.toLocaleString('ar-SA')}
          subtitle="مستفيد دائم مسجل"
          icon={Users}
          iconColor="green"
          trend="محدث لحظياً"
          trendType="up"
          onClick={() => navigate('/beneficiaries')}
        />
        <KpiCard
          title="إجمالي التوزيعات"
          value={stats.loading ? '—' : stats.distributedCount.toLocaleString('ar-SA')}
          subtitle="سلة ومساعدة ممنوحة"
          icon={Package}
          iconColor="gold"
          trend="عمليات موثقة"
          trendType="neutral"
          onClick={() => navigate('/delivery')}
        />
        <KpiCard
          title="قيد التجهيز والانتظار"
          value={stats.loading ? '—' : stats.pendingCount.toLocaleString('ar-SA')}
          subtitle="بانتظار الصرف أو التوصيل"
          icon={Clock}
          iconColor="amber"
          trend="يتطلب متابعة"
          trendType="down"
          onClick={() => navigate('/delivery')}
        />
        <KpiCard
          title="تم التوصيل والإنهاء"
          value={stats.loading ? '—' : stats.deliveredCount.toLocaleString('ar-SA')}
          subtitle="استلام مكتمل ميدانياً"
          icon={Truck}
          iconColor="blue"
          trend="إنجاز مكتمل"
          trendType="up"
          onClick={() => navigate('/delivery')}
        />
      </div>

      {/* Section Title */}
      <div className="pt-2">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-black text-gray-900">أقسام وعمليات النظام</h2>
            <p className="text-xs text-gray-500">اختر القسم المطلوب للبدء في إدارة وتوثيق العمليات</p>
          </div>
        </div>

        {/* Quick Action Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {actionCards.map((card, index) => {
            const Icon = card.icon;
            return (
              <div
                key={index}
                onClick={() => navigate(card.path)}
                className="group bg-white rounded-2xl p-5 border border-[#E5E2D9] shadow-xs hover:shadow-card-hover hover:border-[#C9A24A]/60 transition-all duration-200 cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-[#FAF8F5] border border-[#E5E2D9] flex items-center justify-center text-[#3F6B3A] group-hover:bg-[#EBF4EA] group-hover:text-[#3F6B3A] transition-colors shadow-xs">
                      <Icon className="w-6 h-6" />
                    </div>
                    {card.badge && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#FAF8F5] text-gray-600 border border-[#E5E2D9]">
                        {card.badge}
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-extrabold text-gray-900 mb-1 group-hover:text-[#3F6B3A] transition-colors">
                    {card.title}
                  </h3>
                  <p className="text-xs text-gray-500 leading-relaxed mb-4">
                    {card.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-[#E5E2D9]/60 flex items-center justify-between text-xs font-bold text-[#D97706] group-hover:text-[#B45309]">
                  <span>فتح القسم</span>
                  <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </MainLayout>
  );
}