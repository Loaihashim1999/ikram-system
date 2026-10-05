import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import HomeDeliveryPage from '../pages/delivery/HomeDeliveryPage';
import api from '../api/axios';
import { deliverySelectionEligibility } from '../utils/deliverySelection';

const { session } = vi.hoisted(() => ({ session: { user: { role: 'admin' } } }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => session }));
vi.mock('../api/axios', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));
vi.mock('../components/layout/MainLayout', () => ({ default: ({ children }) => <div>{children}</div> }));

const ready = { id: 'ready-1', recipient_name: 'EKRAM-E2E-TEST جاهز', status: 'ready', items: [] };
const moving = { id: 'move-1', recipient_name: 'EKRAM-E2E-TEST جارٍ', status: 'in_delivery', items: [] };
const done = { id: 'done-1', recipient_name: 'EKRAM-E2E-TEST مكتمل', status: 'completed', items: [] };
const tasks = [ready, moving, done];

function mount() {
  return render(<MemoryRouter><HomeDeliveryPage /></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  session.user = { role: 'admin' };
  api.get.mockImplementation(async (url) => {
    if (url === '/support/distributions') return { data: { data: tasks, last_page: 1, metrics: {} } };
    if (url === '/support/drivers') return { data: { data: [{ id: 'driver-2', full_name: 'EKRAM-E2E-TEST سائق بديل', is_active: true }] } };
    return { data: { data: [], last_page: 1 } };
  });
  api.post.mockResolvedValue({ data: {} });
});

describe('delivery selection eligibility', () => {
  it('keeps a completed task ineligible for both actions', () => {
    const result = deliverySelectionEligibility(tasks, ['done-1']);
    expect(result.assignEligible).toBe(false);
    expect(result.reassignEligible).toBe(false);
    expect(result.assignReason).toContain('EKRAM-E2E-TEST مكتمل');
    expect(result.reassignReason).toContain('EKRAM-E2E-TEST مكتمل');
  });

  it('enables assignment only for an entirely ready selection', async () => {
    mount();
    expect(await screen.findByRole('checkbox', { name: 'تحديد للتكليف' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('السائق'), { target: { value: 'driver-2' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'تحديد للتكليف' }));
    expect(screen.getByRole('button', { name: 'إنشاء التكليف (1)' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'نقل التكليف إلى سائق آخر (1)' })).toBeDisabled();
    expect(screen.getByText(/أزل من التحديد: EKRAM-E2E-TEST جاهز/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'إنشاء التكليف (1)' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/support/assignments', { driver_id: 'driver-2', tasks: ['ready-1'], minutes: 480 }));
  });

  it('enables reassignment only for an entirely in-delivery selection', async () => {
    mount();
    fireEvent.change(await screen.findByLabelText('السائق'), { target: { value: 'driver-2' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'تحديد للنقل' }));
    expect(screen.getByRole('button', { name: 'نقل التكليف إلى سائق آخر (1)' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'إنشاء التكليف (1)' })).toBeDisabled();
    expect(screen.getByText(/أزل من التحديد: EKRAM-E2E-TEST جارٍ/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'إنشاء التكليف (1)' }));
    expect(api.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'نقل التكليف إلى سائق آخر (1)' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/support/assignments/reassign', { driver_id: 'driver-2', tasks: ['move-1'], minutes: 480 }));
  });

  it('disables both actions for a mixed selection and names each required change', async () => {
    mount();
    fireEvent.change(await screen.findByLabelText('السائق'), { target: { value: 'driver-2' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'تحديد للتكليف' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'تحديد للنقل' }));
    expect(screen.getByRole('button', { name: 'إنشاء التكليف (2)' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'نقل التكليف إلى سائق آخر (2)' })).toBeDisabled();
    expect(screen.getByText(/أزل من التحديد: EKRAM-E2E-TEST جارٍ/)).toBeInTheDocument();
    expect(screen.getByText(/أزل من التحديد: EKRAM-E2E-TEST جاهز/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'إنشاء التكليف (2)' }));
    fireEvent.click(screen.getByRole('button', { name: 'نقل التكليف إلى سائق آخر (2)' }));
    expect(api.post).not.toHaveBeenCalled();
  });

  it('offers no assignment actions to an unauthorized viewer', async () => {
    session.user = { role: 'staff', permissions: { support: { view: true } } };
    mount();
    expect(await screen.findByText('EKRAM-E2E-TEST مكتمل')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /إنشاء التكليف|نقل التكليف/ })).not.toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalledWith('/support/assignments');
  });

  it('does not offer a completed task for selection', async () => {
    mount();
    expect(await screen.findByText('EKRAM-E2E-TEST مكتمل')).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
  });
});
