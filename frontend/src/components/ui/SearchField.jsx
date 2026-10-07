import { Search } from 'lucide-react';

export default function SearchField({
  value,
  onChange,
  placeholder = 'بحث',
  label = 'بحث',
  className = '',
  ...props
}) {
  return (
    <div className={`relative w-full max-w-sm ${className}`}>
      <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" aria-hidden="true" />
      <input
        type="search"
        aria-label={label}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-soft)] pr-9 pl-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-gold)]"
        {...props}
      />
    </div>
  );
}
