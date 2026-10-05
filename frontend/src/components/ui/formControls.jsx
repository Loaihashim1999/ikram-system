import FormField from './FormField';

const controlClass = 'ikram-control';

function withField(Component) {
  return function Field(props) {
    const { label, error, helperText, required, className = '', ...inputProps } = props;
    return (
      <FormField label={label} name={inputProps.name || inputProps.id} required={required} error={error} helperText={helperText}>
        <Component className={`${controlClass} ${className}`} required={required} {...inputProps} />
      </FormField>
    );
  };
}

export const TextInput = withField('input');
export const SelectInput = withField('select');
export const TextArea = withField('textarea');
export const DateInput = withField((props) => <input type="date" dir="ltr" {...props} />);
export const NumericInput = withField((props) => {
  const { className = '', ...rest } = props;
  return <input type="number" inputMode="decimal" dir="ltr" {...rest} className={`ikram-numeric ${className}`} />;
});

export function CheckboxField({ label, name, className = '', ...props }) {
  return (
    <label className={`flex min-h-11 items-center gap-2 text-sm ${className}`} htmlFor={name}>
      <input id={name} name={name} type="checkbox" className="h-4 w-4 accent-[var(--color-primary)]" {...props} />
      <span>{label}</span>
    </label>
  );
}

export function RadioField({ label, name, className = '', ...props }) {
  return (
    <label className={`flex min-h-11 items-center gap-2 text-sm ${className}`}>
      <input name={name} type="radio" className="h-4 w-4 accent-[var(--color-primary)]" {...props} />
      <span>{label}</span>
    </label>
  );
}

export function ValidationMessage({ id, children }) {
  if (!children) return null;
  return <p id={id} className="text-xs font-semibold text-[var(--color-danger)]" role="alert">{children}</p>;
}

export function HelperText({ id, children }) {
  if (!children) return null;
  return <p id={id} className="text-xs text-[var(--color-text-muted)]">{children}</p>;
}

export function RequiredIndicator() {
  return <span className="text-[var(--color-danger)]" aria-hidden="true"> *</span>;
}
