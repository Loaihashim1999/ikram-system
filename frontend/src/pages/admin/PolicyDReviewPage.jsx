import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../../api/axios';
import Button from '../../components/ui/Button';
import PageHeader from '../../components/ui/PageHeader';

const statuses = { verified: 'موثقة', rejected: 'مرفوضة', under_review: 'قيد المراجعة', missing: 'مفقودة', not_applicable: 'غير مطلوبة', draft: 'مسودة', submitted: 'مقدمة للمراجعة', reviewed: 'تمت المراجعة', pending: 'قرار معلق', approved: 'تم الاعتماد' };
const eligibilityLabels = { eligible: 'لائق', ineligible: 'غير لائق', review_required: 'يتطلب مراجعة', not_applicable: 'غير منطبق' };
const text = (value) => value === null || value === undefined ? 'غير متوفر' : String(value);
const status = (value) => statuses[value] || text(value);
const fieldClass = 'ikram-control mt-1';
const sectionClass = 'ikram-panel space-y-3 p-4 sm:p-5';

export default function PolicyDReviewPage() {
  const { evaluationId } = useParams();
  const base = `/beneficiary-policy/evaluations/${evaluationId}`;
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({});
  const [docInput, setDocInput] = useState({});
  const [medical, setMedical] = useState({});
  const [recommendation, setRecommendation] = useState('');
  const [reason, setReason] = useState({ code: '', description: '' });
  const load = useCallback(async () => {
    const response = await api.get(base + '/review');
    const next = response.data.data;
    setData(next);
    const a = next.social_assessment;
    setDraft(a ? { assessment_date: a.assessment_date?.slice(0, 10), housing_condition: a.housing_condition, service_area_result: a.service_area_result, landlord_relationship_result: a.landlord_relationship_result, affected_children_count: a.household_findings?.affected_children_count ?? '', controlled_notes: a.controlled_notes ?? '' } : {});
    setRecommendation(a?.structured_recommendation || '');
  }, [base]);
  useEffect(() => { let active = true; api.get(base + '/review').then(({ data: response }) => { if (active) { const next = response.data; setData(next); const a = next.social_assessment; setDraft(a ? { ...a, assessment_date: a.assessment_date?.slice(0, 10), affected_children_count: a.household_findings?.affected_children_count ?? '' } : {}); setRecommendation(a?.structured_recommendation || ''); } }).catch(() => { if (active) setError('تعذر تحميل المراجعة أو ليس لديك صلاحية الوصول.'); }); return () => { active = false; }; }, [base]);
  const run = async (method, suffix, body) => {
    setBusy(true); setError('');
    try { await api[method](base + suffix, body); await load(); }
    catch (e) { setError(Object.values(e.response?.data?.errors || {}).flat().join(' — ') || e.response?.data?.message || 'تعذر حفظ الإجراء.'); }
    finally { setBusy(false); }
  };
  if (!data || data.evaluation.id !== evaluationId) return <main dir="rtl" className="ikram-page"><p role={error ? 'alert' : 'status'} className="ikram-panel p-5 text-sm">{error || 'جارٍ تحميل المراجعة...'}</p></main>;
  const { evaluation: e, capabilities: can, social_assessment: a } = data;
  const editable = data.current_state === 'pending';
  const button = (label, action, disabled = false) => <Button variant="outline" size="sm" className="m-1" onClick={action} disabled={busy || disabled}>{label}</Button>;
  const select = (label, key, options) => <label className="block text-sm font-bold text-[var(--color-text-secondary)]">{label}<select className={fieldClass} aria-label={label} value={draft[key] || ''} disabled={!can.social_assessment || !editable || (a && a.status !== 'draft')} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}><option value="">اختر</option>{options.map(([value, title]) => <option key={value} value={value}>{title}</option>)}</select></label>;
  return <main dir="rtl" className="ikram-page ikram-record max-w-5xl p-6">
    <PageHeader title="مراجعة سياسة المستفيد (POLICY-D)" subtitle="مراجعة الأدلة والتقييم الاجتماعي والقرار مع الحفاظ على نتيجة التقييم التاريخية" breadcrumbs={[{ label: 'المستفيدون', to: '/beneficiaries' }, { label: 'مراجعة السياسة' }]} actions={<Button as={Link} to={`/beneficiaries/${data.beneficiary?.id}`} variant="outline">العودة إلى المستفيد</Button>} />
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
    <section className={sectionClass} aria-label="نتائج التقييم">
      <h2>{data.beneficiary?.full_name}</h2><p>التقييم: {e.id}</p><p>إصدار السياسة: {data.policy_version.version}</p>
      <p>أهلية السياسة: <span data-testid="eligibility-decision">{eligibilityLabels[e.eligibility_decision] || text(e.eligibility_decision)}</span></p>
      <p>صافي دخل الفرد: <span data-testid="financial-result">{text(e.financial_snapshot?.net_income_per_capita)}</span></p>
      <p>فئة الدخل: <span data-testid="income-category">{text(e.income_category)}</span></p>
      <p>النقاط: <span data-testid="policy-score">{text(e.policy_score)}</span></p>
      <p>فئة النقاط: <span data-testid="score-category">{text(e.score_category)}</span></p>
      <p>النتيجة التاريخية: {text(e.scoring_snapshot?.outcome)}</p>
      <p>هذه نتائج التقييم المحفوظة؛ مراجعة الأدلة لا تعيد احتسابها.</p>
    </section>
    <section aria-label="الوثائق" className={sectionClass}><h2>حالة الوثائق المطلوبة</h2>
      {data.documents.map((d) => <div key={d.code} data-testid={`document-${d.code}`} className="border-b py-3">
        <p>{d.label} — <strong>{status(d.status)}</strong> {d.required && '(مطلوبة)'}</p>
        {d.verification?.evidence_reference && <p>مرجع الدليل: {d.verification.evidence_reference}</p>}
        {can.verify_documents && editable && d.applicable && <div>
          <label>مرجع الدليل<input aria-label={`مرجع ${d.code}`} className={fieldClass} value={docInput[d.code]?.reference || ''} onChange={(event) => setDocInput({ ...docInput, [d.code]: { ...docInput[d.code], reference: event.target.value } })} /></label>
          <label>سبب رفض الوثيقة<input aria-label={`سبب رفض ${d.code}`} className={fieldClass} value={docInput[d.code]?.rejection || ''} onChange={(event) => setDocInput({ ...docInput, [d.code]: { ...docInput[d.code], rejection: event.target.value } })} /></label>
          {['verified', 'rejected', 'under_review'].map((state) => <Button key={state} variant="outline" size="sm" className="m-1" disabled={busy} onClick={() => run('post', `/documents/${d.code}`, { status: state, evidence_reference: docInput[d.code]?.reference || '', rejection_reason: docInput[d.code]?.rejection || null })}>{state === 'verified' ? 'توثيق' : state === 'rejected' ? 'رفض الوثيقة' : 'قيد المراجعة'}</Button>)}
        </div>}
      </div>)}
    </section>
    <section className={sectionClass} aria-label="الدليل الطبي"><h2>دليل الإعاقة الطبي</h2>
      <p>الحالة: {status(data.medical_evidence?.verification_status)}</p><p>النسبة الموثقة: {text(data.medical_evidence?.verified_disability_percentage)}</p>
      {can.verify_documents && editable && <><label>نسبة الإعاقة<input aria-label="نسبة الإعاقة" type="number" min="0" max="100" step="0.01" className={fieldClass} value={medical.percentage ?? ''} onChange={(event) => setMedical({ ...medical, percentage: event.target.value })} /></label><label>مرجع الدليل الطبي<input aria-label="مرجع الدليل الطبي" className={fieldClass} value={medical.reference || ''} onChange={(event) => setMedical({ ...medical, reference: event.target.value })} /></label>{button('توثيق الدليل الطبي', () => run('post', '/medical-evidence', { verification_status: 'verified', verified_disability_percentage: medical.percentage, evidence_reference: medical.reference }))}</>}
    </section>
    <section className={sectionClass} aria-label="التقييم الاجتماعي"><h2>التقييم الاجتماعي</h2><p data-testid="assessment-state">{a ? status(a.status) : 'لا يوجد تقييم اجتماعي'}</p>
      {select('حالة المسكن', 'housing_condition', [['poor', 'فقير'], ['average', 'متوسط'], ['good', 'جيد']])}
      {select('منطقة الخدمة', 'service_area_result', [['verified_inside', 'داخل'], ['verified_outside', 'خارج'], ['review_required', 'يتطلب مراجعة']])}
      {select('علاقة المؤجر', 'landlord_relationship_result', [['no_prohibited_relationship', 'لا علاقة محظورة'], ['prohibited_relationship', 'علاقة محظورة'], ['review_required', 'يتطلب مراجعة']])}
      <label>الأطفال المتأثرون<input aria-label="الأطفال المتأثرون" className={fieldClass} type="number" min="0" value={draft.affected_children_count ?? ''} disabled={!can.social_assessment || !editable || (a && a.status !== 'draft')} onChange={(event) => setDraft({ ...draft, affected_children_count: event.target.value })} /></label>
      {can.social_assessment && editable && (!a || a.status === 'draft') && <><label>تاريخ التقييم<input aria-label="تاريخ التقييم" type="date" className={fieldClass} value={draft.assessment_date || ''} onChange={(event) => setDraft({ ...draft, assessment_date: event.target.value })} /></label>
        {button('حفظ المسودة', () => run('put', '/social-assessment', { assessment_date: draft.assessment_date, housing_condition: draft.housing_condition, service_area_result: draft.service_area_result, landlord_relationship_result: draft.landlord_relationship_result, household_findings: { affected_children_count: draft.affected_children_count === '' || draft.affected_children_count === undefined ? null : Number(draft.affected_children_count) }, controlled_notes: draft.controlled_notes || null }))}
        {a && button('تقديم التقييم', () => run('post', '/social-assessment/submit', {}))}</>}
      <p>التوصية: {text(a?.structured_recommendation)}</p>
      {can.review && editable && a?.status === 'submitted' && <><label>توصية المراجعة<select aria-label="توصية المراجعة" className={fieldClass} value={recommendation} onChange={(event) => setRecommendation(event.target.value)}><option value="">اختر</option><option value="approve">اعتماد</option><option value="reject">رفض</option><option value="pending_review">مراجعة إضافية</option></select></label>{button('إتمام المراجعة', () => run('post', '/social-assessment/review', { structured_recommendation: recommendation }))}</>}
    </section>
    <section className={sectionClass}><h2>أسباب المراجعة وموانع الاعتماد</h2><ul data-testid="approval-blockers">{data.approval_blockers.map((r) => <li key={r}>{r}</li>)}</ul></section>
    <section className={sectionClass}><h2>القرار وسجل القرارات</h2><p data-testid="decision-state">{status(data.current_state)}</p>
      {can.decide && editable && <><label>رمز السبب الثابت<input aria-label="رمز السبب الثابت" className={fieldClass} value={reason.code} onChange={(event) => setReason({ ...reason, code: event.target.value })} /></label><label>شرح القرار<input aria-label="شرح القرار" className={fieldClass} value={reason.description} onChange={(event) => setReason({ ...reason, description: event.target.value })} /></label>{button('اعتماد القرار', () => run('post', '/approve', { reason_code: reason.code, reason_text: reason.description }))}{button('رفض القرار', () => run('post', '/reject', { reason_code: reason.code, reason_text: reason.description }))}</>}
      <ul data-testid="decision-history">{data.decision_history.map((d) => <li key={d.id}>{status(d.decision)} — {d.stable_reason_code} — {d.human_readable_reason} — {d.decided_at}</li>)}</ul>
    </section>
  </main>;
}
