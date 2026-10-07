import { MoreHorizontal } from 'lucide-react';

export default function ActionMenu({ label = 'إجراءات السجل', children, className = '' }) {
  return <details className={`group relative inline-block ${className}`}>
    <summary aria-label={label} className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-brand-gold)] hover:bg-[var(--color-bg-soft)] [&::-webkit-details-marker]:hidden"><MoreHorizontal className="h-4 w-4" /></summary>
    <div className="absolute left-0 z-30 mt-1 min-w-40 overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] p-1 shadow-[var(--shadow-overlay)] group-open:animate-fade-in">{children}</div>
  </details>;
}

export function ActionMenuItem({ children, icon: Icon, danger = false, ...props }) {
  return <button type="button" className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-right text-xs font-bold ${danger ? 'text-[var(--color-danger)] hover:bg-[var(--status-danger-bg)]' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-soft)]'}`} {...props}>{Icon && <Icon className="h-4 w-4" />}{children}</button>;
}
