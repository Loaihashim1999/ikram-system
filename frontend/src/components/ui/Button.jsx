import { Loader2 } from 'lucide-react';

/**
 * Reusable Standard Button Component for Ikram Design System:
 * Variants:
 * - primary: Action Amber (var(--color-brand-green)) for primary actions, save, submit, confirm
 * - secondary: Brand Green (var(--color-brand-green)) for secondary identity actions
 * - gold: Royal Gold (var(--color-brand-gold))
 * - outline: Border with transparent background
 * - ghost: Flat with hover background
 * - danger: Crimson Red (#DC2626) strictly for destructive operations
 */
export function PrimaryButton(props) {
  return <Button variant="primary" {...props} />;
}

export function SecondaryButton(props) {
  return <Button variant="secondary" {...props} />;
}

export function DangerButton(props) {
  return <Button variant="danger" {...props} />;
}

function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon: Icon,
  iconPosition = 'start',
  className = '',
  type = 'button',
  onClick,
  as: Component = 'button',
  ...props
}) {
  const baseClasses = 'ikram-btn transition-colors duration-150 focus:outline-none';

  const sizeClasses = {
    xs: 'px-2.5 py-1 text-xs gap-1.5',
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-5 py-2.5 text-base gap-2.5',
  };

  const variantClasses = {
    primary: 'ikram-btn-primary',
    secondary: 'ikram-btn-secondary',
    gold: 'ikram-btn-gold',
    outline: 'ikram-btn-outline',
    ghost: 'ikram-btn-ghost',
    danger: 'ikram-btn-danger',
    dangerOutline: 'ikram-btn-dangerOutline',
  };

  const isDisabled = disabled || loading;

  return (
    <Component
      {...(Component === 'button' ? { type, disabled: isDisabled } : {})}
      aria-disabled={Component !== 'button' && isDisabled ? true : undefined}
      onClick={onClick}
      className={`${baseClasses} ${sizeClasses[size] || sizeClasses.md} ${variantClasses[variant] || variantClasses.primary} ${className}`}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
      {!loading && Icon && iconPosition === 'start' && <Icon className="w-4 h-4 shrink-0" />}
      <span>{children}</span>
      {!loading && Icon && iconPosition === 'end' && <Icon className="w-4 h-4 shrink-0" />}
    </Component>
  );
}

export default Button;
