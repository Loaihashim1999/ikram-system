import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import NotificationCenter from '../components/layout/NotificationCenter';
import { NotificationProvider } from '../context/NotificationContext';
import api from '../api/axios';
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', role: 'admin' } }) }));
vi.mock('../api/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
describe('Persistent Notification Center', () => {
  let read;
  beforeEach(() => {
    read = false; vi.clearAllMocks();
    api.get.mockImplementation(async (url) => ({ data: url === '/settings' ? { data: {} } : url.includes('unread-count') ? { unread_count: read ? 0 : 1 } : {
      data: [{ id: 'n1', message_body: 'تنبيه المخزون', category: 'warehouse_expiry', read_at: read ? '2026-09-13' : null, created_at: '2026-09-13' }], last_page: 1 } }));
    api.post.mockImplementation(async () => { read = true; return { data: { success: true } }; });
  });
  it('loads server records, filters tabs and persists mark all read', async () => {
    render(<MemoryRouter><NotificationProvider><NotificationCenter /></NotificationProvider></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /مركز الإشعارات والتنبيهات/ }));
    await waitFor(() => expect(screen.getAllByText('تنبيه المخزون').length).toBeGreaterThan(0));
    fireEvent.click(screen.getByText('الأمان'));
    expect(screen.getByText('لا توجد إشعارات مطابقة')).toBeInTheDocument();
    fireEvent.click(screen.getByText('المستودع والصلاحية'));
    expect(screen.getAllByText('تنبيه المخزون').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByTitle('تحديد الكل كمقروء'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/notifications/mark-all-read'));
    await waitFor(() => expect(screen.getByText('جميع الإشعارات مقروءة')).toBeInTheDocument());
  });
  it('shows API errors instead of pretending history is empty', async () => {
    api.get.mockRejectedValue(new Error('offline'));
    render(<MemoryRouter><NotificationProvider><NotificationCenter /></NotificationProvider></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /مركز الإشعارات والتنبيهات/ }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('تعذر تحديث الإشعارات'));
  });
});
