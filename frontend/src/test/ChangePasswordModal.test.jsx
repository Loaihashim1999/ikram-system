import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChangePasswordModal from '../components/common/ChangePasswordModal';
import api from '../api/axios';

vi.mock('../api/axios', () => ({ default: { post: vi.fn() } }));
const current = 'Fixture-Current!123';
const next = 'Fixture-Changed!456';
let onClose, onSuccess;
function mount() {
  onClose = vi.fn(); onSuccess = vi.fn();
  render(<ChangePasswordModal isOpen onClose={onClose} onSuccess={onSuccess} />);
}
function fill(values = {}) {
  for (const [name, value] of Object.entries({ current_password: current, password: next, password_confirmation: next, ...values })) {
    fireEvent.change(screen.getByLabelText(name === 'current_password' ? /كلمة المرور الحالية|كلمة المرور المؤقتة/ : name === 'password' ? /^كلمة المرور الجديدة/ : /تأكيد كلمة المرور الجديدة/), { target: { value } });
  }
}
function submit() { fireEvent.submit(screen.getByRole('button', { name: 'حفظ كلمة المرور الجديدة' }).closest('form')); }
beforeEach(() => { vi.resetAllMocks(); localStorage.clear(); api.post.mockResolvedValue({ data: {} }); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('E2E-005 authenticated modal API contract', () => {
  it('posts exactly the authoritative body once', async () => {
    mount(); fill(); submit();
    await screen.findByRole('status');
    expect(api.post).toHaveBeenCalledExactlyOnceWith('/change-password', { current_password: current, password: next, password_confirmation: next });
    expect(Object.keys(api.post.mock.calls[0][1]).sort()).toEqual(['current_password', 'password', 'password_confirmation']);
    submit(); expect(api.post).toHaveBeenCalledTimes(1);
  });
  it('shows wrong-current validation and preserves forced/auth state after a rejection', async () => {
    localStorage.setItem('user', JSON.stringify({ must_change_password: true }));
    api.post.mockRejectedValue({ response: { status: 422, data: { message: 'كلمة المرور الحالية غير صحيحة.' } } });
    mount(); fill(); submit();
    expect(await screen.findByText('كلمة المرور الحالية غير صحيحة.')).toBeVisible();
    expect(screen.getByLabelText(/كلمة المرور الحالية/)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem('user')).must_change_password).toBe(true);
    expect(screen.getByLabelText(/كلمة المرور الحالية/)).toHaveValue(current);
  });
  it('associates backend weak-password validation with the new-password input', async () => {
    api.post.mockRejectedValue({ response: { status: 422, data: { errors: { password: ['Backend rule failure'] } } } });
    mount(); fill(); submit();
    const input = screen.getByLabelText(/^كلمة المرور الجديدة/);
    await waitFor(() => expect(input).toHaveAttribute('aria-invalid', 'true'));
    expect(document.getElementById(input.getAttribute('aria-describedby'))).toHaveTextContent(/12/);
    expect(screen.queryByText('Backend rule failure')).not.toBeInTheDocument();
  });
  it('rejects weak input locally with the existing policy and no request', () => {
    mount(); fill({ password: 'weak', password_confirmation: 'weak' }); submit();
    expect(screen.getByText(/يجب أن لا تقل كلمة المرور عن 12/)).toBeVisible();
    expect(api.post).not.toHaveBeenCalled();
  });
  it('shows a confirmation mismatch on the confirmation field without posting', () => {
    mount(); fill({ password_confirmation: next + 'x' }); submit();
    expect(screen.getByText('كلمة المرور الجديدة وتأكيدها غير متطابقين.')).toBeVisible();
    expect(screen.getByLabelText(/تأكيد كلمة المرور الجديدة/)).toHaveAttribute('aria-invalid', 'true');
    expect(api.post).not.toHaveBeenCalled();
  });
  it('handles backend confirmation validation without exposing raw server errors', async () => {
    api.post.mockRejectedValue({ response: { status: 422, data: { errors: { password_confirmation: ['Raw server detail'] } } } });
    mount(); fill(); submit();
    expect(await screen.findByText('كلمة المرور الجديدة وتأكيدها غير متطابقين.')).toBeVisible();
    expect(screen.queryByText('Raw server detail')).not.toBeInTheDocument();
  });
  it('renders a missing current-password error even on forced form', () => {
    render(<ChangePasswordModal isOpen isForced />);
    fill({ current_password: '' }); submit();
    expect(screen.getByText('يرجى إدخال كلمة المرور الحالية.')).toBeVisible();
    expect(api.post).not.toHaveBeenCalled();
  });
  it('handles backend required-field errors with Arabic field feedback', async () => {
    api.post.mockRejectedValue({ response: { status: 422, data: { errors: { current_password: ['required'] } } } });
    mount(); fill(); submit();
    expect(await screen.findByText('يرجى التحقق من كلمة المرور الحالية.')).toBeVisible();
    expect(onSuccess).not.toHaveBeenCalled();
  });
  it.each([422, 503])('uses a safe fallback for unknown HTTP %i and never logs credentials', async status => {
    const guards = ['log','warn','error'].map(method => vi.spyOn(console, method).mockImplementation(() => {}));
    api.post.mockRejectedValue({ response: { status, data: { message: 'Server internals ' + next } }, config: { data: { password: next, current_password: current } } });
    mount(); fill(); submit();
    expect(await screen.findByText('تعذر تغيير كلمة المرور. حاول مرة أخرى.')).toBeVisible();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
    guards.forEach(guard => expect(guard).not.toHaveBeenCalled());
    expect(screen.queryByText(new RegExp(next))).not.toBeInTheDocument();
  });
  it('keeps network failure distinct from success', async () => {
    api.post.mockRejectedValue(new Error('Offline'));
    mount(); fill(); submit();
    expect(await screen.findByText('تعذر تغيير كلمة المرور. حاول مرة أخرى.')).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
  });
  it('shows genuine success then invokes the existing logout callback once', async () => {
    vi.useFakeTimers(); mount(); fill();
    await act(async () => submit());
    expect(screen.getByRole('status')).toHaveTextContent('تم تغيير كلمة المرور. سجل الدخول بكلمة المرور الجديدة.');
    expect(screen.getByLabelText(/كلمة المرور الحالية/)).toHaveValue('');
    expect(onSuccess).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(1200));
    expect(onSuccess).toHaveBeenCalledTimes(1); expect(onClose).toHaveBeenCalledTimes(1);
  });
  it('does not reject Unicode case, number and symbol characters accepted by backend policy', async () => {
    const unicode = 'Äääääääääää١!';
    mount(); fill({ password: unicode, password_confirmation: unicode }); submit();
    await screen.findByRole('status'); expect(api.post).toHaveBeenCalledTimes(1);
  });
});
