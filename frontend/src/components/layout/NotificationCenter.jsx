import React, { useState } from 'react';
import { useNotifications } from '../../context/NotificationContext';
import Scrim from '../overlays/Scrim';
import Dialog from '../overlays/Dialog';
import {
  Bell, CheckCheck, Trash2, AlertTriangle, Info,
  Package, ShieldAlert, CheckCircle2, Clock, X, Eye
} from 'lucide-react';

export default function NotificationCenter({
  isOpen: controlledIsOpen,
  onClose: controlledOnClose,
  showTrigger = false,
}) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen;
  const onClose = isControlled ? controlledOnClose : () => setInternalIsOpen(false);

  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearNotifications,
  } = useNotifications();

  const [filterType, setFilterType] = useState('all'); // 'all' | 'warehouse_expiry' | 'system_event' | 'security'
  const [selectedNotif, setSelectedNotif] = useState(null);


  const triggerBtn = (
    <button
      type="button"
      onClick={() => setInternalIsOpen(!internalIsOpen)}
      className="relative p-2.5 rounded-xl text-[#1F2937] hover:bg-[#FAF8F5] hover:text-[#C9A24A] transition-colors border border-[#E5E2D9] cursor-pointer"
      title="مركز الإشعارات والتنبيهات"
      aria-label="مركز الإشعارات والتنبيهات"
    >
      <Bell size={18} />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-[#D97706] text-white text-[10px] font-extrabold w-5 h-5 rounded-full flex items-center justify-center shadow-xs border-2 border-white animate-pulse">
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
        return <Package className="w-4 h-4 text-[#D97706]" />;
      case 'security':
        return <ShieldAlert className="w-4 h-4 text-[#C24B3F]" />;
      case 'system_event':
        return <CheckCircle2 className="w-4 h-4 text-[#3F6B3A]" />;
      default:
        return <Info className="w-4 h-4 text-[#C9A24A]" />;
    }
  };

  return (
    <>
      {(!isControlled || showTrigger) && triggerBtn}
      {isOpen && (
        <Scrim isOpen={isOpen} onClose={onClose} zIndex="z-40">

        <div
          className="fixed top-16 left-2 sm:left-6 z-50 w-full max-w-sm sm:max-w-md bg-white rounded-2xl shadow-2xl border border-[#E5E2D9] overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-150"
          dir="rtl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-4 border-b border-[#E5E2D9] bg-[#FAF8F5] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-[#F5EDDA] text-[#C9A24A] rounded-xl">
                <Bell size={18} />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-[#111827]">مركز الإشعارات والتنبيهات</h3>
                <p className="text-[11px] text-[#6B7280]">
                  {unreadCount > 0 ? `لديك ${unreadCount} إشعار غير مقروء` : 'جميع الإشعارات مقروءة'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="p-1.5 text-xs text-[#3F6B3A] hover:bg-green-50 rounded-lg font-bold flex items-center gap-1"
                  title="تحديد الكل كمقروء"
                >
                  <CheckCheck size={16} />
                  <span className="hidden sm:inline">تحديد الكل</span>
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg cursor-pointer"
                aria-label="إغلاق"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="px-3 py-2 bg-white border-b border-[#E5E2D9] flex items-center gap-1 text-[11px] overflow-x-auto">
            <button
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                filterType === 'all' ? 'bg-[#C9A24A] text-white' : 'text-[#6B7280] hover:bg-[#FAF8F5]'
              }`}
            >
              الكل ({notifications.length})
            </button>
            <button
              onClick={() => setFilterType('warehouse_expiry')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                filterType === 'warehouse_expiry' ? 'bg-[#D97706] text-white' : 'text-[#6B7280] hover:bg-[#FAF8F5]'
              }`}
            >
              المستودع والصلاحية
            </button>
            <button
              onClick={() => setFilterType('system_event')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                filterType === 'system_event' ? 'bg-[#3F6B3A] text-white' : 'text-[#6B7280] hover:bg-[#FAF8F5]'
              }`}
            >
              الأحداث والعمليات
            </button>
            <button
              onClick={() => setFilterType('security')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                filterType === 'security' ? 'bg-[#C24B3F] text-white' : 'text-[#6B7280] hover:bg-[#FAF8F5]'
              }`}
            >
              الأمان
            </button>
          </div>

          {/* Notifications List */}
          <div className="overflow-y-auto flex-1 divide-y divide-[#E5E2D9]">
            {filtered.length === 0 ? (
              <div className="py-12 text-center text-[#6B7280] space-y-2">
                <Bell size={28} className="mx-auto text-gray-300" />
                <p className="text-xs font-bold">لا توجد إشعارات مطابقة</p>
              </div>
            ) : (
              filtered.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    markAsRead(item.id);
                    setSelectedNotif(item);
                  }}
                  className={`p-3.5 flex items-start gap-3 hover:bg-[#FAF8F5] transition-colors cursor-pointer text-right ${
                    !item.isRead ? 'bg-[#FAF8F5]/60 font-semibold' : 'opacity-85'
                  }`}
                >
                  <div className="p-2 bg-white rounded-xl border border-[#E5E2D9] shadow-xs mt-0.5">
                    {getIcon(item.type)}
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="text-xs font-bold text-[#111827] truncate">{item.title}</h4>
                      {!item.isRead && (
                        <span className="w-2 h-2 rounded-full bg-[#D97706] flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-[#4B5563] line-clamp-2 leading-relaxed">{item.message}</p>
                    <div className="flex items-center justify-between text-[10px] text-[#9CA3AF] pt-1">
                      <span className="flex items-center gap-1 font-mono">
                        <Clock size={11} />
                        {new Date(item.createdAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {item.details?.remainingDays !== undefined && (
                        <span className="font-bold text-[#D97706]">
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
            <div className="p-2.5 border-t border-[#E5E2D9] bg-[#FAF8F5] flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={clearNotifications}
                className="text-[11px] text-[#C24B3F] hover:underline font-bold flex items-center gap-1"
              >
                <Trash2 size={13} />
                مسح جميع الإشعارات
              </button>
              <span className="text-[11px] text-[#6B7280]">
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
          footer={
            <button
              onClick={() => setSelectedNotif(null)}
              className="px-5 py-2 bg-[#FAF8F5] border border-[#E5E2D9] text-[#111827] rounded-xl font-bold text-xs hover:bg-gray-100"
            >
              إغلاق
            </button>
          }
        >
          <div className="space-y-3 text-xs text-[#1F2937]" dir="rtl">
            <div className="p-3 bg-[#FAF8F5] rounded-xl border border-[#E5E2D9]">
              <p className="leading-relaxed font-medium">{selectedNotif.message}</p>
            </div>

            {selectedNotif.type === 'warehouse_expiry' && selectedNotif.details && (
              <div className="space-y-2 border border-[#E5E2D9] rounded-xl p-3 bg-amber-50/30">
                <h4 className="font-bold text-[#D97706] text-xs">تفاصيل صنف المستودع:</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><strong>اسم الصنف:</strong> {selectedNotif.details.itemName}</div>
                  <div><strong>رقم / اسم السلة:</strong> {selectedNotif.details.basketNumber}</div>
                  <div><strong>تاريخ الانتهاء:</strong> {selectedNotif.details.expirationDate}</div>
                  <div><strong>الأيام المتبقية:</strong> <span className="font-bold text-amber-800">{selectedNotif.details.remainingDays} يوم</span></div>
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
