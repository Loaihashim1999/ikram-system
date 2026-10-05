import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext';
import Scrim from '../overlays/Scrim';
import Dialog from '../overlays/Dialog';
import {
  Bell, CheckCheck, AlertTriangle, Info,
  Package, ShieldAlert, CheckCircle2, Clock, X
} from 'lucide-react';

export default function NotificationCenter({
  isOpen: controlledIsOpen,
  onClose: controlledOnClose,
  showTrigger = false,
}) {
  const navigate = useNavigate();
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen;
  const onClose = isControlled ? controlledOnClose : () => setInternalIsOpen(false);

  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    error,
  } = useNotifications();

  const [filterType, setFilterType] = useState('all'); // 'all' | 'warehouse_expiry' | 'system_event' | 'security'
  const [selectedNotif, setSelectedNotif] = useState(null);


  const triggerBtn = (
    <button
      type="button"
      onClick={() => setInternalIsOpen(!internalIsOpen)}
      className="relative p-2.5 rounded-xl text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-soft)] hover:text-[var(--color-brand-gold)] transition-colors border border-[var(--color-border)] cursor-pointer"
      title="مركز الإشعارات والتنبيهات"
      aria-label="مركز الإشعارات والتنبيهات"
    >
      <Bell size={18} />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-[var(--color-brand-green)] text-white text-[10px] font-extrabold w-5 h-5 rounded-full flex items-center justify-center shadow-xs border-2 border-white animate-pulse">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );

  const filtered = notifications.filter((n) => {
    if (filterType === 'all') return true;
    return n.type === filterType;
  });

  const getIcon = (type) => {
    switch (type) {
      case 'warehouse_expiry':
        return <Package className="w-4 h-4 text-[var(--color-brand-green)]" />;
      case 'security':
        return <ShieldAlert className="w-4 h-4 text-[#C24B3F]" />;
      case 'system_event':
        return <CheckCircle2 className="w-4 h-4 text-[var(--color-brand-green)]" />;
      default:
        return <Info className="w-4 h-4 text-[var(--color-brand-gold)]" />;
    }
  };

  return (
    <>
      {(!isControlled || showTrigger) && triggerBtn}
      {isOpen && !selectedNotif && (
        <Scrim isOpen={isOpen} onClose={onClose} zIndex="z-[70]">

        <div
          className="fixed top-16 left-2 sm:left-6 z-[80] w-[calc(100%-1rem)] max-w-sm sm:max-w-md bg-white rounded-2xl shadow-2xl border border-[var(--color-border)] overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-150"
          dir="rtl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-4 border-b border-[var(--color-border)] bg-[var(--color-bg-soft)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-[var(--color-bg-soft)] text-[var(--color-brand-gold)] rounded-xl">
                <Bell size={18} />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-[var(--color-text-primary)]">مركز الإشعارات والتنبيهات</h3>
                <p className="text-[11px] text-[var(--color-text-muted)]">
                  {unreadCount > 0 ? `لديك ${unreadCount} إشعار غير مقروء` : 'جميع الإشعارات مقروءة'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="p-1.5 text-xs text-[var(--color-brand-green)] hover:bg-green-50 rounded-lg font-bold flex items-center gap-1"
                  title="تحديد الكل كمقروء"
                >
                  <CheckCheck size={16} />
                  <span className="hidden sm:inline">تحديد الكل</span>
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-soft)] rounded-lg cursor-pointer"
                aria-label="إغلاق"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="px-3 py-2 bg-white border-b border-[var(--color-border)] flex items-center gap-1 text-[11px] overflow-x-auto">
            <button
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                filterType === 'all' ? 'bg-[var(--color-brand-gold)] text-white' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-soft)]'
              }`}
            >
              الكل ({notifications.length})
            </button>
            <button
              onClick={() => setFilterType('warehouse_expiry')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                filterType === 'warehouse_expiry' ? 'bg-[var(--color-brand-green)] text-white' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-soft)]'
              }`}
            >
              المستودع والصلاحية
            </button>
            <button
              onClick={() => setFilterType('system_event')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                filterType === 'system_event' ? 'bg-[var(--color-brand-green)] text-white' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-soft)]'
              }`}
            >
              الأحداث والعمليات
            </button>
            <button
              onClick={() => setFilterType('security')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                filterType === 'security' ? 'bg-[#C24B3F] text-white' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-soft)]'
              }`}
            >
              الأمان
            </button>
          </div>

          {error && <p role="alert" className="p-3 text-sm text-red-700">{error}</p>}
          {/* Notifications List */}
          <div className="overflow-y-auto flex-1 divide-y divide-[var(--color-border)]">
            {filtered.length === 0 ? (
              <div className="py-12 text-center text-[var(--color-text-muted)] space-y-2">
                <Bell size={28} className="mx-auto text-[var(--color-text-muted)]" />
                <p className="text-xs font-bold">لا توجد إشعارات مطابقة</p>
              </div>
            ) : (
              filtered.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedNotif(item)}
                  className={`p-3.5 flex items-start gap-3 hover:bg-[var(--color-bg-soft)] transition-colors cursor-pointer text-right ${
                    !item.isRead ? 'bg-[var(--color-bg-soft)]/60 font-semibold' : 'opacity-85'
                  }`}
                >
                  <div className="p-2 bg-white rounded-xl border border-[var(--color-border)] shadow-xs mt-0.5">
                    {getIcon(item.type)}
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="text-xs font-bold text-[var(--color-text-primary)] truncate">{item.title}</h4>
                      {!item.isRead && (
                        <span className="w-2 h-2 rounded-full bg-[var(--color-brand-green)] flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--color-text-secondary)] line-clamp-2 leading-relaxed">{item.message}</p>
                    <div className="flex items-center justify-between text-[10px] text-[#9CA3AF] pt-1">
                      <span className="flex items-center gap-1 font-mono">
                        <Clock size={11} />
                        {new Date(item.createdAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {item.details?.remainingDays !== undefined && (
                        <span className="font-bold text-[var(--color-brand-green)]">
                          متبقي: {item.details.remainingDays} يوم
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-2.5 border-t border-[var(--color-border)] bg-[var(--color-bg-soft)] flex items-center justify-between text-xs">

              <span className="text-[11px] text-[var(--color-text-muted)]">
                إجمالي: {notifications.length} إشعار
              </span>
            </div>
          )}
        </div>
      </Scrim>
      )}

      {/* Details Dialog */}
      {selectedNotif && (
        <Dialog
          isOpen={!!selectedNotif}
          onClose={() => setSelectedNotif(null)}
          title={selectedNotif.title}
          subtitle={`تاريخ الإشعار: ${new Date(selectedNotif.createdAt).toLocaleString('ar-SA')}`}
          icon={AlertTriangle}
          maxWidth="max-w-lg"
          footer={<div className="flex gap-2 flex-wrap">
            {!selectedNotif.isRead && <button onClick={async () => { if (!await markAsRead(selectedNotif.id)) return; setSelectedNotif({ ...selectedNotif, isRead: true }); }} className="px-5 py-2 bg-[var(--color-brand-gold)] text-white rounded-xl font-bold text-xs">تحديد كمقروء</button>}
            {selectedNotif.actionUrl && <button onClick={async () => { if (!selectedNotif.isRead && !await markAsRead(selectedNotif.id)) return; navigate(selectedNotif.actionUrl); setSelectedNotif(null); onClose(); }} className="px-5 py-2 bg-[var(--color-brand-green)] text-white rounded-xl font-bold text-xs">فتح السجل</button>}
            <button onClick={() => setSelectedNotif(null)} className="px-5 py-2 bg-[var(--color-bg-soft)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-xl font-bold text-xs hover:bg-[var(--color-bg-soft)]">إغلاق</button>
          </div>}
        >
          <div className="space-y-3 text-xs text-[var(--color-text-secondary)]" dir="rtl">
            <div className="p-3 bg-[var(--color-bg-soft)] rounded-xl border border-[var(--color-border)]">
              <p className="leading-relaxed font-medium">{selectedNotif.message}</p>
            </div>

            {selectedNotif.relatedRecordId && <div className="p-3 bg-white rounded-xl border border-[var(--color-border)] text-[11px] text-[var(--color-text-muted)]"><strong>مرجع السجل:</strong> <span className="font-mono">{selectedNotif.relatedRecordId}</span></div>}

            {selectedNotif.type === 'warehouse_expiry' && selectedNotif.details && (
              <div className="space-y-2 border border-[var(--color-border)] rounded-xl p-3 bg-[var(--color-bg-soft)]/30">
                <h4 className="font-bold text-[var(--color-brand-green)] text-xs">تفاصيل صنف المستودع:</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><strong>اسم الصنف:</strong> {selectedNotif.details.itemName}</div>
                  <div><strong>رقم / اسم السلة:</strong> {selectedNotif.details.basketNumber}</div>
                  <div><strong>تاريخ الانتهاء:</strong> {selectedNotif.details.expirationDate}</div>
                  <div><strong>الأيام المتبقية:</strong> <span className="font-bold text-[var(--color-text-secondary)]">{selectedNotif.details.remainingDays} يوم</span></div>
                  <div><strong>الكمية المتوفرة:</strong> {selectedNotif.details.currentQuantity} {selectedNotif.details.unit}</div>
                </div>

                {selectedNotif.recommendedAction && (
                  <div className="mt-3 p-2.5 bg-amber-100/60 rounded-lg text-amber-900 font-bold text-[11px] border border-amber-300 flex items-center gap-2">
                    <span>💡 الإجراء الموصى به:</span>
                    <span>{selectedNotif.recommendedAction}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </Dialog>
      )}
    </>
  );
}
