import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DailyBeneficiariesList from '../pages/daily-beneficiaries/DailyBeneficiariesList';
import api from '../api/axios';

const context = vi.hoisted(() => ({ user: { role: 'admin' } }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => context }));
vi.mock('../components/layout/MainLayout', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('../api/axios', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));

const citizen = {
  id: 'daily-citizen',
  full_name: 'مستفيد يومي سعودي',
  beneficiary_type: 'citizen',
  nationality: 'سعودي',
  phone: '0550001122',
  district: 'حي النوارية',
  created_at: '2026-09-14T08:30:00',
  national_id: '1234567890',
  status: 'active',
};

const blankNationality = {
  id: 'daily-blank',
  full_name: 'مستفيد بلا جنسية',
  beneficiary_type: 'resident',
  nationality: '',
  phone: '0550003344',
  district: 'حي الشرائع',
  created_at: '2026-08-02T08:30:00',
  national_id: '2234567890',
  status: 'active',
};

describe('daily beneficiary list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    context.user = { role: 'admin' };
    api.get.mockImplementation((url) => {
      if (url === '/daily-beneficiaries') {
        return Promise.resolve({
          data: {
            success: true,
            data: { data: [citizen, blankNationality], current_page: 1, last_page: 1, total: 2 },
            districts: [citizen.district, blankNationality.district],
            categories: [],
          },
        });
      }
      return Promise.resolve({ data: { success: true, data: [] } });
    });
  });

  it('shows citizen nationality fields and does not present a blank nationality as سعودي', async () => {
    render(<MemoryRouter><DailyBeneficiariesList /></MemoryRouter>);

    expect(await screen.findByText(citizen.full_name)).toBeInTheDocument();
    const citizenRow = screen.getByText(citizen.full_name).closest('tr');
    expect(citizenRow).toHaveTextContent('مواطن');
    expect(citizenRow).toHaveTextContent(citizen.phone);
    expect(citizenRow).toHaveTextContent(citizen.district);
    expect(citizenRow).toHaveTextContent(citizen.nationality);
    expect(citizenRow).toHaveTextContent('2026-09-14');

    const blankRow = screen.getByText(blankNationality.full_name).closest('tr');
    expect(blankRow).not.toHaveTextContent('سعودي');
    expect(blankRow).toHaveTextContent('—');
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/daily-beneficiaries', expect.any(Object)));
  });
});
