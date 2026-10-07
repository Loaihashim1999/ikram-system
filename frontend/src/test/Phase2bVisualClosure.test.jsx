import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AddBeneficiaryPage from '../pages/beneficiaries/AddBeneficiaryPage';
import BeneficiaryDetailsPage from '../pages/beneficiaries/BeneficiaryDetails';
import EditBeneficiaryPage from '../pages/beneficiaries/EditBeneficiaryPage';
import beneficiaryApi from '../api/beneficiaries';
import api from '../api/axios';

vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { role: 'admin', permissions: { beneficiaries: { edit: true, delete: true }, support: { view: true, create: true }, beneficiary_policy: { evaluate: true, view: true, review: true } } } }) }));
vi.mock('../components/layout/MainLayout', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('../api/beneficiaries', () => ({
  default: { create: vi.fn(), checkNationalId: vi.fn(), get: vi.fn(), restore: vi.fn(), remove: vi.fn() },
  getBeneficiary: vi.fn(),
  updateBeneficiary: vi.fn(),
}));
vi.mock('../api/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

const legacyColor = /(?:^|\s)(?:amber|emerald|green|yellow)-|text-green-|bg-green-|bg-emerald-|border-amber-/;

function beneficiaryRecord() {
  return {
    id: 'b1',
    full_name: 'مستفيد اختبار',
    national_id: '1234567890',
    phone: '0550000000',
    beneficiary_type: 'citizen',
    nationality: 'سعودي',
    family_status: 'poor',
    family_members_count: 2,
    housing_type: 'own',
    city: 'مكة المكرمة',
    district: 'النوارية',
    street: 'شارع الاختبار',
    status: 'active',
    priority: 'first_class',
    income_sources: [],
    dependents: [],
    distributions: [],
  };
}

describe('phase 2B visual closure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockImplementation((path) => Promise.resolve({ data: { data: path.includes('/evaluations') || path.includes('/versions') ? [] : {} } }));
    api.post.mockResolvedValue({ data: { data: {} } });
    beneficiaryApi.get.mockResolvedValue({ data: { data: beneficiaryRecord() } });
    beneficiaryApi.create.mockResolvedValue({ data: { data: { id: 'b1' } } });
  });

  it('renders registration with the shared shell and without legacy colors', async () => {
    const { container } = render(<MemoryRouter initialEntries={['/beneficiaries/add-citizen']}><AddBeneficiaryPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'تسجيل مستفيد مواطن جديد' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'البيانات الأساسية' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'التالي' })).toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(legacyColor);
    fireEvent.submit(container.querySelector('form'));
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/settings'));
    expect(beneficiaryApi.create).not.toHaveBeenCalled();
  });

  it('shows an Arabic family status on review and confirms through the existing request', async () => {
    const user = userEvent.setup();
    const { container } = render(<MemoryRouter initialEntries={['/beneficiaries/add-citizen']}><AddBeneficiaryPage /></MemoryRouter>);
    await user.type(screen.getByLabelText(/الاسم الرباعي/), 'مستفيد اختبار');
    await user.type(screen.getByLabelText(/رقم الهوية/), '1234567890');
    await user.type(screen.getByLabelText(/الجوال/), '0550000000');
    fireEvent.change(screen.getByLabelText(/تاريخ الميلاد/), { target: { value: '1990-01-01' } });
    await user.type(screen.getByLabelText(/الحي/), 'النوارية');
    await user.type(screen.getByLabelText(/الشارع/), 'شارع الاختبار');
    await user.click(screen.getByRole('button', { name: 'التالي' }));
    fireEvent.change(screen.getByLabelText(/الحالة الاجتماعية/), { target: { value: 'poor' } });
    fireEvent.change(screen.getByLabelText(/نوع السكن/), { target: { value: 'own' } });
    await user.click(screen.getByRole('button', { name: 'التالي' }));
    await user.click(screen.getByRole('button', { name: 'التالي' }));
    const idFile = new File(['id'], 'identity.png', { type: 'image/png' });
    const addressFile = new File(['address'], 'address.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText(/صورة الهوية الوطنية/), { target: { files: [idFile] } });
    fireEvent.change(screen.getByLabelText(/العنوان الوطني/), { target: { files: [addressFile] } });
    await user.click(screen.getByRole('button', { name: 'التالي' }));
    expect(screen.getByRole('heading', { name: 'مراجعة بيانات المستفيد' })).toBeInTheDocument();
    expect(screen.getAllByText('فقير').length).toBeGreaterThan(0);
    expect(screen.queryByText('poor')).not.toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(legacyColor);
    await user.click(screen.getByRole('button', { name: 'التالي' }));
    expect(screen.getByRole('heading', { name: 'تأكيد التسجيل' })).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'تأكيد وحفظ المستفيد' }));
    await waitFor(() => expect(beneficiaryApi.create).toHaveBeenCalledTimes(1));
    expect(beneficiaryApi.create.mock.calls[0][0].get('reviewed_confirmation')).toBe('1');
    expect(beneficiaryApi.create.mock.calls[0][0].get('family_status')).toBe('poor');
  });

  it('renders the workspace with shared tabs and an Arabic family status', async () => {
    const { container } = render(<MemoryRouter initialEntries={['/beneficiaries/b1']}><Routes><Route path="/beneficiaries/:id" element={<BeneficiaryDetailsPage />} /></Routes></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'مستفيد اختبار' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'بيانات المستفيد' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'السياسة والاستحقاق' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'تعديل البيانات' })).toBeInTheDocument();
    await userClickFamily(container);
    expect(screen.getAllByText('فقير').length).toBeGreaterThan(0);
    expect(screen.queryByText('poor')).not.toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(legacyColor);
  });

  it('keeps beneficiary edit focus through continuous typing', async () => {
    const { getBeneficiary } = await import('../api/beneficiaries');
    getBeneficiary.mockResolvedValue({ data: { data: beneficiaryRecord() } });
    const user = userEvent.setup();
    const { container } = render(<MemoryRouter initialEntries={['/beneficiaries/b1/edit']}><Routes><Route path="/beneficiaries/:id/edit" element={<EditBeneficiaryPage />} /></Routes></MemoryRouter>);
    const input = await screen.findByDisplayValue('مستفيد اختبار');
    await user.click(input);
    await user.type(input, ' متصل');
    expect(input).toHaveValue('مستفيد اختبار متصل');
    expect(input).toHaveFocus();
    expect(container.innerHTML).not.toMatch(legacyColor);
    expect(screen.getByRole('tab', { name: 'البيانات الأساسية' })).toBeInTheDocument();
  });
});

async function userClickFamily() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('tab', { name: 'الأسرة والتابعون' }));
}
