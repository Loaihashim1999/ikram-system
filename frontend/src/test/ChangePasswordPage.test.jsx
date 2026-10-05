import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ChangePasswordPage from '../pages/auth/ChangePasswordPage';
import api from '../api/axios';

const { logout } = vi.hoisted(() => ({ logout: vi.fn() }));
vi.mock('../api/axios', () => ({ default: { post: vi.fn() } }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ logout }) }));

function submit() {
  fireEvent.change(screen.getByLabelText('كلمة المرور المؤقتة'), { target: { value: 'TEST-Old!Password123' } });
  fireEvent.change(screen.getByLabelText('كلمة المرور الجديدة'), { target: { value: 'TEST-New!Password456' } });
  fireEvent.change(screen.getByLabelText('تأكيد كلمة المرور الجديدة'), { target: { value: 'TEST-New!Password456' } });
  fireEvent.click(screen.getByRole('button', { name: 'حفظ كلمة المرور وتسجيل الدخول مجدداً' }));
}

describe('Production password-change UI contract', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);
  it('submits the three required fields to the existing API path and logs out only after success', async () => {
    api.post.mockResolvedValue({ data: { message: 'تم تغيير كلمة المرور' } });
    render(<ChangePasswordPage />);
    submit();
    await waitFor(() => expect(logout).toHaveBeenCalledOnce());
    expect(api.post).toHaveBeenCalledWith('/change-password', {
      current_password: 'TEST-Old!Password123', password: 'TEST-New!Password456', password_confirmation: 'TEST-New!Password456',
    });
    expect(screen.getByLabelText('كلمة المرور الجديدة')).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText('كلمة المرور الجديدة')).toHaveAttribute('required');
  });
  it('shows validation feedback and keeps the authenticated flow when the backend rejects', async () => {
    api.post.mockRejectedValue({ response: { status: 422, data: { errors: { password: ['TEST validation feedback'] } } } });
    render(<ChangePasswordPage />);
    submit();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('TEST validation feedback'));
    expect(logout).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'حفظ كلمة المرور وتسجيل الدخول مجدداً' })).toBeEnabled();
  });
});
