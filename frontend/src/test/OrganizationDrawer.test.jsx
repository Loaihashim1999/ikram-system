import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import NeighborhoodRepsPage from '../pages/representatives/NeighborhoodRepsPage';
import api from '../api/axios';

const { session } = vi.hoisted(() => ({ session: { user: { role: 'admin', is_active: true } } }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => session }));
vi.mock('../api/axios', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
vi.mock('../components/layout/MainLayout', () => ({ default: ({ children }) => <div>{children}</div> }));

const organization = {
  id: 'org-1',
  organization_name: 'جمعية الاختبار',
  organization_type: 'جمعية خيرية',
  contact_person: 'مسؤول الاختبار',
  phone: '0501111000',
  email: 'org@example.com',
  city: 'مكة المكرمة',
  district_name: 'العزيزية',
  status: 'active',
  beneficiaries_count: 1,
};

const mount = () => render(<MemoryRouter><NeighborhoodRepsPage /></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  session.user = { role: 'admin', is_active: true };
  api.get.mockImplementation(async (url) => {
    if (url === '/neighborhood-reps') return { data: { data: [organization] } };
    if (url === '/neighborhood-reps/org-1') return { data: { data: { linked_beneficiaries: [] } } };
    return { data: { data: [] } };
  });
  api.post.mockResolvedValue({ data: {} });
});

describe('organization create and edit drawer', () => {
  it('opens one create drawer with grouped fields, Arabic uploads, and a visible save action', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'تسجيل جهة مستفيدة جديدة' }));
    expect(await screen.findByRole('heading', { name: 'إضافة جهة مستفيدة' })).toBeInTheDocument();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(document.querySelectorAll('#organization-form')).toHaveLength(1);
    expect(screen.getByText('بيانات الجهة')).toBeInTheDocument();
    expect(screen.getByText('بيانات المسؤول')).toBeInTheDocument();
    expect(screen.getByText('المرفقات')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /اسم الجهة المستفيدة/ })).toBeInTheDocument();
    expect(screen.getByLabelText(/رفع ملف مضغوط بملفات المستفيدين/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'إضافة الجهة' })).toBeEnabled();
    expect(screen.getAllByText('لم يتم اختيار ملف').length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toContain('Choose File');
    expect(document.body.textContent).not.toContain('No file chosen');
    expect(document.body.textContent).not.toContain('active');
    expect(screen.getByRole('dialog').className).toContain('max-w-3xl');
    expect(screen.getByRole('dialog').parentElement.className).toContain('justify-center');
    expect(document.querySelector('#organization-form .grid')).toHaveClass('grid-cols-1');
  });

  it('keeps entered values after a failed save and shows the selected file name', async () => {
    api.post.mockRejectedValue({ response: { data: { errors: { phone: ['The phone field is required.'] } } } });
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'تسجيل جهة مستفيدة جديدة' }));
    fireEvent.change(await screen.findByRole('textbox', { name: /اسم الجهة المستفيدة/ }), { target: { value: 'جمعية ثابتة' } });
    const letter = new File(['letter'], 'authorization-letter.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText(/خطاب التفويض الرسمي للشخص المسؤول/), { target: { files: [letter] } });
    expect(screen.getByText('authorization-letter.pdf')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'إزالة' }));
    expect(screen.queryByText('authorization-letter.pdf')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/خطاب التفويض الرسمي للشخص المسؤول/), { target: { files: [letter] } });
    fireEvent.click(screen.getByRole('button', { name: 'تغيير' }));
    fireEvent.submit(document.getElementById('organization-form'));
    expect(await screen.findByText('تحقق من صحة هذا الحقل.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /اسم الجهة المستفيدة/ })).toHaveValue('جمعية ثابتة');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('opens the same form for edit and closes on cancel', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'تعديل بيانات الجهة المستفيدة' }));
    expect(await screen.findByRole('heading', { name: 'تعديل بيانات الجهة المستفيدة' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /اسم الجهة المستفيدة/ })).toHaveValue('جمعية الاختبار');
    expect(screen.getByRole('button', { name: 'حفظ' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'إلغاء' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('does not open organization management for an unauthorized role', async () => {
    session.user = { role: 'warehouse', is_active: true };
    mount();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'تسجيل جهة مستفيدة جديدة' })).not.toBeInTheDocument());
  });
});
