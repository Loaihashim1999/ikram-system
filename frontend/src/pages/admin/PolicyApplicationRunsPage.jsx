import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../../api/axios';
import PageHeader from '../../components/ui/PageHeader';

const runStatuses = { draft: 'مسودة', simulated: 'تمت المحاكاة', approved_for_execution: 'معتمد للتنفيذ', running: 'قيد التنفيذ', completed: 'مكتمل', completed_with_errors: 'مكتمل مع أخطاء', failed: 'فشل', cancelled: 'ملغي' };
const itemStatuses = { pending: 'بانتظار المعالجة', simulated: 'تمت المحاكاة', processing: 'قيد المعالجة', completed: 'مكتمل', review_required: 'يتطلب مراجعة', not_applicable: 'غير منطبق', failed: 'فشل', cancelled: 'ملغي' };
const modeLabels = { new_only: 'المستفيدون الجدد فقط', all_existing_and_new: 'الحاليون والجدد', selected_existing_and_new: 'مستفيدون محددون والجدد', effective_from_date: 'من تاريخ النفاذ' };

/**
 * POLICY-E5 — application-scope run ledger UI.
 *
 * Lifecycle only through the real API: create+simulate (read-only), approve,
 * execute, retry and cancel. Conflicts surface the server STABLE machine code
 * (e.g. SIMULATION_STALE) beside the Arabic message; the client never derives
 * or hides a business outcome.
 */
export default function PolicyApplicationRunsPage() {
  const { versionId } = useParams();
  const [version, setVersion] = useState(null);
  const [runs, setRuns] = useState([]);
  const [detail, setDetail] = useState(null);
  const [items, setItems] = useState(null);
  const [page, setPage] = useState(1);
  const [candidates, setCandidates] = useState([]);
  const [picked, setPicked] = useState([]);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const currentUser = (() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
  })();
  const can = (permission) => !currentUser
    || currentUser.role === 'admin'
    || currentUser.permissions?.beneficiary_policy?.[permission] === true;

  const loadRuns = useCallback(async () => {
    const response = await api.get(`/beneficiary-policy/versions/${versionId}/application-runs`);
    setRuns(response.data.data || []);
    return response.data.data || [];
  }, [versionId]);

  const loadItems = useCallback(async (runId, currentPage = 1) => {
    const response = await api.get(`/beneficiary-policy/application-runs/${runId}/items`, { params: { per_page: 10, page: currentPage } });
    setItems(response.data.data);
    setPage(currentPage);
  }, []);

  const select = useCallback(async (runId) => {
    setError('');
    const response = await api.get(`/beneficiary-policy/application-runs/${runId}`);
    setDetail(response.data.data);
    await loadItems(runId, 1);
  }, [loadItems]);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get(`/beneficiary-policy/versions/${versionId}`),
      api.get(`/beneficiary-policy/versions/${versionId}/application-runs`),
    ]).then(([v, r]) => {
      if (!active) return;
      setVersion(v.data.data);
      setRuns(r.data.data || []);
    }).catch(() => { if (active) setError('تعذر تحميل نطاق التطبيق أو ليس لديك صلاحية الوصول.'); });
    return () => { active = false; };
  }, [versionId]);

  const messageFor = (e) => {
    const data = e.response?.data;
    if (!data) return 'تعذر تنفيذ الإجراء.';
    return (data.code ? `${data.code} — ` : '') + (data.message || 'تعذر تنفيذ الإجراء.');
  };

  const createAndSimulate = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      const scopeMode = version?.configuration?.application_scope?.applies_to;
      const body = scopeMode === 'selected_existing_and_new' ? { scope_parameters: { beneficiary_ids: picked } } : {};
      const response = await api.post(`/beneficiary-policy/versions/${versionId}/simulate`, body);
      setMessage('تمت المحاكاة بنجاح (للقراءة فقط — لم يتم إنشاء أي تقييم).');
      await loadRuns();
      await select(response.data.data.id);
    } catch (e) { setError(messageFor(e)); } finally { setBusy(false); }
  };

  const act = async (runId, suffix) => {
    setBusy(true); setError(''); setMessage('');
    try {
      await api.post(`/beneficiary-policy/application-runs/${runId}/${suffix}`);
      await loadRuns();
      await select(runId);
    } catch (e) { setError(messageFor(e)); } finally { setBusy(false); }
  };

  const loadCandidates = async (term = '') => {
    const response = await api.get('/beneficiaries', { params: { per_page: 100, search: term || undefined } });
    setCandidates(response.data.data?.data || []);
  };

  const mode = version?.configuration?.application_scope?.applies_to;
  const actionsFor = (status, runId) => {
    const map = {
      draft: [['محاكاة', 'simulate', 'simulate'], ['إلغاء', 'cancel', 'apply_scope']],
      simulated: [['اعتماد للتنفيذ', 'approve-application', 'apply_scope'], ['إلغاء', 'cancel', 'apply_scope']],
      approved_for_execution: [['تنفيذ', 'execute', 'execute_reevaluation'], ['إلغاء', 'cancel', 'apply_scope']],
      completed_with_errors: [['إعادة المعالجة', 'retry', 'execute_reevaluation']],
    };
    return (map[status] || []).filter(([, , permission]) => can(permission)).map(([label, suffix]) => (
      <button key={suffix} type="button" data-testid={`action-${suffix}`} aria-label={`${label} ${runId}`} disabled={busy} onClick={() => act(runId, suffix)} className="px-2 py-1 rounded-lg border border-[var(--color-border)] bg-white text-[11px] font-bold disabled:opacity-40">{label}</button>
    ));
  };

  return (
    <main dir="rtl" className="ikram-page max-w-5xl">
      <PageHeader title="تطبيق نطاق السياسة (POLICY-E)" subtitle="محاكاة النطاق واعتماده وتنفيذه مع سجل تشغيل قابل للتدقيق" breadcrumbs={[{ label: 'الإعدادات', to: '/admin/settings' }, { label: 'نطاق التطبيق' }]} actions={<Link to="/admin/settings" className="text-xs font-bold text-[var(--color-brand-green)] underline">العودة إلى الإعدادات</Link>} />
      <p role="alert" data-testid="policye-error" className={`p-3 rounded-xl text-xs font-bold bg-[#FEE2E2] text-[#B91C1C] border border-[#FCA5A5] ${error ? '' : 'hidden'}`}>{error}</p>
      <p role="status" data-testid="policye-message" className={`p-3 rounded-xl text-xs font-bold ${message ? 'bg-[#E6F4EC] text-[#2E7D32] border border-[#A5D6A7]' : 'hidden'}`}>{message}</p>

      {!version && !error && <p role="status">جارٍ تحميل نطاق التطبيق...</p>}
      {version && (
        <section className="ikram-panel space-y-3 p-4 sm:p-5" aria-label="معلومات الإصدار">
          <h2 className="text-xs font-extrabold">{version.policy_name} — {version.version}</h2>
          <p className="text-[11px] text-[var(--color-text-muted)]">نطاق التطبيق: {modeLabels[mode] || mode || 'غير محدد'}</p>
          {mode === 'selected_existing_and_new' && (
            <div className="space-y-2" data-testid="candidate-picker">
              <label htmlFor="candidate-search" className="text-[11px] font-bold">اختيار المستفيدين المحددين</label>
              <input id="candidate-search" aria-label="بحث مستفيد" className="ikram-control" value={search} onChange={(e) => { setSearch(e.target.value); loadCandidates(e.target.value); }} onFocus={() => candidates.length === 0 && loadCandidates('')} />
              <ul className="max-h-40 overflow-y-auto border rounded divide-y">
                {candidates.map((c) => (
                  <li key={c.id} className="p-1 text-[11px] flex items-center gap-2">
                    <input type="checkbox" aria-label={c.full_name} checked={picked.includes(c.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, c.id] : picked.filter((id) => id !== c.id))} />
                    {c.full_name} — {c.beneficiary_type}
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-[var(--color-text-muted)]">المحدد: {picked.length}</p>
            </div>
          )}
          <button type="button" data-testid="create-simulate" disabled={busy || (mode === 'selected_existing_and_new' && picked.length === 0)} onClick={createAndSimulate} className="px-3 py-1.5 rounded-xl bg-[var(--color-brand-green)] text-white text-xs font-bold disabled:opacity-40">إنشاء محاكاة جديدة (قراءة فقط)</button>
        </section>
      )}

      {version && (
      <section className="ikram-panel space-y-3 overflow-hidden p-4 sm:p-5" aria-label="سجل المحاكاة والتنفيذ">
        <h2 className="text-xs font-extrabold">سجل التشغيل (Runs)</h2>
        {runs.length === 0 && <p className="text-xs text-[var(--color-text-muted)]" data-testid="runs-empty">لا توجد محاكاة لهذا الإصدار بعد.</p>}
        {runs.length > 0 && (
          <div className="ikram-table-wrap">
          <table className="ikram-table text-[11px]">
            <thead className="bg-[var(--color-bg-soft)] font-bold border-b border-[var(--color-border)]">
              <tr>
                <th className="p-2">الحالة</th>
                <th className="p-2">المرشحون</th>
                <th className="p-2">عالجت</th>
                <th className="p-2">مكتملة</th>
                <th className="p-2">مراجعة</th>
                <th className="p-2">غير منطبق</th>
                <th className="p-2">أخطاء</th>
                <th className="p-2">الإجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {runs.map((r) => (
                <tr key={r.id} className={`hover:bg-[var(--color-bg-soft)] ${detail?.id === r.id ? 'bg-[#FFF7E6]' : ''}`} data-testid={`run-row-${r.status}`}>
                  <td className="p-2 font-bold"><span data-testid="run-status">{runStatuses[r.status] || r.status}</span></td>
                  <td className="p-2">{r.total_candidates}</td>
                  <td className="p-2">{r.processed_count}</td>
                  <td className="p-2">{r.success_count}</td>
                  <td className="p-2">{r.review_count}</td>
                  <td className="p-2">{r.not_applicable_count}</td>
                  <td className="p-2">{r.failed_count}</td>
                  <td className="p-2">
                    <div className="flex flex-wrap gap-1">
                      <button type="button" aria-label={`تفاصيل ${r.id}`} disabled={busy} onClick={() => select(r.id)} className="px-2 py-1 rounded-lg border border-[var(--color-border)] bg-white text-[11px] font-bold disabled:opacity-40">تفاصيل</button>
                      {actionsFor(r.status, r.id)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </section>
      )}

      {detail && (
        <section className="ikram-panel space-y-3 overflow-hidden p-4 sm:p-5" aria-label="تفاصيل التشغيل">
          <h2 className="text-xs font-extrabold" data-testid="detail-status">{runStatuses[detail.status] || detail.status}</h2>
          <p data-testid="freshness" className={`text-[11px] font-bold ${detail.freshness?.fresh ? 'text-[#2E7D32]' : 'text-[#B91C1C]'}`}>
            {detail.freshness ? (detail.freshness.fresh ? 'المحاكاة محدثة' : `قديمة — ${detail.freshness.code}`) : 'حالة التحديث غير متاحة'}
          </p>
          <p className="text-[11px] text-[var(--color-text-muted)] break-all" data-testid="candidate-hash">بصمة مجموعة المرشحين: {detail.candidate_set_hash || '—'}</p>
          <p className="text-[11px]" data-testid="run-counters">
            المرشحون: {detail.total_candidates} | تمت معالجتها: {detail.processed_count} | مكتملة: {detail.success_count} | مراجعة: {detail.review_count} | غير منطبق: {detail.not_applicable_count} | أخطاء: {detail.failed_count}
          </p>
          {detail.simulation_summary && (
            <p className="text-[11px]" data-testid="simulation-summary">
              حصر المحاكاة — محاكى: {detail.simulation_summary.simulated_count ?? 0}، لائق: {detail.simulation_summary.eligible_count ?? 0}، غير لائق: {detail.simulation_summary.ineligible_count ?? 0}، غير منطبق: {detail.simulation_summary.not_applicable_count ?? 0}، يتطلب مراجعة: {detail.simulation_summary.review_required_count ?? 0}، أخطاء: {detail.simulation_summary.failed_count ?? 0}
            </p>
          )}
          {detail.approved_by_name && <p className="text-[11px]">اعتُمد للتنفيذ بواسطة: {detail.approved_by_name}</p>}

          <div className="ikram-table-wrap">
            <table className="ikram-table text-[11px]">
              <thead className="bg-[var(--color-bg-soft)] font-bold border-b border-[var(--color-border)]">
                <tr>
                  <th className="p-2">المستفيد</th>
                  <th className="p-2">النوع</th>
                  <th className="p-2">الحالة</th>
                  <th className="p-2">المحاولات</th>
                  <th className="p-2">رمز الخطأ</th>
                  <th className="p-2">التقييم الجديد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]" data-testid="items-body">
                {(items?.data || []).map((it) => (
                  <tr key={it.id}>
                    <td className="p-2">{it.beneficiary_name || it.beneficiary_id}</td>
                    <td className="p-2">{it.beneficiary_type}</td>
                    <td className="p-2">{itemStatuses[it.status] || it.status}</td>
                    <td className="p-2">{it.attempt_count}</td>
                    <td className="p-2">{it.failure_code ? `${it.failure_code}: ${it.failure_details || ''}` : '—'}</td>
                    <td className="p-2">{it.new_evaluation_id ? String(it.new_evaluation_id).slice(0, 8) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {items && items.last_page > 1 && (
            <div className="flex gap-2 text-[11px]">
              <button type="button" disabled={busy || page <= 1} onClick={() => loadItems(detail.id, page - 1)} className="px-2 py-1 border rounded disabled:opacity-40">السابق</button>
              <span className="px-2 py-1" data-testid="items-page">صفحة {items.current_page} من {items.last_page} ({items.total})</span>
              <button type="button" disabled={busy || page >= items.last_page} onClick={() => loadItems(detail.id, page + 1)} className="px-2 py-1 border rounded disabled:opacity-40">التالي</button>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
