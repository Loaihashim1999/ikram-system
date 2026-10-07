import { useState } from 'react';
import api from '../../api/axios';
import MainLayout from '../../components/layout/MainLayout';
import PageShell from '../../components/ui/PageShell';
import SectionCard from '../../components/ui/SectionCard';
import FormField from '../../components/ui/FormField';
import { PrimaryButton } from '../../components/ui/Button';
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
  return <MainLayout><PageShell title="الاستلام المباشر" description="التحقق من رمز المستلم وتوثيق تسليم الدعم في مقر الجمعية" breadcrumbs={[{ label: 'الاستلام المباشر' }]}>
    {operations.message && <p role="alert" className="ikram-panel p-4">{operations.message}</p>}
    {supportGrant(user, 'fulfill') && <SectionCard title="التحقق من الاستلام"><form onSubmit={verify} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 sm:grid-cols-[minmax(0,16rem)_minmax(0,12rem)_auto] sm:justify-start"><FormField label="مرجع الدعم" name="support-reference"><input required disabled={operations.busy} className="ikram-control w-full" value={reference} onChange={(e) => { setReference(e.target.value); setVerified(null); }} /></FormField><FormField label="رمز الاستلام" name="receipt-code"><input required disabled={operations.busy} inputMode="numeric" pattern="[0-9]{4}" maxLength={4} className="ikram-control w-full" value={code} onChange={(e) => { setCode(e.target.value.replace(/[^0-9]/g, '')); setVerified(null); }} /></FormField><div className="flex items-end"><PrimaryButton type="submit" className="h-11 w-auto shrink-0 px-5" disabled={operations.busy || code.length !== 4 || !reference.trim()}>تحقق</PrimaryButton></div></form><p className="mt-3 text-sm text-[var(--color-text-muted)]">مرجع الدعم يربط الرمز بالمستفيد الصحيح ويحمي من تشابه الرموز.</p>
      {verified && <div className="mt-4 space-y-3"><h3 className="font-bold">{verified.recipient_name}</h3><p>مرجع الدعم: {verified.id || verified.verifiedReference}</p><p>الحالة: {displayLabel('status', verified.status)}</p>{verified.items?.map((item, i) => <p key={item.id || i}>{item.name || 'دعم عيني'} — {item.quantity} {item.unit}</p>)}<PrimaryButton type="button" disabled={operations.busy} onClick={() => operations.run(async () => { await api.post(`/support/distributions/${verified.verifiedReference}/verify`, { code: verified.verifiedCode }); setCode(''); setVerified(null); }, 'تم تأكيد الاستلام وحفظ الإيصال.')}>تأكيد الاستلام</PrimaryButton></div>}
    </SectionCard>}
    <SupportFilters operations={operations} compact /><SupportTable operations={operations} user={user} />
  </PageShell></MainLayout>;
}
