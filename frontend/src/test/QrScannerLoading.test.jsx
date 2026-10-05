import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import QrScannerModal from '../components/common/QrScannerModal';

const loader = vi.hoisted(() => {
  let resolve;
  const pending = new Promise(done => { resolve = done; });
  return { pending, resolve, requested: vi.fn(), construct: vi.fn() };
});
vi.mock('html5-qrcode', async () => {
  loader.requested();
  await loader.pending;
  return { Html5Qrcode: loader.construct };
});

it('keeps manual entry usable while downloading and never starts a dismissed scanner', async () => {
  const success = vi.fn();
  const { rerender } = render(<QrScannerModal isOpen onClose={() => {}} onScanSuccess={success} />);
  await waitFor(() => expect(loader.requested).toHaveBeenCalledOnce());
  expect(screen.getByRole('status')).toBeInTheDocument();
  fireEvent.change(screen.getByPlaceholderText(/أدخل رمز الاستلام/), { target: { value: ' REP-123 ' } });
  fireEvent.click(screen.getByRole('button', { name: 'بحث' }));
  expect(success).toHaveBeenCalledWith('REP-123');
  rerender(<QrScannerModal isOpen={false} onClose={() => {}} onScanSuccess={success} />);
  await act(async () => { loader.resolve(); await loader.pending; });
  expect(loader.construct).not.toHaveBeenCalled();
});
