import { useEffect, useState } from 'react';
import api from '../../api/axios';
import { displayLabel, templateDisplay, templateStorage } from '../../utils/displayVocabulary';

const labels = { beneficiary_pickup: 'SMS — مستفيد / استلام', beneficiary_delivery: 'SMS — مستفيد / توصيل', staff_pickup: 'SMS — موظف / استلام', staff_delivery: 'SMS — موظف / توصيل', organization_pickup: 'SMS — جهة / استلام', organization_delivery: 'SMS — جهة / توصيل', driver_assignment_sms: 'رسالة SMS للسائق', password_reset_otp: 'SMS — رمز إعادة تعيين كلمة المرور', password_reset_subject: 'البريد — عنوان الاستعادة (متوقف)', password_reset_body: 'البريد — محتوى الاستعادة (متوقف)' };
export default function CommunicationsSettings() {
  const [form, setForm] = useState(null);
  const [providerMode, setProviderMode] = useState(null);
  const [definitions, setDefinitions] = useState({});
  const [preview, setPreview] = useState({});
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [locations, setLocations] = useState([]);
  const [logs, setLogs] = useState([]);
  const [location, setLocation] = useState({ name: '', location_url: '', address: '', city: '', district: '' });
  const load = () => Promise.all([api.get('/settings/communications'), api.get('/support/pickup-locations'), api.get('/settings/communications/messages')]).then(([a,b,c]) => { setForm(a.data.data); setProviderMode(a.data.provider?.mode); setDefinitions(a.data.definitions); setLocations(b.data.data); setLogs(c.data.data); }).catch(() => setMessage('تعذر تحميل إعدادات الاتصالات.'));
  useEffect(() => { load(); }, []);
  const save = async (event) => {
    event.preventDefault(); setBusy(true); setErrors({}); setMessage('');
    try { const templates = Object.fromEntries(Object.entries(form)); await api.put('/settings/communications', { templates }); setMessage('تم حفظ قوالب الاتصالات.'); }
    catch (error) { setErrors(error.response?.data?.errors || {}); setMessage(error.response?.data?.message || 'تعذر الحفظ.'); }
    finally { setBusy(false); }
  };
  const showPreview = async (key) => {
    try { const result = await api.post('/settings/communications/preview', { key, template: form[key] }); setPreview((p) => ({ ...p, [key]: result.data.data })); setErrors({}); }
    catch (error) { setErrors(error.response?.data?.errors || {}); }
  };
  const addLocation = async (event) => {
    event.preventDefault(); setBusy(true);
    try { await api.post('/support/pickup-locations', { ...location, location_url: location.location_url || null }); setLocation({ name: '', location_url: '', address: '', city: '', district: '' }); await load(); setMessage('تم حفظ موقع الاستلام.'); }
    catch (error) { setMessage(error.response?.data?.message || 'تعذر حفظ الموقع.'); }
    finally { setBusy(false); }
  };
  return <section className="mt-8 space-y-5 rounded-2xl bg-white p-5 border" dir="rtl"><h2 className="text-xl font-bold">الاتصالات</h2><p>{providerMode === 'fake' ? 'وضع محاكاة الرسائل' : providerMode === 'taqnyat' ? 'الاتصال بمزود الرسائل مفعّل' : 'لم تتوفر حالة مزود الرسائل'}</p><p>المعاينة ببيانات تجريبية فقط. قبول مزود الرسائل لا يعني تأكيد التسليم.</p>{message && <p role="status">{message}</p>}{form && <form onSubmit={save} className="space-y-5"><label className="block">اسم الجمعية<input className="block w-full border rounded-lg p-3" value={form.association_name} maxLength={150} onChange={(e) => setForm({ ...form, association_name: e.target.value })}/></label>{Object.entries(labels).map(([key,label]) => <div key={key}><label className="block font-bold" htmlFor={key}>{label}</label><textarea id={key} className="w-full border rounded-lg p-3 min-h-28" value={templateDisplay(form[key])} onChange={(e) => setForm({ ...form, [key]: templateStorage(e.target.value, definitions[key]?.allowed) })}/><div className="flex flex-wrap gap-2" aria-label="حقول الرسالة">{definitions[key]?.allowed.map((token) => <button key={token} type="button" className="border rounded px-2 py-1" onClick={() => setForm({ ...form, [key]: (form[key] || '') + '{' + token + '}' })}>{displayLabel('token', token)}</button>)}</div>{errors[key] && <p role="alert" className="text-red-700">{errors[key][0]}</p>}<button type="button" className="border rounded-lg px-4 py-3 mt-2" onClick={() => showPreview(key)}>معاينة {label}</button>{preview[key] && <p className="whitespace-pre-wrap break-words bg-[var(--color-bg-soft)] rounded-lg p-4 mt-2">{preview[key]}</p>}</div>)}<button disabled={busy} className="rounded-lg bg-emerald-900 text-white px-5 py-3">حفظ قوالب الاتصالات</button></form>}
  <h3 className="font-bold">مواقع الاستلام</h3>{locations.map((l) => <p key={l.id}>{l.name} — {l.location_url || 'الرابط غير محدد'}</p>)}<form onSubmit={addLocation} className="grid gap-3 md:grid-cols-2">{Object.entries({name:'اسم الموقع',location_url:'رابط الموقع',address:'العنوان',city:'المدينة',district:'الحي'}).map(([key,label]) => <label key={key}>{label}<input className="block w-full border rounded-lg p-3" required={key === 'name'} type={key === 'location_url' ? 'url' : 'text'} value={location[key]} onChange={(e) => setLocation({ ...location, [key]: e.target.value })}/></label>)}<button disabled={busy} className="rounded-lg border px-5 py-3">إضافة موقع</button></form>
  <h3 className="font-bold">سجل الاتصالات</h3>{logs.map((log) => <div className="rounded-lg border p-3" key={log.id}><p>{displayLabel('channel', log.channel)} — {log.destination} — {displayLabel('status', log.error_code === 'send_outcome_unknown' ? 'unknown' : log.status)}</p><p>المحاولات: {log.attempts}</p>{log.error_code && <p>{displayLabel('providerError', log.error_code)}</p>}{log.status === 'failed' && log.error_code !== 'send_outcome_unknown' && <button className="border rounded-lg px-4 py-3" onClick={async () => { try { await api.post('/settings/communications/messages/' + log.id + '/retry'); await load(); } catch (error) { setMessage(error.response?.data?.message || 'تعذرت إعادة المحاولة.'); } }}>إعادة المحاولة</button>}</div>)}</section>;
}
