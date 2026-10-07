import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Clock, X } from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import Scrim from '../overlays/Scrim';
import EmptyState from '../ui/EmptyState';
import ErrorState from '../ui/ErrorState';
import LoadingState from '../ui/LoadingState';
import StatusBadge from '../ui/StatusBadge';
import ConfirmationDialog from '../ui/ConfirmationDialog';
import { DangerButton, PrimaryButton, SecondaryButton } from '../ui/Button';
import { hasModuleAction } from '../../utils/modulePermissions';

const categories = {
  all: 'الكل',
  warehouse_expiry: 'المستودع والصلاحية',
  system_event: 'الأحداث والعمليات',
  security: 'الأمان',
};

export default function NotificationCenter({ isOpen: controlledIsOpen, onClose: controlledOnClose, showTrigger = false }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen;
  const onClose = isControlled ? controlledOnClose : () => setInternalIsOpen(false);
  const { notifications, unreadCount, meta, error, loading, markAsRead, markAllAsRead, loadList, removeNotifications } = useNotifications();
  const [category, setCategory] = useState('all');
  const [read, setRead] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selected, setSelected] = useState([]);
  const [selectedNotif, setSelectedNotif] = useState(null);
  const [pending, setPending] = useState(null);
  const [actionError, setActionError] = useState('');
  const canDelete = user?.role === 'admin' || hasModuleAction(user, 'notifications', 'delete');
  const canPurge = user?.role === 'admin' || hasModuleAction(user, 'notifications', 'purge');

  const paramsFor = (page = 1) => ({
    page,
    per_page: 20,
    ...(category !== 'all' ? { category } : {}),
    ...(read !== 'all' ? { read } : {}),
    ...(dateFrom ? { date_from: dateFrom } : {}),
    ...(dateTo ? { date_to: dateTo } : {}),
  });

  useEffect(() => {
    if (isOpen) { setSelected([]); loadList(paramsFor(1)); }
  }, [isOpen, category, read, dateFrom, dateTo]);

  const triggerBtn = (
    <button type="button" onClick={() => setInternalIsOpen(!internalIsOpen)} className="relative min-h-11 min-w-11 rounded-[var(--radius-control)] border border-[var(--color-border)] p-2.5 text-[var(--color-text-secondary)]" title="مركز الإشعارات والتنبيهات" aria-label="مركز الإشعارات والتنبيهات">
      <Bell size={18} />
      {unreadCount > 0 && <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-brand-green)] text-[10px] font-extrabold text-white">{unreadCount > 99 ? '99+' : unreadCount}</span>}
    </button>
  );

  const confirmDelete = async () => {
    const action = pending;
    setPending(null);
    if (!action) return;
    setActionError('');
    try {
    if (action.type === 'one') await removeNotifications(() => api.delete(`/notifications/${action.id}`));
    if (action.type === 'selected') await removeNotifications(() => api.post('/notifications/delete-selected', { ids: selected }));
    if (action.type === 'read') await removeNotifications(() => api.post('/notifications/delete-read'));
    if (action.type === 'purge') await removeNotifications(() => api.post('/notifications/purge', { days: action.days, include_unread: false }));
    setSelected([]);
    setSelectedNotif(null);
    } catch {
      setActionError('تعذر حذف الإشعارات. حاول مرة أخرى.');
    }
  };

  return (
    <>
      {(!isControlled || showTrigger) && triggerBtn}
      {isOpen && !selectedNotif && (
        <Scrim isOpen={isOpen} onClose={onClose} zIndex="z-[70]">
          <div className="ikram-panel fixed inset-x-2 top-2 bottom-2 z-[80] flex min-h-0 flex-col overflow-y-auto sm:inset-x-auto sm:bottom-auto sm:top-16 sm:left-2 sm:max-h-[calc(100dvh-5rem)] sm:w-[36rem] sm:max-w-[calc(100vw-1rem)]" dir="rtl" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="مركز الإشعارات والتنبيهات">
            <div className="ikram-panel-header">
              <div>
                <h3 className="ikram-section-title">مركز الإشعارات والتنبيهات</h3>
                <p className="ikram-section-description">{unreadCount > 0 ? `لديك ${unreadCount} إشعار غير مقروء` : 'جميع الإشعارات مقروءة'}</p>
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && <button type="button" onClick={markAllAsRead} className="ikram-btn ikram-btn-outline min-h-11 px-3 text-xs" title="تحديد الكل كمقروء"><CheckCheck size={16} /><span className="hidden sm:inline">تحديد الكل</span></button>}
                <button type="button" onClick={onClose} className="min-h-11 min-w-11" aria-label="إغلاق"><X size={18} /></button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1 border-b border-[var(--color-border)] px-3 py-2">
              {Object.entries(categories).map(([key, label]) => <button key={key} type="button" className={`min-h-9 rounded-[var(--radius-control)] px-3 text-xs font-bold ${category === key ? 'bg-[var(--color-brand-green)] text-white' : 'text-[var(--color-text-muted)]'}`} onClick={() => setCategory(key)}>{label}{key === 'all' ? ` (${meta.total || notifications.length})` : ''}</button>)}
            </div>
            <div className="flex flex-wrap items-end gap-2 px-3 py-2">
              {[['all', 'الكل'], ['unread', 'غير مقروء'], ['read', 'مقروء']].map(([key, label]) => <button key={key} type="button" className={`h-9 rounded-[var(--radius-control)] px-3 text-xs font-bold ${read === key ? 'bg-[var(--color-brand-gold)] text-white' : 'border border-[var(--color-border)]'}`} onClick={() => setRead(key)}>{label}</button>)}
              <div className="grid w-full grid-cols-2 gap-2">
              <label className="min-w-0 text-xs font-bold">تاريخ الإشعار من<input type="date" aria-label="تاريخ الإشعار من" className="ikram-control mt-1 min-w-0 max-w-full" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
              <label className="min-w-0 text-xs font-bold">تاريخ الإشعار إلى<input type="date" aria-label="تاريخ الإشعار إلى" className="ikram-control mt-1 min-w-0 max-w-full" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
              </div>
            </div>
            {(error || actionError) && <ErrorState compact title="تعذر تحديث الإشعارات" description={actionError || error} onRetry={() => { setActionError(''); loadList(paramsFor(meta.current_page)); }} />}
            <div className="min-h-40 flex-1 shrink-0 sm:shrink overflow-y-auto">
              {loading && <LoadingState message="جارٍ تحميل الإشعارات…" />}
              {!loading && !error && notifications.length === 0 && <EmptyState title="لا توجد إشعارات مطابقة" description="جرّب مرشحاً آخر أو انتظر تنبيهاً جديداً." />}
              {!loading && notifications.map((item) => (
                <div key={item.id} className="flex items-start gap-2 border-b border-[var(--color-border)] p-3">
                  {canDelete && <input type="checkbox" aria-label={`تحديد ${item.title}`} checked={selected.includes(item.id)} onChange={(event) => setSelected((old) => event.target.checked ? [...old, item.id] : old.filter((id) => id !== item.id))} />}
                  <button type="button" className="min-w-0 flex-1 text-right" onClick={() => setSelectedNotif(item)}>
                    <span className="flex items-center justify-between gap-2"><strong className="truncate text-sm">{item.title}</strong><StatusBadge status={item.isRead ? 'used' : 'active'} label={item.isRead ? 'مقروء' : 'غير مقروء'} /></span>
                    <span className="mt-1 block break-words text-xs text-[var(--color-text-secondary)] [overflow-wrap:anywhere]">{item.message}</span>
                    <span className="mt-1 flex items-center gap-2 text-[11px] text-[var(--color-text-muted)]"><Clock size={11} />{item.createdAt ? new Date(item.createdAt).toLocaleString('ar-SA') : ''}<span>{categories[item.type] || 'تنبيه'}</span></span>
                  </button>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border)] p-3">
              <div className="flex gap-2">
                <SecondaryButton disabled={loading || meta.current_page <= 1} onClick={() => { setSelected([]); loadList(paramsFor(meta.current_page - 1)); }}>السابق</SecondaryButton>
                <span className="self-center text-xs">{meta.current_page} / {meta.last_page}</span>
                <SecondaryButton disabled={loading || meta.current_page >= meta.last_page} onClick={() => { setSelected([]); loadList(paramsFor(meta.current_page + 1)); }}>التالي</SecondaryButton>
              </div>
              {canDelete && <div className="flex flex-wrap gap-2">
                <SecondaryButton onClick={() => setSelected(notifications.map((item) => item.id))}>تحديد الصفحة</SecondaryButton>
                <SecondaryButton onClick={() => setSelected([])}>مسح التحديد</SecondaryButton>
                {selected.length > 0 && <DangerButton onClick={() => setPending({ type: 'selected' })}>حذف المحدد نهائيًا ({selected.length})</DangerButton>}
                <details className="relative">
                  <summary className="ikram-btn ikram-btn-outline flex h-9 cursor-pointer list-none items-center px-3 text-xs [&::-webkit-details-marker]:hidden">إجراءات</summary>
                  <div className="min-w-52 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] p-1 shadow-[var(--shadow-overlay)]">
                    <button type="button" className="block w-full px-3 py-2 text-right text-xs font-bold" onClick={() => setPending({ type: 'read' })}>حذف جميع المقروءة</button>
                    {canPurge && <button type="button" className="block w-full px-3 py-2 text-right text-xs font-bold" onClick={() => setPending({ type: 'purge', days: 30 })}>تنظيف الإشعارات القديمة</button>}
                  </div>
                </details>
              </div>}
            </div>
          </div>
        </Scrim>
      )}
      {selectedNotif && (
        <Scrim isOpen onClose={() => setSelectedNotif(null)}>
          <div className="ikram-panel fixed top-4 left-1/2 z-[90] max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 overflow-y-auto p-5 [overflow-wrap:anywhere]" dir="rtl" role="dialog" aria-modal="true" aria-label="تفاصيل الإشعار">
            {actionError && <p role="alert">{actionError}</p>}
            <h3 className="font-extrabold">{selectedNotif.title}</h3>
            <p className="mt-3 text-sm">{selectedNotif.message}</p>
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">{categories[selectedNotif.type] || 'تنبيه'}</p>
            {selectedNotif.relatedRecordId && <p className="mt-2 break-all text-xs">{selectedNotif.relatedRecordId}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              {!selectedNotif.isRead && <PrimaryButton onClick={async () => { if (!await markAsRead(selectedNotif.id)) return; setSelectedNotif({ ...selectedNotif, isRead: true }); }}>تحديد كمقروء</PrimaryButton>}
              {selectedNotif.actionUrl && <PrimaryButton onClick={async () => { if (!selectedNotif.isRead && !await markAsRead(selectedNotif.id)) return; navigate(selectedNotif.actionUrl); setSelectedNotif(null); onClose(); }}>فتح السجل</PrimaryButton>}
              {!selectedNotif.actionUrl && <p className="text-sm">السجل المرتبط لم يعد متاحاً.</p>}
              {canDelete && <DangerButton onClick={() => setPending({ type: 'one', id: selectedNotif.id })}>حذف نهائي</DangerButton>}
              <SecondaryButton onClick={() => setSelectedNotif(null)}>إغلاق</SecondaryButton>
            </div>
          </div>
        </Scrim>
      )}
      <ConfirmationDialog
        isOpen={Boolean(pending)}
        type="danger"
        title="حذف نهائي"
        message={pending?.type === 'selected' ? `هل أنت متأكد من حذف ${selected.length} إشعارات محددة نهائيًا؟ لا يمكن التراجع عن هذا الإجراء.` : pending?.type === 'read' ? 'هل أنت متأكد من حذف جميع الإشعارات المقروءة الخاصة بك؟ الإشعارات غير المقروءة تبقى. لا يمكن التراجع عن هذا الإجراء.' : pending?.type === 'purge' ? 'هل أنت متأكد من التنظيف الإداري للإشعارات المقروءة الأقدم من 30 يوماً؟' : 'هل أنت متأكد من حذف هذا الإشعار نهائيًا؟ لا يمكن التراجع عن هذا الإجراء.'}
        confirmLabel="حذف نهائي"
        cancelLabel="إلغاء"
        onClose={() => setPending(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}
