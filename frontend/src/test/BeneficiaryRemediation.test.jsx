import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AddBeneficiaryPage from '../pages/beneficiaries/AddBeneficiaryPage';
import SupportRequestPage from '../pages/beneficiaries/SupportRequestPage';
import beneficiaryApi from '../api/beneficiaries';
import api from '../api/axios';

const context = vi.hoisted(() => ({ user: { role: 'admin' } }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => context }));
vi.mock('../components/layout/MainLayout', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('../api/beneficiaries', () => ({ default: { create: vi.fn(), checkNationalId: vi.fn() } }));
vi.mock('../api/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

describe('beneficiary remediation boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    context.user = { role: 'admin' };
    api.get.mockImplementation((path) => Promise.resolve({ data: { data: path.includes('/beneficiaries/') ? { id: 'b1', full_name: 'EKRAM-E2E-TEST' } : [] } }));
  });

  it('does not submit registration from an early wizard step', async () => {
    const { container } = render(<MemoryRouter initialEntries={['/beneficiaries/add-citizen']}><AddBeneficiaryPage /></MemoryRouter>);
    fireEvent.submit(container.querySelector('form'));
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/settings'));
    expect(beneficiaryApi.create).not.toHaveBeenCalled();
    expect(screen.queryByText('راجعت بيانات المستفيد والأسرة والمستندات وأؤكد حفظها')).not.toBeInTheDocument();
  });

  it('prefills the routed beneficiary and creates a canonical delivery draft', async () => {
    api.get.mockImplementation((path) => Promise.resolve({ data: { data: path === '/beneficiaries/b1' ? { id: 'b1', full_name: 'EKRAM-E2E-TEST' } : path === '/inventory' ? [{ id: 'stock1', name: 'صنف تجريبي' }] : [] } }));
    api.post.mockResolvedValue({ data: { data: { id: 'support1' } } });
    render(<MemoryRouter initialEntries={['/beneficiaries/b1/support']}><Routes><Route path="/beneficiaries/:id/support" element={<SupportRequestPage />} /><Route path="/support-delivery" element={<p>تم حفظ الطلب</p>} /></Routes></MemoryRouter>);
    await screen.findByText('EKRAM-E2E-TEST');
    fireEvent.change(screen.getByLabelText('طريقة التسليم'), { target: { value: 'delivery' } });
    fireEvent.change(screen.getByLabelText('الصنف 1'), { target: { value: 'stock1' } });
    fireEvent.click(screen.getByText('حفظ مسودة طلب الدعم'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/support/distributions', expect.objectContaining({ beneficiary_id: 'b1', recipient_type: 'beneficiary', fulfillment_method: 'delivery', items: [{ inventory_item_id: 'stock1', requested_quantity: '1' }] })));
  });

  it('makes no dependency requests without support creation authority', () => {
    context.user = { role: 'staff', permissions: { support: { view: true, create: false } } };
    render(<MemoryRouter><SupportRequestPage /></MemoryRouter>);
    expect(api.get).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('صلاحية الإنشاء');
  });
});
