import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import api from '../api/axios';
const NotificationContext = createContext();
export function NotificationProvider({ children }) {
  const auth = useAuth();
  const user = auth?.user;
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState('');
  const [thresholdDays, setThresholdDays] = useState(10);
  useEffect(() => { if (user) api.get('/settings').then(r => setThresholdDays(Number(r.data?.data?.warehouse_alert_threshold_days) || 10)).catch(() => {}); }, [user?.id]);
  const enabled = user && (user.role === 'admin' || user.can_receive_notifications || user.permissions?.can_receive_notifications);
  const refresh = useCallback(async () => {
    if (!enabled) return;
    const owner = localStorage.getItem('token');
    try {
      const [response, count] = await Promise.all([api.get('/notifications'), api.get('/notifications/unread-count')]);
      let rows = response.data.data;
      for (let page = 2; page <= response.data.last_page; page++) {
        const next = await api.get('/notifications', { params: { page } });
        rows = rows.concat(next.data.data);
      }
      if (owner !== localStorage.getItem('token')) return;
      setNotifications(rows.map(n => ({ id: n.id, title: n.title || n.message_body, message: n.message_body, type: n.category,
        actionUrl: n.action_url, isRead: !!n.read_at, createdAt: n.created_at,
        relatedRecordType: n.related_record_type, relatedRecordId: n.related_record_id })));
      setUnreadCount(count.data.unread_count);
      setError('');
    } catch { setError('تعذر تحديث الإشعارات. ستتم إعادة المحاولة.'); }
  }, [enabled, user?.id]);
  useEffect(() => {
    setNotifications([]); setUnreadCount(0); setError('');
    // Retire the shared browser cache: database records belong to individual users.
    localStorage.removeItem('ikram_system_notifications_v1');
    refresh();
    const timer = setInterval(refresh, 30000);
    return () => clearInterval(timer);
  }, [refresh]);
  const markAsRead = async (id) => {
    try { await api.post(`/notifications/${id}/mark-as-read`); await refresh(); }
    catch { setError('تعذر حفظ حالة القراءة'); }
  };
  const markAllAsRead = async () => {
    try { await api.post('/notifications/mark-all-read'); await refresh(); }
    catch { setError('تعذر حفظ حالة القراءة'); }
  };
  return <NotificationContext.Provider value={{ notifications, unreadCount, error, refresh, thresholdDays, markAsRead, markAllAsRead,
    checkWarehouseExpirations: refresh, canViewWarehouseAlerts: () => !!enabled, notificationEnabled: !!enabled }}>
    {children}
  </NotificationContext.Provider>;
}
export const useNotifications = () => useContext(NotificationContext);
