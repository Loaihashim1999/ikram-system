import { useCallback, useEffect, useState } from 'react';
import './driver-access.css';

const accessToken = window.location.hash.slice(1);
if (window.location.pathname === '/driver-access') window.history.replaceState(null, '', '/driver-access');
const endpoint = import.meta.env.VITE_API_URL || '/api';

export default function DriverAccessPage() {
  const [token, setToken] = useState(accessToken);
  useEffect(() => {
    const change = () => { const next = window.location.hash.slice(1); if (next) { window.history.replaceState(null, '', '/driver-access'); setToken(next); } };
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  const [assignment, setAssignment] = useState(null);
  const [selected, setSelected] = useState(null);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [terminal, setTerminal] = useState(false);
  const [completed, setCompleted] = useState(false);
  const request = useCallback(async (path = '', body) => {
    const response = await fetch(endpoint + '/driver-access' + path, {
      method: body ? 'POST' : 'GET', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Driver-Token': token },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json();
    if (!response.ok) {
      if ([401, 403, 410].includes(response.status)) {
        setTerminal(true); setCompleted(Boolean(result.completed)); setAssignment(null); setSelected(null);
      }
      throw new Error(result.message || 'تعذر إتمام الطلب.');
    }
    return result;
  }, [token]);
  const load = useCallback(async () => {
    setLoading(true); setMessage(''); setTerminal(false); setCompleted(false); setSelected(null); setAssignment(null);
    try { const result = await request(); setAssignment(result.data); setCompleted(Boolean(result.data?.all_completed)); }
    catch (error) { setMessage(error.message === 'Failed to fetch' ? 'تعذر الاتصال. تحقق من الإنترنت ثم حاول مجدداً.' : error.message); }
    finally { setLoading(false); }
  }, [request]);
  useEffect(() => { load(); }, [load]);
  const confirm = async (event) => {
    event.preventDefault(); if (busy) return;
    setBusy(true); setMessage('');
    try {
      const result = await request('/tasks/' + selected.id + '/confirm', { code });
      setCode(''); setSelected(null);
      await load();
      setCompleted(Boolean(result.completed));
      setMessage(result.completed ? 'اكتملت جميع المهام. تم حفظ سجل التوصيل.' : result.message);
    } catch (error) { setMessage(error.message === 'Failed to fetch' ? 'تعذر الاتصال؛ تحقق من حالة المهمة قبل إعادة المحاولة.' : error.message); }
    finally { setBusy(false); }
  };
  const taskCard = (task, detail = false) => <article className="driver-card" key={task.id}>
    <div className="driver-card-heading"><h2>{task.recipient_name}</h2><span className={task.status === 'completed' ? 'driver-done' : 'driver-pending'}>{task.status === 'completed' ? 'تم التوصيل' : 'قيد التوصيل'}</span></div>
    <p className="driver-muted">رقم المهمة: {task.reference || task.id}</p>
    <p>نوع الدعم: {task.support_type || task.items.map((item) => item.name).join('، ')}</p>
    {task.completed_at && <p>تاريخ التوصيل: <bdi>{new Date(task.completed_at).toLocaleString('ar-SA')}</bdi></p>}
    <p>{[task.city, task.district].filter(Boolean).join('، ') || 'المدينة والحي غير محددين'}</p>
    <p>{task.address || 'العنوان غير متوفر — تواصل مع الإدارة'}</p>
    {task.phone && /^\+?[0-9]{9,15}$/.test(task.phone) ? <a className="driver-action secondary" href={'tel:' + task.phone} dir="ltr">اتصال: {task.phone}</a> : <p>رقم التواصل غير متوفر</p>}
    {task.location_url && /^https?:/.test(task.location_url) ? <a className="driver-action secondary" href={task.location_url} target="_blank" rel="noopener noreferrer">فتح الموقع</a> : <p className="driver-muted">رابط الموقع غير متوفر</p>}
    <ul className="driver-items">{task.items.map((item, i) => <li key={i}><span>{item.name}</span><strong>{item.quantity} {item.unit}</strong></li>)}</ul>
    {!detail && task.status !== 'completed' && <button className="driver-action" onClick={() => { setSelected(task); setCode(''); setMessage(''); }}>عرض المهمة وتأكيد الاستلام</button>}
  </article>;
  return <main className="driver-shell" dir="rtl">
    <header className="driver-header"><span>إكرام • التوصيل</span><h1>{completed ? 'اكتمل التكليف' : 'مهام التوصيل'}</h1><p>وصول مؤقت وآمن لمهام هذا الرابط، بلا حساب دخول.</p></header>
    <div className="driver-content">
      {message && <div role="alert" className={completed ? 'driver-message success' : 'driver-message'}>{message}</div>}
      {loading && <div role="status" className="driver-card">جارٍ تحميل المهام…</div>}
      {!loading && !assignment && !terminal && <button className="driver-action" onClick={load}>إعادة المحاولة</button>}
      {terminal && <section className="driver-card"><h2>{completed ? 'شكرًا لجهودك' : 'الرابط غير متاح'}</h2><p>{completed ? 'تم حفظ سجل الاستلام وانتهت صلاحية هذا الرابط.' : 'تواصل مع الإدارة للحصول على تكليف صالح.'}</p></section>}
      {assignment && !terminal && <>
        <section className="driver-card"><h2>مرحبًا، {assignment.driver_name}</h2><div className="driver-counts"><span>الإجمالي <b>{assignment.total}</b></span><span>مكتمل <b>{assignment.completed}</b></span><span>متبقي <b>{assignment.remaining}</b></span></div><p className="driver-muted">صالح حتى <bdi>{new Date(assignment.expires_at).toLocaleString('ar-SA')}</bdi></p></section>
        {selected ? <>
          <button className="driver-action secondary" onClick={() => { setSelected(null); setMessage(''); }}>العودة إلى المهام</button>
          {taskCard(selected, true)}
          <form onSubmit={confirm} className="driver-card"><label htmlFor="receipt-code">رمز الاستلام من المستلم</label><p className="driver-muted">أدخل الرمز المكوّن من أربعة أرقام بعد التسليم.</p><input id="receipt-code" className="driver-code" type="text" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} autoComplete="off" dir="ltr" value={code} onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} required/><button className="driver-action" type="submit" disabled={busy || code.length !== 4}>{busy ? 'جارٍ تأكيد الاستلام…' : 'تأكيد الاستلام'}</button></form>
        </> : assignment.tasks.map((task) => taskCard(task))}
      </>}
    </div>
  </main>;
}
