import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { displayLabel } from '../../utils/displayVocabulary';
import MainLayout from '../../components/layout/MainLayout';
import PageShell from '../../components/ui/PageShell';
import SectionCard from '../../components/ui/SectionCard';
import FormField from '../../components/ui/FormField';
import SearchField from '../../components/ui/SearchField';
import { PrimaryButton, SecondaryButton } from '../../components/ui/Button';
import StatusBadge from '../../components/ui/StatusBadge';
import ErrorState from '../../components/ui/ErrorState';
import LoadingState from '../../components/ui/LoadingState';

const supportAllowed = (row) => row?.eligibility_decision === 'eligible' && row?.current_state === 'approved';

export default function SupportRequestPage() {
  const { id: routedId } = useParams();
  const [searchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState(searchParams.get('beneficiary') || '');
  const [candidates, setCandidates] = useState([]);
  const [search, setSearch] = useState('');
  const id = routedId || selectedId;
  const navigate = useNavigate();
  const { user } = useAuth();
  const admin = user?.role === 'admin';
  const allowed = admin || (!['readonly', 'driver', 'delivery_driver'].includes(user?.role) && user?.permissions?.support?.view === true && user?.permissions?.support?.create === true);
  const dependencies = admin || (['assistant_admin', 'staff', 'readonly'].includes(user?.role) && (!user?.permissions?.beneficiaries || user.permissions.beneficiaries.view === true) && (!user?.permissions?.warehouse || user.permissions.warehouse.view === true));
  const [beneficiary, setBeneficiary] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [locations, setLocations] = useState([]);
  const [evaluation, setEvaluation] = useState(null);
  const [items, setItems] = useState([{ inventory_item_id: '', requested_quantity: '1' }]);
  const [method, setMethod] = useState('pickup');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (routedId || !allowed || !dependencies) return undefined;
    let active = true;
    const timer = setTimeout(() => api.get('/beneficiaries', { params: { search, per_page: 50 } }).then(({ data }) => { if (active) setCandidates(data.data?.data || data.data || []); }).catch(() => { if (active) setError('تعذر تحميل المستفيدين.'); }), 250);
    return () => { active = false; clearTimeout(timer); };
  }, [routedId, allowed, dependencies, search]);
  useEffect(() => {
    setBeneficiary(null); setEvaluation(null);
    if (!id || !allowed || !dependencies) return undefined;
    let active = true;
    setLoading(true);
    Promise.all([api.get(`/beneficiaries/${id}`), api.get('/inventory', { params: { per_page: -1 } }), api.get('/support/pickup-locations')]).then(([person, stock, places]) => {
      if (!active) return;
      setBeneficiary(person.data.data); setInventory(stock.data.data?.data || stock.data.data || []); setLocations(places.data.data?.data || places.data.data || []);
    }).catch((exception) => { if (active) setError(exception.response?.data?.message || 'تعذر تحميل متطلبات طلب الدعم.'); }).finally(() => { if (active) setLoading(false); });
    api.get(`/beneficiary-policy/beneficiaries/${id}/evaluations`).then(({ data }) => { if (active) setEvaluation((data.data || [])[0] || null); }).catch(() => { if (active) setEvaluation(null); });
    return () => { active = false; };
  }, [id, allowed, dependencies]);
  const blockedReason = !evaluation ? 'لا يمكن تقديم الدعم قبل إكمال تقييم سياسة المستفيد.' : evaluation.eligibility_decision !== 'eligible' ? 'المستفيد غير مؤهل للدعم وفق آخر تقييم سياسة صالح.' : evaluation.current_state !== 'approved' ? 'لا يمكن تقديم الدعم قبل استكمال مراجعة السياسة.' : '';
  const submit = async (event) => {
    event.preventDefault();
    if (busy || !beneficiary || beneficiary.archived_at || blockedReason) return;
    setBusy(true); setError('');
    try {
      const { data } = await api.post('/support/distributions', { recipient_type: 'beneficiary', beneficiary_id: id, fulfillment_method: method, ...(method === 'pickup' ? { pickup_location_id: location } : {}), notes, items });
      navigate(`/${method === 'delivery' ? 'delivery' : 'receiver'}?task=${data.data.id}`);
    } catch (exception) {
      const validation = Object.values(exception.response?.data?.errors || {}).flat()[0];
      setError(validation || exception.response?.data?.message || 'تعذر إنشاء طلب الدعم.');
    } finally { setBusy(false); }
  };
  const options = beneficiary && !candidates.some((item) => String(item.id) === String(beneficiary.id)) ? [beneficiary, ...candidates] : candidates;
  return (
    <MainLayout>
      <PageShell title="طلب دعم للمستفيد" description={beneficiary?.full_name || 'مسودة دعم مرتبطة بتقييم السياسة الساري.'} breadcrumbs={[{ label: 'المستفيدون', href: '/beneficiaries' }, { label: 'طلب دعم' }]}>
        {error && <ErrorState title="تعذر إكمال الطلب" description={error} />}
        {!allowed || !dependencies ? <ErrorState title="لا توجد صلاحية" description="يتطلب طلب الدعم صلاحية الإنشاء وقراءة المستفيد والمخزون." /> : loading ? <LoadingState message="جارٍ تحميل طلب الدعم..." /> : (
          <>
            {!routedId && (
              <SectionCard title="اختيار المستفيد">
                <div className="grid gap-3 md:grid-cols-2">
                  <SearchField label="بحث المستفيد" placeholder="اسم المستفيد أو الجوال" value={search} onChange={(event) => setSearch(event.target.value)} />
                  <FormField label="المستفيد" name="beneficiary-id"><select aria-label="المستفيد" className="ikram-control w-full" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}><option value="">اختر المستفيد</option>{options.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></FormField>
                </div>
              </SectionCard>
            )}
            {beneficiary?.archived_at ? <ErrorState title="المستفيد مؤرشف" description="استعد سجله قبل إنشاء دعم جديد." /> : beneficiary && (
              <form onSubmit={submit} className="space-y-4">
                <SectionCard title="حالة سياسة المستفيد">
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge tone={supportAllowed(evaluation) ? 'success' : 'warning'} label={evaluation ? displayLabel('status', evaluation.eligibility_decision) : 'لا يوجد تقييم'} />
                    <StatusBadge tone="neutral" label={evaluation?.evaluated_at?.slice(0, 10) || 'بدون تاريخ تقييم'} />
                  </div>
                  {blockedReason && <p className="mt-3 text-sm font-bold text-[var(--color-text-primary)]">{blockedReason}</p>}
                </SectionCard>
                <SectionCard title="بيانات الطلب" description="ينشئ هذا الطلب مسودة دعم. الاعتماد والحجز والتسليم مراحل لاحقة.">
                  <div className="grid gap-3">
                    <FormField label="طريقة التسليم" name="fulfillment_method">
                      <select aria-label="طريقة التسليم" className="ikram-control w-full" value={method} onChange={(event) => setMethod(event.target.value)}><option value="pickup">استلام مباشر</option><option value="delivery">توصيل للمنازل</option></select>
                    </FormField>
                    {method === 'pickup' && (
                      <FormField label="موقع الاستلام" name="pickup_location_id">
                        <select aria-label="موقع الاستلام" required className="ikram-control w-full" value={location} onChange={(event) => setLocation(event.target.value)}><option value="">اختر الموقع</option>{locations.filter((place) => place.is_active).map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}</select>
                      </FormField>
                    )}
                    {items.map((item, index) => (
                      <div key={index} className="grid gap-3 md:grid-cols-[1fr_10rem_auto]">
                        <FormField label={`الصنف ${index + 1}`} name={`item-${index}`}>
                          <select aria-label={`الصنف ${index + 1}`} required className="ikram-control w-full" value={item.inventory_item_id} onChange={(event) => setItems((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, inventory_item_id: event.target.value } : row))}><option value="">اختر الصنف</option>{inventory.map((stock) => <option key={stock.id} value={stock.id}>{stock.name}</option>)}</select>
                        </FormField>
                        <FormField label={`الكمية ${index + 1}`} name={`quantity-${index}`}>
                          <input aria-label={`الكمية ${index + 1}`} required type="number" min="0.01" step="0.01" className="ikram-control w-full" value={item.requested_quantity} onChange={(event) => setItems((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, requested_quantity: event.target.value } : row))} />
                        </FormField>
                        {items.length > 1 && <SecondaryButton type="button" onClick={() => setItems((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}>إزالة</SecondaryButton>}
                      </div>
                    ))}
                    <SecondaryButton type="button" onClick={() => setItems((rows) => [...rows, { inventory_item_id: '', requested_quantity: '1' }])}>إضافة صنف</SecondaryButton>
                    <FormField label="ملاحظات" name="notes"><textarea className="ikram-control w-full" maxLength={5000} value={notes} onChange={(event) => setNotes(event.target.value)} /></FormField>
                    <PrimaryButton type="submit" disabled={busy || Boolean(blockedReason)}>{busy ? 'جاري الحفظ...' : 'حفظ مسودة طلب الدعم'}</PrimaryButton>
                  </div>
                </SectionCard>
              </form>
            )}
          </>
        )}
      </PageShell>
    </MainLayout>
  );
}
