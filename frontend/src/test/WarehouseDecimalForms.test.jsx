import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Warehouse from '../pages/warehouse/Warehouse';
import { addInventoryItem, adjustStock, getInventory, updateInventoryItem } from '../api/warehouse';

vi.mock('../api/warehouse', () => ({
  getInventory: vi.fn(), addInventoryItem: vi.fn(), updateInventoryItem: vi.fn(),
  deleteInventoryItem: vi.fn(), adjustStock: vi.fn(),
}));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'admin', role: 'admin', permissions: null } }) }));
vi.mock('../components/layout/MainLayout', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('../context/NotificationContext', () => ({ useNotifications: () => ({ checkWarehouseExpirations: () => {} }) }));

describe('Warehouse decimal form contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getInventory.mockResolvedValue({ data: { data: [
      { id: 'stock-1', name: 'Decimal stock', unit: 'كيلو', current_quantity: '3.00', min_threshold: '1.00' },
    ] } });
    addInventoryItem.mockResolvedValue({ data: {} });
    updateInventoryItem.mockResolvedValue({ data: {} });
    adjustStock.mockResolvedValue({ data: {} });
  });

  async function page() {
    render(<MemoryRouter><Warehouse /></MemoryRouter>);
    await screen.findByText('Decimal stock');
  }

  function change(input, value) { fireEvent.change(input, { target: { value } }); }

  async function addForm() {
    await page();
    fireEvent.click(screen.getByRole('button', { name: /إضافة صنف/ }));
    const dialog = screen.getByRole('dialog');
    change(dialog.querySelector('[name="name"]'), 'Fractional stock');
    change(dialog.querySelector('[name="expiration_date"]'), '2027-12-31');
    return dialog;
  }

  it.each([['1.25', '0.75'], ['0.75', '1.25']])('preserves opening stock %s and threshold %s', async (quantity, threshold) => {
    const dialog = await addForm();
    change(dialog.querySelector('[name="current_quantity"]'), quantity);
    change(dialog.querySelector('[name="min_threshold"]'), threshold);
    expect(dialog.querySelector('form').checkValidity()).toBe(true);
    fireEvent.click(within(dialog).getByRole('button', { name: 'حفظ الصنف وتوثيق الصلاحية' }));
    await waitFor(() => expect(addInventoryItem).toHaveBeenCalledWith(expect.objectContaining({
      current_quantity: quantity, min_threshold: threshold,
    })));
  });

  it.each(['1.25', '0.75'])('preserves edited threshold %s without replacing stock', async threshold => {
    await page();
    fireEvent.click(screen.getByRole('button', { name: 'تعديل الصنف' }));
    const dialog = screen.getByRole('dialog');
    change(dialog.querySelector('[name="edit_min_threshold"]'), threshold);
    expect(dialog.querySelector('form').checkValidity()).toBe(true);
    fireEvent.click(within(dialog).getByRole('button', { name: 'حفظ التعديلات' }));
    await waitFor(() => expect(updateInventoryItem).toHaveBeenCalledWith('stock-1', expect.objectContaining({ min_threshold: threshold })));
    expect(updateInventoryItem.mock.calls[0][1]).not.toHaveProperty('current_quantity');
  });

  it.each(['1.25', '0.75'])('preserves adjustment %s in the actual API call', async quantity => {
    await page();
    fireEvent.click(screen.getByRole('button', { name: 'تعديل المخزون' }));
    const dialog = screen.getByRole('dialog');
    change(dialog.querySelector('[name="quantity"]'), quantity);
    change(dialog.querySelector('[name="reason"]'), 'Synthetic decimal adjustment');
    expect(dialog.querySelector('form').checkValidity()).toBe(true);
    fireEvent.click(within(dialog).getByRole('button', { name: 'تأكيد حركة المخزون' }));
    await waitFor(() => expect(adjustStock).toHaveBeenCalledWith('stock-1', expect.objectContaining({ quantity })));
  });

  it.each(['-1', '1.234', '', '10000000000'])('blocks invalid opening quantity %s rather than silently coercing it', async quantity => {
    const dialog = await addForm();
    change(dialog.querySelector('[name="current_quantity"]'), quantity);
    expect(dialog.querySelector('form').checkValidity()).toBe(false);
    fireEvent.click(within(dialog).getByRole('button', { name: 'حفظ الصنف وتوثيق الصلاحية' }));
    expect(addInventoryItem).not.toHaveBeenCalled();
  });

  it('blocks a zero adjustment rather than sending a zero movement', async () => {
    await page();
    fireEvent.click(screen.getByRole('button', { name: 'تعديل المخزون' }));
    const dialog = screen.getByRole('dialog');
    change(dialog.querySelector('[name="quantity"]'), '0');
    change(dialog.querySelector('[name="reason"]'), 'Synthetic adjustment');
    expect(dialog.querySelector('form').checkValidity()).toBe(false);
    fireEvent.click(within(dialog).getByRole('button', { name: 'تأكيد حركة المخزون' }));
    expect(adjustStock).not.toHaveBeenCalled();
  });
});
