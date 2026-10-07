import { useEffect, useState } from 'react';
import api from '../../api/axios';
import SectionCard from '../../components/ui/SectionCard';
import FormField from '../../components/ui/FormField';
import StatusBadge from '../../components/ui/StatusBadge';
import ErrorState from '../../components/ui/ErrorState';
import EmptyState from '../../components/ui/EmptyState';
import { PrimaryButton, SecondaryButton } from '../../components/ui/Button';
import { displayLabel, templateDisplay, templateStorage } from '../../utils/displayVocabulary';

const labels = { beneficiary_pickup: 'SMS — مستفيد / استلام', beneficiary_delivery: 'SMS — مستفيد / توصيل', staff_pickup: 'SMS — موظف / استلام', staff_delivery: 'SMS — موظف / توصيل', organization_pickup: 'SMS — جهة / استلام', organization_delivery: 'SMS — جهة / توصيل', driver_assignment_sms: 'رسالة SMS للسائق', password_reset_otp: 'SMS — رمز إعادة تعيين كلمة المرور', password_reset_subject: 'البريد — عنوان الاستعادة (متوقف)', password_reset_body: 'البريد — محتوى الاستعادة (متوقف)' };
const pickupText = '{recipient_name}، استلام الدعم من {pickup_location_name} {pickup_location_url} في {delivery_date}. رمز الاستلام: {verification_code}. {association_name}';
const deliveryText = '{recipient_name}، توصيل الدعم في {delivery_date}. رمز الاستلام: {verification_code}. {association_name}';
const defaultTemplates = {
  association_name: 'جمعية إكرام الجود لخدمة ضيوف الرحمن',
  beneficiary_pickup: pickupText, staff_pickup: pickupText, organization_pickup: pickupText,
  beneficiary_delivery: deliveryText, staff_delivery: deliveryText, organization_delivery: deliveryText,
  driver_assignment_sms: "لديك مهمة توصيل جديدة من جمعية إكرام الجود.\nللدخول إلى مهام التوصيل استخدم الرابط الآمن التالي:\n{temporary_driver_link}",
  password_reset_otp: "رمز التحقق لإعادة تعيين كلمة المرور في نظام إكرام هو:\n{reset_code}\n\nتنتهي صلاحية الرمز خلال {expiry_minutes} دقائق.\nلا تشارك الرمز مع أي شخص.",
  password_reset_subject: 'استعادة الحساب — {association_name}',
  password_reset_body: '{user_name}، لاستعادة حسابك: {reset_link} صالح حتى {reset_expiry}. {association_name}',
};

export default function CommunicationsSettings() {
  const [form, setForm] = useState(null);
  const [providerMode, setProviderMode] = useState(null);
  const [senderConfigured, setSenderConfigured] = useState(false);
  const [definitions, setDefinitions] = useState({});
  const [preview, setPreview] = useState({});
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [locations, setLocations] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [location, setLocation] = useState({ name: '', location_url: '', address: '', city: '', district: '' });
  const load = () => Promise.allSettled([api.get('/settings/communications'), api.get('/support/pickup-locations'), api.get('/settings/communications/messages')]).then(([settings, places, messages]) => {
    if (settings.status === 'fulfilled') {
      setForm(settings.value.data.data);
      setProviderMode(settings.value.data.provider?.mode);
      setSenderConfigured(Boolean(settings.value.data.provider?.sender_configured));
      setDefinitions(settings.value.data.definitions || {});
      setLoadError('');
    } else {
      setForm(defaultTemplates);
      setLoadError('تعذر تحميل القوالب المحفوظة. النصوص المعروضة هي الافتراضية ويمكن تعديلها بعد اتصال الإعدادات.');
    }
    if (places.status === 'fulfilled') setLocations(places.value.data.data || []);
    if (messages.status === 'fulfilled') setLogs(messages.value.data.data || []);
  });
  useEffect(() => { load(); }, []);
  const save = async (event) => {
    event.preventDefault(); setBusy(true); setErrors({}); setMessage('');
    try { await api.put('/settings/communications', { templates: { ...form } }); setMessage('تم حفظ قوالب الاتصالات.'); }
    catch (error) { setErrors(error.response?.data?.errors || {}); setMessage(error.response?.data?.message || 'تعذر الحفظ.'); }
    finally { setBusy(false); }
  };
  const showPreview = async (key) => {
    try { const result = await api.post('/settings/communications/preview', { key, template: form[key] }); setPreview((current) => ({ ...current, [key]: result.data.data })); setErrors({}); }
    catch (error) { setErrors(error.response?.data?.errors || {}); }
  };
  const addLocation = async (event) => {
    event.preventDefault(); setBusy(true);
    try { await api.post('/support/pickup-locations', { ...location, location_url: location.location_url || null }); setLocation({ name: '', location_url: '', address: '', city: '', district: '' }); await load(); setMessage('تم حفظ موقع الاستلام.'); }
    catch (error) { setMessage(error.response?.data?.message || 'تعذر حفظ الموقع.'); }
    finally { setBusy(false); }
  };
  const providerLabel = providerMode === 'fake' ? 'وضع محاكاة الرسائل' : providerMode === 'taqnyat' ? 'تَقنيات / Taqnyat' : 'لم تتوفر حالة مزود الرسائل';

  return (
    <div className="mt-8 space-y-5" dir="rtl">
      <SectionCard title="الاتصالات" description="المعاينة ببيانات تجريبية فقط. قبول مزود الرسائل لا يعني تأكيد التسليم.">
        <div className="mb-4 flex flex-wrap gap-2">
          <StatusBadge status={providerMode === 'taqnyat' ? 'active' : 'pending'} label={providerLabel} />
          <StatusBadge status={senderConfigured ? 'active' : 'suspended'} label={senderConfigured ? 'المرسل مُعد' : 'المرسل غير متاح'} />
          <StatusBadge status="suspended" label="Webhook: معطل" />
        </div>
        <p>بيانات Callback الرسمية من المزود غير مكتملة. لا يوجد تفعيل من هذه الشاشة.</p>
        {loadError && <ErrorState className="mt-3" title="تعذر تحميل الإعدادات" description={loadError} />}
        {message && <p role="status" className="mt-3">{message}</p>}
        {form && (
          <form onSubmit={save} className="mt-4 space-y-5">
            <FormField label="اسم الجمعية" name="association_name">
              <input className="ikram-control" value={form.association_name || ''} maxLength={150} onChange={(event) => setForm({ ...form, association_name: event.target.value })} />
            </FormField>
            {Object.entries(labels).map(([key, label]) => (
              <div key={key}>
                <FormField label={label} name={key} error={errors[key]?.[0]}>
                  <textarea className="ikram-control min-h-28" value={templateDisplay(form[key])} onChange={(event) => setForm({ ...form, [key]: templateStorage(event.target.value, definitions[key]?.allowed) })} />
                </FormField>
                <div className="mt-2 flex flex-wrap gap-2" aria-label="حقول الرسالة">
                  {definitions[key]?.allowed.map((token) => <SecondaryButton key={token} type="button" onClick={() => setForm({ ...form, [key]: (form[key] || '') + '{' + token + '}' })}>{displayLabel('token', token)}</SecondaryButton>)}
                </div>
                <SecondaryButton type="button" className="mt-2" onClick={() => showPreview(key)}>معاينة {label}</SecondaryButton>
                {preview[key] && <p className="mt-2 whitespace-pre-wrap break-words rounded-[var(--radius-control)] bg-[var(--color-bg-soft)] p-4">{preview[key]}</p>}
              </div>
            ))}
            <PrimaryButton disabled={busy} type="submit">حفظ قوالب الاتصالات</PrimaryButton>
          </form>
        )}
      </SectionCard>
      <SectionCard title="مواقع الاستلام">
        {locations.length === 0 && <EmptyState title="لا توجد مواقع استلام" description="أضف موقعاً ليستخدمه الاستلام المباشر." />}
        {locations.map((item) => <p key={item.id}>{item.name} — {item.location_url || 'الرابط غير محدد'}</p>)}
        <form onSubmit={addLocation} className="mt-3 grid gap-3 md:grid-cols-2">
          {Object.entries({ name: 'اسم الموقع', location_url: 'رابط الموقع', address: 'العنوان', city: 'المدينة', district: 'الحي' }).map(([key, label]) => (
            <FormField key={key} label={label} name={`location-${key}`}>
              <input className="ikram-control" required={key === 'name'} type={key === 'location_url' ? 'url' : 'text'} value={location[key]} onChange={(event) => setLocation({ ...location, [key]: event.target.value })} />
            </FormField>
          ))}
          <SecondaryButton disabled={busy} type="submit">إضافة موقع</SecondaryButton>
        </form>
      </SectionCard>
      <SectionCard title="سجل الاتصالات" description="حالة الإرسال هنا هي قبول الطلب أو تعذره. ليست تأكيد وصول الرسالة إلى الجوال.">
        {logs.length === 0 && <EmptyState title="لا توجد رسائل مسجلة" description="يظهر السجل بعد طلب إرسال." />}
        {logs.map((log) => (
          <div className="mb-3 rounded-[var(--radius-control)] border border-[var(--color-border)] p-3" key={log.id}>
            <p>{displayLabel('channel', log.channel)} — {log.destination} — {displayLabel('status', log.error_code === 'send_outcome_unknown' ? 'unknown' : log.status)}</p>
            <p>المحاولات: {log.attempts}</p>
            {log.error_code && <p>{displayLabel('providerError', log.error_code)}</p>}
            {log.status === 'failed' && log.error_code !== 'send_outcome_unknown' && <SecondaryButton onClick={async () => { try { await api.post('/settings/communications/messages/' + log.id + '/retry'); await load(); } catch (error) { setMessage(error.response?.data?.message || 'تعذرت إعادة المحاولة.'); } }}>إعادة المحاولة</SecondaryButton>}
          </div>
        ))}
      </SectionCard>
    </div>
  );
}
