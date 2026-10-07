import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import MainLayout from '../../components/layout/MainLayout';
import PageShell from '../../components/ui/PageShell';
import SectionCard from '../../components/ui/SectionCard';
import FormField from '../../components/ui/FormField';
import StatusBadge from '../../components/ui/StatusBadge';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import SearchField from '../../components/ui/SearchField';
import ActionMenu, { ActionMenuItem } from '../../components/ui/ActionMenu';
import { PrimaryButton, SecondaryButton } from '../../components/ui/Button';
import { canonicalSaudiPhone, displaySaudiPhone } from '../../utils/saudiPhone';

const emptyForm = { full_name: '', phone: '', vehicle_info: '', is_active: true };

function validPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return /^05\d{8}$/.test(digits) || /^9665\d{8}$/.test(digits);
}

export default function DriversDirectoryPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState(null);
  const [fieldError, setFieldError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    setError('');
    api.get('/support/drivers')
      .then((response) => setRows(response.data.data || []))
      .catch(() => setError('تعذر تحميل قائمة السائقين.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const visible = rows.filter((row) => {
    const phone = displaySaudiPhone(row.phone);
    const matchesQuery = !query || `${row.full_name} ${phone}`.includes(query.trim());
    const matchesStatus = !status || (status === 'active' ? row.is_active : !row.is_active);
    return matchesQuery && matchesStatus;
  });

  const save = async (event) => {
    event.preventDefault();
    if (!validPhone(form.phone)) {
      setFieldError('أدخل رقم جوال محليًا بصيغة 05xxxxxxxx.');
      return;
    }
    setSaving(true);
    setFieldError('');
    setNotice('');
    try {
      const payload = { full_name: form.full_name.trim(), phone: canonicalSaudiPhone(form.phone), vehicle_info: form.vehicle_info || null, is_active: Boolean(form.is_active) };
      if (form.id) await api.patch(`/support/drivers/${form.id}`, payload);
      else await api.post('/support/drivers', payload);
      setForm(null);
      setNotice(form.id ? 'تم حفظ بيانات السائق.' : 'تمت إضافة السائق.');
      load();
    } catch (requestError) {
      setFieldError(requestError.response?.data?.message || 'تعذر حفظ السائق.');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (row) => {
    setNotice('');
    try {
      await api.patch(`/support/drivers/${row.id}`, { is_active: !row.is_active });
      setNotice(row.is_active ? 'تم تعطيل السائق.' : 'تم تفعيل السائق.');
      load();
    } catch {
      setError('تعذر تحديث حالة السائق.');
    }
  };

  const assignmentAction = async (row, action) => {
    if (!row.open_assignment_id) {
      setNotice('يُنشأ رابط السائق عند تكليفه بمهام من صفحة التوصيل للمنازل.');
      return;
    }
    const id = row.open_assignment_id;
    try {
      if (action === 'copy' || action === 'create') {
        const response = await api.get(`/support/assignments/${id}/link`);
        const url = response.data?.data?.access_url;
        if (url) await navigator.clipboard.writeText(url);
        setNotice('تم نسخ الرابط. لن يُعرض الرمز في الشاشة.');
        return;
      }
      if (action === 'resend') {
        await api.post(`/support/assignments/${id}/resend`, { minutes: 60 });
        setNotice('تم إنشاء رابط جديد وإلغاء الرابط السابق.');
        return;
      }
      await api.post(`/support/assignments/${id}/send`);
      setNotice('تم إرسال الرابط عبر قناة الرسائل المعتمدة.');
    } catch {
      setError('تعذر تنفيذ إجراء الرابط.');
    }
  };

  return (
    <MainLayout>
      <PageShell
        title="إدارة السائقين"
        description="سجل السائقين ومهام التوصيل. السائق ليس حساب دخول."
        breadcrumbs={[{ label: 'إدارة السائقين' }]}
        primaryAction={<PrimaryButton type="button" onClick={() => { setForm({ ...emptyForm }); setFieldError(''); }}>إضافة سائق</PrimaryButton>}
      >
        {notice && <p role="status" className="ikram-panel p-3 text-sm">{notice}</p>}
        {error && <ErrorState compact title="تعذر تحميل السائقين" description={error} onRetry={load} />}
        <div className="grid gap-3 sm:grid-cols-3">
          <SearchField label="بحث عن سائق" placeholder="اسم السائق أو رقم الجوال" value={query} onChange={(event) => setQuery(event.target.value)} />
          <label className="text-xs font-bold">الحالة
            <select className="ikram-control mt-1" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">كل الحالات</option>
              <option value="active">نشط</option>
              <option value="inactive">معطّل</option>
            </select>
          </label>
        </div>
        {form && (
          <SectionCard title={form.id ? 'تعديل بيانات السائق' : 'إضافة سائق'}>
            <form id="driver-form" onSubmit={save} className="grid gap-3 sm:grid-cols-2">
              <FormField label="اسم السائق" name="driver-name" required>
                <input className="ikram-control" value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} required />
              </FormField>
              <FormField label="رقم الجوال" name="driver-phone" required error={fieldError}>
                <input className="ikram-control" dir="ltr" inputMode="tel" placeholder="05xxxxxxxx" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} required />
              </FormField>
              <FormField label="الحالة" name="driver-status">
                <select className="ikram-control" value={form.is_active ? 'active' : 'inactive'} onChange={(event) => setForm({ ...form, is_active: event.target.value === 'active' })}>
                  <option value="active">نشط</option>
                  <option value="inactive">معطّل</option>
                </select>
              </FormField>
              <div className="flex items-end gap-2 sm:col-span-2">
                <PrimaryButton type="submit" disabled={saving}>{saving ? 'جارٍ الحفظ' : 'حفظ'}</PrimaryButton>
                <SecondaryButton type="button" onClick={() => setForm(null)}>إلغاء</SecondaryButton>
              </div>
            </form>
          </SectionCard>
        )}
        {loading && <p role="status">جارٍ تحميل السائقين…</p>}
        {!loading && visible.length === 0 && <EmptyState title="لا يوجد سائقون مطابقون" description="أضف سائقًا أو غيّر التصفية." />}
        {!loading && visible.length > 0 && (
          <div className="overflow-x-auto rounded-[var(--radius-panel)] border border-[var(--color-border)]">
            <table className="ikram-drivers-table w-full text-right text-sm">
              <thead>
                <tr>
                  {['اسم السائق', 'رقم الهاتف', 'الحالة', 'إجمالي المهام', 'جاري التوصيل', 'تم التوصيل', 'متبقي', 'آخر نشاط', 'اكتمال جميع المهام', 'الإجراءات'].map((label) => <th key={label} className="whitespace-nowrap p-3">{label}</th>)}
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.id} className="border-t border-[var(--color-border)]">
                    <td className="p-3">{row.full_name}</td>
                    <td className="p-3" dir="ltr">{displaySaudiPhone(row.phone)}</td>
                    <td className="p-3"><StatusBadge status={row.is_active ? 'active' : 'suspended'} label={row.is_active ? 'نشط' : 'معطّل'} /></td>
                    <td className="p-3">{row.assigned_count ?? 0}</td>
                    <td className="p-3">{row.in_progress_count ?? 0}</td>
                    <td className="p-3">{row.delivered_count ?? 0}</td>
                    <td className="p-3">{row.remaining_count ?? 0}</td>
                    <td className="p-3">{row.last_activity ? new Date(row.last_activity).toLocaleString('ar-SA') : '—'}</td>
                    <td className="p-3">{row.all_completed ? 'نعم' : 'لا'}</td>
                    <td className="p-3">
                      <ActionMenu label={`إجراءات ${row.full_name}`} className="[&>div]:static">
                        <ActionMenuItem onClick={() => navigate('/delivery')}>عرض المهام</ActionMenuItem>
                        <ActionMenuItem onClick={() => { setFieldError(''); setForm({ id: row.id, full_name: row.full_name, phone: displaySaudiPhone(row.phone), vehicle_info: row.vehicle_info || '', is_active: row.is_active }); }}>تعديل</ActionMenuItem>
                        <ActionMenuItem onClick={() => toggle(row)}>{row.is_active ? 'تعطيل' : 'تفعيل'}</ActionMenuItem>
                        <ActionMenuItem onClick={() => assignmentAction(row, 'create')}>إنشاء الرابط</ActionMenuItem>
                        <ActionMenuItem onClick={() => assignmentAction(row, 'resend')}>إعادة إنشاء الرابط</ActionMenuItem>
                        <ActionMenuItem onClick={() => assignmentAction(row, 'copy')}>نسخ الرابط</ActionMenuItem>
                        <ActionMenuItem onClick={() => assignmentAction(row, 'send')}>إرسال الرابط</ActionMenuItem>
                      </ActionMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageShell>
    </MainLayout>
  );
}
