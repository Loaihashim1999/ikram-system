import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import api from '../../api/axios';

import StatusBadge from '../../components/ui/StatusBadge';
import { PrimaryButton, DangerButton } from '../../components/ui/Button';
import ErrorState from '../../components/ui/ErrorState';

const versionTiming = (version) => {
  const today = new Date().toISOString().slice(0, 10);
  const from = String(version.effective_from || '').slice(0, 10);
  const to = String(version.effective_to || '').slice(0, 10);
  if (version.status === 'draft') return { label: 'مسودة', tone: 'neutral' };
  if (version.status === 'retired') return { label: 'مؤرشفة', tone: 'neutral' };
  if (from && from > today) return { label: `منشورة — يبدأ سريانها في ${from}`, tone: 'warning' };
  if (to && to < today) return { label: 'منتهية', tone: 'danger' };
  return { label: 'سارية حالياً', tone: 'success' };
};
const SCOPES = [
  { key: 'new_only', label: 'المستفيدون الجدد فقط' },
  { key: 'all_existing_and_new', label: 'جميع المستفيدين الحاليين والجدد' },
  { key: 'selected_existing_and_new', label: 'مستفيدون مختارون والحاليون والجدد' },
  { key: 'effective_from_date', label: 'التطبيق من تاريخ السريان' },
];
const INCOME_SOURCES = [
  { key: 'salary', label: 'الراتب' },
  { key: 'social_security', label: 'الضمان الاجتماعي' },
  { key: 'citizen_account', label: 'حساب المواطن' },
  { key: 'retirement', label: 'التقاعد' },
  { key: 'family_support', label: 'دعم الأسرة' },
  { key: 'social_insurance', label: 'التأمينات الاجتماعية' },
  { key: 'other', label: 'مصادر أخرى معتمدة' },
];
const ACTIONS_LABELS = { view: 'عرض', edit_draft: 'تحرير مسودة', approve: 'اعتماد', publish: 'نشر', retire: 'أرشفة' };
const SCORING_DIM_ORDER = ['income', 'housing_condition', 'housing_tenure', 'head_health', 'children_health', 'age'];
const DIM_LABELS = {
  income: 'الدخل (ريال للفرد)', housing_condition: 'حالة المسكن', housing_tenure: 'ملكية المسكن',
  head_health: 'إعاقة رب الأسرة (%)', children_health: 'الأطفال المتأثرون صحياً', age: 'عمر رب الأسرة (سنوات)',
};
const SCORE_CAT_META = [
  { key: 'd', label: 'فئة النقاط د' }, { key: 'c', label: 'فئة النقاط ج' },
  { key: 'b', label: 'فئة النقاط ب' }, { key: 'a', label: 'فئة النقاط أ' },
];

const emptyIncomeBands = (threshold = 1000) => [
  { key: 'a', label: 'فئة الدخل أ', min: '0', max: '400' },
  { key: 'b', label: 'فئة الدخل ب', min: '400.01', max: '600' },
  { key: 'c', label: 'فئة الدخل ج', min: '600.01', max: '800' },
  { key: 'd', label: 'فئة الدخل د', min: '800.01', max: String(threshold) },
];

const emptyScoring = () => ({
  max_score: '75',
  dimensions: {
    income: { enabled: true, bands: [
      { min: '0', max: '400', points: '15' },
      { min: '400.01', max: '600', points: '11' },
      { min: '600.01', max: '800', points: '7' },
      { min: '800.01', max: '1000', points: '5' },
      { min: '1000.01', max: '', points: '0' },
    ] },
    housing_condition: { enabled: true, values: [
      { value: 'poor', label: 'متدهور', points: '10' },
      { value: 'average', label: 'متوسط', points: '5' },
      { value: 'good', label: 'جيد', points: '0' },
    ] },
    housing_tenure: { enabled: true, values: [
      { value: 'rented', label: 'مستأجر', points: '10' },
      { value: 'owned', label: 'مالك', points: '0' },
    ] },
    head_health: { enabled: true, bands: [
      { min: '0', max: '0', points: '0' },
      { min: '0.01', max: '49.99', points: '5' },
      { min: '50', max: '79.99', points: '10' },
      { min: '80', max: '100', points: '15' },
    ] },
    children_health: { enabled: true, values: [
      { value: '1', label: 'طفل واحد', points: '5' },
      { value: '2', label: 'طفلان', points: '7' },
      { value: '3', label: 'ثلاثة أطفال', points: '10' },
    ] },
    age: { enabled: true, bands: [
      { min: '30', max: '39', points: '0' },
      { min: '40', max: '49', points: '5' },
      { min: '50', max: '59', points: '10' },
      { min: '60', max: '', points: '15' },
    ] },
  },
});

const emptyScoreCats = (maxScore = 75) => [
  { key: 'd', label: 'فئة النقاط د', min: '0', max: '4' },
  { key: 'c', label: 'فئة النقاط ج', min: '5', max: '25' },
  { key: 'b', label: 'فئة النقاط ب', min: '26', max: '50' },
  { key: 'a', label: 'فئة النقاط أ', min: '51', max: String(maxScore) },
];

const emptyExceptions = (ceiling = 1200) => ({
  rules: [{
    code: 'orphan_mother', enabled: true, label: 'أم يتيم / أرملة مع أيتام',
    income_ceiling: String(ceiling), requires_manual_review: true,
    condition: { field: 'family_status', operator: 'in', values: ['widow_with_orphans'] },
  }],
});

const emptyDraft = () => ({
  policy_name: 'سياسة صرف المساعدات للمستفيدين',
  version: '',
  policy_scope: 'citizen_beneficiaries',
  effective_from: '',
  effective_to: '',
  source_document_reference: '',
  source_document_version: '',
  change_reason: '',
  financial: { per_family_member_deduction: '100', counted_income_sources: ['salary', 'social_security', 'citizen_account'], rent_mode: 'annual_preference' },
  eligibility: { review: { documents: true, service_area: true, landlord_relation: true, family_status: true, male_under_40: true } },
  applies_to: 'all_existing_and_new',
  incomeCategories: { exclusion_threshold: '1000', bands: emptyIncomeBands() },
  scoring: emptyScoring(),
  scoreCategories: { bands: emptyScoreCats() },
  exceptions: emptyExceptions(),
});

// ── Client-side mirror of the POLICY-C validator (visible overlap/gap errors) ──

const toCents = (v) => Math.round(Number(v || 0) * 100);

function computePolicyErrors(f) {
  const errs = [];
  // income categories
  const threshold = Number(f.incomeCategories.exclusion_threshold);
  if (!(threshold >= 0)) errs.push('حد الاستبعاد الدخلي يجب أن يكون رقماً غير سالب.');
  let prevMax = null;
  f.incomeCategories.bands.forEach((b, i) => {
    const min = Number(b.min);
    const max = Number(b.max);
    if (!(min >= 0) || !(max >= 0)) { errs.push(`شريحة الدخل ${b.key}: الحدود لا يمكن أن تكون سالبة.`); return; }
    if (min > max) errs.push(`شريحة الدخل ${b.key}: الحد الأدنى أكبر من الحد الأعلى.`);
    if (i === 0 && toCents(min) !== 0) errs.push('الشرائح الدخلية يجب أن تبدأ من صفر.');
    if (prevMax !== null && toCents(min) !== prevMax + 1) errs.push(`شريحة الدخل ${b.key}: الشرائح متجاورة فقط بفرق 0.01 — يوجد تداخل أو فجوة.`);
    prevMax = toCents(max);
  });
  if (prevMax !== null && prevMax !== toCents(threshold)) errs.push(`أعلى شريحة دخلية (${Number(f.incomeCategories.bands.at(-1)?.max)}) يجب أن تبلغ حد الاستبعاد (${threshold.toFixed(2)}) بالضبط.`);

  // scoring: bands dimensions (income / head_health / age)
  const dims = f.scoring.dimensions;
  ['income', 'head_health', 'age'].forEach((dim) => {
    const d = dims[dim];
    if (!d || !d.bands) return;
    const step = dim === 'age' ? 100 : 1;
    let pMax = null;
    let openCount = 0;
    d.bands.forEach((r, i) => {
      const min = Number(r.min);
      const hasMax = String(r.max).trim() !== '';
      const max = hasMax ? Number(r.max) : null;
      if (!(min >= 0)) { errs.push(`${DIM_LABELS[dim]}: الحد الأدنى للنطاق ${i + 1} سالب.`); return; }
      if (hasMax && max < min) errs.push(`${DIM_LABELS[dim]}: الحد الأعلى للنطاق ${i + 1} أقل من الأدنى.`);
      if (!hasMax) {
        openCount += 1;
        if (openCount > 1) errs.push(`${DIM_LABELS[dim]}: لا يمكن أن يكون هناك أكثر من نطاق مفتوح واحد.`);
      }
      if (pMax !== null && toCents(min) !== pMax + step) errs.push(`${DIM_LABELS[dim]}: النطاقات يجب أن تكون متجاورة دون تداخل أو فجوات.`);
      pMax = hasMax ? toCents(max) : null;
    });
    if (dim === 'income' && toCents(Number(d.bands[0]?.min ?? 0)) !== 0) errs.push('بعد الدخل (نقاط) يجب أن يبدأ من صفر.');
    if (dim === 'income' && openCount === 0) errs.push('بعد الدخل (نقاط) يجب أن يغطي كل القيم عبر نطاق مفتوح في الأعلى.');
    if (dim === 'head_health' && pMax !== 10000) errs.push('نسبة الإعاقة يجب أن تغطي النطاق 0–100 بالكامل.');
  });

  // scoring: max achievable vs max_score
  const maxScore = Number(f.scoring.max_score);
  if (!(maxScore >= 0) || !Number.isInteger(maxScore)) errs.push('الحد الأقصى للنقاط يجب أن يكون عدداً صحيحاً غير سالب.');
  else {
    let achievable = 0;
    SCORING_DIM_ORDER.forEach((dim) => {
      const d = dims[dim];
      if (!d || !d.enabled) return;
      const rows = d.values || d.bands || [];
      const top = Math.max(...rows.map((r) => Number(r.points || 0)), 0);
      achievable += top;
    });
    if (achievable > maxScore) errs.push(`مجموع الحدود القصوى لأبعاد النقاط (${achievable}) يتجاوز الحد الأقصى المسموح (${maxScore}).`);
  }

  // score categories
  let prevScore = null;
  f.scoreCategories.bands.forEach((b, i) => {
    const min = Number(b.min);
    const max = Number(b.max);
    if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max < 0) { errs.push(`فئة النقاط ${b.key}: الحدود يجب أن تكون أعداداً صحيحة غير سالبة.`); return; }
    if (min > max) errs.push(`فئة النقاط ${b.key}: الحد الأدنى أكبر من الحد الأعلى.`);
    if (max > maxScore) errs.push(`فئة النقاط ${b.key}: النطاق (${max}) يتجاوز الحد الأقصى (${maxScore}).`);
    if (i === 0 && min !== 0) errs.push('فئات النقاط يجب أن تبدأ من صفر.');
    if (prevScore !== null && min !== prevScore + 1) errs.push(`فئة النقاط ${b.key}: الفئات متجاورة فقط بفارق نقطة — يوجد تداخل أو فجوة.`);
    prevScore = max;
  });
  if (prevScore !== null && prevScore !== maxScore) errs.push(`أعلى فئة نقاط (${prevScore}) يجب أن تبلغ الحد الأقصى للنقاط (${maxScore}).`);

  // exceptions
  f.exceptions.rules.forEach((r) => {
    const ceiling = Number(r.income_ceiling);
    if (!(ceiling > 0)) errs.push(`استثناء «${r.label}»: سقف الدخل يجب أن يكون رقماً موجباً.`);
    if (ceiling <= threshold) errs.push(`استثناء «${r.label}»: سقف الدخل (${ceiling}) يجب أن يتجاوز حد الاستبعاد (${threshold}).`);
  });

  return errs;
}

export default function BeneficiaryPolicySettings() {
  const [versions, setVersions] = useState([]);
  const [permissions, setPermissions] = useState({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // { mode: 'create'|'edit'|'approve'|'retire', version }
  const [form, setForm] = useState(emptyDraft());
  const [approve, setApprove] = useState({ board_approval_reference: '', board_approval_date: '' });
  const [retireReason, setRetireReason] = useState('');
  const [history, setHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const policyErrors = useMemo(() => computePolicyErrors(form), [form]);

  const scoringSummary = useMemo(() => {
    let achievable = 0;
    SCORING_DIM_ORDER.forEach((dim) => {
      const d = form.scoring.dimensions[dim];
      if (!d || !d.enabled) return;
      const rows = d.values || d.bands || [];
      achievable += Math.max(...rows.map((r) => Number(r.points || 0)), 0);
    });
    return { achievable, maxScore: Number(form.scoring.max_score) };
  }, [form.scoring]);

  const load = () => Promise.all([api.get('/beneficiary-policy/permissions'), api.get('/beneficiary-policy/versions')])
    .then(([p, v]) => { setPermissions(p.data.data || {}); setVersions(v.data.data || []); })
    .catch(() => setError('تعذر تحميل إصدارات السياسة.'));

  useEffect(() => { load(); }, []);

  const flash = (type, text) => { setMessage(type === 'ok' ? text : ''); setError(type === 'err' ? text : ''); setTimeout(() => { setMessage(''); setError(''); }, 4000); };

  const toNumber = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
  const toValue = (dim, v) => (dim === 'children_health' ? Number(v) : String(v));

  const configPayload = () => ({
    financial: {
      per_family_member_deduction: Number(form.financial.per_family_member_deduction),
      counted_income_sources: form.financial.counted_income_sources,
      rent_mode: form.financial.rent_mode,
    },
    eligibility: { review: form.eligibility.review },
    application_scope: { applies_to: form.applies_to },
    income_categories: {
      exclusion_threshold: Number(form.incomeCategories.exclusion_threshold),
      bands: form.incomeCategories.bands.map((b) => ({ key: b.key, label: b.label, min: Number(b.min), max: Number(b.max) })),
    },
    scoring: {
      max_score: Number(form.scoring.max_score),
      dimensions: Object.fromEntries(SCORING_DIM_ORDER.map((dim) => {
        const d = form.scoring.dimensions[dim];
        return [dim, {
          enabled: d.enabled,
          ...(d.bands
            ? { bands: d.bands.map((r) => ({ min: Number(r.min), max: toNumber(r.max), points: Number(r.points) })) }
            : { values: d.values.map((r) => ({ value: toValue(dim, r.value), points: Number(r.points) })) }),
        }];
      })),
    },
    score_categories: {
      bands: form.scoreCategories.bands.map((b) => ({ key: b.key, label: b.label, min: Number(b.min), max: Number(b.max) })),
    },
    exceptions: {
      rules: form.exceptions.rules.map((r) => ({
        code: r.code, enabled: r.enabled, label: r.label,
        income_ceiling: Number(r.income_ceiling), requires_manual_review: r.requires_manual_review,
        condition: r.condition,
      })),
    },
  });

  const openCreate = () => { setForm(emptyDraft()); setModal({ mode: 'create' }); };
  const openEdit = (v) => {
    const cfg = v.configuration && typeof v.configuration === 'object' ? v.configuration : {};
    const base = emptyDraft();
    const storedScoring = (old) => ({
      max_score: String(old.scoring?.max_score ?? 75),
      dimensions: Object.fromEntries(SCORING_DIM_ORDER.map((dim) => {
        const saved = old.scoring?.dimensions?.[dim] || {};
        const source = base.scoring.dimensions[dim];
        if (saved.bands) {
          return [dim, { enabled: saved.enabled ?? true, bands: saved.bands.map((r) => ({ min: String(r.min), max: r.max === null || r.max === undefined ? '' : String(r.max), points: String(r.points) })) }];
        }
        return [dim, { enabled: saved.enabled ?? true, values: saved.values ? saved.values.map((r) => ({ value: String(r.value), points: String(r.points) })) : source.values }];
      })),
    });
    setForm({
      policy_name: v.policy_name, version: v.version, policy_scope: v.policy_scope,
      effective_from: v.effective_from || '', effective_to: v.effective_to || '',
      source_document_reference: v.source_document_reference || '', source_document_version: v.source_document_version || '',
      change_reason: v.change_reason || '',
      financial: {
        per_family_member_deduction: String(cfg.financial?.per_family_member_deduction ?? 100),
        counted_income_sources: cfg.financial?.counted_income_sources ?? [],
        rent_mode: cfg.financial?.rent_mode || 'annual_preference',
      },
      eligibility: { review: { ...base.eligibility.review, ...(cfg.eligibility?.review || {}) } },
      applies_to: cfg.application_scope?.applies_to || 'all_existing_and_new',
      incomeCategories: cfg.income_categories
        ? { exclusion_threshold: String(cfg.income_categories.exclusion_threshold), bands: cfg.income_categories.bands.map((b) => ({ key: b.key, label: b.label, min: String(b.min), max: String(b.max) })) }
        : base.incomeCategories,
      scoring: storedScoring(cfg),
      scoreCategories: cfg.score_categories
        ? { bands: cfg.score_categories.bands.map((b) => ({ key: b.key, label: b.label, min: String(b.min), max: String(b.max) })) }
        : base.scoreCategories,
      exceptions: cfg.exceptions
        ? { rules: cfg.exceptions.rules.map((r) => ({ ...r, income_ceiling: String(r.income_ceiling), condition: r.condition || base.exceptions.rules[0].condition })) }
        : base.exceptions,
    });
    setModal({ mode: 'edit', version: v });
  };

  const submitDraft = async (event) => {
    event.preventDefault();
    if (policyErrors.length > 0) { setError('لا يمكن الحفظ: توجد أخطاء في الإعدادات (مذكورة أعلاه).'); return; }
    setBusy(true);
    const payload = {
      policy_name: form.policy_name, version: form.version, policy_scope: form.policy_scope,
      effective_from: form.effective_from || null, effective_to: form.effective_to || null,
      source_document_reference: form.source_document_reference || null, source_document_version: form.source_document_version || null,
      change_reason: form.change_reason || null,
      configuration: configPayload(),
    };
    try {
      if (modal.mode === 'create') await api.post('/beneficiary-policy/versions', payload);
      else await api.patch(`/beneficiary-policy/versions/${modal.version.id}`, payload);
      setModal(null); flash('ok', 'تم حفظ المسودة بنجاح.'); await load();
    } catch (err) { flash('err', err.response?.data?.message || 'تعذر الحفظ.'); }
    finally { setBusy(false); }
  };

  const act = async (action, id, extra = {}) => {
    setBusy(true);
    try { await api.post(`/beneficiary-policy/versions/${id}/${action}`, extra); setModal(null); flash('ok', 'تم تنفيذ العملية.'); await load(); }
    catch (err) { flash('err', err.response?.data?.message || 'تعذر تنفيذ العملية.'); }
    finally { setBusy(false); }
  };

  const openHistory = async (v) => {
    try { const res = await api.get(`/beneficiary-policy/versions/${v.id}/history`); setHistory(res.data.data || []); setHistoryOpen(true); }
    catch { flash('err', 'تعذر تحميل سجل التغييرات.'); }
  };

  const can = (action) => permissions[action] === true;

  const setIncome = (patch) => setForm((f) => ({ ...f, incomeCategories: { ...f.incomeCategories, ...patch } }));
  const setScoring = (patch) => setForm((f) => ({ ...f, scoring: { ...f.scoring, ...patch } }));
  const setScoreCats = (bands) => setForm((f) => ({ ...f, scoreCategories: { bands } }));
  const setExceptionRule = (index, patch) => setForm((f) => ({
    ...f,
    exceptions: { ...f.exceptions, rules: f.exceptions.rules.map((r, i) => (i === index ? { ...r, ...patch } : r)) },
  }));

  const onThresholdChange = (value) => {
    setIncome({
      exclusion_threshold: value,
      bands: form.incomeCategories.bands.map((b, i, arr) => (i === arr.length - 1 ? { ...b, max: value } : b)),
    });
  };

  const onMaxScoreChange = (value) => {
    setScoring({ max_score: value });
    setScoreCats(form.scoreCategories.bands.map((b) => (b.key === 'a' ? { ...b, max: value } : b)));
  };

  const setBandRow = (dim, index, patch) => setScoring({
    dimensions: {
      ...form.scoring.dimensions,
      [dim]: { ...form.scoring.dimensions[dim], bands: form.scoring.dimensions[dim].bands.map((r, i) => (i === index ? { ...r, ...patch } : r)) },
    },
  });

  const setValueRow = (dim, index, patch) => setScoring({
    dimensions: {
      ...form.scoring.dimensions,
      [dim]: { ...form.scoring.dimensions[dim], values: form.scoring.dimensions[dim].values.map((r, i) => (i === index ? { ...r, ...patch } : r)) },
    },
  });

  const toggleDim = (dim) => setScoring({
    dimensions: { ...form.scoring.dimensions, [dim]: { ...form.scoring.dimensions[dim], enabled: !form.scoring.dimensions[dim].enabled } },
  });

  return (
    <div className="max-w-5xl mx-auto px-4 pb-8">
      <div className="rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3 mb-4">
          <h2 className="text-sm font-extrabold text-[var(--color-text-primary)]">🛡️ إصدارات سياسة المستفيدين</h2>
          <div className="flex items-center gap-2">
            {can('edit_draft') && (
              <button type="button" onClick={openCreate} className="px-3 py-1.5 rounded-xl bg-[var(--color-brand-green)] text-white text-xs font-bold hover:bg-[var(--color-brand-green-hover)]">+ إنشاء مسودة جديدة</button>
            )}
            <button type="button" onClick={() => load()} className="px-3 py-1.5 rounded-xl border border-[var(--color-border)] text-xs font-bold">تحديث</button>
          </div>
        </div>

        {message && <StatusBadge tone="success" label={message} />}
        {error && <ErrorState title="تعذر تنفيذ العملية" description={error} />}

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right">
            <thead className="bg-[var(--color-bg-soft)] font-bold border-b border-[var(--color-border)]">
              <tr>
                <th className="p-2.5">اسم السياسة</th>
                <th className="p-2.5">الإصدار</th>
                <th className="p-2.5">الحالة</th>
                <th className="p-2.5">السريان من</th>
                <th className="p-2.5">السريان إلى</th>
                <th className="p-2.5 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {versions.length === 0 && <tr><td colSpan="6" className="p-6 text-center text-[var(--color-text-muted)]">لا توجد إصدارات بعد.</td></tr>}
              {versions.map((v) => (
                <tr key={v.id} className="hover:bg-[var(--color-bg-soft)]">
                  <td className="p-2.5 font-bold text-[var(--color-text-primary)]">{v.policy_name}</td>
                  <td className="p-2.5">{v.version}</td>
                  <td className="p-2.5"><StatusBadge tone={versionTiming(v).tone} label={versionTiming(v).label} /></td>
                  <td className="p-2.5">{v.effective_from || '—'}</td>
                  <td className="p-2.5">{v.effective_to || '—'}</td>
                  <td className="p-2.5">
                    <div className="flex flex-wrap gap-1 justify-center">
                      <button type="button" onClick={() => openEdit(v)} disabled={v.status !== 'draft'} title="عرض / تعديل المسودة" className="px-2 py-1 rounded-lg border border-[var(--color-border)] text-[11px] font-bold disabled:opacity-40">عرض</button>
                      {v.status === 'draft' && !v.approved_by && can('approve') && (
                        <button type="button" onClick={() => { setApprove({ board_approval_reference: '', board_approval_date: '' }); setModal({ mode: 'approve', version: v }); }} className="px-2 py-1 rounded-lg bg-[var(--color-brand-gold)] text-white text-[11px] font-bold">اعتماد</button>
                      )}
                      {v.status === 'draft' && v.approved_by && can('publish') && (
                        <PrimaryButton type="button" onClick={() => act('publish', v.id)} disabled={busy}>نشر</PrimaryButton>
                      )}
                      {v.status === 'published' && can('retire') && (
                        <DangerButton type="button" onClick={() => { setRetireReason(''); setModal({ mode: 'retire', version: v }); }}>أرشفة</DangerButton>
                      )}
                      {can('edit_draft') && <button type="button" onClick={() => act('clone', v.id)} disabled={busy} title="إنشاء مسودة جديدة انطلاقاً من هذا الإصدار" className="px-2 py-1 rounded-lg border border-[var(--color-border)] text-[11px] font-bold">نسخ كمسودة</button>}
                      <Link to={`/admin/beneficiary-policy/versions/${v.id}/application-runs`} title="محاكاة وتطبيق نطاق السياسة على المستفيدين" className="px-2 py-1 rounded-lg border border-[var(--color-border)] text-[11px] font-bold">نطاق التطبيق</Link>
                      <button type="button" onClick={() => openHistory(v)} className="px-2 py-1 rounded-lg border border-[var(--color-border)] text-[11px] font-bold">السجل</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-[var(--color-text-muted)] mt-3">
          الإصدارات المنشورة أو المؤرشفة دائمة وغير قابلة للتعديل؛ أي تغيير يتطلب نسخ مسودة جديدة ثم الاعتماد ثم النشر.
          لا توجد أي إعادة احتساب للمستفيدين في هذه المرحلة.
        </p>
      </div>

      {/* Create / Edit draft modal */}
      {modal?.mode === 'create' || modal?.mode === 'edit' ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto p-4" onClick={() => setModal(null)}>
          <div className="bg-[var(--color-surface)] rounded-2xl p-6 mt-10 w-full max-w-4xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-extrabold text-[var(--color-text-primary)] border-b border-[var(--color-border)] pb-3 mb-4">{modal.mode === 'create' ? 'إنشاء مسودة سياسة جديدة' : `تعديل مسودة الإصدار ${form.version}`}</h3>
            <form onSubmit={submitDraft} className="space-y-4 text-right" dir="rtl">
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="اسم السياسة *"><input required value={form.policy_name} onChange={(e) => setForm({ ...form, policy_name: e.target.value })} className={inputCls} /></Field>
                <Field label="رقم الإصدار * (مثال: 2)"><input required value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} className={inputCls} placeholder="2" /></Field>
                <Field label="تاريخ السريان"><input type="date" value={form.effective_from} onChange={(e) => setForm({ ...form, effective_from: e.target.value })} className={inputCls} /></Field>
                <Field label="تاريخ نهاية السريان (اختياري)"><input type="date" value={form.effective_to} onChange={(e) => setForm({ ...form, effective_to: e.target.value })} className={inputCls} /></Field>
                <Field label="مرجع وثيقة السياسة"><input value={form.source_document_reference} onChange={(e) => setForm({ ...form, source_document_reference: e.target.value })} className={inputCls} placeholder="سياسة صرف المساعدات — نسخة 4" /></Field>
                <Field label="إصدار الوثيقة"><input value={form.source_document_version} onChange={(e) => setForm({ ...form, source_document_version: e.target.value })} className={inputCls} placeholder="4" /></Field>
              </div>

              <div className="rounded-xl border border-[var(--color-border)] p-4">
                <h4 className="text-xs font-extrabold text-[var(--color-text-primary)] mb-2">⚠️ أخطاء إعدادات POLICY-C (تُمنع الحفظ):</h4>
                {policyErrors.length === 0 ? (
                  <p className="text-[11px] text-[var(--color-brand-green)] font-bold">لا توجد أخطاء — الإعدادات صالحة.</p>
                ) : (
                  <ul className="list-disc pr-5 space-y-1">
                    {policyErrors.map((e, i) => <li key={i} className="text-[11px] text-[var(--color-danger)]">{e}</li>)}
                  </ul>
                )}
              </div>

              <div className="rounded-xl border border-[var(--color-border)] p-4">
                <h4 className="text-xs font-extrabold text-[var(--color-text-primary)] mb-2">الإعدادات المالية (افتراضية معتمدة؛ تُدار عبر السياسة وليست مدمجة في الكود)</h4>
                <Field label="حسم الفرد من الأسرة (ريال)"><input type="number" min="0" value={form.financial.per_family_member_deduction} onChange={(e) => setForm({ ...form, financial: { ...form.financial, per_family_member_deduction: e.target.value } })} className={inputCls} /></Field>
                <Field label="وضع الإيجار الشهري">
                  <select value={form.financial.rent_mode} onChange={(e) => setForm({ ...form, financial: { ...form.financial, rent_mode: e.target.value } })} className={inputCls}>
                    <option value="annual_preference">الأولوية للإيجار السنوي (قديم ÷ 12)</option>
                    <option value="direct_monthly_preference">الأولوية للإيجار الشهري المباشر</option>
                  </select>
                </Field>
                <div className="mt-3">
                  <p className="text-xs font-bold text-[var(--color-text-primary)] mb-2">مصادر الدخل المحتسبة (الافتراضية: الراتب + الضمان + حساب المواطن)</p>
                  <div className="flex flex-wrap gap-3">
                    {INCOME_SOURCES.map((s) => (
                      <label key={s.key} className="flex gap-1.5 items-center text-xs">
                        <input type="checkbox" checked={form.financial.counted_income_sources.includes(s.key)}
                          onChange={() => setForm({ ...form, financial: { ...form.financial, counted_income_sources: form.financial.counted_income_sources.includes(s.key) ? form.financial.counted_income_sources.filter((k) => k !== s.key) : [...form.financial.counted_income_sources, s.key] } })} className="accent-[var(--color-brand-green)]" />
                        {s.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-[var(--color-border)] p-4">
                <h4 className="text-xs font-extrabold text-[var(--color-text-primary)] mb-2">إعدادات الأهلية الأساسية</h4>
                <p className="text-[11px] text-[var(--color-text-muted)] mb-2">بوابات المراجعة الإلزامية التي تُطبَّق على تقييمات هذه المسودة. كل بوابة مُفعّلة تعني: يتطلب مراجعة يدوية لاحقة (POLICY-C/D).</p>
                {[
                  { key: 'documents', label: 'مراجعة الوثائق المطلوبة' },
                  { key: 'service_area', label: 'منطقة الخدمة' },
                  { key: 'landlord_relation', label: 'علاقة المالك (الإيجار)' },
                  { key: 'family_status', label: 'حالة الأسرة (أرملة/مطلقة...)' },
                  { key: 'male_under_40', label: 'الذكور تحت 40 (قرار طبي)' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex gap-2 items-center text-xs mb-1.5">
                    <input type="checkbox" checked={form.eligibility.review[key] !== false}
                      onChange={() => setForm({ ...form, eligibility: { ...form.eligibility, review: { ...form.eligibility.review, [key]: !form.eligibility.review[key] } } })}
                      className="accent-[var(--color-brand-green)]" />
                    {label}
                  </label>
                ))}
              </div>

              {/* POLICY-C: income categories */}
              <div className="rounded-xl border border-[var(--color-border)] p-4">
                <h4 className="text-xs font-extrabold text-[var(--color-text-primary)] mb-1">شرائح الدخل للفرد (الفئات أ–د) — POLICY-C</h4>
                <p className="text-[11px] text-[var(--color-text-muted)] mb-2">تصنيف الدخل يعتمد على net income per capita المحسوب من POLICY-B. كل من يحصل على أكثر من حد الاستبعاد يُصنَّف «مستبعد» مالياً.</p>
                <div className="grid md:grid-cols-2 gap-3 mb-3">
                  <Field label="حد الاستبعاد الدخلي (ريال للفرد)"><input type="number" min="0" step="0.01" value={form.incomeCategories.exclusion_threshold} onChange={(e) => onThresholdChange(e.target.value)} className={inputCls} /></Field>
                </div>
                <div className="grid grid-cols-[3.5rem_1fr_6rem_6rem] gap-2 text-[11px] font-bold text-[var(--color-text-muted)] mb-1">
                  <span>الرمز</span><span>المسمى</span><span>الحد الأدنى</span><span>الحد الأعلى</span>
                </div>
                {form.incomeCategories.bands.map((b, i) => (
                  <div key={b.key} className="grid grid-cols-[3.5rem_1fr_6rem_6rem] gap-2 mb-1.5">
                    <input value={b.key} disabled className={smallCls} />
                    <input value={b.label} onChange={(e) => setIncome({ bands: form.incomeCategories.bands.map((row, j) => (j === i ? { ...row, label: e.target.value } : row)) })} className={smallCls} />
                    <input type="number" min="0" step="0.01" value={b.min} onChange={(e) => setIncome({ bands: form.incomeCategories.bands.map((row, j) => (j === i ? { ...row, min: e.target.value } : row)) })} className={smallCls} />
                    <input type="number" min="0" step="0.01" value={b.max} onChange={(e) => setIncome({ bands: form.incomeCategories.bands.map((row, j) => (j === i ? { ...row, max: e.target.value } : row)) })} className={smallCls} />
                  </div>
                ))}
                <p className="text-[11px] text-[var(--color-text-muted)] mt-1">الشرائح يجب أن تكون متتالية بفارق 0.01 بالضبط، والأعلى يبلغ حد الاستبعاد بالضبط (أعلى من الحد ← مستبعد).</p>
              </div>

              {/* POLICY-C: scoring */}
              <div className="rounded-xl border border-[var(--color-border)] p-4">
                <h4 className="text-xs font-extrabold text-[var(--color-text-primary)] mb-1">نقاط التقييم (POLICY-C) — الحد الأقصى 75 في التصميم</h4>
                <p className="text-[11px] text-[var(--color-text-muted)] mb-2">قيم لا يمكن تقييمها بنيوياً (حالة المسكن، نسبة الإعاقة المعتمدة، عدد الأطفال المتأثرين) تُسجَّل «يتطلب مراجعة» — لا يتم تدويرها إلى صفر.</p>
                <div className="grid md:grid-cols-3 gap-3 mb-3">
                  <Field label="الحد الأقصى للنقاط (max_score)">
                    <input type="number" min="0" value={form.scoring.max_score} onChange={(e) => onMaxScoreChange(e.target.value)} className={inputCls} />
                  </Field>
                  <div className="md:col-span-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-soft)] p-3 text-xs">
                    <span className="font-extrabold text-[var(--color-brand-green)]">أقصى نقاط قابلة للتحقيق: {scoringSummary.achievable} من {scoringSummary.maxScore}</span>
                    <span className="text-[var(--color-text-secondary)] mr-2">(الحد الأقصى حسب تصميم السياسة: 75 — إذا جمعت الحدود القصوى للأبعاد أكثر من 75 سيرفض النظام الحفظ)</span>
                  </div>
                </div>

                {SCORING_DIM_ORDER.map((dim) => {
                  const d = form.scoring.dimensions[dim];
                  return (
                    <div key={dim} className="rounded-xl border border-[var(--color-border)] p-3 mb-2 bg-[var(--color-bg-soft)]">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-bold text-[var(--color-text-primary)]">{DIM_LABELS[dim]}</p>
                        <label className="flex gap-1.5 items-center text-[11px] text-[var(--color-text-secondary)]">
                          <input type="checkbox" checked={d.enabled} onChange={() => toggleDim(dim)} className="accent-[var(--color-brand-green)]" />
                          مفعّل
                        </label>
                      </div>
                      {d.bands ? (
                        <div className="space-y-1.5">
                          {d.bands.map((r, i) => (
                            <div key={i} className="grid grid-cols-2 md:grid-cols-4 gap-2 items-center">
                              <input type="number" min="0" step={dim === 'age' ? '1' : '0.01'} value={r.min} onChange={(e) => setBandRow(dim, i, { min: e.target.value })} placeholder="من" className={smallCls} />
                              <input type="number" min="0" step={dim === 'age' ? '1' : '0.01'} value={r.max} onChange={(e) => setBandRow(dim, i, { max: e.target.value })} placeholder={dim === 'income' ? 'اتركها فارغة للمفتوح' : 'إلى'} className={smallCls} />
                              <input type="number" min="0" value={r.points} onChange={(e) => setBandRow(dim, i, { points: e.target.value })} placeholder="النقاط" className={smallCls} />
                              <div className="text-[10px] text-[var(--color-text-muted)]">{r.max === '' ? 'نطاق مفتوح' : dim === 'income' ? `${DIM_LABELS.income}` : ''}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {d.values.map((r, i) => (
                            <div key={i} className="grid grid-cols-2 md:grid-cols-4 gap-2 items-center">
                              <input value={r.value} disabled={dim === 'housing_condition' || dim === 'housing_tenure' || dim === 'children_health'} className={`${smallCls} opacity-70`} />
                              <span className="text-[11px] text-[var(--color-text-muted)]">{r.label || ''}</span>
                              <input type="number" min="0" value={r.points} onChange={(e) => setValueRow(dim, i, { points: e.target.value })} placeholder="النقاط" className={smallCls} />
                              <div />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* POLICY-C: score categories */}
              <div className="rounded-xl border border-[var(--color-border)] p-4">
                <h4 className="text-xs font-extrabold text-[var(--color-text-primary)] mb-1">فئات النقاط (أ: 51–75، ب: 26–50، ج: 5–25، د: 0–4)</h4>
                <p className="text-[11px] text-[var(--color-text-muted)] mb-2">فئتا النقاط والدرجة تُخزنان منفصلتين عن فئة الدخل — لا يوجد أي تحويل أو تسوية بين النظامين.</p>
                <div className="grid grid-cols-[3.5rem_1fr_6rem_6rem] gap-2 text-[11px] font-bold text-[var(--color-text-muted)] mb-1">
                  <span>الرمز</span><span>المسمى</span><span>الحد الأدنى</span><span>الحد الأعلى</span>
                </div>
                {form.scoreCategories.bands.map((b, i) => (
                  <div key={b.key} className="grid grid-cols-[3.5rem_1fr_6rem_6rem] gap-2 mb-1.5">
                    <input value={b.key} disabled className={smallCls} />
                    <input value={b.label} onChange={(e) => setScoreCats(form.scoreCategories.bands.map((row, j) => (j === i ? { ...row, label: e.target.value } : row)))} className={smallCls} />
                    <input type="number" min="0" value={b.min} onChange={(e) => setScoreCats(form.scoreCategories.bands.map((row, j) => (j === i ? { ...row, min: e.target.value } : row)))} className={smallCls} />
                    <input type="number" min="0" value={b.max} onChange={(e) => setScoreCats(form.scoreCategories.bands.map((row, j) => (j === i ? { ...row, max: e.target.value } : row)))} className={smallCls} />
                  </div>
                ))}
                <p className="text-[11px] text-[var(--color-text-muted)] mt-1">أعلى فئة يجب أن تبلغ max_score بالضبط (تُزامن تلقائياً عند تغيير الحد الأقصى أعلاه).</p>
              </div>

              {/* POLICY-C: exceptions */}
              <div className="rounded-xl border border-[var(--color-border)] p-4">
                <h4 className="text-xs font-extrabold text-[var(--color-text-primary)] mb-1">الاستثناءات المقيّدة (POLICY-C)</h4>
                <p className="text-[11px] text-[var(--color-text-muted)] mb-2">قواعد إصدارية آمنة: رمز مسموح به، سقف دخل للفرد، وشرط بنيوي صريح (حالة الأسرة ∈ القيم). لا نصوص تنفيذية أو تقييم حر.</p>
                {form.exceptions.rules.map((r, index) => (
                  <div key={r.code} className="rounded-xl border border-[var(--color-border)] p-3 bg-[var(--color-bg-soft)] space-y-2">
                    <div className="flex flex-wrap items-center gap-4">
                      <span className="text-xs font-extrabold text-[var(--color-text-primary)]">{r.code} — {r.label}</span>
                      <label className="flex gap-1.5 items-center text-[11px] text-[var(--color-text-secondary)]">
                        <input type="checkbox" checked={r.enabled} onChange={() => setExceptionRule(index, { enabled: !r.enabled })} className="accent-[var(--color-brand-green)]" />
                        مفعّل
                      </label>
                      <label className="flex gap-1.5 items-center text-[11px] text-[var(--color-text-secondary)]">
                        <input type="checkbox" checked={r.requires_manual_review} onChange={() => setExceptionRule(index, { requires_manual_review: !r.requires_manual_review })} className="accent-[var(--color-brand-green)]" />
                        يتطلب مراجعة يدوية (وثائق)
                      </label>
                    </div>
                    <div className="grid md:grid-cols-2 gap-3">
                      <Field label="سقف الدخل عند الاستثناء (ريال للفرد)"><input type="number" min="0" step="0.01" value={r.income_ceiling} onChange={(e) => setExceptionRule(index, { income_ceiling: e.target.value })} className={inputCls} /></Field>
                      <div>
                        <label className="block text-xs font-bold text-[var(--color-text-primary)] mb-1">الشرط البنيوي (قراءة فقط)</label>
                        <input value={`حالة الأسرة ∈ [${r.condition.values.join('، ')}]`} disabled className={inputCls} />
                      </div>
                    </div>
                    <p className="text-[11px] text-[var(--color-text-muted)]">{r.requires_manual_review ? 'يُطبَّق الاستثناء كطلب مراجعة فقط؛ لا توجد موافقة نهائية تلقائية.' : 'عند تطابق الشرط البنيوي يُطبَّق الاستثناء تلقائياً.'}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-[var(--color-border)] p-4">
                <h4 className="text-xs font-extrabold text-[var(--color-text-primary)] mb-2">نطاق التطبيق (يُنفذ في مرحلة لاحقة)</h4>
                <select value={form.applies_to} onChange={(e) => setForm({ ...form, applies_to: e.target.value })} className={inputCls}>
                  {SCOPES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </div>

              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-soft)] p-3 text-[11px] text-[var(--color-text-secondary)]">
                ⚠️ جميع هذه التغييرات تؤثر على هذه المسودة فقط. الإصدار المنشور لا يتغير؛ أي تعديل يتطلب نسخ مسودة جديدة.
              </div>

              {policyErrors.length > 0 && (
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--status-danger-bg)] p-3 text-[11px] font-bold text-[var(--color-danger)]">
                  🚫 لا يمكن الحفظ حتى تُصحَّح أخطاء الإعدادات أعلاه ({policyErrors.length}).
                </div>
              )}

              <Field label="سبب التغيير (اختياري)"><textarea value={form.change_reason} onChange={(e) => setForm({ ...form, change_reason: e.target.value })} rows="2" className={inputCls} /></Field>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-xl border border-[var(--color-border)] text-xs font-bold">إلغاء</button>
                <button type="submit" disabled={busy || policyErrors.length > 0} className="px-4 py-2 rounded-xl bg-[var(--color-brand-green)] text-white text-xs font-bold disabled:opacity-50">حفظ المسودة</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Approve modal */}
      {modal?.mode === 'approve' ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto p-4" onClick={() => setModal(null)}>
          <div className="bg-[var(--color-surface)] rounded-2xl p-6 mt-10 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-extrabold text-[var(--color-text-primary)] border-b border-[var(--color-border)] pb-3 mb-4">اعتماد الإصدار {modal.version.version}</h3>
            <div className="space-y-3 text-right" dir="rtl">
              <Field label="مرجع قرار مجلس الإدارة *"><input value={approve.board_approval_reference} onChange={(e) => setApprove({ ...approve, board_approval_reference: e.target.value })} className={inputCls} placeholder="قرار رقم ..." /></Field>
              <Field label="تاريخ القرار *"><input type="date" value={approve.board_approval_date} onChange={(e) => setApprove({ ...approve, board_approval_date: e.target.value })} className={inputCls} /></Field>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-xl border border-[var(--color-border)] text-xs font-bold">إلغاء</button>
                <button type="button" disabled={busy || !approve.board_approval_reference || !approve.board_approval_date} onClick={() => act('approve', modal.version.id, approve)} className="px-4 py-2 rounded-xl bg-[var(--color-brand-gold)] text-white text-xs font-bold disabled:opacity-50">اعتماد</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Retire modal */}
      {modal?.mode === 'retire' ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto p-4" onClick={() => setModal(null)}>
          <div className="bg-[var(--color-surface)] rounded-2xl p-6 mt-10 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-extrabold text-[var(--color-danger)] border-b border-[var(--color-border)] pb-3 mb-4">أرشفة الإصدار {modal.version.version}</h3>
            <div className="space-y-3 text-right" dir="rtl">
              <p className="text-xs text-[var(--color-text-muted)]">ستظل نسخة الإصدار محفوظة بشكل دائم مع كامل تقييماتها؛ لن يُحذف أي شيء.</p>
              <Field label="سبب الأرشفة *"><textarea value={retireReason} onChange={(e) => setRetireReason(e.target.value)} rows="2" className={inputCls} /></Field>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-xl border border-[var(--color-border)] text-xs font-bold">إلغاء</button>
                <DangerButton type="button" disabled={busy || !retireReason.trim()} onClick={() => act('retire', modal.version.id, { change_reason: retireReason })}>أرشفة</DangerButton>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* History drawer */}
      {historyOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto p-4" onClick={() => setHistoryOpen(false)}>
          <div className="bg-[var(--color-surface)] rounded-2xl p-6 mt-10 w-full max-w-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-extrabold text-[var(--color-text-primary)] border-b border-[var(--color-border)] pb-3 mb-4">سجل التغييرات</h3>
            <div className="space-y-2 text-right" dir="rtl">
              {history.length === 0 && <p className="text-xs text-[var(--color-text-muted)]">لا توجد أحداث مسجلة.</p>}
              {history.map((h) => (
                <div key={h.id} className="rounded-xl border border-[var(--color-border)] p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[var(--color-text-primary)]">{h.action}</span>
                    <span className="text-[11px] text-[var(--color-text-muted)]">{h.user?.full_name || h.user_id} · {new Date(h.created_at).toLocaleString('ar-SA')}</span>
                  </div>
                  {h.details && <pre className="mt-2 bg-[var(--color-bg-soft)] rounded-lg p-2 text-[11px] text-[var(--color-text-secondary)] overflow-x-auto whitespace-pre-wrap">{JSON.stringify(h.details, null, 2)}</pre>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls = "w-full rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-xs text-right bg-[var(--color-surface)] focus:border-[var(--color-brand-gold)]";
const smallCls = "w-full rounded-lg border border-[var(--color-border)] px-2 py-1.5 text-xs text-right bg-[var(--color-surface)] focus:border-[var(--color-brand-gold)]";

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-bold text-[var(--color-text-primary)] mb-1">{label}</label>
      {children}
    </div>
  );
}