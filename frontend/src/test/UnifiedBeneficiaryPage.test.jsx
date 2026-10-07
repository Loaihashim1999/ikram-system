import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import UnifiedBeneficiaryPage from '../pages/beneficiaries/UnifiedBeneficiaryPage';
import api from '../api/axios';

const { session } = vi.hoisted(() => ({ session: { user: null } }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => session }));

vi.mock('../api/axios', () => ({ default: { get: vi.fn() } }));
vi.mock('../components/layout/MainLayout', () => ({ default: ({ children }) => <div>{children}</div> }));

const payload = (rows = [], overrides = {}) => ({
  data: { data: { data: rows, total: rows.length, current_page: 1, last_page: 1, ...overrides } },
});

describe('POLICY-F unified beneficiary page', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    session.user = null;
    api.get.mockResolvedValue(payload([{ id: 'p1', source: 'permanent', full_name: 'دائم واحد', beneficiary_type: 'citizen', city: 'الرياض', district: 'الملز', status: 'active', created_at: '2026-09-01' }]));
    URL.createObjectURL = vi.fn(() => 'blob:policy-f');
    URL.revokeObjectURL = vi.fn();
    HTMLAnchorElement.prototype.click = vi.fn();
  });

  const renderPage = () => render(<MemoryRouter><UnifiedBeneficiaryPage /></MemoryRouter>);

  it('loads ALL and switches PERMANENT/DAILY through server query parameters', async () => {
    renderPage();
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/beneficiaries/unified', expect.objectContaining({ params: expect.objectContaining({ tab: 'all', page: 1, per_page: 25 }) })));
    fireEvent.click(screen.getByTestId('tab-permanent'));
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/beneficiaries/unified', expect.objectContaining({ params: expect.objectContaining({ tab: 'permanent' }) })));
    fireEvent.click(screen.getByTestId('tab-daily'));
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/beneficiaries/unified', expect.objectContaining({ params: expect.objectContaining({ tab: 'daily' }) })));
  });

  it('sends combined column filters to the backend and renders the returned page only', async () => {
    renderPage();
    await screen.findByText('دائم واحد');
    expect(screen.getByText('لم يُقيّم')).toBeInTheDocument();
    expect(screen.getByText('لا يوجد دعم')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'فتح المرشحات' }));
    fireEvent.change(screen.getByLabelText('بحث'), { target: { value: 'دائم' } });
    fireEvent.change(screen.getByLabelText('التصنيف'), { target: { value: 'citizen' } });
    fireEvent.change(screen.getByLabelText('الحي'), { target: { value: 'الملز' } });
    fireEvent.change(screen.getByLabelText('الحالة الأسرية'), { target: { value: 'widow' } });
    fireEvent.change(screen.getByLabelText('الجنسية'), { target: { value: 'سعودي' } });
    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith('/beneficiaries/unified', expect.objectContaining({ params: expect.objectContaining({ search: 'دائم', beneficiary_type: 'citizen', district: 'الملز', family_status: 'widow', nationality: 'سعودي', page: 1 }) })));
    expect(screen.getAllByTestId('unified-row')).toHaveLength(1);
  });

  it('keeps pagination server driven', async () => {
    api.get.mockResolvedValue(payload([{ id: 'p1', source: 'permanent', full_name: 'دائم واحد' }], { total: 30, last_page: 2 }));
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'الصفحة التالية' }));
    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith('/beneficiaries/unified', expect.objectContaining({ params: expect.objectContaining({ page: 2, per_page: 25 }) })));
  });

  it('triggers the backend Excel export with active tab and filters', async () => {
    api.get.mockImplementation((url) => url.endsWith('/export') ? Promise.resolve({ data: new Blob(['xlsx']) }) : Promise.resolve(payload([{ id: 'd1', source: 'daily', full_name: 'يومي واحد' }])));
    renderPage();
    fireEvent.click(screen.getByTestId('tab-daily'));
    fireEvent.click(screen.getByRole('button', { name: 'فتح المرشحات' }));
    fireEvent.change(screen.getByLabelText('الحي'), { target: { value: 'الصفا' } });
    await waitFor(() => expect(screen.getByTestId('unified-export')).not.toBeDisabled());
    fireEvent.click(screen.getByTestId('unified-export'));
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/beneficiaries/unified/export', expect.objectContaining({ responseType: 'blob', params: expect.objectContaining({ tab: 'daily', district: 'الصفا' }) })));
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it('opens the support dialog with shared controls and no local amber or emerald styles', () => {
    session.user = { role: 'admin', permissions: { support: { view: true, create: true } } };
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'تقديم الدعم' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('تقديم دعم للمستفيد');
    expect(dialog).toHaveTextContent('اختر مستفيداً واحداً على الأقل للمتابعة.');
    expect(dialog.innerHTML).not.toMatch(/amber-|emerald-/);
    fireEvent.click(screen.getByRole('button', { name: 'إلغاء' }));
    expect(screen.queryByRole('dialog', { name: 'تقديم دعم للمستفيد' })).not.toBeInTheDocument();
  });
});
