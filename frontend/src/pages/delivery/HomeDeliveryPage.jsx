import { useCallback, useEffect, useState } from 'react';
import api from '../../api/axios';
import MainLayout from '../../components/layout/MainLayout';
import PagePermissionGuard from '../../components/common/PagePermissionGuard';
import PageShell from '../../components/ui/PageShell';
import SectionCard from '../../components/ui/SectionCard';
import KpiCard from '../../components/ui/KpiCard';
import FilterBar from '../../components/ui/FilterBar';
import DataTable from '../../components/ui/DataTable';
import FormField from '../../components/ui/FormField';
import SearchField from '../../components/ui/SearchField';
import StatusBadge from '../../components/ui/StatusBadge';
import ActionMenu, { ActionMenuItem } from '../../components/ui/ActionMenu';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import ConfirmationDialog from '../../components/ui/ConfirmationDialog';
import { PrimaryButton, SecondaryButton } from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { canViewSupport } from '../../utils/modulePermissions';
import { supportGrant, useSupportOperations } from '../../components/support/SupportOperations';
import { deliverySelectionEligibility } from '../../utils/deliverySelection';
import { displayLabel } from '../../utils/displayVocabulary';
import { displaySaudiPhone } from '../../utils/saudiPhone';
import { getDocumentPdfUrl, openProtectedDocument } from '../../utils/documentUrl';

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
  const [pendingResend, setPendingResend] = useState(null);
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
      console.error('Driver list request failed', error.response?.status || 'network');
      operations.setMessage('تعذر تحميل قائمة السائقين. يرجى المحاولة مرة أخرى.');
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
  const copyUrl = async (url) => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      operations.setMessage('تم نسخ الرابط. شاركه يدوياً مع السائق.');
    } catch {
      operations.setMessage('تعذر النسخ التلقائي. حدد الرابط وانسخه يدوياً.');
    }
  };
  const reveal = async (assignmentId) => {
    await operations.run(async () => {
      const response = await api.get(`/support/assignments/${assignmentId}/link`);
      const url = response.data?.data?.access_url || response.data?.access_url;
      rememberLink(response, assignmentId, false);
      if (url) await navigator.clipboard.writeText(url).catch(() => {});
    }, 'تم عرض الرابط الحالي. النسخ لا يدوّر الرابط.');
  };
  const selection = deliverySelectionEligibility(operations.data || [], selected);
  const queue = operations.metrics?.queue || {};
  const operational = operations.metrics?.operational;
  const activeFilters = ['q', 'status', 'date_from', 'date_to', 'due_from', 'due_to', 'district', 'metrics_from', 'metrics_to'].filter((key) => operations.filters[key]).length;

  return (
    <MainLayout>
      <PageShell
        breadcrumbs={[{ label: 'التوصيل', to: '/delivery' }, { label: 'إدارة التوصيل للمنازل' }]}
        title="إدارة التوصيل للمنازل"
        description="مؤشرات الفترة منفصلة عن لقطة الطابور. التكليف يتم لسائق موجود، والرابط يُنسخ أو يُرسل من المولّد نفسه."
      >
        {operations.message && <p role="alert" className="ikram-panel p-4">{operations.message}</p>}
        <FilterBar
          activeCount={activeFilters}
          onReset={() => ['q', 'status', 'date_from', 'date_to', 'due_from', 'due_to', 'district', 'employee_id', 'metrics_from', 'metrics_to'].forEach((key) => operations.filter(key, ''))}
          search={(
            <SearchField label="بحث التوصيل" placeholder="بحث باسم المستفيد أو المرجع" value={operations.filters.q} onChange={(event) => operations.filter('q', event.target.value)} />
          )}
        >
          <FormField label="بداية فترة الاستحقاق" name="metrics-from" helperText="تُحسب مؤشرات الفترة على تاريخ الاستحقاق.">
            <input type="date" className="ikram-control" value={operations.filters.metrics_from || ''} onChange={(event) => operations.filter('metrics_from', event.target.value)} />
          </FormField>
          <FormField label="نهاية فترة الاستحقاق" name="metrics-to">
            <input type="date" className="ikram-control" value={operations.filters.metrics_to || ''} onChange={(event) => operations.filter('metrics_to', event.target.value)} />
          </FormField>
          <FormField label="الحالة" name="delivery-status">
            <select className="ikram-control" value={operations.filters.status} onChange={(event) => operations.filter('status', event.target.value)}>
              <option value="">جميع الحالات</option>
              {['draft', 'approved', 'reserved', 'ready', 'in_delivery', 'completed', 'cancelled'].map((status) => <option key={status} value={status}>{displayLabel('status', status)}</option>)}
            </select>
          </FormField>
          <FormField label="الحي" name="delivery-district">
            <input className="ikram-control" value={operations.filters.district} onChange={(event) => operations.filter('district', event.target.value)} />
          </FormField>
          <FormField label="تاريخ الاستلام من" name="delivery-date-from" helperText="يصفي السجل حسب الإكمال الفعلي، ولا يغيّر لقطة الطابور.">
            <input type="date" className="ikram-control" value={operations.filters.date_from} onChange={(event) => operations.filter('date_from', event.target.value)} />
          </FormField>
          <FormField label="تاريخ الاستلام إلى" name="delivery-date-to">
            <input type="date" className="ikram-control" value={operations.filters.date_to} onChange={(event) => operations.filter('date_to', event.target.value)} />
          </FormField>
        </FilterBar>

        <SectionCard title="مؤشرات الفترة" description="المستحق والمكتمل وغير المكتمل والمتأخر تأتي من خدمة المؤشرات التشغيلية لعمليات التوصيل فقط.">
          {operational ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard title="العمليات المستحقة" value={operational.total_due} subtitle="حسب تاريخ الاستحقاق" />
              <KpiCard title="اكتملت حتى نهاية الفترة" value={operational.completed_by_cutoff} />
              <KpiCard title="العمليات المستحقة غير المكتملة" value={operational.not_completed} />
              <KpiCard title="المتأخرة" value={operational.overdue} />
              <KpiCard title="المستفيدون المستحقون" value={operational.unique_due_beneficiaries} subtitle="أشخاص" />
              <KpiCard title="المستفيدون الذين اكتمل توصيلهم" value={operational.unique_completed_beneficiaries} subtitle="أشخاص" />
            </div>
          ) : <EmptyState title="حدد فترة الاستحقاق" description="مؤشرات الفترة تظهر بعد اختيار البداية والنهاية. لا تُحسب من لقطة الطابور." />}
        </SectionCard>

        <SectionCard title="لقطة طابور التوصيل" description="لقطة حالية غير مرتبطة بالفترة. لم يبدأ ما لم يدخل التوصيل، وجاري التوصيل هو ما قيد التوصيل، وتم التوصيل هو المكتمل. لا توجد حالة محفوظة لتعذر التوصيل، لذلك لا يُعرض عداد لها.">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="لقطة طابور التوصيل">
            <KpiCard title="لم يبدأ" value={queue.not_started ?? '—'} subtitle="لقطة حالية" />
            <KpiCard title="جاري التوصيل" value={queue.in_delivery ?? '—'} subtitle="لقطة حالية" />
            <KpiCard title="تم التوصيل" value={queue.completed ?? '—'} subtitle="لقطة حالية" />
          </div>
        </SectionCard>

        {admin && (
          <SectionCard title="تكليف سائق" description="يُختار السائق من الدليل. نجاح التكليف مستقل عن إرسال الرسالة.">
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="السائق" name="assignment-driver">
                <select aria-label="السائق" className="ikram-control" value={driverId} onChange={(event) => setDriverId(event.target.value)}>
                  <option value="">اختر سائقاً نشطاً</option>
                  {drivers.filter((row) => row.is_active).map((row) => <option key={row.id} value={row.id}>{row.full_name}</option>)}
                </select>
              </FormField>
              <FormField label="مدة صلاحية الرابط بالدقائق" name="assignment-minutes">
                <input type="number" min="1" max="1440" className="ikram-control" value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} />
              </FormField>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <PrimaryButton disabled={operations.busy || !driverId || !selection.assignEligible} onClick={() => manage(async () => {
                const response = await api.post('/support/assignments', { driver_id: driverId, tasks: selected, minutes });
                rememberLink(response, response.data?.data?.id, false);
                setSelected([]);
              }, 'تم إنشاء التكليف. انسخ الرابط وشاركه يدوياً.')}>إنشاء التكليف ({selected.length})</PrimaryButton>
              <SecondaryButton disabled={operations.busy || !driverId || !selection.reassignEligible} onClick={() => manage(async () => {
                const response = await api.post('/support/assignments/reassign', { driver_id: driverId, tasks: selected, minutes });
                rememberLink(response, response.data?.data?.id, true);
                setSelected([]);
              }, 'تم نقل المهام المحددة. انسخ رابط السائق الجديد. انتهت صلاحية السائق السابق على هذه المهام فقط.')}>نقل التكليف إلى سائق آخر ({selected.length})</SecondaryButton>
            </div>
            {!selection.assignEligible && <p role="status">{selection.assignReason}</p>}
            {!selection.reassignEligible && <p role="status">{selection.reassignReason}</p>}
            {driversLoaded && drivers.filter((row) => row.is_active).length === 0 && <p role="status">لا يوجد سائق نشط.</p>}
            {manualLink && (
              <div className="mt-4 space-y-2" aria-label="رابط القدرة للمشاركة اليدوية">
                <p className="text-sm">{manualLink.rotated ? 'التدوير ألغى الرابط السابق. انسخ الرابط الجديد وشاركه يدوياً.' : 'عرض الرابط أو نسخه لا يدوّره ولا يرسله.'}</p>
                <input readOnly aria-label="رابط وصول السائق" className="ikram-control" dir="ltr" value={manualLink.url} autoComplete="off" spellCheck="false" />
                <SecondaryButton type="button" onClick={() => copyUrl(manualLink.url)}>نسخ الرابط</SecondaryButton>
              </div>
            )}
          </SectionCard>
        )}

        <SectionCard
          title="سجل التوصيل"
          description="الصفوف المكتملة تعرض هاتف المستفيد وعنوانه من لقطة التأكيد. السجلات القديمة بلا لقطة تبقى موسومة كسجل سابق."
          actions={supportGrant(user, 'export') ? <SecondaryButton disabled={operations.busy} onClick={operations.exportExcel}>تصدير Excel</SecondaryButton> : null}
        >
          {operations.filters.driver_id && <SecondaryButton onClick={() => operations.filter('driver_id', '')}>إلغاء تصفية السائق</SecondaryButton>}
          <DataTable
            data={operations.data || []}
            loading={operations.loading}
            emptyMessage={Object.values(operations.filters || {}).some((value) => String(value || '').trim() !== '') ? 'لا توجد عمليات تطابق التصفية.' : 'لا توجد عمليات توصيل مسجلة.'}
            columns={[
              { key: 'beneficiary', header: 'المستفيد', render: (task) => task.history_name || task.recipient_name },
              { key: 'phone', header: 'الهاتف', numeric: true, render: (task) => <span dir="ltr">{displaySaudiPhone(task.contact_phone) || '—'}</span> },
              { key: 'address', header: 'العنوان', render: (task) => <span className="block max-w-xs whitespace-normal break-words">{task.address || 'العنوان غير محدد'}</span> },
              { key: 'support', header: 'نوع الدعم', render: (task) => task.items?.map((item) => item.inventory_item?.name || item.name || 'دعم عيني').join('، ') || '—' },
              { key: 'driver', header: 'السائق', render: (task) => task.history_driver_name || task.driver?.full_name || 'لم يُعيّن سائق' },
              { key: 'id', header: 'رقم المهمة', render: (task) => <span className="break-all">{task.id}</span> },
              { key: 'completed_at', header: 'تاريخ ووقت التوصيل', render: (task) => task.completed_at ? new Date(task.completed_at).toLocaleString('ar-SA') : '—' },
              { key: 'status', header: 'الحالة', render: (task) => <StatusBadge status={task.status} label={displayLabel('status', task.status)} /> },
              { key: 'verification', header: 'طريقة التحقق', render: (task) => task.verification_method ? displayLabel('verification', task.verification_method) : '—' },
              { key: 'source', header: 'مصدر السجل', render: (task) => task.history_source === 'legacy' ? 'سجل سابق' : task.history_source === 'snapshot' ? 'لقطة التأكيد' : '—' },
              { key: 'actions', header: 'الإجراءات', render: (task) => (
                <div className="flex items-center gap-2">
                  {admin && (task.status === 'ready' || task.status === 'in_delivery') && (
                    <label className="flex items-center gap-2 text-xs">
                      <input type="checkbox" checked={selected.includes(task.id)} onChange={(event) => setSelected((old) => (event.target.checked ? [...old, task.id] : old.filter((value) => value !== task.id)))} />
                      {task.status === 'in_delivery' ? 'تحديد للنقل' : 'تحديد للتكليف'}
                    </label>
                  )}
                  <ActionMenu label={`إجراءات ${task.history_name || task.recipient_name}`}>
                    {supportGrant(user, 'fulfill') && ['ready', 'in_delivery'].includes(task.status) && <ActionMenuItem onClick={() => operations.run(() => api.post(`/support/distributions/${task.id}/receipt-code`), 'تم إصدار رمز الاستلام وجدولة رسالة المستلم.')}>إصدار رمز الاستلام</ActionMenuItem>}
                    {task.proof_available && <ActionMenuItem onClick={() => operations.run(() => openProtectedDocument(getDocumentPdfUrl(`/support/distributions/${task.id}/proof`)), 'تم فتح الوثيقة.')}>مستند إثبات التوصيل</ActionMenuItem>}
                    {['draft', 'approved', 'reserved', 'ready'].includes(task.status) && supportGrant(user, 'cancel') && <ActionMenuItem danger onClick={() => { if (window.confirm('تأكيد إلغاء طلب الدعم وإعادة حجز المخزون؟')) operations.run(() => api.patch(`/support/distributions/${task.id}/cancel`, {}), 'تم تحديث حالة الدعم.'); }}>إلغاء الدعم</ActionMenuItem>}
                  </ActionMenu>
                </div>
              ) },
            ]}
          />
        </SectionCard>

        {admin && (
          <SectionCard title="روابط التكليفات" description="النسخ يعرض الرابط المحفوظ. إعادة الإنشاء تلغي الرابط السابق. الإرسال يستخدم الرابط الحالي نفسه.">
            <DataTable
              data={assignments}
              emptyMessage="لا توجد تكليفات."
              columns={[
                { key: 'driver', header: 'السائق', render: (assignment) => assignment.driver?.full_name || '—' },
                { key: 'id', header: 'مرجع التكليف', render: (assignment) => <span className="break-all">{assignment.id}</span> },
                { key: 'state', header: 'الحالة', render: (assignment) => assignment.completed_at ? 'مكتمل' : assignment.revoked_at ? 'ملغي' : 'نشط' },
                { key: 'actions', header: 'الإجراءات', render: (assignment) => (
                  <ActionMenu label={`إجراءات تكليف ${assignment.driver?.full_name || ''}`}>
                    {!assignment.completed_at && !assignment.revoked_at && <ActionMenuItem onClick={() => reveal(assignment.id)}>نسخ الرابط</ActionMenuItem>}
                    {!assignment.completed_at && !assignment.revoked_at && <ActionMenuItem onClick={() => manage(() => api.post(`/support/assignments/${assignment.id}/send`), 'تم تمرير الرابط الحالي إلى رسالة السائق.')}>إرسال الرابط</ActionMenuItem>}
                    {!assignment.completed_at && <ActionMenuItem onClick={() => setPendingResend(assignment.id)}>إعادة إنشاء الرابط</ActionMenuItem>}
                    {!assignment.completed_at && !assignment.revoked_at && <ActionMenuItem danger onClick={() => manage(() => api.post(`/support/assignments/${assignment.id}/revoke`), 'تم إلغاء صلاحية الرابط.')}>إلغاء الرابط</ActionMenuItem>}
                  </ActionMenu>
                ) },
              ]}
            />
          </SectionCard>
        )}
        <ConfirmationDialog
          isOpen={Boolean(pendingResend)}
          type="warning"
          title="إعادة إنشاء الرابط"
          message="سيتوقف الرابط السابق عن العمل، ويُنشأ رابط جديد لهذا التكليف."
          confirmLabel="إعادة إنشاء الرابط"
          onClose={() => setPendingResend(null)}
          onConfirm={() => {
            const id = pendingResend;
            setPendingResend(null);
            manage(async () => {
              const response = await api.post(`/support/assignments/${id}/resend`, { minutes });
              rememberLink(response, id, true);
            }, 'تم تدوير الرابط. الرابط السابق لم يعد صالحاً.');
          }}
        />
        {operations.message && operations.message.startsWith('تعذر') && <ErrorState title="تعذر إكمال الإجراء" description={operations.message} />}
      </PageShell>
    </MainLayout>
  );
}
