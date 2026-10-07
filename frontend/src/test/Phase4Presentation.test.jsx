import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GovernancePage from '../pages/governance/GovernancePage';
import DirectHandoverPage from '../pages/delivery/DirectHandoverPage';
import { getAnalytics } from '../api/dailyBeneficiaries';

vi.mock('../api/dailyBeneficiaries', () => ({ getAnalytics: vi.fn() }));
vi.mock('../api/axios', () => ({ default: { get: vi.fn().mockResolvedValue({ data: { data: [], last_page: 1 } }), post: vi.fn() } }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { role: 'admin' } }) }));
vi.mock('../components/layout/MainLayout', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('../components/common/PagePermissionGuard', () => ({ default: ({ children }) => children }));

describe('phase 4 governance and handover presentation', () => {
  beforeEach(() => {
    getAnalytics.mockResolvedValue({ data: { success: true, period: { start_date: '2026-10-01', end_date: '2026-10-03', label: 'الفترة' }, operational_metrics: { total_due: 3, completed_by_cutoff: 1, completed_in_period: 1, not_completed: 2, overdue: 2, unique_due_beneficiaries: 2, unique_completed_beneficiaries: 1, unique_not_completed_beneficiaries: 2 }, kpis: {}, beneficiaries: { total: 4 }, daily_beneficiaries: {}, charts: { column_chart: { data: [] }, line_chart: { data: [] }, funnel_chart: { stages: [] }, pie_chart: { data: [] } }, inventory: {} } });
  });

  it('separates the period operation count from the beneficiary snapshot', async () => {
    render(<MemoryRouter><GovernancePage /></MemoryRouter>);
    expect(await screen.findByText('العمليات المستحقة غير المكتملة')).toBeInTheDocument();
    expect(screen.getByText('لقطة: إجمالي المستفيدين المسجلين')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'منظومة الحوكمة والتحليلات الشاملة' })).toBeInTheDocument();
    expect(screen.queryByText('citizen')).not.toBeInTheDocument();
  });

  it('renders direct handover verification on the shared page shell', async () => {
    render(<MemoryRouter><DirectHandoverPage /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'الاستلام المباشر' })).toBeInTheDocument();
    expect(screen.getByText('مرجع الدعم')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'تحقق' })).toBeInTheDocument();
  });
});
