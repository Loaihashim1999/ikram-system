
/**
 * Standardized Input Component for Ikram System:
 * - Clean white background with soft warm border
 * - Focus ring with Royal Gold (var(--color-brand-gold))
 * - Optional prefix/suffix icons
 * - Clear button
 */
export default function Input({
  type = 'text',
  value,
  onChange,
  placeholder,
  icon: Icon,
  error,
  disabled = false,
  className = '',
  id,
  name,
  ...props
}) {
  return (
    <div className="relative w-full" dir="rtl">
      {Icon && (
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-[var(--color-text-muted)]">
          <Icon className="w-4 h-4" />
        </div>
      )}

      <input
        type={type}
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full min-h-11 px-3 ${Icon ? 'pr-9' : 'pr-3'} pl-3 bg-white border ${
          error ? 'border-red-400 focus:ring-red-400' : 'border-[var(--color-border)] focus:ring-[var(--color-brand-gold)]'
        } rounded-xl text-xs sm:text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:border-transparent transition-all disabled:bg-[var(--color-bg-soft)] disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
        {...props}
      />
    </div>
  );
}
