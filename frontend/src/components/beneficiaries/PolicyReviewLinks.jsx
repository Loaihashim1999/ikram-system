import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { displayLabel, displayReason, policyBreakdown } from '../../utils/displayVocabulary';
import FormField from '../ui/FormField';
import { PrimaryButton } from '../ui/Button';
import EmptyState from '../ui/EmptyState';
import ErrorState from '../ui/ErrorState';
import StatusBadge from '../ui/StatusBadge';
import DataTable from '../ui/DataTable';
import KpiCard from '../ui/KpiCard';

const availability = (version) => {
  const today = new Date().toISOString().slice(0, 10);
  const from = String(version.effective_from || '').slice(0, 10);
  const to = String(version.effective_to || '').slice(0, 10);
  if (version.status !== 'published') return { selectable: false, label: `${version.policy_name} — مسودة` };
  if (from && from > today) return { selectable: false, label: `منشورة — يبدأ سريانها في ${from}` };
  if (to && to < today) return { selectable: false, label: `${version.policy_name} — منتهية` };
  return { selectable: true, label: `${version.policy_name} — ${version.version}` };
};

export default function PolicyReviewLinks({ beneficiaryId, archived = false }) {
  const { user } = useAuth();
  const allowed = user?.role === 'admin' || ['view_documents', 'verify_documents', 'social_assessment', 'review', 'decide'].some((permission) => user?.permissions?.beneficiary_policy?.[permission] === true);
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
    if (allowed) api.get(`/beneficiary-policy/beneficiaries/${beneficiaryId}/evaluations`).then(({ data }) => { if (active) setRows(data.data || []); }).catch(() => { if (active) setError('تعذر تحميل المراجعات.'); });
    if (canEvaluate && canViewVersions) api.get('/beneficiary-policy/versions').then(({ data }) => { if (active) setVersions(data.data?.data || data.data || []); }).catch(() => { if (active) setError('تعذر تحميل إصدارات السياسة.'); });
    return () => { active = false; };
  }, [beneficiaryId, allowed, canEvaluate, canViewVersions, revision]);
  const evaluate = async () => {
    setBusy(true); setError('');
    try { await api.post('/beneficiary-policy/evaluate', { beneficiary_id: beneficiaryId, policy_version_id: versionId }); setVersionId(''); setRevision((current) => current + 1); }
    catch (exception) { setError(exception.response?.data?.errors?.policy_version_id?.[0] || exception.response?.data?.message || 'تعذر إعادة تقييم السياسة.'); }
    finally { setBusy(false); }
  };
  if (!allowed && !canEvaluate) return <EmptyState title="لا توجد بيانات سياسة" description="لا تتوفر صلاحية عرض تقييمات السياسة لهذا الحساب." />;
  const latest = rows[0];
  const breakdown = policyBreakdown({ breakdown: latest?.score_breakdown });
  const selectable = versions.filter((version) => availability(version).selectable);
  const columns = [
    { key: 'label', header: 'البند', render: (row) => row.label },
    { key: 'value', header: 'القيمة المستخدمة', render: (row) => row.value ?? 'غير متوفر' },
    { key: 'condition', header: 'الشرط', render: (row) => row.condition || 'غير محدد' },
    { key: 'awarded_points', header: 'النقاط', render: (row) => row.awarded_points ?? '—' },
    { key: 'max_points', header: 'الحد الأعلى', render: (row) => row.max_points ?? '—' },
    { key: 'reason', header: 'السبب', render: (row) => row.reason ? displayReason(row.reason) : '—' },
  ];
  return (
    <div className="space-y-4">
      {error && <ErrorState title="تعذر تنفيذ الإجراء" description={error} />}
      {canEvaluate && canViewVersions && selectable.length === 0 && <ErrorState title="لا توجد سياسة سارية" description="لا يمكن إنشاء تقييم تشغيلي قبل وجود نسخة منشورة داخل تاريخ سريانها." />}
      {canEvaluate && canViewVersions && (
        <div className="flex flex-wrap items-end gap-3">
          <FormField label="إصدار السياسة" name="policy_version_id" className="min-w-0 flex-1">
            <select id="policy_version_id" aria-label="إصدار السياسة" value={versionId} onChange={(event) => setVersionId(event.target.value)} className="ikram-control w-full">
              <option value="">اختر سياسة سارية لإعادة التقييم</option>
              {versions.map((version) => {
                const state = availability(version);
                return <option key={version.id} value={state.selectable ? version.id : ''} disabled={!state.selectable}>{state.label}</option>;
              })}
            </select>
          </FormField>
          <PrimaryButton type="button" disabled={!versionId || busy} onClick={evaluate}>إنشاء تقييم جديد</PrimaryButton>
        </div>
      )}
      {!latest ? <EmptyState title="لا يوجد تقييم سياسة" description={selectable.length ? 'لم يُسجل تقييم بعد. يمكن إنشاء تقييم جديد على السياسة السارية.' : 'لا يوجد تقييم محفوظ، ولا توجد سياسة سارية تسمح بإنشائه الآن.'} /> : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <KpiCard title="حالة التقييم" value={displayLabel('status', latest.current_state || latest.evaluation_status)} />
            <KpiCard title="إصدار السياسة" value={latest.policy_version?.version || 'غير متوفر'} />
            <KpiCard title="تاريخ التقييم" value={latest.evaluated_at?.slice(0, 10) || 'غير متوفر'} />
            <KpiCard title="مجموع النقاط" value={latest.policy_score ?? 'غير متوفرة'} />
            <KpiCard title="الفئة" value={displayLabel('scoreCategory', latest.score_category)} />
            <KpiCard title="نتيجة الاستحقاق" value={displayLabel('status', latest.eligibility_decision)} />
          </div>
          <DataTable columns={columns} data={breakdown} rowKey="rule_id" emptyMessage="لا يوجد تفصيل نقاط محفوظ" emptySubMessage="سيظهر التفصيل من لقطة التقييم عند توفره." />
          <p className="text-sm"><Link to={`/admin/beneficiary-policy/review/${latest.id}`}>فتح مراجعة هذا التقييم</Link></p>
          {latest.eligibility_reasons?.length > 0 && <ul>{latest.eligibility_reasons.map((reason) => <li key={reason}><StatusBadge tone="warning" label={displayReason(reason)} /></li>)}</ul>}
        </>
      )}
      {rows.length > 1 && (
        <div className="space-y-2">
          <h3 className="text-sm font-extrabold text-[var(--color-text-primary)]">التقييمات السابقة</h3>
          {rows.slice(1).map((evaluation) => (
            <p key={evaluation.id} className="text-sm">
              <Link to={`/admin/beneficiary-policy/review/${evaluation.id}`}>{evaluation.evaluated_at?.slice(0, 10) || 'بدون تاريخ'}</Link>
              {' — '}{displayLabel('status', evaluation.eligibility_decision)}{' — '}{evaluation.policy_score ?? 'بدون نقاط'}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
