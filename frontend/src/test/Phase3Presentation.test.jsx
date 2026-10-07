import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PolicyReviewLinks from '../components/beneficiaries/PolicyReviewLinks';
import SupportRequestPage from '../pages/beneficiaries/SupportRequestPage';
import api from '../api/axios';

vi.mock('../api/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { role: 'admin' } }) }));
vi.mock('../components/layout/MainLayout', () => ({ default: ({ children }) => <div>{children}</div> }));

describe('phase 3 policy and support presentation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the stored score breakdown in Arabic without a raw blocker code', async () => {
    api.get.mockImplementation((path) => Promise.resolve({ data: { data: path.includes('/evaluations') ? [{
      id: 'e1', evaluated_at: '2026-10-01T00:00:00', policy_score: '19.0000', score_category: 'c', eligibility_decision: 'eligible', current_state: 'approved',
      policy_version: { version: 'v1' }, eligibility_reasons: ['REQUIRED_DOCUMENTS_INCOMPLETE'],
      score_breakdown: [{ rule_id: 'income', label: 'الدخل', value: 440, condition: '400–600', awarded_points: 11, max_points: 15, reason: 'REQUIRED_DOCUMENTS_INCOMPLETE' }],
    }] : [] } }));
    render(<MemoryRouter><PolicyReviewLinks beneficiaryId="b1" /></MemoryRouter>);
    expect(await screen.findByText('الدخل')).toBeInTheDocument();
    expect(screen.getByText('19.0000')).toBeInTheDocument();
    expect(screen.getByText('الفئة الثالثة')).toBeInTheDocument();
    expect(screen.getByText('مؤهل')).toBeInTheDocument();
    expect(screen.getAllByText('الوثائق المطلوبة غير مكتملة').length).toBeGreaterThan(0);
    expect(screen.queryByText('REQUIRED_DOCUMENTS_INCOMPLETE')).not.toBeInTheDocument();
  });

  it('blocks support submission when no evaluation exists and labels fulfillment in Arabic', async () => {
    api.get.mockImplementation((path) => {
      if (path === '/beneficiaries/b1') return Promise.resolve({ data: { data: { id: 'b1', full_name: 'مستفيد الدعم' } } });
      if (path.includes('/evaluations')) return Promise.resolve({ data: { data: [] } });
      return Promise.resolve({ data: { data: [] } });
    });
    render(<MemoryRouter initialEntries={['/beneficiaries/b1/support']}><Routes><Route path="/beneficiaries/:id/support" element={<SupportRequestPage />} /></Routes></MemoryRouter>);
    expect(await screen.findByText('لا يمكن تقديم الدعم قبل إكمال تقييم سياسة المستفيد.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'حفظ مسودة طلب الدعم' })).toBeDisabled();
    expect(screen.getByRole('option', { name: 'استلام مباشر' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'توصيل للمنازل' })).toBeInTheDocument();
  });
});
