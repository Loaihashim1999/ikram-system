import { AlertCircle, RotateCcw } from 'lucide-react';
import Button from './Button';

export default function ErrorState({ title = 'تعذر تحميل البيانات', description = 'حدث خطأ غير متوقع. حاول مرة أخرى.', onRetry, className = '' }) {
  return <div role="alert" className={`flex flex-col items-center justify-center gap-3 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--status-danger-bg)] p-6 text-center ${className}`}>
    <AlertCircle className="h-7 w-7 text-[var(--color-danger)]" aria-hidden="true" />
    <div><h3 className="text-sm font-extrabold text-[var(--status-danger-text)]">{title}</h3><p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">{description}</p></div>
    {onRetry && <Button variant="dangerOutline" size="sm" icon={RotateCcw} onClick={onRetry}>إعادة المحاولة</Button>}
  </div>;
}
