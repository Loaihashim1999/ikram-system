import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import DirectHandoverPage from '../pages/delivery/DirectHandoverPage';
import HomeDeliveryPage from '../pages/delivery/HomeDeliveryPage';
import api from '../api/axios';
import { exportApiDataToExcel } from '../utils/excelExport';

const { session } = vi.hoisted(() => ({ session: { user: { role: 'admin' } } }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => session }));
vi.mock('../api/axios', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));
vi.mock('../components/layout/MainLayout', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('../utils/excelExport', () => ({ exportApiDataToExcel: vi.fn() }));
const task = { id: 'support-1', recipient_name: 'EKRAM-E2E-TEST مستفيد', status: 'ready', fulfillment_method: 'pickup', items: [{ id: 'item-1', inventory_item: { name: 'سلة غذائية' }, requested_quantity: '1.00' }] };
const mount = (component) => render(<MemoryRouter>{component}</MemoryRouter>);
beforeEach(() => {
  vi.clearAllMocks(); session.user = { role: 'admin' };
  api.get.mockImplementation(async (url) => ({ data: url === '/support/distributions' ? { data: [task], last_page: 1, metrics: { total: 1 } } : { data: [], last_page: 1 } }));
  api.post.mockResolvedValue({ data: { data: task } }); api.patch.mockResolvedValue({ data: {} });
  exportApiDataToExcel.mockResolvedValue(1);
});
describe('separate fulfillment workflows', () => {
  it('loads only pickup and previews before an explicit mutation', async () => {
    mount(<DirectHandoverPage />);
    await screen.findByText(task.recipient_name);
    expect(api.get).toHaveBeenCalledWith('/support/distributions', { params: expect.objectContaining({ fulfillment_method: 'pickup' }) });
    expect(api.get).not.toHaveBeenCalledWith('/support/drivers');
    expect(screen.queryByText('تسجيل سائق')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('مرجع الدعم'), { target: { value: task.id } });
    fireEvent.change(screen.getByLabelText('رمز الاستلام'), { target: { value: '1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'تحقق' }));
    await screen.findByRole('button', { name: 'تأكيد الاستلام' });
    expect(api.post).toHaveBeenCalledWith('/support/distributions/support-1/verify-preview', { code: '1234' });
    expect(api.post).not.toHaveBeenCalledWith('/support/distributions/support-1/verify', expect.anything());
    fireEvent.click(screen.getByRole('button', { name: 'تأكيد الاستلام' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/support/distributions/support-1/verify', { code: '1234' }));
  });
  it('loads only delivery and exposes driver operations with no handover confirmation form', async () => {
    mount(<HomeDeliveryPage />);
    expect(await screen.findByRole('heading', { name: 'إدارة التوصيل للمنازل' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'دليل السائقين' })).not.toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/support/distributions', { params: expect.objectContaining({ fulfillment_method: 'delivery' }) });
    expect(screen.queryByLabelText('رمز الاستلام')).not.toBeInTheDocument();
  });
  it('retains filters for full-dataset export', async () => {
    mount(<DirectHandoverPage />);
    fireEvent.change(screen.getByLabelText('المستفيد أو المرجع أو نوع الدعم'), { target: { value: 'EKRAM-E2E-TEST' } });
    fireEvent.click(screen.getByRole('button', { name: 'تصدير Excel' }));
    await waitFor(() => expect(exportApiDataToExcel).toHaveBeenCalledWith(expect.objectContaining({ endpoint: '/support/distributions', params: expect.objectContaining({ fulfillment_method: 'pickup', q: 'EKRAM-E2E-TEST' }), metadata: expect.objectContaining({ title: 'تقرير الاستلام المباشر' }) })));
  });
  it('viewer does not load admin driver APIs or show fulfillment mutations', async () => {
    session.user = { role: 'staff', permissions: { support: { view: true } } };
    mount(<HomeDeliveryPage />);
    await screen.findByText(task.recipient_name);
    expect(api.get).not.toHaveBeenCalledWith('/support/drivers');
    expect(api.get).not.toHaveBeenCalledWith('/support/assignments');
    expect(screen.queryByRole('button', { name: 'إصدار رمز الاستلام' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'تصدير Excel' })).not.toBeInTheDocument();
  });
});
