import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Download, FileSpreadsheet, Plus, Send } from 'lucide-react';
import api from '../../api/axios';
import beneficiaryApi from '../../api/beneficiaries';
import { deleteDailyBeneficiary } from '../../api/dailyBeneficiaries';
import { useAuth } from '../../context/AuthContext';
import { hasModuleAction } from '../../utils/modulePermissions';
import SmartExcelImport from '../../components/common/SmartExcelImport';
import MainLayout from '../../components/layout/MainLayout';
import Button, { PrimaryButton, SecondaryButton } from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import ErrorState from '../../components/ui/ErrorState';
import KpiCard from '../../components/ui/KpiCard';
import DataTable from '../../components/ui/DataTable';
import FilterBar from '../../components/ui/FilterBar';
import SearchField from '../../components/ui/SearchField';
import PageShell from '../../components/ui/PageShell';
import Tabs from '../../components/ui/Tabs';
import Dialog from '../../components/overlays/Dialog';
import StatusBadge from '../../components/ui/StatusBadge';
import ActionMenu, { ActionMenuItem } from '../../components/ui/ActionMenu';
import { displayLabel } from '../../utils/displayVocabulary';

const tabs = [
  ['all', 'الكل'], ['permanent', 'الدائمون'], ['daily', 'اليوميون'],
];

const FAMILY_STATUS_VALUES = ['poor', 'widow', 'widow_with_orphans', 'divorced', 'divorced_with_children', 'abandoned'];

const emptyFilters = {
  search: '',
  beneficiary_type: '',
  district: '',
  family_status: '',
  nationality: '',
  nationality_missing: '',
  city: '',
  status: '',
  date_from: '',
  date_to: '',
  policy_result: '',
  policy_category: '',
  support_status: '',
  receipt_history: '',
  sort: '',
  direction: '',
};

const classificationLabel = (row) => {
  if (row.beneficiary_type === 'citizen') return 'مواطن';
  if (row.beneficiary_type === 'resident') return 'مقيم';
  const nationality = String(row.nationality || '').trim();
  if (nationality === 'سعودي') return 'مواطن';
  if (nationality) return 'مقيم';
  return '—';
};

const dateText = (value) => (value ? String(value).slice(0, 10) : '—');
const SUPPORT_STEPS = ['اختيار المستفيدين', 'اختيار الدعم', 'طريقة التسليم', 'مراجعة وإرسال'];

export default function UnifiedBeneficiaryPage() {
  const navigate = useNavigate();
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
  const [importOpen, setImportOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportStep, setSupportStep] = useState(0);
  const [supportIds, setSupportIds] = useState(() => new Set());
  const [supportPeople, setSupportPeople] = useState([]);
  const [supportSearch, setSupportSearch] = useState('');
  const [supportItems, setSupportItems] = useState([]);
  const [supportLocations, setSupportLocations] = useState([]);
  const [supportItemId, setSupportItemId] = useState('');
  const [supportQty, setSupportQty] = useState('1');
  const [supportMethod, setSupportMethod] = useState('pickup');
  const [supportLocation, setSupportLocation] = useState('');
  const [supportDate, setSupportDate] = useState('');
  const [supportBusy, setSupportBusy] = useState(false);

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
    city: filters.city,
    status: filters.status,
    date_from: filters.date_from,
    date_to: filters.date_to,
    policy_result: filters.policy_result,
    policy_category: filters.policy_category,
    support_status: filters.support_status,
    receipt_history: filters.receipt_history,
    sort: filters.sort,
    direction: filters.direction,
  }).filter(([, value]) => value !== '' && value !== null && value !== undefined)), [tab, page, filters]);

  const load = async () => {
    setLoading(true); setError('');
    try { const response = await api.get('/beneficiaries/unified', { params }); setResult(response.data.data || { data: [], total: 0, last_page: 1 }); }
    catch { setError('تعذر تحميل قائمة المستفيدين. حاول مرة أخرى.'); }
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

  const openSupport = (beneficiaryId) => {
    setSupportStep(0);
    setSupportIds(beneficiaryId ? new Set([beneficiaryId]) : new Set());
    setSupportSearch('');
    setSupportOpen(true);
    if (supportItems.length && supportPeople.length) return;
    Promise.all([
      api.get('/beneficiaries', { params: { per_page: 100 } }),
      api.get('/inventory', { params: { per_page: -1 } }),
      api.get('/support/pickup-locations'),
    ]).then(([people, items, places]) => {
      setSupportPeople(people.data.data?.data || people.data.data || []);
      setSupportItems(items.data.data?.data || items.data.data || []);
      setSupportLocations(places.data.data || []);
    }).catch(() => setError('تعذر تحميل بيانات تقديم الدعم.'));
  };
  const toggleSupport = (id) => setSupportIds((current) => {
    const next = new Set(current);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const submitSupport = async () => {
    if (supportBusy || supportIds.size === 0 || !supportItemId) return;
    setSupportBusy(true);
    try {
      for (const beneficiaryId of supportIds) {
        await api.post('/support/distributions', {
          recipient_type: 'beneficiary',
          beneficiary_id: beneficiaryId,
          fulfillment_method: supportMethod,
          ...(supportMethod === 'pickup' ? { pickup_location_id: supportLocation } : {}),
          ...(supportDate ? { support_date: supportDate } : {}),
          items: [{ inventory_item_id: supportItemId, requested_quantity: supportQty }],
        });
      }
      setSupportStep(4);
      await load();
    } catch (e) {
      setError('تعذر إنشاء طلب الدعم. تحقق من البيانات وحاول مرة أخرى.');
    } finally {
      setSupportBusy(false);
    }
  };
  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const columns = [
    {
      key: 'source',
      header: 'السجل',
      render: (row) => (
        <StatusBadge tone={row.source === 'daily' ? 'warning' : 'success'} label={row.source === 'daily' ? 'يومي' : 'دائم'} />
      ),
    },
    {
      key: 'full_name',
      header: 'المستفيد',
      render: (row) => (
        <div>
          <Link className="font-bold text-[var(--color-brand-green-hover)] hover:underline" to={row.source === 'daily' ? `/daily-beneficiaries/${row.id}` : `/beneficiaries/${row.id}`}>
            {row.full_name || '—'}
          </Link>
          {row.national_id && <div className="text-xs text-[var(--color-text-muted)]">{row.national_id}</div>}
        </div>
      ),
    },
    { key: 'beneficiary_type', header: 'النوع', render: classificationLabel },
    { key: 'city', header: 'المدينة', render: (row) => row.city || '—' },
    { key: 'district', header: 'الحي', render: (row) => row.district || '—' },
    { key: 'status', header: 'حالة الملف', render: (row) => row.status ? <StatusBadge status={row.status} label={displayLabel('status', row.status)} /> : '—' },
    { key: 'policy_result', header: 'السياسة', render: (row) => row.policy_result ? <StatusBadge status={row.policy_result} label={displayLabel('status', row.policy_result)} /> : <StatusBadge tone="neutral" label="لم يُقيّم" /> },
    { key: 'policy_score', header: 'النقاط / الأولوية', render: (row) => row.policy_score != null ? <span className="ikram-numeric">{row.policy_score}</span> : (row.priority ? displayLabel('priority', row.priority) : '—') },
    { key: 'support_status', header: 'حالة الدعم', render: (row) => row.support_status ? <StatusBadge status={row.support_status} label={displayLabel('status', row.support_status)} /> : <StatusBadge tone="neutral" label="لا يوجد دعم" /> },
    {
      key: 'latest_completed_receipt',
      header: 'آخر استلام',
      render: (row) => {
        const receipt = row.latest_completed_receipt;
        if (!receipt) return row.days_without_receipt == null ? 'لم يسبق له الاستلام' : '—';
        return `${receipt.summary || '—'} — ${dateText(receipt.completed_at)}${row.days_without_receipt != null ? ` — منذ ${row.days_without_receipt} يوماً` : ''}`;
      },
    },
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
          <ActionMenu label={`إجراءات ${row.full_name || 'السجل'}`}>
            {can(module, 'view') && <ActionMenuItem onClick={() => navigate(detailTo)}>عرض التفاصيل</ActionMenuItem>}
            {can(module, 'edit') && <ActionMenuItem onClick={() => navigate(editTo)}>تعديل</ActionMenuItem>}
            {!daily && (user?.role === 'admin' || user?.permissions?.beneficiary_policy?.evaluate === true) && <ActionMenuItem onClick={() => navigate(`/beneficiaries/${row.id}`)}>تقييم السياسة</ActionMenuItem>}
            {!daily && canSupport && !row.archived_at && <ActionMenuItem onClick={() => openSupport(row.id)}>تقديم الدعم</ActionMenuItem>}
            {can(module, 'view') && <ActionMenuItem onClick={() => navigate(docsTo)}>المرفقات</ActionMenuItem>}
            {can(module, 'delete') && <ActionMenuItem danger onClick={() => archiveRow(row)}>{daily ? 'حذف' : 'أرشفة'}</ActionMenuItem>}
          </ActionMenu>
        );
      },
    },
  ];

  return <MainLayout>
    <PageShell
      title="قائمة المستفيدين الموحدة"
      description={`عرض مركزي يحافظ على استقلال سجلات المستفيدين الدائمين واليوميين. السجلات المطابقة: ${result.total || 0}`}
      breadcrumbs={[{ label: 'المستفيدون' }]}
      secondaryActions={<><Button variant="secondary" icon={Download} onClick={exportData} loading={exporting} disabled={!result.total} data-testid="unified-export">تصدير Excel</Button>{canSupport && <Button variant="secondary" size="sm" icon={Send} onClick={() => openSupport()}>تقديم الدعم</Button>}</>}
      primaryAction={can('beneficiaries', 'create') ? <Button as={Link} to="/beneficiaries/add-citizen" variant="outline" icon={Plus}>إضافة دائم</Button> : null}
      filters={(
        <>
          <Tabs tabs={tabs.map(([id, label]) => ({ id, label, testId: `tab-${id}` }))} activeTab={tab} onChange={(value) => { setTab(value); setPage(1); }} />
    <FilterBar
      activeCount={activeFilterCount}
      onReset={reset}
      tools={can('beneficiaries', 'import') && <button type="button" className="ikram-btn ikram-btn-outline min-h-11 shrink-0 px-3" aria-label="استيراد المستفيدين" onClick={() => setImportOpen(true)}><FileSpreadsheet className="h-4 w-4" /></button>}
      search={<SearchField label="بحث" value={filters.search} onChange={(e) => update('search', e.target.value)} placeholder="الاسم أو الهوية أو الجوال" />}
    >
      <label className="space-y-1"><span className="ikram-label">التصنيف</span><select aria-label="التصنيف" value={filters.beneficiary_type} onChange={(e) => update('beneficiary_type', e.target.value)} className="ikram-control"><option value="">الكل</option><option value="citizen">مواطن</option><option value="resident">مقيم</option></select></label>
      <label className="space-y-1"><span className="ikram-label">الحي</span><input aria-label="الحي" value={filters.district} onChange={(e) => update('district', e.target.value)} placeholder="الحي" className="ikram-control" /></label>
      <label className="space-y-1"><span className="ikram-label">الحالة الأسرية</span><select aria-label="الحالة الأسرية" value={filters.family_status} onChange={(e) => update('family_status', e.target.value)} className="ikram-control"><option value="">الكل</option>{FAMILY_STATUS_VALUES.map((value) => <option key={value} value={value}>{displayLabel('family', value)}</option>)}</select></label>
      <label className="space-y-1"><span className="ikram-label">الجنسية</span><input aria-label="الجنسية" value={filters.nationality} onChange={(e) => update('nationality', e.target.value)} placeholder="الجنسية" disabled={Boolean(filters.nationality_missing)} className="ikram-control" /></label>
      <label className="flex items-center gap-2 pt-6 text-sm font-bold"><input aria-label="جنسية غير مسجلة" type="checkbox" checked={Boolean(filters.nationality_missing)} onChange={(e) => update('nationality_missing', e.target.checked ? '1' : '')} />جنسية غير مسجلة</label>
      <label className="space-y-1"><span className="ikram-label">المدينة</span><input aria-label="المدينة" value={filters.city} onChange={(e) => update('city', e.target.value)} placeholder="المدينة" className="ikram-control" /></label>
      <label className="space-y-1"><span className="ikram-label">حالة الملف</span><select aria-label="حالة الملف" value={filters.status} onChange={(e) => update('status', e.target.value)} className="ikram-control"><option value="">الكل</option><option value="active">نشط</option><option value="suspended">موقوف</option><option value="under_review">قيد المراجعة</option></select></label>
      <label className="space-y-1"><span className="ikram-label">من تاريخ</span><input aria-label="من تاريخ التسجيل" type="date" value={filters.date_from} onChange={(e) => update('date_from', e.target.value)} className="ikram-control" /></label>
      <label className="space-y-1"><span className="ikram-label">إلى تاريخ</span><input aria-label="إلى تاريخ التسجيل" type="date" value={filters.date_to} onChange={(e) => update('date_to', e.target.value)} className="ikram-control" /></label>
      <label className="space-y-1"><span className="ikram-label">نتيجة السياسة</span><select aria-label="نتيجة السياسة" value={filters.policy_result} onChange={(e) => update('policy_result', e.target.value)} className="ikram-control"><option value="">الكل</option><option value="eligible">مؤهل</option><option value="ineligible">غير مؤهل</option><option value="review_required">يتطلب المراجعة</option><option value="not_applicable">لا تنطبق السياسة</option></select></label>
      <label className="space-y-1"><span className="ikram-label">فئة السياسة</span><select aria-label="فئة السياسة" value={filters.policy_category} onChange={(e) => update('policy_category', e.target.value)} className="ikram-control"><option value="">الكل</option>{['A', 'B', 'C', 'D', 'E'].map((category) => <option key={category} value={category}>{displayLabel('scoreCategory', category)}</option>)}</select></label>
      <label className="space-y-1"><span className="ikram-label">حالة الدعم</span><select aria-label="حالة الدعم" value={filters.support_status} onChange={(e) => update('support_status', e.target.value)} className="ikram-control"><option value="">الكل</option><option value="draft">مسودة</option><option value="approved">معتمد</option><option value="ready">جاهز للاستلام</option><option value="in_delivery">جارٍ التوصيل</option><option value="completed">مكتمل</option><option value="cancelled">ملغي</option></select></label>
      <label className="space-y-1"><span className="ikram-label">سجل الاستلام</span><select aria-label="سجل الاستلام" value={filters.receipt_history} onChange={(e) => update('receipt_history', e.target.value)} className="ikram-control"><option value="">الكل</option><option value="received">سبق له الاستلام</option><option value="never">لم يسبق له الاستلام</option></select></label>
      <label className="space-y-1"><span className="ikram-label">الترتيب</span><select aria-label="الترتيب" value={filters.sort} onChange={(e) => update('sort', e.target.value)} className="ikram-control"><option value="">الافتراضي</option><option value="full_name">الاسم</option><option value="created_at">تاريخ التسجيل</option><option value="district">الحي</option><option value="beneficiary_type">النوع</option><option value="completed_receipt_count">عدد الاستلامات</option><option value="latest_completed_at">تاريخ آخر استلام</option><option value="policy_score">نقاط السياسة</option><option value="policy_category">فئة السياسة</option><option value="days_without_receipt">أيام بدون استلام</option></select></label>
      <label className="space-y-1"><span className="ikram-label">الاتجاه</span><select aria-label="الاتجاه" value={filters.direction} onChange={(e) => update('direction', e.target.value)} className="ikram-control"><option value="">الافتراضي</option><option value="asc">تصاعدي</option><option value="desc">تنازلي</option></select></label>
    </FilterBar>
        </>
      )}
    >
    {error ? <ErrorState compact title="تعذر تحميل قائمة المستفيدين" description={error} onRetry={load} /> : (<DataTable columns={columns} data={result.data} loading={loading} error={error} onRetry={load} emptyMessage="لا توجد سجلات مطابقة" emptySubMessage="عدّل المرشحات أو امسحها لعرض نتائج أخرى." rowKey={(row) => `${row.source}-${row.id}`} getRowProps={() => ({ 'data-testid': 'unified-row' })} pagination currentPage={page} totalPages={result.last_page || 1} totalItems={result.total || 0} pageSize={25} onPageChange={setPage} />)}
    <Dialog isOpen={importOpen} onClose={() => setImportOpen(false)} title="استيراد المستفيدين" subtitle="اختر هدف الاستيراد ثم ارفع ملف Excel أو CSV." icon={FileSpreadsheet} maxWidth="max-w-3xl">
      <label className="block max-w-sm space-y-1"><span className="ikram-label">هدف الاستيراد</span>
        <select aria-label="هدف الاستيراد" value={importTarget} onChange={(e) => setImportTarget(e.target.value)} className="ikram-control">
          <option value="permanent">مستفيدون دائمون</option>
          <option value="daily">مستفيدون يوميون</option>
        </select>
      </label>
      <SmartExcelImport entity="beneficiaries" target={importTarget} onComplete={() => { setImportOpen(false); load(); }} />
    </Dialog>
    <Dialog isOpen={supportOpen} onClose={() => setSupportOpen(false)} title="تقديم دعم للمستفيد" subtitle="خطوات اختيار المستفيد والدعم وطريقة التسليم" icon={Send} maxWidth="max-w-4xl">
      {error && <ErrorState title="تعذر تقديم الدعم" description={error} />}
      {supportStep < 4 && <div className="mb-4 flex items-center gap-2 overflow-x-auto">{SUPPORT_STEPS.map((label, index) => <StatusBadge key={label} tone={index === supportStep ? 'success' : 'neutral'} label={`${index < supportStep ? '✓ ' : `${index + 1} `}${label}`} />)}</div>}
      {supportStep === 0 && <div className="space-y-4">
        <div className="flex items-center justify-between gap-3"><span className="text-sm font-bold text-[var(--color-text-secondary)]">اختر المستفيدين لتقديم الدعم لهم</span><StatusBadge tone="neutral" label={`محدد: ${supportIds.size}`} /></div>
        {supportIds.size === 0 && <p role="status" className="text-sm text-[var(--color-text-muted)]">اختر مستفيداً واحداً على الأقل للمتابعة.</p>}
        <SearchField label="بحث دعم المستفيد" value={supportSearch} onChange={(e) => setSupportSearch(e.target.value)} placeholder="اسم المستفيد أو الجوال" />
        <div className="ikram-table-wrap max-h-60 overflow-auto"><table className="ikram-table"><thead><tr><th>#</th><th>اسم المستفيد</th><th>الجوال</th><th>المدينة والحي</th></tr></thead><tbody>{supportPeople.filter((person) => !person.archived_at && (!supportSearch || `${person.full_name || ''} ${person.phone || ''}`.includes(supportSearch))).map((person) => <tr key={person.id} onClick={() => toggleSupport(person.id)} className={supportIds.has(person.id) ? 'bg-[var(--color-bg-soft)] font-bold' : ''}><td><input type="checkbox" checked={supportIds.has(person.id)} readOnly /></td><td>{person.full_name}</td><td className="ikram-numeric">{person.phone || '—'}</td><td>{person.city || '—'} - {person.district || '—'}</td></tr>)}</tbody></table></div>
      </div>}
      {supportStep === 1 && <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{supportItems.map((item) => <button key={item.id} type="button" onClick={() => setSupportItemId(item.id)} className={`ikram-panel p-4 text-right ${supportItemId === item.id ? 'border-[var(--color-brand-gold)]' : ''}`}><div className="text-sm font-bold text-[var(--color-text-primary)]">{item.name}</div><div className="mt-2 text-xs font-bold text-[var(--color-text-muted)]">المتوفّر: {item.current_quantity ?? item.stock_quantity ?? 0}</div></button>)}{!supportItemId && <p role="status" className="text-sm text-[var(--color-text-muted)] sm:col-span-2">اختر نوع الدعم للمتابعة.</p>}<FormField label="الكمية" name="support-qty" className="sm:col-span-2"><input aria-label="كمية الدعم" className="ikram-control" value={supportQty} onChange={(e) => setSupportQty(e.target.value)} /></FormField></div>}
      {supportStep === 2 && <div className="grid gap-4 sm:grid-cols-2"><FormField label="طريقة التنفيذ" name="support-method"><select aria-label="طريقة تسليم الدعم" className="ikram-control" value={supportMethod} onChange={(e) => setSupportMethod(e.target.value)}><option value="pickup">استلام مباشر</option><option value="delivery">توصيل منزلي</option></select></FormField><FormField label="تاريخ التسليم" name="support-date"><input aria-label="تاريخ تسليم الدعم" type="date" className="ikram-control" value={supportDate} onChange={(e) => setSupportDate(e.target.value)} /></FormField>{supportMethod === 'pickup' && <FormField label="موقع الاستلام" name="support-location" className="sm:col-span-2" required error={supportLocation ? undefined : 'موقع الاستلام مطلوب للاستلام المباشر.'}><select aria-label="موقع تسليم الدعم" className="ikram-control" value={supportLocation} onChange={(e) => setSupportLocation(e.target.value)}><option value="">اختر الموقع</option>{supportLocations.filter((place) => place.is_active !== false).map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}</select></FormField>}</div>}
      {supportStep === 3 && <div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><KpiCard title="عدد المستفيدين" value={supportIds.size} iconColor="green" /><KpiCard title="الدعم المختار" value={supportItems.find((item) => item.id === supportItemId)?.name || '—'} iconColor="gold" /><KpiCard title="طريقة التنفيذ" value={supportMethod === 'pickup' ? 'استلام مباشر' : 'توصيل منزلي'} iconColor="green" /></div>}
      {supportStep < 4 && <div className="mt-6 flex flex-wrap items-center justify-between gap-2"><SecondaryButton type="button" onClick={() => setSupportOpen(false)}>إلغاء</SecondaryButton><div className="flex gap-2"><SecondaryButton type="button" disabled={supportStep === 0} onClick={() => setSupportStep((step) => step - 1)}>السابق</SecondaryButton>{supportStep < 3 ? <PrimaryButton type="button" disabled={(supportStep === 0 && supportIds.size === 0) || (supportStep === 1 && !supportItemId) || (supportStep === 2 && supportMethod === 'pickup' && !supportLocation)} onClick={() => setSupportStep((step) => step + 1)}>التالي</PrimaryButton> : <PrimaryButton type="button" loading={supportBusy} disabled={supportBusy} onClick={submitSupport}>تقديم الدعم</PrimaryButton>}</div></div>}
      {supportStep === 4 && <div className="space-y-4 text-center"><StatusBadge tone="success" label="تم إنشاء طلبات الدعم للمستفيدين المحددين." /><SecondaryButton type="button" onClick={() => setSupportOpen(false)}>إغلاق</SecondaryButton></div>}
    </Dialog>
    </PageShell>
  </MainLayout>;
}
