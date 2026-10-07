import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../../context/AuthContext';
import { NotificationProvider } from '../../context/NotificationContext';
import MainLayout from '../../components/layout/MainLayout';
import PageShell from '../../components/ui/PageShell';
import SectionCard from '../../components/ui/SectionCard';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import KpiCard from '../../components/ui/KpiCard';
import { PrimaryButton, SecondaryButton } from '../../components/ui/Button';

const sample = [
  { id: '1', full_name: 'خالد العتيبي', phone: '0551234567', vehicle_info: 'فان أبيض', assigned_count: 6, in_progress_count: 2, remaining_count: 2, is_active: true },
  { id: '2', full_name: 'سلمان الحربي', phone: '0539876543', vehicle_info: '—', assigned_count: 3, in_progress_count: 0, remaining_count: 0, is_active: false },
];

function PreviewScreen() {
  return (
    <MainLayout>
      <PageShell
        breadcrumbs={[{ label: 'التوصيل', to: '/delivery' }, { label: 'دليل السائقين' }]}
        title="دليل السائقين"
        description="معاينة الشكل فقط. الأسماء أرقام تجريبية وليست سجلات تشغيل."
        secondaryActions={<SecondaryButton type="button">إدارة التوصيل</SecondaryButton>}
        kpis={(
          <>
            <KpiCard title="السائقون" value="2" iconColor="green" />
            <KpiCard title="جاري التوصيل" value="2" iconColor="gold" />
            <KpiCard title="نشط" value="1" iconColor="green" />
            <KpiCard title="معطّل" value="1" iconColor="amber" />
          </>
        )}
      >
        <SectionCard title="إضافة أو تعديل سائق" description="التعطيل يبقي السجل. تعيين المهام يتم من إدارة التوصيل.">
          <form className="grid gap-3 sm:grid-cols-3">
            <label>اسم السائق<input className="ikram-control mt-1" defaultValue="" placeholder="اسم السائق" /></label>
            <label>هاتف السائق<input dir="ltr" className="ikram-control ikram-numeric mt-1" placeholder="05xxxxxxxx" /></label>
            <label>بيانات المركبة<input className="ikram-control mt-1" placeholder="اختياري" /></label>
            <div className="ikram-actions sm:col-span-3">
              <PrimaryButton type="button">إضافة السائق</PrimaryButton>
            </div>
          </form>
        </SectionCard>
        <h2 className="ikram-section-title">السائقون المسجلون</h2>
        <DataTable
          data={sample}
          columns={[
            { key: 'full_name', header: 'السائق' },
            { key: 'phone', header: 'الهاتف', numeric: true },
            { key: 'vehicle_info', header: 'المركبة' },
            { key: 'assigned_count', header: 'المعيّن', numeric: true },
            { key: 'in_progress_count', header: 'جاري التوصيل', numeric: true },
            { key: 'remaining_count', header: 'المتبقي', numeric: true },
            { key: 'is_active', header: 'الحالة', render: (row) => <StatusBadge status={row.is_active ? 'active' : 'suspended'} label={row.is_active ? 'نشط' : 'معطّل'} /> },
            { key: 'actions', header: 'الإجراءات', render: () => (
              <div className="ikram-actions">
                <SecondaryButton type="button">تعديل</SecondaryButton>
                <SecondaryButton type="button">تعطيل</SecondaryButton>
              </div>
            ) },
          ]}
        />
      </PageShell>
    </MainLayout>
  );
}

export default function DesignPreview() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <PreviewScreen />
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
