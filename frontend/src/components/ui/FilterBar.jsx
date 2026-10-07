import { SlidersHorizontal, X } from 'lucide-react';
import { useState } from 'react';
import Button from './Button';
import Dialog from '../overlays/Dialog';

export default function FilterBar({ search, tools, children, advanced, activeCount = 0, onReset, className = '' }) {
  const [open, setOpen] = useState(false);
  return (
    <section className={`ikram-panel p-3 sm:p-4 ${className}`} aria-label="المرشحات">
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">{search}</div>
        {tools}
        <button
          type="button"
          className="ikram-btn ikram-btn-outline relative min-h-11 shrink-0 px-3"
          aria-label="فتح المرشحات"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <SlidersHorizontal className="h-4 w-4" />
          {activeCount > 0 && <span className="text-xs font-bold">{activeCount}</span>}
        </button>
      </div>
      <Dialog
        isOpen={open}
        onClose={() => setOpen(false)}
        title="تصفية النتائج"
        subtitle="اختر المرشحات ثم طبّقها على القائمة."
        icon={SlidersHorizontal}
        footer={(
          <>
            {onReset && <Button type="button" variant="ghost" icon={X} onClick={onReset}>مسح المرشحات</Button>}
            <Button type="button" variant="primary" onClick={() => setOpen(false)}>تطبيق</Button>
          </>
        )}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}{advanced}</div>
      </Dialog>
    </section>
  );
}
