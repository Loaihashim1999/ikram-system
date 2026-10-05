import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import MainLayout from '../../components/layout/MainLayout';
import PageHeader from '../../components/ui/PageHeader';
import PagePermissionGuard from '../../components/common/PagePermissionGuard';
import { useAuth } from '../../context/AuthContext';
import { canViewSupport } from '../../utils/modulePermissions';
import { SupportFilters, SupportTable, useSupportOperations } from '../../components/support/SupportOperations';
import { deliverySelectionEligibility } from '../../utils/deliverySelection';

export default function HomeDeliveryPage() {
  return <PagePermissionGuard canAccess={canViewSupport}><HomeDeliveryContent /></PagePermissionGuard>;
}

function HomeDeliveryContent() {
  const { user } = useAuth();
  const operations = useSupportOperations('delivery');
  const [drivers, setDrivers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [driverId, setDriverId] = useState('');
  const [selected, setSelected] = useState([]);
  const [minutes, setMinutes] = useState(480);
  const [manualLink, setManualLink] = useState(null);
  const [driversLoaded, setDriversLoaded] = useState(false);
  const admin = user?.role === 'admin';

  const loadDrivers = useCallback(async () => {
    if (!admin) return;
    try {
      const [driversResponse, assignmentsResponse] = await Promise.all([api.get('/support/drivers'), api.get('/support/assignments')]);
      setDrivers(driversResponse.data.data || []);
      setDriversLoaded(true);
      let rows = assignmentsResponse.data.data || [];
      for (let page = 2; page <= (assignmentsResponse.data.last_page || 1); page += 1) {
        const next = await api.get('/support/assignments', { params: { page } });
        rows = rows.concat(next.data.data);
      }
      setAssignments(rows);
    } catch (error) {
      operations.setMessage(error.response?.data?.message || 'تعذر تحميل السائقين والتكليفات.');
    } finally {
      setDriversLoaded(true);
    }
  }, [admin, operations.setMessage]);

  useEffect(() => { loadDrivers(); }, [loadDrivers]);

  const manage = (work, success) => operations.run(async () => { await work(); await loadDrivers(); }, success);
  const rememberLink = (response, assignmentId, rotated) => {
    const url = response.data?.access_url || response.data?.data?.access_url;
    if (url) setManualLink({ url, assignmentId, rotated });
  };
  const reveal = async (assignmentId) => {
    setManualLink(null);
    await operations.run(async () => {
      const response = await api.get(`/support/assignments/${assignmentId}/link`);
      rememberLink(response, assignmentId, false);
    }, 'تم عرض الرابط الحالي. النسخ مشاركة يدوية ولا يدوّر الرابط.');
  };
  const copyLink = async () => {
    if (!manualLink?.url) return;
    try {
      await navigator.clipboard.writeText(manualLink.url);
      operations.setMessage('تم نسخ الرابط. شاركه يدوياً مع السائق.');
    } catch {
      operations.setMessage('تعذر النسخ التلقائي. حدد الرابط وانسخه يدوياً.');
    }
  };
  const selection = deliverySelectionEligibility(operations.data || [], selected);
  const metrics = operations.metrics || {};

  return (
    <MainLayout>
      <main dir="rtl" className="mx-auto max-w-7xl space-y-5">
        <PageHeader title="التوصيل للمنازل" subtitle="اختيار سائق موجود، ثم التكليف أو إعادة التكليف، مع نسخ رابط القدرة يدوياً دون الاعتماد على رسالة الجوال." />
        {operations.message && <p role="alert" className="ikram-panel p-4">{operations.message}</p>}
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="مؤشرات التوصيل">
          {Object.entries({ total: 'إجمالي طلبات التوصيل', in_delivery: 'جاري التوصيل', completed: 'تم التوصيل', not_started: 'لم يبدأ', cancelled: 'ملغي', delivered_beneficiaries: 'المستفيدون الذين تم التوصيل لهم', remaining: 'إجمالي المتبقي' }).map(([key, label]) => (
            <div className="ikram-panel p-4" key={key}><p>{label}</p><strong className="text-2xl">{metrics[key] ?? '—'}</strong></div>
          ))}
        </section>
        {admin && (
          <>
            <section className="ikram-panel space-y-4 p-5">
              <h2 className="font-bold">تكليف سائق بمهام التوصيل المحددة</h2>
              <p className="text-sm leading-7">يُختار السائق من الدليل. إضافة السائقين وتفعيلهم تتم من <Link className="font-bold underline" to="/admin/drivers">دليل السائقين</Link>. نجاح التكليف مستقل عن إرسال الرسالة.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label>السائق
                  <select aria-label="السائق" className="ikram-control mt-1" value={driverId} onChange={(event) => setDriverId(event.target.value)}>
                    <option value="">اختر سائقاً نشطاً</option>
                    {drivers.filter((row) => row.is_active).map((row) => <option key={row.id} value={row.id}>{row.full_name}</option>)}
                  </select>
                </label>
                <label>مدة صلاحية الرابط بالدقائق
                  <input type="number" min="1" max="1440" className="ikram-control mt-1" value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} />
                </label>
                <button className="ikram-btn ikram-btn-primary" disabled={operations.busy || !driverId || !selection.assignEligible} onClick={() => manage(async () => {
                  const response = await api.post('/support/assignments', { driver_id: driverId, tasks: selected, minutes });
                  rememberLink(response, response.data?.data?.id, false);
                  setSelected([]);
                }, 'تم إنشاء التكليف. انسخ الرابط وشاركه يدوياً.')}>إنشاء التكليف ({selected.length})</button>
                <button className="ikram-btn ikram-btn-outline" disabled={operations.busy || !driverId || !selection.reassignEligible} onClick={() => manage(async () => {
                  const response = await api.post('/support/assignments/reassign', { driver_id: driverId, tasks: selected, minutes });
                  rememberLink(response, response.data?.data?.id, true);
                  setSelected([]);
                }, 'تم نقل المهام المحددة. انسخ رابط السائق الجديد. انتهت صلاحية السائق السابق على هذه المهام فقط.')}>نقل التكليف إلى سائق آخر ({selected.length})</button>
              </div>
              {!selection.assignEligible && <p role="status">{selection.assignReason}</p>}
              {!selection.reassignEligible && <p role="status">{selection.reassignReason}</p>}
              {driversLoaded && drivers.filter((row) => row.is_active).length === 0 && <p role="status">لا يوجد سائق نشط. أضف سائقاً من دليل السائقين أولاً.</p>}
            </section>
            {manualLink && (
              <section className="ikram-panel space-y-3 p-5" aria-label="رابط القدرة للمشاركة اليدوية">
                <h2 className="font-bold">{manualLink.rotated ? 'رابط جديد بعد التدوير' : 'رابط القدرة الحالي'}</h2>
                <p className="text-sm leading-7">{manualLink.rotated ? 'التدوير ألغى الرابط السابق. انسخ الرابط الجديد وشاركه يدوياً.' : 'عرض الرابط أو نسخه لا يدوّره ولا يرسله.'}</p>
                <input readOnly aria-label="رابط وصول السائق" className="ikram-control" dir="ltr" value={manualLink.url} autoComplete="off" spellCheck="false" />
                <button type="button" className="ikram-btn ikram-btn-primary" onClick={copyLink}>نسخ الرابط</button>
              </section>
            )}
          </>
        )}
        <SupportFilters operations={operations} delivery />
        {operations.filters.driver_id && <button onClick={() => operations.filter('driver_id', '')}>إلغاء تصفية السائق</button>}
        <SupportTable operations={operations} user={user} delivery selected={selected} onSelect={admin ? (id, checked) => setSelected((old) => (checked ? [...old, id] : old.filter((value) => value !== id))) : undefined} />
        {admin && (
          <section className="ikram-panel space-y-3 p-5">
            <h2 className="font-bold">روابط التكليفات</h2>
            <p className="text-sm leading-7">النسخ يعرض الرابط المحفوظ. التدوير إجراء مستقل يلغي القدرة السابقة.</p>
            {assignments.map((assignment) => (
              <article key={assignment.id} className="space-y-2 border-b py-3">
                <h3>{assignment.driver?.full_name}</h3>
                <p>مرجع التكليف: {assignment.id}</p>
                <p>{assignment.completed_at ? 'مكتمل' : assignment.revoked_at ? 'ملغي' : `صالح حتى ${new Date(assignment.expires_at).toLocaleString('ar-SA')}`}</p>
                {!assignment.completed_at && !assignment.revoked_at && <button className="ikram-btn ikram-btn-outline w-auto" disabled={operations.busy} onClick={() => reveal(assignment.id)}>عرض الرابط ونسخه</button>}
                {!assignment.completed_at && <button className="ikram-btn ikram-btn-outline w-auto" disabled={operations.busy} onClick={() => manage(async () => {
                  const response = await api.post(`/support/assignments/${assignment.id}/resend`, { minutes });
                  rememberLink(response, assignment.id, true);
                }, 'تم تدوير الرابط. الرابط السابق لم يعد صالحاً.')}>تدوير الرابط</button>}
                {!assignment.completed_at && !assignment.revoked_at && <button className="ikram-btn ikram-btn-dangerOutline w-auto" disabled={operations.busy} onClick={() => manage(() => api.post(`/support/assignments/${assignment.id}/revoke`), 'تم إلغاء صلاحية الرابط.')}>إلغاء الرابط</button>}
              </article>
            ))}
          </section>
        )}
      </main>
    </MainLayout>
  );
}
