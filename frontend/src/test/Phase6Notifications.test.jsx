import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import NotificationCenter from '../components/layout/NotificationCenter';
import { NotificationProvider } from '../context/NotificationContext';
import CommunicationsSettings from '../pages/admin/CommunicationsSettings';
import api from '../api/axios';

const { session } = vi.hoisted(() => ({ session: { user: { id: 'u1', role: 'staff', can_receive_notifications: true, permissions: { notifications: {} } } } }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => session }));
vi.mock('../api/axios', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));

const row = { id: 'n1', title: 'تنبيه الدعم', message_body: 'وصل طلب', category: 'system_event', read_at: '2026-10-01', created_at: '2026-10-01', action_url: '/delivery?task=1', target_available: true, related_record_id: 'task-1' };

function renderCenter() {
  return render(<MemoryRouter><NotificationProvider><NotificationCenter /></NotificationProvider></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  session.user = { id: 'u1', role: 'staff', can_receive_notifications: true, permissions: { notifications: { delete: true } } };
  api.get.mockImplementation(async (url) => {
    if (String(url).includes('unread-count')) return { data: { unread_count: 1 } };
    return { data: { data: [row], last_page: 1, total: 1, current_page: 1, per_page: 20, unread_count: 1 } };
  });
  api.post.mockResolvedValue({ data: { deleted_count: 1, unread_count: 0 } });
  api.delete.mockResolvedValue({ data: { deleted_count: 1, unread_count: 0 } });
  api.put.mockResolvedValue({ data: {} });
});

describe('phase 6 notification actions', () => {
  it('confirms permanent delete and can cancel without calling the API', async () => {
    renderCenter();
    fireEvent.click(screen.getByRole('button', { name: /مركز الإشعارات والتنبيهات/ }));
    fireEvent.click(await screen.findByText('تنبيه الدعم'));
    fireEvent.click(await screen.findByRole('button', { name: 'حذف نهائي' }));
    expect(screen.getByText(/لا يمكن التراجع عن هذا الإجراء/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'إلغاء' }));
    expect(api.delete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'حذف نهائي' }));
    const confirm = screen.getAllByRole('button', { name: 'حذف نهائي' }).at(-1);
    fireEvent.click(confirm);
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/notifications/n1'));
  });

  it('hides the record action when the target is gone and hides delete without permission', async () => {
    session.user = { id: 'u1', role: 'staff', can_receive_notifications: true, permissions: { notifications: {} } };
    api.get.mockImplementation(async (url) => {
      if (String(url).includes('unread-count')) return { data: { unread_count: 0 } };
      return { data: { data: [{ ...row, action_url: '/delivery?task=1', target_available: false }], last_page: 1, total: 1, current_page: 1, unread_count: 0 } };
    });
    renderCenter();
    fireEvent.click(screen.getByRole('button', { name: /مركز الإشعارات والتنبيهات/ }));
    fireEvent.click(await screen.findByText('تنبيه الدعم'));
    expect(await screen.findByText('السجل المرتبط لم يعد متاحاً.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'فتح السجل' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'حذف نهائي' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /تنظيف إداري/ })).not.toBeInTheDocument();
  });
});

describe('phase 6 communication settings', () => {
  it('shows the disabled webhook and does not render a provider secret', async () => {
    api.get.mockImplementation(async (url) => {
      if (url === '/settings/communications') return { data: { data: { association_name: 'جمعية إكرام', driver_assignment_sms: 'رابط {temporary_driver_link}' }, definitions: { driver_assignment_sms: { allowed: ['temporary_driver_link'] } }, provider: { mode: 'taqnyat', sender_configured: true, webhook: 'disabled' } } };
      return { data: { data: [] } };
    });
    render(<CommunicationsSettings />);
    expect(await screen.findByText('تَقنيات / Taqnyat')).toBeInTheDocument();
    expect(screen.getByText('Webhook: معطل')).toBeInTheDocument();
    expect(screen.getByText(/بيانات Callback الرسمية من المزود غير مكتملة/)).toBeInTheDocument();
    expect(screen.queryByText(/TAQNYAT_SMS_TOKEN|Bearer/)).not.toBeInTheDocument();
    expect(screen.getByText(/قبول مزود الرسائل لا يعني تأكيد التسليم/)).toBeInTheDocument();
  });
});
