import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import CommunicationsSettings from '../pages/admin/CommunicationsSettings';
import SupportDeliveryPage from '../pages/delivery/HomeDeliveryPage';
import api from '../api/axios';

vi.mock('../api/axios', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { role: 'admin' } }) }));
vi.mock('../components/layout/MainLayout', () => ({ default: ({ children }) => <div>{children}</div> }));

const definitions = {
  driver_assignment_sms: {
    allowed: ['driver_name', 'temporary_driver_link', 'link_expiry', 'association_name'],
    required: ['temporary_driver_link'],
  },
};

describe('driver SMS migration UI', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    api.get.mockImplementation((url) => {
      if (url === '/settings/communications') return Promise.resolve({ data: { data: { association_name: 'جمعية إكرام', driver_assignment_sms: 'رابط {temporary_driver_link}' }, definitions } });
      if (url === '/settings/communications/messages') return Promise.resolve({ data: { data: [] } });
      if (url === '/support/pickup-locations') return Promise.resolve({ data: { data: [] } });
      if (url === '/support/distributions') return Promise.resolve({ data: { data: [] } });
      if (url === '/support/drivers') return Promise.resolve({ data: { data: [{ id: 'driver-1', full_name: 'سائق اختبار نشط', is_active: true, whatsapp_opt_in: false }] } });
      if (url === '/support/assignments') return Promise.resolve({ data: { data: [] } });
      return Promise.reject(new Error('unexpected url: ' + url));
    });
  });

  it('shows the editable driver SMS template and no WhatsApp operations', async () => {
    render(<CommunicationsSettings />);
    expect(await screen.findByText('رسالة SMS للسائق')).toBeInTheDocument();
    expect(screen.getByLabelText('رسالة SMS للسائق')).toHaveValue('رابط ‹رابط السائق الآمن›');
    expect(screen.queryByText(/WhatsApp|واتساب/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'حفظ قوالب الاتصالات' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/settings/communications', {
      templates: expect.objectContaining({ driver_assignment_sms: 'رابط {temporary_driver_link}' }),
    }));
  });

  it('allows an active driver without WhatsApp opt-in and exposes no consent controls', async () => {
    render(<MemoryRouter><SupportDeliveryPage /></MemoryRouter>);
    expect(await screen.findByRole('option', { name: 'سائق اختبار نشط' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'نقل التكليف إلى سائق آخر (0)' })).toBeInTheDocument();
    expect(screen.queryByText(/موافقة WhatsApp|موافقة واتساب/i)).not.toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalledWith(expect.stringContaining('whatsapp'));
  });
});
