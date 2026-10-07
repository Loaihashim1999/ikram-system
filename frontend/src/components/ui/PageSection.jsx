export default function PageSection({ title, description, icon: Icon, actions, children, className = '', bodyClassName = 'p-4 sm:p-5', as: Component = 'section' }) {
  return (
    <Component className={`ikram-panel overflow-hidden ${className}`}>
      {(title || description || actions) && (
        <div className="ikram-panel-header">
          <div className="flex min-w-0 items-start gap-2.5">
            {Icon && <span className="mt-0.5 rounded-lg bg-[var(--status-success-bg)] p-2 text-[var(--color-brand-green)]"><Icon className="h-4 w-4" /></span>}
            <div className="min-w-0">
              {title && <h2 className="ikram-section-title">{title}</h2>}
              {description && <p className="ikram-section-description">{description}</p>}
            </div>
          </div>
          {actions && <div className="ikram-actions shrink-0">{actions}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </Component>
  );
}
