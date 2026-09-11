import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import NotificationCenter from '../components/layout/NotificationCenter';
import { NotificationProvider, useNotifications } from '../context/NotificationContext';

// Helper component to interact with NotificationContext in tests
function NotificationTestHarness({ initialNotifications = [] }) {
  const { notifications, unreadCount, addNotification, markAsRead, markAllAsRead } = useNotifications();

  React.useEffect(() => {
    initialNotifications.forEach(n => addNotification(n));
  }, []);

  return (
    <div>
      <div data-testid="unread-count">{unreadCount}</div>
      <NotificationCenter />
      <button
        data-testid="add-alert-btn"
        onClick={() => addNotification({
          type: 'warehouse_expiry',
          title: 'تنبيه انتهاء صلاحية',
          message: 'الصنف أرز بسمتي قارب على الانتهاء',
          priority: 'high',
        })}
      >
        إضافة تنبيه
      </button>
      <button data-testid="mark-all-read-btn" onClick={markAllAsRead}>
        قراءة الكل
      </button>
    </div>
  );
}

const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = String(value); },
    clear: () => { store = {}; },
    removeItem: (key) => { delete store[key]; },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe('NotificationCenter & Warehouse Alert Rules', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders notification bell icon', () => {
    render(
      <NotificationProvider>
        <NotificationCenter />
      </NotificationProvider>
    );

    const bellBtn = screen.getByRole('button', { name: /مركز الإشعارات والتنبيهات/i });
    expect(bellBtn).toBeInTheDocument();
  });

  it('displays unread badge count when notifications exist', () => {
    render(
      <NotificationProvider>
        <NotificationTestHarness
          initialNotifications={[
            { id: 'n1', title: 'إشعار 1', message: 'محتوى 1', type: 'info' },
            { id: 'n2', title: 'إشعار 2', message: 'محتوى 2', type: 'warehouse_expiry', priority: 'high' },
          ]}
        />
      </NotificationProvider>
    );

    const badge = screen.getByTestId('unread-count');
    expect(Number(badge.textContent)).toBeGreaterThanOrEqual(2);
  });

  it('opens notification panel on bell click and marks all as read', () => {
    render(
      <NotificationProvider>
        <NotificationTestHarness
          initialNotifications={[
            { id: 'n1', title: 'تنبيه هام', message: 'يوجد صنف قارب على الانتهاء', type: 'warehouse_expiry' },
          ]}
        />
      </NotificationProvider>
    );

    const bellBtn = screen.getByRole('button', { name: /مركز الإشعارات والتنبيهات/i });
    fireEvent.click(bellBtn);

    expect(screen.getByText(/مركز الإشعارات/i)).toBeInTheDocument();
    expect(screen.getByText('يوجد صنف قارب على الانتهاء')).toBeInTheDocument();


    const markAllBtn = screen.getByTestId('mark-all-read-btn');
    fireEvent.click(markAllBtn);

    const badge = screen.getByTestId('unread-count');
    expect(Number(badge.textContent)).toBe(0);
  });
});
