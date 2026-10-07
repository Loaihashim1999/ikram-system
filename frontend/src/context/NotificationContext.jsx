import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import api from '../api/axios';

const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const auth = useAuth();
  const user = auth?.user;
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0, per_page: 20 });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const listParams = useRef({ page: 1, per_page: 20 });
  const thresholdDays = 5;
  const enabled = user && (user.role === 'admin' || user.can_receive_notifications || user.permissions?.can_receive_notifications);

  const applyPage = (payload) => {
    const rows = payload.data || [];
    setNotifications(rows.map((row) => ({
      id: row.id,
      title: row.title || row.message_body,
      message: row.message_body,
      type: row.category,
      eventType: row.event_type,
      actionUrl: row.target_available === false ? null : row.action_url,
      targetAvailable: row.target_available !== false,
      isRead: !!row.read_at,
      createdAt: row.created_at,
      relatedRecordType: row.related_record_type,
      relatedRecordId: row.related_record_id,
    })));
    setMeta({
      current_page: payload.current_page || 1,
      last_page: payload.last_page || 1,
      total: payload.total || 0,
      per_page: payload.per_page || 20,
    });
    if (typeof payload.unread_count === 'number') setUnreadCount(payload.unread_count);
  };

  const refreshUnread = useCallback(async () => {
    if (!enabled) return;
    const owner = localStorage.getItem('token');
    try {
      const count = await api.get('/notifications/unread-count');
      if (owner !== localStorage.getItem('token')) return;
      setUnreadCount(count.data.unread_count || 0);
      setError('');
    } catch {
      setError('تعذر تحديث الإشعارات. ستتم إعادة المحاولة.');
    }
  }, [enabled, user?.id]);

  const loadList = useCallback(async (params = listParams.current) => {
    if (!enabled) return;
    listParams.current = params;
    setLoading(true);
    const owner = localStorage.getItem('token');
    try {
      const response = await api.get('/notifications', { params });
      if (owner !== localStorage.getItem('token')) return;
      applyPage(response.data);
      setError('');
    } catch {
      setError('تعذر تحديث الإشعارات. ستتم إعادة المحاولة.');
    } finally {
      setLoading(false);
    }
  }, [enabled, user?.id]);

  const reload = useCallback(async () => {
    await loadList(listParams.current);
    await refreshUnread();
  }, [loadList, refreshUnread]);

  useEffect(() => {
    setNotifications([]);
    setUnreadCount(0);
    setError('');
    localStorage.removeItem('ikram_system_notifications_v1');
    refreshUnread();
    const timer = setInterval(refreshUnread, 30000);
    return () => clearInterval(timer);
  }, [refreshUnread]);

  const markAsRead = async (id) => {
    try {
      await api.post(`/notifications/${id}/mark-as-read`);
      await reload();
      return true;
    } catch {
      setError('تعذر حفظ حالة القراءة');
      return false;
    }
  };
  const markAllAsRead = async () => {
    try {
      await api.post('/notifications/mark-all-read');
      await reload();
      return true;
    } catch {
      setError('تعذر حفظ حالة القراءة');
      return false;
    }
  };
  const removeNotifications = async (work) => {
    const result = await work();
    await reload();
    return result.data;
  };

  return (
    <NotificationContext.Provider value={{
      notifications, unreadCount, meta, error, loading, thresholdDays, markAsRead, markAllAsRead, loadList, reload, refreshUnread, removeNotifications,
      checkWarehouseExpirations: refreshUnread, canViewWarehouseAlerts: () => !!enabled, notificationEnabled: !!enabled,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);
