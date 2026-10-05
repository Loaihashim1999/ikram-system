import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Warehouse from '../pages/warehouse/Warehouse';

const { authState, apiState } = vi.hoisted(() => ({
  authState: { user: null },
  apiState: { items: [] },
}));
vi.mock('../context/AuthContext', () => ({ useAuth: () => authState }));
vi.mock('../context/NotificationContext', () => ({ useNotifications: () => ({ checkWarehouseExpirations: vi.fn() }) }));
vi.mock('../api/warehouse', () => ({
  getInventory: vi.fn(async () => ({ data: { data: apiState.items } })),
  addInventoryItem: vi.fn(), updateInventoryItem: vi.fn(), deleteInventoryItem: vi.fn(), adjustStock: vi.fn(),
}));
vi.mock('../components/layout/MainLayout', () => ({ default: ({ children }) => <div>{children}</div> }));

describe('Warehouse action controls respect module permissions', () => {
  beforeEach(() => {
    apiState.items = [{ id: 'synthetic-item', name: 'Synthetic stock', unit: 'kg', current_quantity: '10.00', min_threshold: '1.00', expiry_status: 'valid' }];
  });

  it('keeps read access but hides create/edit/adjust/delete controls for a read-only user', async () => {
    authState.user = { id: 'read-only', role: 'readonly', permissions: { warehouse: { view: true, create: false, edit: false, delete: false } } };
    render(<MemoryRouter><Warehouse /></MemoryRouter>);
    expect(await screen.findByText('Synthetic stock')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'عرض تفاصيل الصنف' })).toBeInTheDocument();
    expect(screen.queryByText('إضافة صنف / مادة للسلة')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'تعديل الصنف' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'تعديل المخزون' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'حذف الصنف' })).not.toBeInTheDocument();
  });

  it('keeps mutation controls for an administrator', async () => {
    authState.user = { id: 'admin', role: 'admin', permissions: null };
    render(<MemoryRouter><Warehouse /></MemoryRouter>);
    expect(await screen.findByText('Synthetic stock')).toBeInTheDocument();
    expect(screen.getByText('إضافة صنف / مادة للسلة')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'تعديل الصنف' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'تعديل المخزون' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'حذف الصنف' })).toBeInTheDocument();
  });
});
