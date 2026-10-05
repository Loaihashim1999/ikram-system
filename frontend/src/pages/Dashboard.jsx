import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { canViewSupport, hasModuleAction } from '../utils/modulePermissions';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../components/layout/MainLayout';
import PageHeader from '../components/ui/PageHeader';
import KpiCard from '../components/ui/KpiCard';
import Button from '../components/ui/Button';
import api from '../api/axios';
import { displayLabel } from '../utils/displayVocabulary';
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
  Clock,
  HeartHandshake,
} from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const supportVisible = canViewSupport(user);
  const canView = (module) => hasModuleAction(user, module, 'view');
  const canCreateBeneficiary = hasModuleAction(user, 'beneficiaries', 'create');
  const canViewDaily = canView('daily_beneficiaries');

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

  const roleLabel = displayLabel('role', user?.role);

  const actionCards = [
    {
      title: 'قائمة المستفيدين الموحدة',
      description: 'عرض وتصنيف وفلترة جميع المستفيدين الدائمين وأسرهم',
      icon: Users,
      badge: 'دائم',
      color: 'green',
      path: '/beneficiaries',
      module: 'beneficiaries',
    },
    {
      title: 'منظومة المستفيدين اليوميين الموحدة',
      description: 'إدارة الحالات الطارئة والزيارات اليومية وسندات الصرف',
      icon: UserCheck,
      badge: 'طارئ',
      color: 'amber',
      path: '/daily-beneficiaries',
      module: 'daily_beneficiaries',
    },
    {
      title: 'منظومة المستفيدين اليوميين الموحدة',
      description: 'صرف فوري للمواد مع طباعة سند الاستلام المعتمد',
      icon: HeartHandshake,
      badge: 'صرف فوري',
      color: 'gold',
      path: '/daily-beneficiaries/receiving',
      module: 'daily_beneficiaries',
    },
    {
      title: 'إدارة المستودع والمخزون ومتابعة الصلاحية',
      description: 'إدارة السلال الغذائية، التبرعات، وحركات الإدخال والصرف',
      icon: Package,
      badge: 'عام',
      color: 'green',
      path: '/warehouse',
      module: 'warehouse',
    },
    {
      title: 'منظومة المستفيدين اليوميين الموحدة',
      description: 'إدارة الأصناف اليومية المستقلة ومتابعة تواريخ الصلاحية',
      icon: Building2,
      badge: 'صلاحيات',
      color: 'amber',
      path: '/daily-beneficiaries/inventory',
      module: 'daily_beneficiaries',
    },
    {
      title: 'إدارة وقوائم موظفي الجمعية',
      description: 'متابعة سجلات الموظفين وسلف السلال الشهرية',
      icon: Briefcase,
      badge: 'إداري',
      color: 'blue',
      path: '/staff',
      module: 'staff',
    },
    {
      title: 'التوصيل للمنازل',
      description: 'جدولة ومتابعة مسارات سيارات التوصيل الميداني',
      icon: Truck,
      badge: 'لوجستي',
      color: 'green',
      path: '/delivery',
      module: 'support',
    },
    {
      title: 'منظومة الحوكمة والتحليلات الشاملة',
      description: 'تقارير أداء شاملة ورسوم بيانية وتصدير رسمي Landscape',
      icon: ShieldCheck,
      badge: 'حوكمة',
      color: 'gold',
      path: '/governance',
      module: 'governance',
    },
    {
      title: 'الاستلام المباشر',
      description: 'التحقق السريع وتسليم المساعدات عبر كاميرا الباركود',
      icon: QrCode,
      badge: 'فوري',
      color: 'blue',
      path: '/receiver',
      module: 'support',
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
            {canCreateBeneficiary && <Button
              variant="outline"
              size="sm"
              icon={UserPlus}
              onClick={() => navigate('/beneficiaries/add-citizen')}
            >
              تسجيل مستفيد مواطن جديد
            </Button>}
            {canViewDaily && <Button
              variant="primary"
              size="sm"
              icon={HeartHandshake}
              onClick={() => navigate('/daily-beneficiaries/receiving')}
            >
              منظومة المستفيدين اليوميين الموحدة
            </Button>}
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
          onClick={canView('beneficiaries') ? () => navigate('/beneficiaries') : undefined}
        />
        <KpiCard
          title="إجمالي التوزيعات"
          value={stats.loading ? '—' : stats.distributedCount.toLocaleString('ar-SA')}
          subtitle="سلة ومساعدة ممنوحة"
          icon={Package}
          iconColor="gold"
          trend="عمليات موثقة"
          trendType="neutral"
          onClick={supportVisible ? () => navigate('/delivery') : undefined}
        />
        <KpiCard
          title="قيد التجهيز والانتظار"
          value={stats.loading ? '—' : stats.pendingCount.toLocaleString('ar-SA')}
          subtitle="بانتظار الصرف أو التوصيل"
          icon={Clock}
          iconColor="amber"
          trend="يتطلب متابعة"
          trendType="down"
          onClick={supportVisible ? () => navigate('/delivery') : undefined}
        />
        <KpiCard
          title="تم التوصيل والإنهاء"
          value={stats.loading ? '—' : stats.deliveredCount.toLocaleString('ar-SA')}
          subtitle="استلام مكتمل ميدانياً"
          icon={Truck}
          iconColor="blue"
          trend="إنجاز مكتمل"
          trendType="up"
          onClick={supportVisible ? () => navigate('/delivery') : undefined}
        />
      </div>

      {/* Section Title */}
      <div className="pt-2">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-black text-[var(--color-text-primary)]">أقسام وعمليات النظام</h2>
            <p className="text-xs text-[var(--color-text-muted)]">اختر القسم المطلوب للبدء في إدارة وتوثيق العمليات</p>
          </div>
        </div>

        {/* Quick Action Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {actionCards.filter((card) => card.module === 'support' ? supportVisible : canView(card.module)).map((card, index) => {
            const Icon = card.icon;
            return (
              <button
                type="button"
                key={index}
                onClick={() => navigate(card.path)}
                className="group ikram-panel p-4 text-right transition-colors hover:border-[var(--color-brand-gold)] flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] bg-[var(--color-bg-soft)] text-[var(--color-brand-green)]">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    {card.badge && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[var(--color-bg-soft)] text-[var(--color-text-muted)] border border-[var(--color-border)]">
                        {card.badge}
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-extrabold text-[var(--color-text-primary)] mb-1 group-hover:text-[var(--color-brand-green)] transition-colors">
                    {card.title}
                  </h3>
                  <p className="text-xs text-[var(--color-text-muted)] leading-relaxed mb-4">
                    {card.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-[var(--color-border)]/60 flex items-center justify-between text-xs font-bold text-[var(--color-brand-green)] group-hover:text-[var(--color-brand-green-hover)]">
                  <span>فتح القسم</span>
                  <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </MainLayout>
  );
}