import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { displayLabel } from '../../utils/displayVocabulary';

const reasonLabels = { POLICY_NOT_APPLICABLE_RESIDENT: 'سياسة المواطنين لا تنطبق على المقيم', POLICY_DOCUMENT_REVIEW_REQUIRED: 'مراجعة الوثائق مطلوبة', SERVICE_AREA_REVIEW_REQUIRED: 'مراجعة نطاق الخدمة مطلوبة', LANDLORD_RELATION_REVIEW_REQUIRED: 'مراجعة علاقة المؤجر مطلوبة', FAMILY_SUPPORT_STATUS_REVIEW_REQUIRED: 'مراجعة الوضع الأسري مطلوبة', MALE_UNDER_40_MEDICAL_REVIEW_REQUIRED: 'مراجعة الدليل الطبي مطلوبة', BENEFICIARY_UNDER_REVIEW_REQUIRED: 'المستفيد تحت المراجعة', INELIGIBLE_BENEFICIARY_STATUS: 'حالة المستفيد تمنع الاستحقاق' };
const decisions = { pending: 'بانتظار القرار', approved: 'معتمد', rejected: 'مرفوض' };
const eligibility = { eligible: 'مستحق مبدئياً', ineligible: 'غير مستحق', review_required: 'يتطلب المراجعة', not_applicable: 'السياسة لا تنطبق' };
export default function PolicyReviewLinks({ beneficiaryId, archived = false }) {
  const { user } = useAuth();
  const allowed = user?.role === 'admin' || ['view_documents', 'verify_documents', 'social_assessment', 'review', 'decide'].some((p) => user?.permissions?.beneficiary_policy?.[p] === true);
  const canEvaluate = !archived && (user?.role === 'admin' || user?.permissions?.beneficiary_policy?.evaluate === true);
  const canViewVersions = user?.role === 'admin' || user?.permissions?.beneficiary_policy?.view === true;
  const [rows, setRows] = useState([]);
  const [versions, setVersions] = useState([]);
  const [versionId, setVersionId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setRows([]); setError('');
    if (allowed) api.get(`/beneficiary-policy/beneficiaries/${beneficiaryId}/evaluations`).then(({ data }) => { if (active) setRows(data.data); }).catch(() => { if (active) setError('تعذر تحميل المراجعات.'); });
    if (canEvaluate && canViewVersions) api.get('/beneficiary-policy/versions').then(({ data }) => { if (active) setVersions(data.data?.data || data.data || []); }).catch(() => { if (active) setError('تعذر تحميل إصدارات السياسة.'); });
    return () => { active = false; };
  }, [beneficiaryId, allowed, canEvaluate, canViewVersions, revision]);
  const evaluate = async () => {
    setBusy(true); setError('');
    try { await api.post('/beneficiary-policy/evaluate', { beneficiary_id: beneficiaryId, policy_version_id: versionId }); setRevision((r) => r + 1); }
    catch (e) { setError(e.response?.data?.message || 'تعذر إعادة تقييم السياسة.'); }
    finally { setBusy(false); }
  };
  if (!allowed && !canEvaluate) return null;
  return <section className="border rounded p-4 mb-4"><h2 className="font-bold">سياسة المستفيد وسجل التقييمات</h2>{error && <p role="alert">{error}</p>}{canEvaluate && canViewVersions && <div className="flex flex-wrap gap-3 py-3"><select aria-label="إصدار السياسة" value={versionId} onChange={(e) => setVersionId(e.target.value)}><option value="">اختر سياسة منشورة لإعادة التقييم</option>{versions.filter((v) => v.status === 'published').map((v) => <option key={v.id} value={v.id}>{v.policy_name} — {v.version}</option>)}</select><button type="button" disabled={!versionId || busy} onClick={evaluate}>إنشاء تقييم جديد</button></div>}{allowed && (rows.length ? <ul>{rows.map((e) => <li key={e.id} className="py-2"><Link className="underline" to={`/admin/beneficiary-policy/review/${e.id}`}>مراجعة التقييم — {e.evaluated_at?.slice(0,10) || 'بدون تاريخ'}</Link><span> — {eligibility[e.eligibility_decision] || 'نتيجة غير متوفرة'} — {decisions[e.current_state] || 'بانتظار القرار'}</span>{e.eligibility_reasons?.length > 0 && <ul>{e.eligibility_reasons.map((reason) => <li key={reason}>{reasonLabels[reason] || 'تتطلب النتيجة مراجعة مختص'}</li>)}</ul>}{e.eligibility_decision !== 'not_applicable' && <p>صافي دخل الفرد: {e.net_income_per_capita ?? 'غير متوفر'} ريال — فئة الدخل: {displayLabel('financialCategory', e.income_category)} — النقاط: {e.policy_score ?? 'غير متوفرة'} — فئة النقاط: {displayLabel('scoreCategory', e.score_category)}</p>}{e.decision_history?.map((decision, index) => <p key={index}>{decisions[decision.decision] || 'قرار مسجل'} — {decision.decided_at?.slice(0,10)} {decision.human_readable_reason}</p>)}</li>)}</ul> : <p>لا توجد تقييمات محفوظة.</p>)}</section>;
}
