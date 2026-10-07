import { useRef } from 'react';

export default function FileUpload({
  label,
  hint,
  accept,
  required = false,
  file = null,
  onChange,
  onClear,
}) {
  const inputRef = useRef(null);

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-soft)] p-3" data-file-upload>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-[var(--color-text-primary)]">{label}</p>
        <span className="text-xs text-[var(--color-text-muted)]">{required ? 'مطلوب' : 'اختياري'}</span>
      </div>
      {hint && <p className="mt-1 text-xs leading-6 text-[var(--color-text-muted)]">{hint}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        aria-label={label}
        onChange={(event) => {
          onChange?.(event.target.files?.[0] || null);
          event.target.value = '';
        }}
      />
      {file ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="min-w-0 break-all text-sm font-bold">{file.name}</span>
          <button type="button" className="ikram-btn ikram-btn-outline h-9 px-3 text-xs" onClick={() => inputRef.current?.click()}>تغيير</button>
          <button type="button" className="ikram-btn ikram-btn-ghost h-9 px-3 text-xs" onClick={onClear}>إزالة</button>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" className="ikram-btn ikram-btn-outline h-9 px-3 text-xs" onClick={() => inputRef.current?.click()}>اختيار ملف</button>
          <span className="text-xs text-[var(--color-text-muted)]">لم يتم اختيار ملف</span>
        </div>
      )}
    </div>
  );
}
