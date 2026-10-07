import { useCallback, useEffect, useState } from 'react';
import PageShell from '../../components/ui/PageShell';
import SectionCard from '../../components/ui/SectionCard';
import StatusBadge from '../../components/ui/StatusBadge';
import FormField from '../../components/ui/FormField';
import EmptyState from '../../components/ui/EmptyState';
import LoadingState from '../../components/ui/LoadingState';
import ErrorState from '../../components/ui/ErrorState';
import { PrimaryButton, SecondaryButton } from '../../components/ui/Button';
import { displayLabel } from '../../utils/displayVocabulary';
import { displaySaudiPhone } from '../../utils/saudiPhone';

const TOKEN_KEY = 'ekram.driverAccessToken';
const endpoint = import.meta.env.VITE_API_URL || '/api';

function readCapabilityToken() {
  const hash = window.location.hash.replace(/^#/, '');
  if (hash) {
    window.history.replaceState(null, '', window.location.pathname || '/driver-access');
    if (/^[a-f0-9]{64}$/.test(hash)) {
      sessionStorage.setItem(TOKEN_KEY, hash);
      return hash;
    }
    sessionStorage.removeItem(TOKEN_KEY);
    return '';
  }
  return sessionStorage.getItem(TOKEN_KEY) || '';
}

function failureCopy(status) {
  if (status === 410) return { title: 'انتهت صلاحية رابط الوصول', description: 'اطلب من الإدارة رابطاً جديداً.' };
  if (status === 403) return { title: 'رابط الوصول غير متاح، يرجى التواصل مع الإدارة', description: 'هذا التكليف لم يعد مفتوحاً.' };
  if (status === 401) return { title: 'رابط الوصول غير صالح', description: 'تأكد أنك فتحت الرابط الذي أرسلته الإدارة.' };
  return { title: 'تعذر تحميل مهام التوصيل', description: 'تحقق من الاتصال ثم أعد المحاولة.' };
}

export default function DriverAccessPage() {
  const [token, setToken] = useState(() => readCapabilityToken());
  const [assignment, setAssignment] = useState(null);
  const [selected, setSelected] = useState(null);
  const [code, setCode] = useState('');
  const [failure, setFailure] = useState(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const clearToken = () => {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken('');
  };

  const request = useCallback(async (path = '', body) => {
    const response = await fetch(endpoint + '/driver-access' + path, {
      method: body ? 'POST' : 'GET', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Driver-Token': token },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const terminal = [401, 403, 410].includes(response.status);
      if (terminal) clearToken();
      const error = new Error(terminal ? failureCopy(response.status).title : (result.message || 'تعذر تأكيد التوصيل.'));
      error.status = response.status;
      error.copy = terminal ? failureCopy(response.status) : null;
      throw error;
    }
    return result;
  }, [token]);

  const load = useCallback(async () => {
    setLoading(true);
    setNotice('');
    setFailure(null);
    setSelected(null);
    if (!token) {
      setAssignment(null);
      setFailure(failureCopy(401));
      setLoading(false);
      return;
    }
    try {
      const result = await request();
      setAssignment(result.data);
    } catch (error) {
      setAssignment(null);
      setFailure(error.copy || (error.message === 'Failed to fetch' ? failureCopy(0) : failureCopy(error.status || 0)));
    } finally {
      setLoading(false);
    }
  }, [request, token]);

  useEffect(() => {
    const preview = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('visual') : null;
    if (preview === 'assignments' || preview === 'empty') {
      setLoading(false);
      setFailure(null);
      setAssignment({
        driver_name: 'سائق EKRAM-VISUAL-PREVIEW',
        total: preview === 'empty' ? 0 : 1,
        completed: 0,
        remaining: preview === 'empty' ? 0 : 1,
        tasks: preview === 'empty' ? [] : [{
          id: 'visual-task',
          recipient_name: 'مستفيد EKRAM-VISUAL-PREVIEW',
          phone: '966574917155',
          address: 'حي المعاينة، شارع التجربة',
          city: 'مكة المكرمة',
          district: 'العزيزية',
          reference: 'EKRAM-VISUAL-PREVIEW',
          support_type: 'سلة غذائية',
          status: 'in_delivery',
          items: [{ name: 'سلة غذائية', quantity: 1, unit: 'حبة' }],
        }],
      });
      return;
    }
    if (preview === 'expired') {
      setLoading(false);
      setAssignment(null);
      setFailure(failureCopy(410));
      return;
    }
    load();
  }, [load]);

  const confirm = async (event) => {
    event.preventDefault();
    if (busy || !selected) return;
    setBusy(true);
    setNotice('');
    try {
      const result = await request('/tasks/' + selected.id + '/confirm', { code });
      setCode('');
      setSelected(null);
      await load();
      setNotice(result.completed ? 'اكتملت جميع المهام. تم حفظ سجل التوصيل.' : (result.message || 'تم تأكيد التوصيل.'));
    } catch (error) {
      if (error.copy) {
        setAssignment(null);
        setFailure(error.copy);
      } else {
        setNotice(error.message === 'Failed to fetch' ? 'تعذر تحميل مهام التوصيل' : error.message);
      }
    } finally {
      setBusy(false);
    }
  };

  const taskCard = (task, detail = false) => (
    <SectionCard key={task.id} title={task.recipient_name} actions={<StatusBadge status={task.status} label={displayLabel('status', task.status)} />}>
      <p>رقم المهمة: {task.reference || task.id}</p>
      <p>نوع الدعم: {task.support_type || task.items?.map((item) => item.name).filter(Boolean).join('، ') || '—'}</p>
      <p className="whitespace-normal break-words">{[task.city, task.district, task.address].filter(Boolean).join('، ') || 'العنوان غير متوفر — تواصل مع الإدارة'}</p>
      {task.phone ? <a className="ikram-btn ikram-btn-outline mt-2 inline-flex min-h-11 items-center px-4" href={'tel:' + task.phone} dir="ltr">اتصال: <span>{displaySaudiPhone(task.phone)}</span></a> : <p>رقم التواصل غير متوفر</p>}
      <ul className="mt-3 space-y-1">{task.items?.map((item, index) => <li key={item.name || index} className="flex justify-between gap-3"><span>{item.name}</span><strong>{item.quantity} {item.unit}</strong></li>)}</ul>
      {!detail && task.status !== 'completed' && <PrimaryButton className="mt-3 w-full" onClick={() => { setSelected(task); setCode(''); setNotice(''); }}>تأكيد التوصيل</PrimaryButton>}
    </SectionCard>
  );

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 py-6" dir="rtl">
      <PageShell title="مهام التوصيل الخاصة بك" description={assignment?.driver_name ? `مرحباً، ${assignment.driver_name}` : 'وصول مؤقت لمهام هذا الرابط، بلا حساب دخول.'}>
        {notice && <p role="status" className="ikram-panel p-4">{notice}</p>}
        {loading && <LoadingState message="جارٍ تحميل المهام…" />}
        {!loading && failure && <ErrorState title={failure.title} description={failure.description} onRetry={token ? load : undefined} />}
        {!loading && assignment && !failure && (
          <>
            <SectionCard title="ملخص التكليف">
              <div className="grid grid-cols-3 gap-2 text-center">
                <p>الإجمالي <strong className="block">{assignment.total}</strong></p>
                <p>مكتمل <strong className="block">{assignment.completed}</strong></p>
                <p>متبقي <strong className="block">{assignment.remaining}</strong></p>
              </div>
            </SectionCard>
            {selected ? (
              <>
                <SecondaryButton className="min-h-11" onClick={() => { setSelected(null); setNotice(''); }}>العودة إلى المهام</SecondaryButton>
                {taskCard(selected, true)}
                <form onSubmit={confirm}>
                  <SectionCard title="تأكيد التوصيل">
                    <FormField label="رمز الاستلام من المستلم" name="receipt-code" helperText="أدخل الرمز المكوّن من أربعة أرقام بعد التسليم.">
                      <input className="ikram-control ikram-numeric" type="text" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} autoComplete="off" dir="ltr" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 4))} required />
                    </FormField>
                    <PrimaryButton className="mt-3 min-h-11 w-full" type="submit" disabled={busy || code.length !== 4}>{busy ? 'جارٍ تأكيد التوصيل…' : 'تأكيد التوصيل'}</PrimaryButton>
                  </SectionCard>
                </form>
              </>
            ) : assignment.tasks?.length ? assignment.tasks.map((task) => taskCard(task)) : <EmptyState title="لا توجد مهام في هذا التكليف" description="إذا كان التكليف مكتملاً فقد أُغلق الرابط بعد انتهاء المهام." />}
            <SecondaryButton className="min-h-11" onClick={() => { clearToken(); setAssignment(null); setFailure(failureCopy(401)); }}>إنهاء الجلسة</SecondaryButton>
          </>
        )}
      </PageShell>
    </main>
  );
}
