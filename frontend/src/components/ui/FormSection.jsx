export default function FormSection({ title, description, icon: Icon, children, className = '' }) {
  return (
    <fieldset className={`ikram-panel p-4 sm:p-5 ${className}`}>
      <legend className="sr-only">{title}</legend>
      <div className="mb-4 flex items-start gap-2.5 border-b border-[var(--color-border)] pb-3">
        {Icon && <span className="rounded-lg bg-[var(--status-success-bg)] p-2 text-[var(--color-brand-green)]"><Icon className="h-4 w-4" aria-hidden="true" /></span>}
        <div><h2 className="ikram-section-title">{title}</h2>{description && <p className="ikram-section-description">{description}</p>}</div>
      </div>
      {children}
    </fieldset>
  );
}
