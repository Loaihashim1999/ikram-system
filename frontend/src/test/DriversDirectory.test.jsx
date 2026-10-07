import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import DriversDirectoryPage from '../pages/admin/DriversDirectoryPage';
import api from '../api/axios';

vi.mock('../api/axios', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));
vi.mock('../components/layout/MainLayout', () => ({ default: ({ children }) => <div>{children}</div> }));

const driver = { id: 'driver-1', full_name: 'سائق الدليل', phone: '966574917155', is_active: true, assigned_count: 4, in_progress_count: 1, delivered_count: 2, remaining_count: 1, last_activity: null, all_completed: false, open_assignment_id: null };

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue({ data: { data: [driver] } });
  api.post.mockResolvedValue({ data: { data: driver } });
  api.patch.mockResolvedValue({ data: { data: driver } });
});

describe('driver management', () => {
  it('creates and edits through the existing driver API with canonical phones', async () => {
    render(<MemoryRouter><DriversDirectoryPage /></MemoryRouter>);
    await screen.findByText('0574917155');
    fireEvent.click(screen.getByRole('button', { name: 'إضافة سائق' }));
    fireEvent.change(screen.getByLabelText(/اسم السائق/), { target: { value: 'سائق جديد' } });
    fireEvent.change(screen.getByLabelText(/رقم الجوال/), { target: { value: '0501234567' } });
    fireEvent.click(screen.getByRole('button', { name: 'حفظ' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/support/drivers', expect.objectContaining({ full_name: 'سائق جديد', phone: '966501234567' })));
    fireEvent.click(await screen.findByRole('button', { name: 'تعديل' }));
    expect(screen.getByLabelText(/رقم الجوال/)).toHaveValue('0574917155');
    fireEvent.change(screen.getByLabelText(/رقم الجوال/), { target: { value: '0507654321' } });
    fireEvent.click(screen.getByRole('button', { name: 'حفظ' }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/support/drivers/driver-1', expect.objectContaining({ phone: '966507654321' })));
  });
  it('lists the driver entity with a local phone and opens one form', async () => {
    render(<MemoryRouter><DriversDirectoryPage /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'إدارة السائقين' })).toBeInTheDocument();
    expect(screen.getByText('0574917155')).toBeInTheDocument();
    expect(screen.queryByText('966574917155')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'إضافة سائق' }));
    expect(screen.getByRole('heading', { name: 'إضافة سائق' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/اسم السائق/), { target: { value: 'سائق جديد' } });
    fireEvent.change(screen.getByLabelText(/رقم الجوال/), { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: 'حفظ' }));
    expect(await screen.findByText('أدخل رقم جوال محليًا بصيغة 05xxxxxxxx.')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });
});
