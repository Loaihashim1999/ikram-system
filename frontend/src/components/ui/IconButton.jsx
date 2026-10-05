
/**
 * Standardized IconButton for DataTables and action bars.
 * Variants:
 * - default: subtle neutral hover
 * - primary: amber action icon
 * - secondary: green identity icon
 * - danger: red delete/reject icon
 * - info: blue view/inspect icon
 */
export default function IconButton({
  icon: Icon,
  onClick,
  title,
  'aria-label': ariaLabel,
  variant = 'default',
  size = 'md',
  disabled = false,
  className = '',
  type = 'button',
  ...props
}) {
  const accessibleName = ariaLabel || title;
  const sizeClasses = {
    sm: 'min-h-11 min-w-11 p-2',
    md: 'min-h-11 min-w-11 p-2',
    lg: 'min-h-11 min-w-11 p-2.5',
  };

  const variantClasses = {
    default: 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-soft)] border border-transparent hover:border-[var(--color-border)]',
    primary: 'text-[var(--color-brand-green)] hover:bg-[#FEF3C7] border border-transparent hover:border-[#FCD34D]',
    secondary: 'text-[var(--color-brand-green)] hover:bg-[#EBF4EA] border border-transparent hover:border-[#A5D6A7]',
    gold: 'text-[var(--color-brand-gold)] hover:bg-[var(--color-bg-soft)] border border-transparent hover:border-[#FCD34D]',
    danger: 'text-red-600 hover:bg-red-50 hover:text-red-800 border border-transparent hover:border-red-200',
    info: 'text-sky-600 hover:bg-sky-50 hover:text-sky-800 border border-transparent hover:border-sky-200',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      title={accessibleName}
      aria-label={accessibleName || 'إجراء'}
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-lg transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-gold)]/40 ${sizeClasses[size] || sizeClasses.md} ${variantClasses[variant] || variantClasses.default} ${className}`}
      {...props}
    >
      {Icon && <Icon className="w-full h-full shrink-0" />}
    </button>
  );
}
