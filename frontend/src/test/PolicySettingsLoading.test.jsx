import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import BeneficiaryPolicySettings from '../pages/admin/BeneficiaryPolicySettings';
import api from '../api/axios';

vi.mock('../api/axios', () => ({ default: { get: vi.fn() } }));
beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation(async path => ({ data: { data: path.endsWith('permissions') ? { view: true } : [] } }));
});
describe('policy version loading', () => {
  it('shows the compact card and clean empty state after successful loading', async () => {
    render(<MemoryRouter><BeneficiaryPolicySettings /></MemoryRouter>);
    expect(await screen.findByText('لا توجد إصدارات بعد.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'إصدارات سياسة المستفيدين' })).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader')).toHaveLength(6);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('localizes raw backend errors, keeps empty state hidden, and retries', async () => {
    api.get.mockRejectedValueOnce({ response: { data: { message: 'No query results for model Policy' } } });
    render(<MemoryRouter><BeneficiaryPolicySettings /></MemoryRouter>);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('تعذر تحميل إصدارات السياسة.');
    expect(alert).toHaveClass('flex-row');
    expect(screen.queryByText(/No query results/)).not.toBeInTheDocument();
    expect(screen.queryByText('لا توجد إصدارات بعد.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'إعادة المحاولة' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(await screen.findByText('لا توجد إصدارات بعد.')).toBeInTheDocument();
  });
});
