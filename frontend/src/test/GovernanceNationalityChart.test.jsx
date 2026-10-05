import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GovernancePage from '../pages/governance/GovernancePage';
import { getAnalytics } from '../api/dailyBeneficiaries';

const context = vi.hoisted(() => ({ user: { role: 'admin' } }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => context }));
vi.mock('../components/layout/MainLayout', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('../api/dailyBeneficiaries', () => ({ getAnalytics: vi.fn() }));

const populations = {
  registered: { label: 'مسجلون', total: 3 },
  active: { label: 'نشطون', total: 12 },
  served: { label: 'مخدومون', total: 18 },
};

const analytics = {
  success: true,
  period: { label: 'أسبوع الاختبار', start_date: '2026-09-01', end_date: '2026-09-07' },
  nationality_analysis: {
    populations,
    chart: {
      categories: [
        { key: 'سعودي', label: 'سعودي' },
        { key: 'missing', label: 'غير مسجلة' },
      ],
      series: [
        { key: 'registered', label: populations.registered.label, data: [1, 2] },
        { key: 'active', label: populations.active.label, data: [4, 8] },
        { key: 'served', label: populations.served.label, data: [7, 11] },
      ],
    },
  },
};

describe('governance nationality chart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    context.user = { role: 'admin' };
    getAnalytics.mockResolvedValue({ data: analytics });
  });

  it('shows population totals and the missing nationality category from the analytics response', async () => {
    render(<MemoryRouter><GovernancePage /></MemoryRouter>);

    expect(await screen.findByText('تحليل الجنسية')).toBeInTheDocument();
    expect(screen.getByText(String(populations.registered.total))).toBeInTheDocument();
    expect(screen.getByText(String(populations.active.total))).toBeInTheDocument();
    expect(screen.getByText(String(populations.served.total))).toBeInTheDocument();
    expect(screen.getAllByText(populations.registered.label).length).toBeGreaterThan(0);
    expect(screen.getAllByText(populations.active.label).length).toBeGreaterThan(0);
    expect(screen.getAllByText(populations.served.label).length).toBeGreaterThan(0);
    expect(screen.getAllByText('غير مسجلة').length).toBeGreaterThan(0);
    expect(analytics.nationality_analysis.chart.categories.at(-1).label).toBe('غير مسجلة');
    for (const series of analytics.nationality_analysis.chart.series) {
      const sum = series.data.reduce((total, value) => total + value, 0);
      expect(sum).toBe(populations[series.key].total);
    }
  });
});
