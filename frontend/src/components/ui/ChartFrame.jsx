export default function ChartFrame({ title, description, children, table }) {
  return (
    <figure className="ikram-panel p-4">
      <figcaption className="mb-3">
        <h3 className="text-base font-bold text-[var(--color-text-primary)]">{title}</h3>
        {description && <p className="mt-1 text-xs text-[var(--color-text-muted)]">{description}</p>}
      </figcaption>
      {children}
      {table}
    </figure>
  );
}
