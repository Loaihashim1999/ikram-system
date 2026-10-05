import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import MainLayout from '../../components/layout/MainLayout';
import PageHeader from '../../components/ui/PageHeader';
import PolicyReviewLinks from '../../components/beneficiaries/PolicyReviewLinks';

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
  const [items, setItems] = useState([{ inventory_item_id: '', requested_quantity: '1' }]);
  const [method, setMethod] = useState('pickup');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (routedId || !allowed || !dependencies) return;
    let active = true;
    const timer = setTimeout(() => api.get('/beneficiaries', { params: { search, per_page: 50 } }).then(({ data }) => { if (active) setCandidates(data.data?.data || data.data || []); }).catch(() => { if (active) setError('تعذر تحميل المستفيدين.'); }), 250);
    return () => { active = false; clearTimeout(timer); };
  }, [routedId, allowed, dependencies, search]);
  useEffect(() => {
    setBeneficiary(null);
    if (!id || !allowed || !dependencies) return;
    let active = true;
    Promise.all([api.get(`/beneficiaries/${id}`), api.get('/inventory', { params: { per_page: -1 } }), api.get('/support/pickup-locations')]).then(([b, i, l]) => {
      if (!active) return;
      setBeneficiary(b.data.data); setInventory(i.data.data?.data || i.data.data || []); setLocations(l.data.data?.data || l.data.data || []);
    }).catch((e) => { if (active) setError(e.response?.data?.message || 'تعذر تحميل متطلبات طلب الدعم.'); });
    return () => { active = false; };
  }, [id, allowed, dependencies]);
  const submit = async (e) => {
    e.preventDefault(); if (busy || !beneficiary || beneficiary.archived_at) return;
    setBusy(true); setError('');
    try { const { data } = await api.post('/support/distributions', { recipient_type: 'beneficiary', beneficiary_id: id, fulfillment_method: method, ...(method === 'pickup' ? { pickup_location_id: location } : {}), notes, items }); navigate(`/${method === 'delivery' ? 'delivery' : 'receiver'}?task=${data.data.id}`); }
    catch (e) { setError(e.response?.data?.message || 'تعذر إنشاء طلب الدعم.'); }
    finally { setBusy(false); }
  };
  const options = beneficiary && !candidates.some((item) => String(item.id) === String(beneficiary.id)) ? [beneficiary, ...candidates] : candidates;
  return <MainLayout><main dir="rtl" className="max-w-4xl mx-auto space-y-5"><PageHeader title="طلب دعم للمستفيد" subtitle={beneficiary?.full_name || ''} />{error && <p role="alert">{error}</p>}{!routedId && allowed && dependencies && <section className="ikram-panel p-4"><label>بحث المستفيد<input aria-label="بحث المستفيد" className="ikram-control" value={search} onChange={(e) => setSearch(e.target.value)}/></label><label>المستفيد<select aria-label="المستفيد" className="ikram-control" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}><option value="">اختر المستفيد</option>{options.map((b) => <option key={b.id} value={b.id}>{b.full_name}</option>)}</select></label></section>}{!allowed || !dependencies ? <p role="alert">يتطلب طلب الدعم صلاحية الإنشاء وقراءة المستفيد والمخزون.</p> : beneficiary?.archived_at ? <p role="alert">المستفيد مؤرشف؛ استعد سجله قبل إنشاء دعم جديد.</p> : beneficiary && <><PolicyReviewLinks beneficiaryId={id} /><form onSubmit={submit} className="ikram-panel p-5 space-y-4"><p>ينشئ هذا الطلب مسودة دعم؛ الاعتماد والحجز والتسليم مراحل مستقلة.</p><label className="block">طريقة التسليم<select aria-label="طريقة التسليم" className="ikram-control" value={method} onChange={(e) => setMethod(e.target.value)}><option value="pickup">استلام مباشر</option><option value="delivery">توصيل منزلي</option></select></label>{method === 'pickup' && <label className="block">موقع الاستلام<select aria-label="موقع الاستلام" required className="ikram-control" value={location} onChange={(e) => setLocation(e.target.value)}><option value="">اختر الموقع</option>{locations.filter((l) => l.is_active).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>}{items.map((item, index) => <div key={index} className="flex gap-3"><select aria-label={`الصنف ${index + 1}`} required className="ikram-control" value={item.inventory_item_id} onChange={(e) => setItems((rows) => rows.map((r, n) => n === index ? { ...r, inventory_item_id: e.target.value } : r))}><option value="">اختر الصنف</option>{inventory.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select><input aria-label={`الكمية ${index + 1}`} required type="number" min="0.01" step="0.01" className="ikram-control" value={item.requested_quantity} onChange={(e) => setItems((rows) => rows.map((r, n) => n === index ? { ...r, requested_quantity: e.target.value } : r))}/>{items.length > 1 && <button type="button" onClick={() => setItems((rows) => rows.filter((_, n) => n !== index))}>إزالة</button>}</div>)}<button type="button" onClick={() => setItems((rows) => [...rows, { inventory_item_id: '', requested_quantity: '1' }])}>إضافة صنف</button><label className="block">ملاحظات<textarea className="ikram-control" maxLength={5000} value={notes} onChange={(e) => setNotes(e.target.value)}/></label><button type="submit" disabled={busy} className="ikram-control">{busy ? 'جاري الحفظ...' : 'حفظ مسودة طلب الدعم'}</button></form></>}</main></MainLayout>;
}
