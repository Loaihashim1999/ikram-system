import { useState } from 'react';
import api from '../../api/axios';
import MainLayout from '../../components/layout/MainLayout';
import PageHeader from '../../components/ui/PageHeader';
import PagePermissionGuard from '../../components/common/PagePermissionGuard';
import { useAuth } from '../../context/AuthContext';
import { canViewSupport } from '../../utils/modulePermissions';
import { displayLabel } from '../../utils/displayVocabulary';
import { SupportFilters, SupportTable, supportGrant, useSupportOperations } from '../../components/support/SupportOperations';

export default function DirectHandoverPage() {
  return <PagePermissionGuard canAccess={canViewSupport}><DirectHandoverContent /></PagePermissionGuard>;
}
function DirectHandoverContent() {
  const { user } = useAuth();
  const operations = useSupportOperations('pickup');
  const [reference, setReference] = useState('');
  const [code, setCode] = useState('');
  const [verified, setVerified] = useState(null);
  const verify = (event) => {
    event.preventDefault(); setVerified(null);
    const verifiedReference = reference.trim();
    const verifiedCode = code;
    operations.run(async () => {
      const response = await api.post(`/support/distributions/${verifiedReference}/verify-preview`, { code: verifiedCode });
      setVerified({ ...response.data.data, verifiedReference, verifiedCode });
    }, 'تم التحقق من الرمز. راجع بيانات المستفيد ثم أكد الاستلام.');
  };
  return <MainLayout><main dir="rtl" className="mx-auto max-w-7xl space-y-5"><PageHeader title="الاستلام المباشر" subtitle="التحقق من رمز المستلم وتوثيق تسليم الدعم في مقر الجمعية" />
    {operations.message && <p role="alert" className="ikram-panel p-4">{operations.message}</p>}
    {supportGrant(user, 'fulfill') && <section className="ikram-panel p-5 space-y-4"><h2 className="font-bold">أدخل رمز الاستلام</h2><form onSubmit={verify} className="grid gap-3 sm:grid-cols-3"><label>مرجع الدعم<input required disabled={operations.busy} className="ikram-control mt-1" value={reference} onChange={(e) => { setReference(e.target.value); setVerified(null); }} /></label><label>رمز الاستلام<input required disabled={operations.busy} inputMode="numeric" pattern="[0-9]{4}" maxLength={4} className="ikram-control mt-1" value={code} onChange={(e) => { setCode(e.target.value.replace(/[^0-9]/g, '')); setVerified(null); }} /></label><button disabled={operations.busy || code.length !== 4 || !reference.trim()} className="ikram-control self-end">تحقق</button></form><p className="text-sm text-[var(--color-text-muted)]">مرجع الدعم يربط الرمز بالمستفيد الصحيح ويحمي من تشابه الرموز.</p>
      {verified && <div className="rounded-xl border p-4 space-y-3"><h3 className="font-bold">{verified.recipient_name}</h3><p>مرجع الدعم: {verified.id || verified.verifiedReference}</p><p>{displayLabel('status', verified.status)}</p>{verified.items?.map((item, i) => <p key={item.id || i}>{item.name || 'دعم عيني'} — {item.quantity} {item.unit}</p>)}<button disabled={operations.busy} className="rounded-lg bg-emerald-900 text-white px-5 py-3" onClick={() => operations.run(async () => { await api.post(`/support/distributions/${verified.verifiedReference}/verify`, { code: verified.verifiedCode }); setCode(''); setVerified(null); }, 'تم تأكيد الاستلام وحفظ الإيصال.')}>تأكيد الاستلام</button></div>}
    </section>}
    <SupportFilters operations={operations} /><SupportTable operations={operations} user={user} />
  </main></MainLayout>;
}
