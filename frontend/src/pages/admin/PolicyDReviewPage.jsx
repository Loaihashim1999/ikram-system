import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../../api/axios';
import MainLayout from '../../components/layout/MainLayout';
import PageShell from '../../components/ui/PageShell';
import SectionCard from '../../components/ui/SectionCard';
import FormField from '../../components/ui/FormField';
import { PrimaryButton, SecondaryButton, DangerButton } from '../../components/ui/Button';
import StatusBadge from '../../components/ui/StatusBadge';
import KpiCard from '../../components/ui/KpiCard';
import DataTable from '../../components/ui/DataTable';
import ErrorState from '../../components/ui/ErrorState';
import EmptyState from '../../components/ui/EmptyState';
import LoadingState from '../../components/ui/LoadingState';
import { displayLabel, displayReason, policyBreakdown } from '../../utils/displayVocabulary';

const text = (value) => value === null || value === undefined || value === '' ? 'غير متوفر' : String(value);
const reasons = (payload) => Object.values(payload?.errors || {}).flat().map((item) => displayReason(String(item))).join(' — ');

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
    const response = await api.get(`${base}/review`);
    const next = response.data.data;
    setData(next);
    const assessment = next.social_assessment;
    setDraft(assessment ? { assessment_date: assessment.assessment_date?.slice(0, 10), housing_condition: assessment.housing_condition, service_area_result: assessment.service_area_result, landlord_relationship_result: assessment.landlord_relationship_result, affected_children_count: assessment.household_findings?.affected_children_count ?? '', controlled_notes: assessment.controlled_notes ?? '' } : {});
    setRecommendation(assessment?.structured_recommendation || '');
  }, [base]);
  useEffect(() => {
    let active = true;
    setData(null);
    api.get(`${base}/review`).then(({ data: response }) => {
      if (!active) return;
      const next = response.data;
      setData(next);
      const assessment = next.social_assessment;
      setDraft(assessment ? { assessment_date: assessment.assessment_date?.slice(0, 10), housing_condition: assessment.housing_condition, service_area_result: assessment.service_area_result, landlord_relationship_result: assessment.landlord_relationship_result, affected_children_count: assessment.household_findings?.affected_children_count ?? '', controlled_notes: assessment.controlled_notes ?? '' } : {});
      setRecommendation(assessment?.structured_recommendation || '');
    }).catch(() => { if (active) setError('تعذر تحميل المراجعة أو ليس لديك صلاحية الوصول.'); });
    return () => { active = false; };
  }, [base]);
  const run = async (method, suffix, body) => {
    setBusy(true); setError('');
    try { await api[method](base + suffix, body); await load(); }
    catch (exception) { setError(reasons(exception.response?.data) || exception.response?.data?.message || 'تعذر حفظ الإجراء.'); }
    finally { setBusy(false); }
  };
  if (!data || data.evaluation.id !== evaluationId) {
    return <MainLayout><div dir="rtl">{error ? <ErrorState title="تعذر تحميل المراجعة" description={error} /> : <LoadingState message="جارٍ تحميل المراجعة..." />}</div></MainLayout>;
  }
  const evaluation = data.evaluation;
  const can = data.capabilities || {};
  const assessment = data.social_assessment;
  const editable = data.current_state === 'pending';
  const blockers = data.approval_blockers || [];
  const breakdown = data.score_breakdown?.length ? data.score_breakdown : policyBreakdown(evaluation.scoring_snapshot);
  const socialLocked = !can.social_assessment || !editable || (assessment && assessment.status !== 'draft');
  const columns = [
    { key: 'label', header: 'البند', render: (row) => row.label || displayLabel('policyDimension', row.rule_id) },
    { key: 'value', header: 'القيمة', render: (row) => text(row.value) },
    { key: 'condition', header: 'الشرط', render: (row) => text(row.condition) },
    { key: 'awarded_points', header: 'النقاط', render: (row) => text(row.awarded_points) },
    { key: 'max_points', header: 'الحد الأعلى', render: (row) => text(row.max_points) },
    { key: 'reason', header: 'السبب', render: (row) => row.reason ? displayReason(row.reason) : '—' },
  ];
  const documents = [
    { key: 'label', header: 'اسم الوثيقة', render: (row) => row.label },
    { key: 'status', header: 'الحالة', render: (row) => <StatusBadge tone="info" label={displayLabel('documentStatus', row.status)} /> },
    { key: 'reference', header: 'مرجع الدليل', render: (row) => row.verification?.evidence_reference || '—' },
    { key: 'notes', header: 'الملاحظات', render: (row) => row.verification?.rejection_reason || (row.required ? 'مطلوبة' : '—') },
  ];
  return (
    <MainLayout>
      <div dir="rtl">
        <PageShell
          title="مراجعة سياسة المستفيد"
          description="مراجعة الأدلة والتقييم الاجتماعي والقرار مع الحفاظ على نتيجة التقييم التاريخية."
          breadcrumbs={[{ label: 'المستفيدون', href: '/beneficiaries' }, { label: data.beneficiary?.full_name || 'المستفيد', href: `/beneficiaries/${data.beneficiary?.id}` }, { label: 'مراجعة السياسة' }]}
          secondaryActions={<SecondaryButton as={Link} to={`/beneficiaries/${data.beneficiary?.id}`}>العودة إلى المستفيد</SecondaryButton>}
        >
          {error && <ErrorState title="تعذر حفظ الإجراء" description={error} />}
          <SectionCard title="ملخص المستفيد">
            <p className="text-sm font-bold text-[var(--color-text-primary)]">{data.beneficiary?.full_name}</p>
            <p className="text-sm text-[var(--color-text-secondary)]">إصدار السياسة: {data.policy_version?.version || 'غير متوفر'}</p>
          </SectionCard>
          <SectionCard title="ملخص نتيجة السياسة">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <KpiCard title="صافي دخل الفرد" value={text(evaluation.financial_snapshot?.net_income_per_capita)} />
              <KpiCard title="مجموع النقاط" value={text(evaluation.policy_score)} />
              <KpiCard title="الفئة" value={displayLabel('scoreCategory', evaluation.score_category)} />
              <KpiCard title="نتيجة الاستحقاق" value={displayLabel('status', evaluation.eligibility_decision)} />
              <KpiCard title="حالة المراجعة" value={displayLabel('documentStatus', data.current_state)} />
            </div>
            <p data-testid="financial-result" className="sr-only">{text(evaluation.financial_snapshot?.net_income_per_capita)}</p>
            <p data-testid="income-category" className="sr-only">{displayLabel('financialCategory', evaluation.income_category)}</p>
            <p data-testid="policy-score" className="sr-only">{text(evaluation.policy_score)}</p>
            <p data-testid="score-category" className="sr-only">{displayLabel('scoreCategory', evaluation.score_category)}</p>
            <p data-testid="eligibility-decision" className="sr-only">{displayLabel('status', evaluation.eligibility_decision)}</p>
            <p className="mt-3 text-xs text-[var(--color-text-muted)]">هذه نتائج التقييم المحفوظة؛ مراجعة الأدلة لا تعيد احتسابها.</p>
          </SectionCard>
          <SectionCard title="تفصيل النقاط">
            <DataTable columns={columns} data={breakdown} rowKey="rule_id" emptyMessage="لا يوجد تفصيل محفوظ" emptySubMessage="يُعرض التفصيل من لقطة التقييم فقط." />
          </SectionCard>
          <SectionCard title="الوثائق المطلوبة">
            <DataTable columns={documents} data={data.documents || []} rowKey="code" emptyMessage="لا توجد وثائق مطلوبة" emptySubMessage="لا توجد قواعد وثائق على هذا التقييم." />
            {(data.documents || []).map((document) => (
              <div key={document.code} data-testid={`document-${document.code}`} className="mt-3 space-y-2">
                {can.verify_documents && editable && document.applicable && (
                  <div className="grid gap-3 md:grid-cols-2">
                    <FormField label={`مرجع ${document.label}`} name={`${document.code}-reference`}>
                      <input aria-label={`مرجع ${document.code}`} className="ikram-control w-full" value={docInput[document.code]?.reference || ''} onChange={(event) => setDocInput({ ...docInput, [document.code]: { ...docInput[document.code], reference: event.target.value } })} />
                    </FormField>
                    <FormField label="سبب الرفض" name={`${document.code}-rejection`}>
                      <input aria-label={`سبب رفض ${document.code}`} className="ikram-control w-full" value={docInput[document.code]?.rejection || ''} onChange={(event) => setDocInput({ ...docInput, [document.code]: { ...docInput[document.code], rejection: event.target.value } })} />
                    </FormField>
                    <div className="flex flex-wrap gap-2 md:col-span-2">
                      <PrimaryButton type="button" disabled={busy} onClick={() => run('post', `/documents/${document.code}`, { status: 'verified', evidence_reference: docInput[document.code]?.reference || '', rejection_reason: docInput[document.code]?.rejection || null })}>توثيق</PrimaryButton>
                      <DangerButton type="button" disabled={busy} onClick={() => run('post', `/documents/${document.code}`, { status: 'rejected', evidence_reference: docInput[document.code]?.reference || '', rejection_reason: docInput[document.code]?.rejection || null })}>رفض الوثيقة</DangerButton>
                      <SecondaryButton type="button" disabled={busy} onClick={() => run('post', `/documents/${document.code}`, { status: 'under_review', evidence_reference: docInput[document.code]?.reference || '', rejection_reason: docInput[document.code]?.rejection || null })}>قيد المراجعة</SecondaryButton>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </SectionCard>
          <SectionCard title="الدليل الطبي / الإعاقة">
            {data.medical_evidence ? (
              <div className="space-y-3">
                <StatusBadge tone="info" label={displayLabel('documentStatus', data.medical_evidence.verification_status)} />
                <p className="text-sm">النسبة الموثقة: {text(data.medical_evidence.verified_disability_percentage)}</p>
              </div>
            ) : <EmptyState title="لا يوجد دليل طبي" description="لا ينطبق دليل إعاقة محفوظ على هذا التقييم." />}
            {can.verify_documents && editable && (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <FormField label="نسبة الإعاقة" name="disability-percentage">
                  <input aria-label="نسبة الإعاقة" type="number" min="0" max="100" step="0.01" className="ikram-control w-full" value={medical.percentage ?? ''} onChange={(event) => setMedical({ ...medical, percentage: event.target.value })} />
                </FormField>
                <FormField label="مرجع الدليل الطبي" name="medical-reference">
                  <input aria-label="مرجع الدليل الطبي" className="ikram-control w-full" value={medical.reference || ''} onChange={(event) => setMedical({ ...medical, reference: event.target.value })} />
                </FormField>
                <PrimaryButton type="button" disabled={busy} onClick={() => run('post', '/medical-evidence', { verification_status: 'verified', verified_disability_percentage: medical.percentage, evidence_reference: medical.reference })}>توثيق الدليل الطبي</PrimaryButton>
              </div>
            )}
          </SectionCard>
          <SectionCard title="التقييم الاجتماعي">
            <p data-testid="assessment-state">{assessment ? displayLabel('documentStatus', assessment.status) : 'لا يوجد تقييم اجتماعي'}</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <FormField label="حالة المسكن" name="housing_condition">
                <select aria-label="حالة المسكن" className="ikram-control w-full" value={draft.housing_condition || ''} disabled={socialLocked} onChange={(event) => setDraft({ ...draft, housing_condition: event.target.value })}><option value="">اختر</option><option value="poor">فقير</option><option value="average">متوسط</option><option value="good">جيد</option></select>
              </FormField>
              <FormField label="منطقة الخدمة" name="service_area_result">
                <select aria-label="منطقة الخدمة" className="ikram-control w-full" value={draft.service_area_result || ''} disabled={socialLocked} onChange={(event) => setDraft({ ...draft, service_area_result: event.target.value })}><option value="">اختر</option><option value="verified_inside">داخل</option><option value="verified_outside">خارج</option><option value="review_required">يتطلب مراجعة</option></select>
              </FormField>
              <FormField label="علاقة المؤجر" name="landlord_relationship_result">
                <select aria-label="علاقة المؤجر" className="ikram-control w-full" value={draft.landlord_relationship_result || ''} disabled={socialLocked} onChange={(event) => setDraft({ ...draft, landlord_relationship_result: event.target.value })}><option value="">اختر</option><option value="no_prohibited_relationship">لا علاقة محظورة</option><option value="prohibited_relationship">علاقة محظورة</option><option value="review_required">يتطلب مراجعة</option></select>
              </FormField>
              <FormField label="الأطفال المتأثرون" name="affected_children_count">
                <input aria-label="الأطفال المتأثرون" className="ikram-control w-full" type="number" min="0" value={draft.affected_children_count ?? ''} disabled={socialLocked} onChange={(event) => setDraft({ ...draft, affected_children_count: event.target.value })} />
              </FormField>
              {can.social_assessment && editable && (!assessment || assessment.status === 'draft') && (
                <FormField label="تاريخ التقييم" name="assessment_date">
                  <input aria-label="تاريخ التقييم" type="date" className="ikram-control w-full" value={draft.assessment_date || ''} onChange={(event) => setDraft({ ...draft, assessment_date: event.target.value })} />
                </FormField>
              )}
            </div>
            <p className="mt-3 text-sm">التوصية: {assessment?.structured_recommendation === 'reject' ? 'رفض' : displayLabel('documentStatus', assessment?.structured_recommendation)}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {can.social_assessment && editable && (!assessment || assessment.status === 'draft') && <SecondaryButton type="button" disabled={busy} onClick={() => run('put', '/social-assessment', { assessment_date: draft.assessment_date, housing_condition: draft.housing_condition, service_area_result: draft.service_area_result, landlord_relationship_result: draft.landlord_relationship_result, household_findings: { affected_children_count: draft.affected_children_count === '' || draft.affected_children_count === undefined ? null : Number(draft.affected_children_count) }, controlled_notes: draft.controlled_notes || null })}>حفظ المسودة</SecondaryButton>}
              {can.social_assessment && editable && assessment && (!assessment || assessment.status === 'draft') && <PrimaryButton type="button" disabled={busy} onClick={() => run('post', '/social-assessment/submit', {})}>تقديم التقييم</PrimaryButton>}
            </div>
            {can.review && editable && assessment?.status === 'submitted' && (
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <FormField label="توصية المراجعة" name="structured_recommendation">
                  <select aria-label="توصية المراجعة" className="ikram-control w-full" value={recommendation} onChange={(event) => setRecommendation(event.target.value)}><option value="">اختر</option><option value="approve">اعتماد</option><option value="reject">رفض</option><option value="pending_review">مراجعة إضافية</option></select>
                </FormField>
                <SecondaryButton type="button" disabled={busy} onClick={() => run('post', '/social-assessment/review', { structured_recommendation: recommendation })}>إتمام المراجعة</SecondaryButton>
              </div>
            )}
          </SectionCard>
          <SectionCard title="موانع الاعتماد">
            <ul data-testid="approval-blockers">{blockers.map((item) => <li key={item}>{displayReason(item)}</li>)}</ul>
            {blockers.length === 0 && <EmptyState title="لا توجد موانع" description="لا تمنع اللقطة الحالية اعتماد القرار." />}
          </SectionCard>
          <SectionCard title="القرار النهائي">
            <p data-testid="decision-state">{displayLabel('documentStatus', data.current_state)}</p>
            {can.decide && editable && (
              <div className="mt-3 grid gap-3">
                <FormField label="رمز السبب" name="reason_code" helperText="يُحفظ الرمز للسجل، ويظهر للمستخدم الشرح العربي.">
                  <input aria-label="رمز السبب الثابت" className="ikram-control w-full" value={reason.code} onChange={(event) => setReason({ ...reason, code: event.target.value })} />
                </FormField>
                <FormField label="شرح القرار" name="reason_text">
                  <input aria-label="شرح القرار" className="ikram-control w-full" value={reason.description} onChange={(event) => setReason({ ...reason, description: event.target.value })} />
                </FormField>
                <div className="flex flex-wrap gap-2">
                  <PrimaryButton type="button" disabled={busy || blockers.length > 0} onClick={() => run('post', '/approve', { reason_code: reason.code, reason_text: reason.description })}>اعتماد القرار</PrimaryButton>
                  <DangerButton type="button" disabled={busy} onClick={() => run('post', '/reject', { reason_code: reason.code, reason_text: reason.description })}>رفض القرار</DangerButton>
                </div>
                {blockers.length > 0 && <p className="text-xs text-[var(--color-text-secondary)]">يبقى الاعتماد موقوفاً حتى تكتمل المراجعات الإلزامية. الخادم هو مرجع الرفض.</p>}
              </div>
            )}
            <ul data-testid="decision-history">{(data.decision_history || []).map((item) => <li key={item.id}>{displayLabel('documentStatus', item.decision)} — {item.human_readable_reason} — {item.decided_at}</li>)}</ul>
          </SectionCard>
        </PageShell>
      </div>
    </MainLayout>
  );
}
