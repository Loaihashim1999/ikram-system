const tones = {
  green: 'bg-[#EBF4EA] text-[var(--color-brand-green)] border-[#CFE3CC]',
  gold: 'bg-[#F8F1DF] text-[#806523] border-[#E8D6A9]',
  blue: 'bg-blue-50 text-blue-700 border-blue-100',
  amber: 'bg-[var(--color-bg-soft)] text-amber-700 border-amber-100',
  red: 'bg-red-50 text-red-700 border-red-100',
  slate: 'bg-slate-50 text-slate-700 border-slate-200',
};

export default function SummaryCard({ label, value, hint, icon: Icon, tone = 'green', className = '' }) {
  return (
    <article className={`ikram-panel p-4 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold text-[var(--color-text-muted)]">{label}</p>
          <p className="mt-1.5 text-2xl font-black tabular-nums text-[var(--color-text-primary)]">{value ?? '—'}</p>
          {hint && <p className="mt-1 text-[11px] leading-5 text-[var(--color-text-muted)]">{hint}</p>}
        </div>
        {Icon && <span className={`rounded-xl border p-2.5 ${tones[tone] || tones.green}`}><Icon className="h-5 w-5" /></span>}
      </div>
    </article>
  );
}
