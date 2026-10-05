import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import ReceiverPage from '../pages/receiver/ReceiverPage';
import QrScannerModal from '../components/common/QrScannerModal';
import api from '../api/axios';

const camera = vi.hoisted(() => ({ loaded: vi.fn(), construct: vi.fn(), start: vi.fn(), stop: vi.fn(), instances: [] }));
vi.mock('html5-qrcode', () => {
  camera.loaded();
  return { Html5Qrcode: class {
    constructor() { camera.construct(); camera.instances.push(this); this.isScanning = false; }
    async start(...args) { this.decode = args[2]; await camera.start(...args); this.isScanning = true; }
    async stop() { camera.stop(); this.isScanning = false; }
  } };
});
vi.mock('../api/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../components/layout/MainLayout', () => ({ default: ({ children }) => <main>{children}</main> }));
vi.mock('../components/ui/PageHeader', () => ({ default: () => <h1>Receiver</h1> }));

beforeEach(() => {
  vi.clearAllMocks();
  camera.instances.length = 0;
  camera.start.mockResolvedValue();
  localStorage.clear();
  api.get.mockResolvedValue({ data: { data: { barcode_code: 'REP-123', status: 'active', beneficiary: { full_name: 'Test Recipient' } } } });
  api.post.mockResolvedValue({ data: { message: 'Delivery confirmed' } });
});

it('keeps the scanner module unloaded for receiver entry, manual lookup and confirmation', async () => {
  render(<ReceiverPage />);
  fireEvent.change(screen.getByPlaceholderText(/أدخل رمز الباركود/), { target: { value: ' REP-123 ' } });
  fireEvent.click(screen.getByRole('button', { name: 'بحث بالرمز' }));
  expect(await screen.findByText('Test Recipient')).toBeInTheDocument();
  expect(api.get).toHaveBeenCalledWith('/receiver/scan/REP-123');
  fireEvent.click(screen.getByRole('button', { name: /تأكيد وتسليم الدعم/ }));
  expect(await screen.findByText('Delivery confirmed')).toBeInTheDocument();
  expect(api.post).toHaveBeenCalledWith('/receiver/confirm/REP-123');
  expect(camera.loaded).not.toHaveBeenCalled();
  expect(camera.construct).not.toHaveBeenCalled();
});

it('opens the camera on demand, searches a decoded code once, and closes the scanner', async () => {
  render(<ReceiverPage />);
  fireEvent.click(screen.getByRole('button', { name: 'فتح الكاميرا' }));
  await waitFor(() => expect(camera.start).toHaveBeenCalledOnce());
  expect(camera.start).toHaveBeenCalledWith({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 250, height: 250 } }, expect.any(Function), expect.any(Function));
  await act(async () => { await Promise.all([camera.instances[0].decode('REP-123'), camera.instances[0].decode('REP-123')]); });
  expect(await screen.findByText('Test Recipient')).toBeInTheDocument();
  expect(api.get).toHaveBeenCalledExactlyOnceWith('/receiver/scan/REP-123');
  expect(screen.queryByLabelText('إغلاق الماسح')).not.toBeInTheDocument();
  expect(camera.stop).toHaveBeenCalledOnce();
});

it('allows manual fallback when the camera fails', async () => {
  camera.start.mockRejectedValue(new Error('permission denied'));
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  render(<ReceiverPage />);
  fireEvent.click(screen.getByRole('button', { name: 'فتح الكاميرا' }));
  expect(await screen.findByText(/لم نتمكن من الوصول/)).toBeInTheDocument();
  fireEvent.change(screen.getByPlaceholderText(/أدخل رمز الاستلام/), { target: { value: ' REP-123 ' } });
  fireEvent.click(screen.getByRole('button', { name: 'بحث', exact: true }));
  expect(await screen.findByText('Test Recipient')).toBeInTheDocument();
  expect(api.get).toHaveBeenCalledWith('/receiver/scan/REP-123');
  log.mockRestore();
});

it('stops a camera that finishes starting after close and permits reopening', async () => {
  let finishStart;
  camera.start.mockImplementationOnce(() => new Promise(resolve => { finishStart = resolve; }));
  render(<ReceiverPage />);
  fireEvent.click(screen.getByRole('button', { name: 'فتح الكاميرا' }));
  await waitFor(() => expect(camera.start).toHaveBeenCalledOnce());
  fireEvent.click(screen.getByLabelText('إغلاق الماسح'));
  await act(async () => { finishStart(); });
  expect(camera.stop).toHaveBeenCalledOnce();
  await act(async () => { await camera.instances[0].decode('STALE'); });
  expect(api.get).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'فتح الكاميرا' }));
  await waitFor(() => expect(camera.start).toHaveBeenCalledTimes(2));
});

it('does not restart on callback changes and cleans up on unmount', async () => {
  const oldCallback = vi.fn();
  const newCallback = vi.fn();
  const { rerender, unmount } = render(<QrScannerModal isOpen onClose={() => {}} onScanSuccess={oldCallback} />);
  await waitFor(() => expect(camera.instances[0]?.isScanning).toBe(true));
  rerender(<QrScannerModal isOpen onClose={() => {}} onScanSuccess={newCallback} />);
  expect(camera.start).toHaveBeenCalledOnce();
  await act(async () => { await camera.instances[0].decode('REP-123'); });
  expect(newCallback).toHaveBeenCalledWith('REP-123');
  expect(oldCallback).not.toHaveBeenCalled();
  unmount();
  expect(camera.stop).toHaveBeenCalledOnce();
});

it.each(['used', 'expired', 'revoked'])('preserves delivery blocking for %s codes', async status => {
  api.get.mockResolvedValue({ data: { data: { barcode_code: 'REP-123', status } } });
  render(<ReceiverPage />);
  fireEvent.change(screen.getByPlaceholderText(/أدخل رمز الباركود/), { target: { value: 'REP-123' } });
  fireEvent.click(screen.getByRole('button', { name: 'بحث بالرمز' }));
  expect(await screen.findByText(/تم تعطيل زر التسليم/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /تأكيد وتسليم الدعم/ })).not.toBeInTheDocument();
  expect(api.post).not.toHaveBeenCalled();
});
