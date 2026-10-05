import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../api/axios';
import { displayLabel } from '../../utils/displayVocabulary';
import { exportApiDataToExcel } from '../../utils/excelExport';
import { getDocumentPdfUrl, openProtectedDocument } from '../../utils/documentUrl';

export function supportGrant(user, action) {
  return user?.role === 'admin' || (!['readonly', 'driver', 'delivery_driver'].includes(user?.role) && user?.permissions?.support?.[action] === true);
}

export function useSupportOperations(method) {
  const [params] = useSearchParams();
  const [filters, setFilters] = useState({ q: '', status: '', date_from: '', date_to: '', district: '', driver_id: '', employee_id: '' });
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ data: [], last_page: 1, metrics: {} });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const taskId = params.get('task');
  const query = { ...filters, fulfillment_method: method, ...(taskId ? { reference: taskId } : {}) };
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/support/distributions', { params: { ...filters, fulfillment_method: method, ...(taskId ? { reference: taskId } : {}), page } });
      setResult(response.data);
      if (taskId && !response.data.data?.length) setMessage('العملية المطلوبة غير متاحة أو مؤرشفة. يمكنك العودة إلى السجل العام.');
    } catch (error) { setMessage(error.response?.data?.message || 'تعذر تحميل عمليات الدعم.'); }
    finally { setLoading(false); }
  }, [filters, method, taskId, page]);
  useEffect(() => { load(); }, [load]);
  const run = async (work, success) => {
    if (busy) return;
    setBusy(true); setMessage('');
    try { await work(); await load(); setMessage(success); }
    catch (error) { setMessage(error.response?.data?.message || 'تعذرت العملية.'); }
    finally { setBusy(false); }
  };
  const filter = (key, value) => { setFilters((old) => ({ ...old, [key]: value })); setPage(1); };
  const exportExcel = () => run(() => exportApiDataToExcel({
    endpoint: '/support/distributions', params: query,
    filename: method === 'pickup' ? 'direct-handover' : 'home-delivery',
    sheetName: method === 'pickup' ? 'الاستلام المباشر' : 'التوصيل للمنازل',
    metadata: { association: 'جمعية إكرام الجود لخدمة ضيوف الرحمن', title: method === 'pickup' ? 'تقرير الاستلام المباشر' : 'تقرير التوصيل للمنازل', range: [filters.date_from, filters.date_to].filter(Boolean).join(' — ') },
    transform: (task) => ({ 'المستفيد': task.recipient_name, 'المرجع': task.id, 'نوع الدعم': task.items?.map((item) => item.inventory_item?.name || item.inventory?.name || item.name || 'دعم عيني').join('، '), 'الحالة': displayLabel('status', task.status), 'العنوان': task.address || '', 'السائق': task.driver?.full_name || '', 'الموظف': task.receipt?.employee_name || '', 'تاريخ الاستلام': task.completed_at ? new Date(task.completed_at).toLocaleString('ar-SA') : '' }),
  }), 'تم تصدير جميع السجلات المطابقة.');
  return { ...result, filters, filter, page, setPage, query, message, setMessage, busy, loading, load, run, exportExcel };
}

export function SupportFilters({ operations, delivery = false }) {
  return <section className="ikram-panel grid gap-3 p-4 sm:grid-cols-3" aria-label="تصفية عمليات الدعم">
    <label>المستفيد أو المرجع أو نوع الدعم<input className="ikram-control mt-1" value={operations.filters.q} onChange={(e) => operations.filter('q', e.target.value)} /></label>
    <label>الحالة<select className="ikram-control mt-1" value={operations.filters.status} onChange={(e) => operations.filter('status', e.target.value)}><option value="">جميع الحالات</option>{['draft', 'approved', 'reserved', 'ready', ...(delivery ? ['in_delivery'] : []), 'completed', 'cancelled'].map((status) => <option key={status} value={status}>{displayLabel('status', status)}</option>)}</select></label>
    <label>الحي<input className="ikram-control mt-1" value={operations.filters.district} onChange={(e) => operations.filter('district', e.target.value)} /></label>
    <label>من تاريخ<input type="date" className="ikram-control mt-1" value={operations.filters.date_from} onChange={(e) => operations.filter('date_from', e.target.value)} /></label>
    <label>إلى تاريخ<input type="date" className="ikram-control mt-1" value={operations.filters.date_to} onChange={(e) => operations.filter('date_to', e.target.value)} /></label>
    <label>مرجع الموظف<input className="ikram-control mt-1" value={operations.filters.employee_id} onChange={(e) => operations.filter('employee_id', e.target.value)} /></label>
  </section>;
}

export function SupportTable({ operations, user, delivery = false, selected = [], onSelect }) {
  const transition = (task, action) => operations.run(() => api.patch(`/support/distributions/${task.id}/${action}`, {}), 'تم تحديث حالة الدعم.');
  const transitions = { draft: ['approve', 'approve', 'اعتماد'], approved: ['reserve', 'reserve', 'حجز المخزون'], reserved: ['ready', 'fulfill', 'تجهيز'] };
  return <section className="ikram-panel p-4 space-y-4">
    <div className="flex flex-wrap justify-between gap-3"><h2 className="font-bold">سجل {delivery ? 'التوصيل' : 'الاستلام المباشر'}</h2>{supportGrant(user, 'export') && <button className="ikram-control w-auto" disabled={operations.busy} onClick={operations.exportExcel}>تصدير Excel</button>}</div>
    {operations.query.reference && <a href={delivery ? '/delivery' : '/receiver'}>العودة إلى السجل العام</a>}
    {operations.loading && <p role="status">جارٍ تحميل السجل…</p>}
    {!operations.loading && !operations.data?.length && <p>لا توجد عمليات تطابق التصفية.</p>}
    <div className="overflow-x-auto"><table className="w-full text-sm text-right"><thead><tr>{['المستفيد', 'المرجع', 'نوع الدعم', 'الحالة', delivery ? 'السائق والعنوان' : 'رمز الاستلام', 'تاريخ الاستلام / الموظف', 'الإجراءات'].map((label) => <th className="p-3 border-b whitespace-nowrap" key={label}>{label}</th>)}</tr></thead><tbody>{operations.data?.map((task) => <tr key={task.id} className="border-b align-top">
      <td className="p-3">{task.recipient_name}</td><td className="p-3 break-all">{task.id}</td><td className="p-3">{task.items?.map((item, i) => <div key={item.id || i}>{item.inventory_item?.name || item.inventory?.name || item.name || 'دعم عيني'} — {item.requested_quantity} {item.unit_snapshot}</div>)}</td>
      <td className="p-3">{displayLabel('status', task.status)}</td><td className="p-3">{delivery ? <>{task.driver?.full_name || 'لم يُعيّن سائق'}<p>{task.address || 'العنوان غير محدد'}</p>{task.contact_phone && <span dir="ltr">{task.contact_phone}</span>}</> : 'رمز سري يُرسل للمستلم'}</td>
      <td className="p-3">{task.completed_at ? new Date(task.completed_at).toLocaleString('ar-SA') : '—'}<p>{task.receipt?.employee_name || '—'}</p></td>
      <td className="p-3 space-y-2">{transitions[task.status] && supportGrant(user, transitions[task.status][1]) && <button disabled={operations.busy} className="ikram-control" onClick={() => transition(task, transitions[task.status][0])}>{transitions[task.status][2]}</button>}
        {supportGrant(user, 'fulfill') && ['ready', 'in_delivery'].includes(task.status) && <button disabled={operations.busy} className="ikram-control" onClick={() => operations.run(() => api.post(`/support/distributions/${task.id}/receipt-code`), 'تم إصدار رمز الاستلام وجدولة رسالة المستلم.')}>إصدار رمز الاستلام</button>}
        {onSelect && (task.status === 'ready' || task.status === 'in_delivery') && <label className="flex gap-2"><input type="checkbox" checked={selected.includes(task.id)} onChange={(e) => onSelect(task.id, e.target.checked)} />{task.status === 'in_delivery' ? 'تحديد للنقل' : 'تحديد للتكليف'}</label>}
        {task.proof_available && <button className="ikram-control" onClick={() => operations.run(() => openProtectedDocument(getDocumentPdfUrl(`/support/distributions/${task.id}/proof`)), 'تم فتح الوثيقة.')}>{delivery ? 'إثبات التوصيل' : 'إيصال الاستلام'}</button>}
        {['draft', 'approved', 'reserved', 'ready'].includes(task.status) && supportGrant(user, 'cancel') && <button className="ikram-control" disabled={operations.busy} onClick={() => { if (window.confirm('تأكيد إلغاء طلب الدعم وإعادة حجز المخزون؟')) transition(task, 'cancel'); }}>إلغاء الدعم</button>}
      </td></tr>)}</tbody></table></div>
    <nav aria-label="صفحات السجل" className="flex items-center justify-center gap-4"><button disabled={operations.page <= 1 || operations.loading} onClick={() => operations.setPage(operations.page - 1)}>السابق</button><span>{operations.page} / {operations.last_page || 1}</span><button disabled={operations.page >= (operations.last_page || 1) || operations.loading} onClick={() => operations.setPage(operations.page + 1)}>التالي</button></nav>
  </section>;
}
