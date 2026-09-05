import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import api from '../api/axios';

const NotificationContext = createContext();

const STORAGE_KEY = 'ikram_system_notifications_v1';

export function NotificationProvider({ children }) {
  const auth = useAuth();
  const user = auth?.user || null;
  const [notifications, setNotifications] = useState(() => {

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [thresholdDays, setThresholdDays] = useState(10);

  // Sync to local storage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
    } catch (e) {
      console.error("Failed to persist notifications", e);
    }
  }, [notifications]);

  // Load system settings for threshold
  useEffect(() => {
    api.get('/settings')
      .then(res => {
        if (res.data?.data?.warehouse_alert_threshold_days) {
          setThresholdDays(parseInt(res.data.data.warehouse_alert_threshold_days) || 10);
        }
      })
      .catch(() => {});
  }, []);

  // Check if current user has permission to see warehouse notifications
  const canViewWarehouseAlerts = useCallback(() => {
    if (!user) return false;
    const role = user.role;
    if (role === 'admin') return true;
    if (role === 'assistant_admin') {
      const perms = user.permissions;
      if (!perms) return true;
      return perms.warehouse?.notifications !== false && perms.warehouse?.view !== false;
    }
    return false;
  }, [user]);

  // Add a new notification
  const addNotification = useCallback((notif) => {
    setNotifications((prev) => {
      // Check duplicate for warehouse expiration alert
      if (notif.type === 'warehouse_expiry') {
        const exists = prev.some(
          (n) =>
            n.type === 'warehouse_expiry' &&
            n.itemId === notif.itemId &&
            n.basketId === notif.basketId &&
            n.alertPeriod === notif.alertPeriod
        );
        if (exists) return prev;
      }

      const newEntry = {
        id: notif.id || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        title: notif.title,
        message: notif.message,
        type: notif.type || 'info', // 'warehouse_expiry' | 'system_event' | 'security' | 'info'
        isRead: false,
        createdAt: notif.createdAt || new Date().toISOString(),
        details: notif.details || {},
        recommendedAction: notif.recommendedAction || null,
        ...notif,
      };

      return [newEntry, ...prev];
    });
  }, []);

  // Mark specific notification as read
  const markAsRead = useCallback((id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }, []);

  // Clear all
  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Trigger warehouse expiration check
  const checkWarehouseExpirations = useCallback((inventoryItems = []) => {
    if (!canViewWarehouseAlerts()) return;

    const now = new Date();
    inventoryItems.forEach((item) => {
      if (!item.expiration_date) return;
      const expiry = new Date(item.expiration_date);
      const diffTime = expiry.getTime() - now.getTime();
      const remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (remainingDays <= thresholdDays) {
        const isExpired = remainingDays <= 0;
        const currentPeriod = now.toISOString().slice(0, 10); // daily deduplication key

        addNotification({
          type: 'warehouse_expiry',
          itemId: item.id,
          basketId: item.basket_id || 'عام',
          alertPeriod: currentPeriod,
          title: isExpired
            ? `⚠️ صنف منتهي الصلاحية: ${item.name}`
            : `⏳ صنف قارب على الانتهاء (${remainingDays} يوم متبقي): ${item.name}`,
          message: isExpired
            ? `انتهت صلاحية الصنف "${item.name}" بتاريخ ${expiry.toLocaleDateString('ar-SA')}. يرجى اتخاذ إجراء فوري.`
            : `يتبقى ${remainingDays} أيام على انتهاء صلاحية الصنف "${item.name}" (تاريخ الانتهاء: ${expiry.toLocaleDateString('ar-SA')}).`,
          details: {
            itemName: item.name,
            basketNumber: item.basket_id || item.basket_number || 'مخزون المستودع العام',
            expirationDate: item.expiration_date,
            remainingDays,
            currentQuantity: item.current_quantity,
            unit: item.unit,
          },
          recommendedAction: isExpired
            ? 'إتلاف أو استبعاد الصنف من المخزون فوراً'
            : 'إعطاء أولوية في التوزيع الميداني الفوري لهذه السلة',
        });
      }
    });
  }, [canViewWarehouseAlerts, thresholdDays, addNotification]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        thresholdDays,
        setThresholdDays,
        addNotification,
        markAsRead,
        markAllAsRead,
        clearNotifications,
        checkWarehouseExpirations,
        canViewWarehouseAlerts,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);
