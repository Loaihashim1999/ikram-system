import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import MainLayout from '../../components/layout/MainLayout';
import PageHeader from '../../components/ui/PageHeader';
import PagePermissionGuard from '../../components/common/PagePermissionGuard';

const emptyDriver = { full_name: '', phone: '', vehicle_info: '' };

function DriversDirectoryContent() {
  const [drivers, setDrivers] = useState([]);
  const [driver, setDriver] = useState(emptyDriver);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const response = await api.get('/support/drivers');
    setDrivers(response.data.data || []);
  }, []);

  useEffect(() => {
    load().catch((error) => setMessage(error.response?.data?.message || 'تعذر تحميل دليل السائقين.'));
  }, [load]);

  const run = async (work, success) => {
    setBusy(true);
    setMessage('');
    try {
      await work();
      await load();
      setMessage(success);
    } catch (error) {
      setMessage(error.response?.data?.message || 'تعذر حفظ بيانات السائق.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <MainLayout>
      <main dir="rtl" className="mx-auto max-w-6xl space-y-5">
        <PageHeader
          title="دليل السائقين"
          subtitle="سجلات سائقين مخصصة داخل الحسابات. السائق لا يملك حساب دخول ولا صلاحيات النظام، ويصل إلى مهامه عبر رابط القدرة فقط."
        />
        {message && <p role="alert" className="ikram-panel p-4">{message}</p>}
        <section className="ikram-panel p-5 space-y-3">
          <h2 className="font-bold">نطاق الدليل</h2>
          <p className="text-sm leading-7">إضافة السائق وتعديله وتفعيله أو تعطيله تتم هنا. تعيين مهام التوصيل ونسخ رابط الوصول يتمان من إدارة التوصيل.</p>
          <Link to="/delivery" className="ikram-btn ikram-btn-outline inline-flex min-h-11 items-center px-4">الانتقال إلى إدارة التوصيل</Link>
        </section>
        <form
          className="ikram-panel grid gap-3 p-5 sm:grid-cols-3"
          onSubmit={(event) => {
            event.preventDefault();
            run(async () => {
              if (editing) await api.patch(`/support/drivers/${editing}`, driver);
              else await api.post('/support/drivers', driver);
              setEditing(null);
              setDriver(emptyDriver);
            }, 'تم حفظ السائق.');
          }}
        >
          <h2 className="font-bold sm:col-span-3">{editing ? 'تعديل السائق' : 'إضافة سائق'}</h2>
          <label>اسم السائق<input required className="ikram-control mt-1" value={driver.full_name} onChange={(event) => setDriver({ ...driver, full_name: event.target.value })} /></label>
          <label>هاتف السائق<input required type="tel" className="ikram-control mt-1" value={driver.phone} onChange={(event) => setDriver({ ...driver, phone: event.target.value })} /></label>
          <label>بيانات المركبة<input className="ikram-control mt-1" value={driver.vehicle_info} onChange={(event) => setDriver({ ...driver, vehicle_info: event.target.value })} /></label>
          <div className="flex flex-wrap gap-2 sm:col-span-3">
            <button disabled={busy} className="ikram-btn ikram-btn-primary min-h-11 px-4">{editing ? 'حفظ التعديل' : 'إضافة السائق'}</button>
            {editing && <button type="button" className="ikram-btn ikram-btn-outline min-h-11 px-4" onClick={() => { setEditing(null); setDriver(emptyDriver); }}>إلغاء التعديل</button>}
          </div>
        </form>
        <section className="ikram-panel overflow-x-auto p-5">
          <h2 className="mb-3 font-bold">السائقون المسجلون</h2>
          <table className="ikram-table w-full text-right text-sm">
            <thead>
              <tr>{['السائق', 'الهاتف', 'المركبة', 'المعيّن', 'جاري التوصيل', 'المتبقي', 'الحالة', 'الإجراءات'].map((label) => <th key={label}>{label}</th>)}</tr>
            </thead>
            <tbody>
              {drivers.map((row) => (
                <tr key={row.id}>
                  <td>{row.full_name}</td>
                  <td dir="ltr">{row.phone}</td>
                  <td>{row.vehicle_info || '—'}</td>
                  <td>{row.assigned_count ?? 0}</td>
                  <td>{row.in_progress_count ?? 0}</td>
                  <td>{row.remaining_count ?? 0}</td>
                  <td>{row.is_active ? 'نشط' : 'معطّل'}</td>
                  <td className="flex flex-wrap gap-2">
                    <button className="ikram-btn ikram-btn-outline min-h-11 px-3" onClick={() => { setEditing(row.id); setDriver({ full_name: row.full_name, phone: row.phone, vehicle_info: row.vehicle_info || '' }); }}>تعديل</button>
                    <button className="ikram-btn ikram-btn-outline min-h-11 px-3" disabled={busy} onClick={() => run(() => api.patch(`/support/drivers/${row.id}`, { is_active: !row.is_active }), 'تم تحديث حالة السائق.')}>{row.is_active ? 'تعطيل' : 'تفعيل'}</button>
                  </td>
                </tr>
              ))}
              {drivers.length === 0 && <tr><td colSpan="8">لا يوجد سائقون مسجلون.</td></tr>}
            </tbody>
          </table>
        </section>
      </main>
    </MainLayout>
  );
}

export default function DriversDirectoryPage() {
  return <PagePermissionGuard canAccess={(user) => user?.role === 'admin'}><DriversDirectoryContent /></PagePermissionGuard>;
}
