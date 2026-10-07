import { useState } from 'react';
import MainLayout from '../../components/layout/MainLayout';
import PageShell from '../../components/ui/PageShell';
import SectionCard from '../../components/ui/SectionCard';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import FormField from '../../components/ui/FormField';
import FilterBar from '../../components/ui/FilterBar';
import SearchField from '../../components/ui/SearchField';
import ActionMenu, { ActionMenuItem } from '../../components/ui/ActionMenu';
import { PrimaryButton, SecondaryButton } from '../../components/ui/Button';

const rows = [
  { id: 'preview-1', name: 'سائق EKRAM-VISUAL-PREVIEW', phone: '0574917155', status: 'نشط', assigned: 4, inDelivery: 1, completed: 2, remaining: 1, lastActivity: '2026-10-06 14:30' },
  { id: 'preview-2', name: 'سائق المعاينة الثاني', phone: '0550001122', status: 'معطّل', assigned: 1, inDelivery: 0, completed: 1, remaining: 0, lastActivity: '2026-10-01 09:15' },
];

function DriverForm({ editing = false }) {
  const [phone, setPhone] = useState(editing ? '0574917155' : '123');
  const invalid = phone !== '' && !/^05\d{8}$/.test(phone);
  return (
    <SectionCard title={editing ? 'تعديل بيانات السائق' : 'إضافة سائق'} description="بيانات تجريبية للمعاينة البصرية. لا يُحفظ هذا النموذج.">
      <form className="grid grid-cols-1 gap-3 lg:grid-cols-2" onSubmit={(event) => event.preventDefault()}>
        <FormField label="اسم السائق" name="visual-driver-name" required>
          <input className="ikram-control" defaultValue={editing ? 'سائق EKRAM-VISUAL-PREVIEW' : ''} placeholder="اسم السائق" />
        </FormField>
        <FormField label="رقم الجوال" name="visual-driver-phone" required error={invalid ? 'أدخل رقم جوال محليًا بصيغة 05xxxxxxxx.' : ''}>
          <input className="ikram-control" dir="ltr" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="05xxxxxxxx" />
        </FormField>
        <FormField label="الحالة" name="visual-driver-status">
          <select className="ikram-control" defaultValue={editing ? 'inactive' : 'active'}>
            <option value="active">نشط</option>
            <option value="inactive">معطّل</option>
          </select>
        </FormField>
        <FormField label="بيانات المركبة" name="visual-driver-vehicle">
          <input className="ikram-control" defaultValue={editing ? 'فان أبيض' : ''} placeholder="اختياري" />
        </FormField>
        <div className="flex flex-wrap gap-2 lg:col-span-2">
          <PrimaryButton type="submit">{editing ? 'حفظ' : 'إضافة السائق'}</PrimaryButton>
          <SecondaryButton type="button">إلغاء</SecondaryButton>
        </div>
      </form>
    </SectionCard>
  );
}

export default function DriverVisualEvidence() {
  const view = new URLSearchParams(window.location.search).get('view') || 'management';
  const [query, setQuery] = useState('');
  const visible = rows.filter((row) => row.name.includes(query) || row.phone.includes(query));
  return (
    <MainLayout>
      <PageShell
        breadcrumbs={[{ label: 'التوصيل' }, { label: 'إدارة السائقين' }]}
        title="إدارة السائقين"
        description="معاينة EKRAM-VISUAL-PREVIEW. لا تُعرض رموز وصول أو روابط قدرة."
        primaryAction={<PrimaryButton type="button">إضافة سائق</PrimaryButton>}
        filters={(
          <FilterBar search={<SearchField label="بحث السائقين" placeholder="اسم السائق أو رقم الجوال" value={query} onChange={(event) => setQuery(event.target.value)} />} onReset={() => setQuery('')}>
            <FormField label="الحالة" name="visual-status-filter">
              <select className="ikram-control" defaultValue=""><option value="">كل الحالات</option><option>نشط</option><option>معطّل</option></select>
            </FormField>
          </FilterBar>
        )}
      >
        {view !== 'management' && <DriverForm editing={view === 'edit'} />}
        <DataTable
          data={visible}
          columns={[
            { key: 'name', header: 'اسم السائق' },
            { key: 'phone', header: 'رقم الهاتف', numeric: true, render: (row) => <span dir="ltr">{row.phone}</span> },
            { key: 'status', header: 'الحالة', render: (row) => <StatusBadge status={row.status === 'نشط' ? 'active' : 'suspended'} label={row.status} /> },
            { key: 'assigned', header: 'إجمالي المهام', numeric: true },
            { key: 'inDelivery', header: 'جاري التوصيل', numeric: true },
            { key: 'completed', header: 'تم التوصيل', numeric: true },
            { key: 'remaining', header: 'متبقي', numeric: true },
            { key: 'lastActivity', header: 'آخر نشاط' },
            { key: 'actions', header: 'الإجراءات', render: (row) => (
              <ActionMenu label={`إجراءات ${row.name}`}>
                <ActionMenuItem>تعديل بيانات السائق</ActionMenuItem>
                <ActionMenuItem>{row.status === 'نشط' ? 'تعطيل' : 'تفعيل'}</ActionMenuItem>
              </ActionMenu>
            ) },
          ]}
        />
      </PageShell>
    </MainLayout>
  );
}
