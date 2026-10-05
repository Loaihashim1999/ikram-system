import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Plus, Search, Users } from 'lucide-react';
import api from '../../api/axios';
import beneficiaryApi from '../../api/beneficiaries';
import { deleteDailyBeneficiary } from '../../api/dailyBeneficiaries';
import { useAuth } from '../../context/AuthContext';
import { hasModuleAction } from '../../utils/modulePermissions';
import SmartExcelImport from '../../components/common/SmartExcelImport';
import MainLayout from '../../components/layout/MainLayout';
import Button from '../../components/ui/Button';
import DataTable from '../../components/ui/DataTable';
import FilterBar from '../../components/ui/FilterBar';
import PageHeader from '../../components/ui/PageHeader';

const tabs = [
  ['all', 'الكل'], ['permanent', 'الدائمون'], ['daily', 'اليوميون'],
];

const FAMILY_STATUS_OPTIONS = [
  ['poor', 'فقير'],
  ['widow', 'أرملة'],
  ['widow_with_orphans', 'أرملة مع أيتام'],
  ['divorced', 'مطلقة'],
  ['divorced_with_children', 'مطلقة مع أطفال'],
  ['abandoned', 'مهجورة'],
];

const emptyFilters = {
  search: '',
  beneficiary_type: '',
  district: '',
  family_status: '',
  nationality: '',
  nationality_missing: '',
  sort: '',
  direction: '',
};

const familyLabel = (value) => FAMILY_STATUS_OPTIONS.find(([code]) => code === value)?.[1] || value || '—';

const classificationLabel = (row) => {
  if (row.beneficiary_type === 'citizen') return 'مواطن';
  if (row.beneficiary_type === 'resident') return 'مقيم';
  const nationality = String(row.nationality || '').trim();
  if (nationality === 'سعودي') return 'مواطن';
  if (nationality) return 'مقيم';
  return '—';
};

const dateText = (value) => (value ? String(value).slice(0, 10) : '—');

export default function UnifiedBeneficiaryPage() {
  const auth = useAuth();
  const user = auth?.user ?? null;
  const can = (module, action) => hasModuleAction(user, module, action);
  const canSupport = user?.role === 'admin' || (user?.permissions?.support?.view === true && user?.permissions?.support?.create === true);
  const [tab, setTab] = useState('all');
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ data: [], total: 0, last_page: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [importTarget, setImportTarget] = useState('permanent');

  const params = useMemo(() => Object.fromEntries(Object.entries({
    tab,
    page,
    per_page: 25,
    search: filters.search,
    beneficiary_type: filters.beneficiary_type,
    district: filters.district,
    family_status: filters.family_status,
    nationality: filters.nationality_missing ? '' : filters.nationality,
    nationality_missing: filters.nationality_missing ? 1 : '',
    sort: filters.sort,
    direction: filters.direction,
  }).filter(([, value]) => value !== '' && value !== null && value !== undefined)), [tab, page, filters]);

  const load = async () => {
    setLoading(true); setError('');
    try { const response = await api.get('/beneficiaries/unified', { params }); setResult(response.data.data || { data: [], total: 0, last_page: 1 }); }
    catch (e) { setError(e.response?.data?.message || 'تعذر تحميل قائمة المستفيدين.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [tab, page, filters]);
  const update = (name, value) => { setPage(1); setFilters((current) => ({ ...current, [name]: value })); };
  const reset = () => { setPage(1); setFilters(emptyFilters); };
  const exportData = async () => {
    setExporting(true);
    try {
      const response = await api.get('/beneficiaries/unified/export', { params, responseType: 'blob' });
      const url = URL.createObjectURL(response.data); const link = document.createElement('a'); link.href = url; link.download = 'ikram-beneficiaries.xlsx'; link.click(); URL.revokeObjectURL(url);
    } catch (e) { setError(e.response?.data?.message || 'تعذر تصدير البيانات.'); } finally { setExporting(false); }
  };
  const archiveRow = async (row) => {
    const daily = row.source === 'daily';
    if (!window.confirm(daily ? 'حذف المستفيد اليومي مع الاحتفاظ بسجل الاستلام؟' : 'أرشفة المستفيد مع الاحتفاظ بالوثائق والسجل؟')) return;
    try {
      if (daily) await deleteDailyBeneficiary(row.id);
      else await beneficiaryApi.remove(row.id);
      await load();
    } catch (e) { setError(e.response?.data?.message || 'تعذر تنفيذ الإجراء.'); }
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const columns = [
    {
      key: 'source',
      header: 'السجل',
      render: (row) => (
        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${row.source === 'daily' ? 'border-[var(--color-border)] bg-[var(--color-bg-soft)] text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
          {row.source === 'daily' ? 'يومي' : 'دائم'}
        </span>
      ),
    },
    {
      key: 'full_name',
      header: 'الاسم',
      render: (row) => (
        <Link className="font-bold text-[var(--color-brand-green-hover)] hover:underline" to={row.source === 'daily' ? `/daily-beneficiaries/${row.id}` : `/beneficiaries/${row.id}`}>
          {row.full_name || '—'}
        </Link>
      ),
    },
    { key: 'beneficiary_type', header: 'التصنيف', render: classificationLabel },
    { key: 'phone', header: 'الجوال', render: (row) => row.phone || '—' },
    { key: 'address', header: 'العنوان', render: (row) => row.address || '—' },
    { key: 'district', header: 'الحي', render: (row) => row.district || '—' },
    { key: 'family_status', header: 'الحالة الأسرية', render: (row) => familyLabel(row.family_status) },
    { key: 'created_at', header: 'تاريخ التسجيل', render: (row) => dateText(row.created_at) },
    {
      key: 'latest_completed_receipt',
      header: 'آخر استلام مكتمل',
      render: (row) => {
        const receipt = row.latest_completed_receipt;
        if (!receipt) return '—';
        return `${receipt.summary || '—'} — ${dateText(receipt.completed_at)}`;
      },
    },
    { key: 'completed_receipt_count', header: 'عدد الاستلامات المكتملة', render: (row) => row.completed_receipt_count ?? 0 },
    {
      key: 'actions',
      header: 'إجراءات',
      render: (row) => {
        const daily = row.source === 'daily';
        const module = daily ? 'daily_beneficiaries' : 'beneficiaries';
        const detailTo = daily ? `/daily-beneficiaries/${row.id}` : `/beneficiaries/${row.id}`;
        const editTo = daily ? `/daily-beneficiaries/${row.id}/edit` : `/beneficiaries/${row.id}/edit`;
        const docsTo = daily ? `/daily-beneficiaries/${row.id}` : `/beneficiaries/${row.id}?tab=documents`;
        return (
          <div className="flex flex-wrap gap-2 text-xs font-bold">
            {can(module, 'view') && <Link className="text-[var(--color-brand-green-hover)]" to={detailTo}>التفاصيل</Link>}
            {can(module, 'edit') && <Link className="text-[var(--color-brand-green-hover)]" to={editTo}>تعديل</Link>}
            {can(module, 'delete') && <button type="button" className="text-[#C24B3F]" onClick={() => archiveRow(row)}>{daily ? 'حذف' : 'أرشفة'}</button>}
            {can(module, 'view') && <Link className="text-[var(--color-brand-green-hover)]" to={docsTo}>المرفقات</Link>}
            {!daily && canSupport && !row.archived_at && <Link className="text-[var(--color-brand-green-hover)]" to={`/support/request?beneficiary=${row.id}`}>إنشاء طلب دعم</Link>}
          </div>
        );
      },
    },
  ];

  return <MainLayout><main dir="rtl" className="space-y-5">
    <PageHeader
      title="قائمة المستفيدين الموحدة"
      subtitle="عرض مركزي يحافظ على استقلال سجلات المستفيدين الدائمين واليوميين"
      badge={`${result.total || 0} سجل مطابق`}
      breadcrumbs={[{ label: 'المستفيدون' }]}
      actions={<><Button variant="secondary" icon={Download} onClick={exportData} loading={exporting} disabled={!result.total} data-testid="unified-export">تصدير Excel</Button>{can('beneficiaries', 'create') && <Button as={Link} to="/beneficiaries/add-citizen" variant="outline" icon={Plus}>إضافة دائم</Button>}</>}
    />
    {can('beneficiaries', 'import') && <section className="ikram-panel space-y-4 p-4">
      <h2 className="text-sm font-extrabold text-[var(--color-text-primary)]">استيراد المستفيدين</h2>
      <label className="block max-w-sm space-y-1"><span className="ikram-label">هدف الاستيراد</span>
        <select aria-label="هدف الاستيراد" value={importTarget} onChange={(e) => setImportTarget(e.target.value)} className="ikram-control">
          <option value="permanent">مستفيدون دائمون</option>
          <option value="daily">مستفيدون يوميون</option>
        </select>
      </label>
      <SmartExcelImport entity="beneficiaries" target={importTarget} onComplete={() => load()} />
    </section>}
    <div className="ikram-panel flex gap-2 overflow-x-auto p-2" role="tablist" aria-label="نوع سجل المستفيدين">{tabs.map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={tab === value} data-testid={`tab-${value}`} onClick={() => { setTab(value); setPage(1); }} className={`min-h-10 whitespace-nowrap rounded-[10px] px-4 py-2 text-sm font-bold transition-colors ${tab === value ? 'bg-[var(--color-brand-green)] text-white shadow-sm' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-soft)] hover:text-[var(--color-text-primary)]'}`}>{label}</button>)}</div>
    <FilterBar activeCount={activeFilterCount} onReset={reset}>
      <label className="space-y-1"><span className="ikram-label">البحث</span><span className="relative block"><Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]"/><input aria-label="بحث" value={filters.search} onChange={(e) => update('search', e.target.value)} placeholder="الاسم أو الهوية أو الجوال" className="ikram-control pr-9" /></span></label>
      <label className="space-y-1"><span className="ikram-label">التصنيف</span><select aria-label="التصنيف" value={filters.beneficiary_type} onChange={(e) => update('beneficiary_type', e.target.value)} className="ikram-control"><option value="">الكل</option><option value="citizen">مواطن</option><option value="resident">مقيم</option></select></label>
      <label className="space-y-1"><span className="ikram-label">الحي</span><input aria-label="الحي" value={filters.district} onChange={(e) => update('district', e.target.value)} placeholder="الحي" className="ikram-control" /></label>
      <label className="space-y-1"><span className="ikram-label">الحالة الأسرية</span><select aria-label="الحالة الأسرية" value={filters.family_status} onChange={(e) => update('family_status', e.target.value)} className="ikram-control"><option value="">الكل</option>{FAMILY_STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="space-y-1"><span className="ikram-label">الجنسية</span><input aria-label="الجنسية" value={filters.nationality} onChange={(e) => update('nationality', e.target.value)} placeholder="الجنسية" disabled={Boolean(filters.nationality_missing)} className="ikram-control" /></label>
      <label className="flex items-center gap-2 pt-6 text-sm font-bold"><input aria-label="جنسية غير مسجلة" type="checkbox" checked={Boolean(filters.nationality_missing)} onChange={(e) => update('nationality_missing', e.target.checked ? '1' : '')} />جنسية غير مسجلة</label>
      <label className="space-y-1"><span className="ikram-label">الترتيب</span><select aria-label="الترتيب" value={filters.sort} onChange={(e) => update('sort', e.target.value)} className="ikram-control"><option value="">الافتراضي</option><option value="full_name">الاسم</option><option value="created_at">تاريخ التسجيل</option><option value="district">الحي</option><option value="beneficiary_type">التصنيف</option><option value="completed_receipt_count">عدد الاستلامات</option><option value="latest_completed_at">تاريخ آخر استلام</option></select></label>
      <label className="space-y-1"><span className="ikram-label">الاتجاه</span><select aria-label="الاتجاه" value={filters.direction} onChange={(e) => update('direction', e.target.value)} className="ikram-control"><option value="">الافتراضي</option><option value="asc">تصاعدي</option><option value="desc">تنازلي</option></select></label>
    </FilterBar>
    <DataTable columns={columns} data={result.data} loading={loading} error={error} onRetry={load} emptyMessage="لا توجد سجلات مطابقة" emptySubMessage="عدّل المرشحات أو امسحها لعرض نتائج أخرى." rowKey={(row) => `${row.source}-${row.id}`} getRowProps={() => ({ 'data-testid': 'unified-row' })} />
    <div className="ikram-panel flex flex-col items-center justify-between gap-3 px-4 py-3 text-sm sm:flex-row"><span className="inline-flex items-center gap-2 font-bold text-[var(--color-text-secondary)]"><Users className="h-4 w-4 text-[var(--color-brand-green)]"/>إجمالي المطابق: {result.total || 0}</span><div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>السابق</Button><span className="min-w-24 text-center font-bold">صفحة {page} من {result.last_page || 1}</span><Button variant="outline" size="sm" disabled={page >= (result.last_page || 1) || loading} onClick={() => setPage((p) => p + 1)}>التالي</Button></div></div>
  </main></MainLayout>;
}
