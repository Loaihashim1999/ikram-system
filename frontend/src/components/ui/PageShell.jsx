import PageHeader from './PageHeader';

export default function PageShell({
  breadcrumbs = [],
  title,
  description,
  primaryAction,
  secondaryActions,
  kpis,
  filters,
  children,
  className = '',
}) {
  const actions = (primaryAction || secondaryActions) ? (
    <>
      {secondaryActions}
      {primaryAction}
    </>
  ) : null;

  return (
    <div className={`space-y-5 ${className}`}>
      <PageHeader title={title} subtitle={description} breadcrumbs={breadcrumbs} actions={actions} />
      {kpis && <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{kpis}</div>}
      {filters}
      {children}
    </div>
  );
}
