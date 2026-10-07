import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import HomeDeliveryPage from '../pages/delivery/HomeDeliveryPage';
import DriverAccessPage from '../pages/driver/DriverAccessPage';
import api from '../api/axios';

const { session } = vi.hoisted(() => ({ session: { user: { role: 'admin' } } }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => session }));
vi.mock('../api/axios', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));
vi.mock('../components/layout/MainLayout', () => ({ default: ({ children }) => <div>{children}</div> }));

const task = {
  id: 'support-1',
  recipient_name: 'مستفيد مكتمل',
  history_name: 'اسم اللقطة',
  contact_phone: '966574917155',
  address: 'شارع التأكيد الطويل الذي يجب أن يلتف',
  status: 'completed',
  history_source: 'snapshot',
  verification_method: 'receipt_code',
  history_driver_name: 'سائق اللقطة',
  completed_at: '2026-10-03T12:00:00+03:00',
  items: [{ name: 'سلة غذائية' }],
  proof_available: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  session.user = { role: 'admin' };
  sessionStorage.clear();
  api.get.mockImplementation(async (url) => {
    if (url === '/support/distributions') {
      return { data: { data: [task], last_page: 1, metrics: { queue: { not_started: 2, in_delivery: 1, completed: 3, basis: 'current_snapshot' }, operational: { total_due: 4, completed_by_cutoff: 1, not_completed: 3, overdue: 2, unique_due_beneficiaries: 2, unique_completed_beneficiaries: 1, fulfillment_method: 'delivery' } } } };
    }
    if (url === '/support/drivers') return { data: { data: [{ id: 'driver-1', full_name: 'سائق الدليل', phone: '966574917155', is_active: true, assigned_count: 4, in_progress_count: 1, delivered_count: 2, remaining_count: 1, last_activity: null, all_completed: false }] } };
    return { data: { data: [], last_page: 1 } };
  });
  api.post.mockResolvedValue({ data: {} });
  api.patch.mockResolvedValue({ data: {} });
});

describe('phase 5 delivery presentation', () => {
  it('separates period metrics from the delivery queue and hides raw codes', async () => {
    render(<MemoryRouter><HomeDeliveryPage /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'إدارة التوصيل للمنازل' })).toBeInTheDocument();
    expect(screen.getByText('مؤشرات الفترة')).toBeInTheDocument();
    expect(screen.getByText('لقطة طابور التوصيل')).toBeInTheDocument();
    expect(screen.getByText('العمليات المستحقة')).toBeInTheDocument();
    expect(screen.getByText('لم يبدأ')).toBeInTheDocument();
    expect(screen.getByText('اسم اللقطة')).toBeInTheDocument();
    expect(screen.getByText('0574917155')).toBeInTheDocument();
    expect(screen.getByText('رمز الاستلام')).toBeInTheDocument();
    expect(screen.getByText('لقطة التأكيد')).toBeInTheDocument();
    expect(screen.queryByText('in_delivery')).not.toBeInTheDocument();
    expect(screen.queryByText('receipt_code')).not.toBeInTheDocument();
    expect(screen.queryByText('تعذر التوصيل = 0')).not.toBeInTheDocument();
  });

});

describe('phase 5 driver portal', () => {
  const token = 'a'.repeat(64);

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ data: { driver_name: 'سائق البوابة', total: 1, completed: 0, remaining: 1, expires_at: '2026-10-08T00:00:00+03:00', tasks: [{ id: 'task-1', recipient_name: 'مستفيد البوابة', phone: '966574917155', address: 'حي طويل جداً يحتاج التفافاً طبيعياً', reference: 'task-1', support_type: 'سلة', status: 'in_delivery', items: [] }] } }) })));
  });

  it('restores the same-session token and does not render it', async () => {
    sessionStorage.setItem('ekram.driverAccessToken', token);
    render(<DriverAccessPage />);
    expect(await screen.findByRole('heading', { name: 'مهام التوصيل الخاصة بك' })).toBeInTheDocument();
    expect(await screen.findByText('مستفيد البوابة')).toBeInTheDocument();
    expect(screen.getByText('0574917155')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'تأكيد التوصيل' })).toBeInTheDocument();
    expect(screen.queryByText(token)).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/driver-access'), expect.objectContaining({ headers: expect.objectContaining({ 'X-Driver-Token': token }) }));
  });

  it('clears an expired token and shows the expiry message', async () => {
    sessionStorage.setItem('ekram.driverAccessToken', token);
    fetch.mockResolvedValueOnce({ ok: false, status: 410, json: async () => ({ message: 'secret' }) });
    render(<DriverAccessPage />);
    expect(await screen.findByText('انتهت صلاحية رابط الوصول')).toBeInTheDocument();
    await waitFor(() => expect(sessionStorage.getItem('ekram.driverAccessToken')).toBeNull());
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
    expect(screen.queryByText(token)).not.toBeInTheDocument();
  });

  it('stores a hash token for the session and removes it from the address', async () => {
    window.location.hash = `#${token}`;
    fetch.mockClear();
    render(<DriverAccessPage />);
    await screen.findByText('مستفيد البوابة');
    expect(sessionStorage.getItem('ekram.driverAccessToken')).toBe(token);
    expect(window.location.hash).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'إنهاء الجلسة' }));
    expect(sessionStorage.getItem('ekram.driverAccessToken')).toBeNull();
  });
});
