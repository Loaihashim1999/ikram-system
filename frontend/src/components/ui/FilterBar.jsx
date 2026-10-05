import { SlidersHorizontal, X } from 'lucide-react';
import { useState } from 'react';
import Button from './Button';

export default function FilterBar({ children, advanced, activeCount = 0, onReset, className = '' }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <section className={`ikram-panel p-3 sm:p-4 ${className}`} aria-label="المرشحات">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
        <div className="ikram-actions lg:justify-end">
          {advanced && <Button variant="outline" size="sm" icon={SlidersHorizontal} onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>مرشحات متقدمة {activeCount > 0 && `(${activeCount})`}</Button>}
          {onReset && activeCount > 0 && <Button variant="ghost" size="sm" icon={X} onClick={onReset}>مسح المرشحات</Button>}
        </div>
      </div>
      {advanced && <div className={`${expanded ? 'grid' : 'hidden'} mt-4 grid-cols-1 gap-3 border-t border-[var(--color-border)] pt-4 sm:grid-cols-2 lg:grid-cols-4`}>{advanced}</div>}
    </section>
  );
}
