import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthProvider, useAuth } from '../context/AuthContext';
import api from '../api/axios';
vi.mock('../api/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
function State() { const a = useAuth(); return <div>{a.loading ? 'loading' : a.user ? 'authenticated' : 'anonymous'}</div>; }
describe('Session resilience', () => {
  beforeEach(() => { vi.clearAllMocks(); localStorage.setItem('token', 'ephemeral-test-placeholder'); localStorage.setItem('user', JSON.stringify({ id: 'test', full_name: 'Test' })); });
  afterEach(cleanup);
  it.each([undefined, 503, 419])('retains authentication after transient error %s', async (status) => {
    api.get.mockRejectedValue({ response: status ? { status } : undefined });
    render(<AuthProvider><State /></AuthProvider>);
    await waitFor(() => expect(screen.getByText('authenticated')).toBeInTheDocument());
    expect(localStorage.getItem('token')).toBeTruthy();
  });
  it('clears a genuinely unauthorized token', async () => {
    api.get.mockRejectedValue({ response: { status: 401 } });
    render(<AuthProvider><State /></AuthProvider>);
    await waitFor(() => expect(screen.getByText('anonymous')).toBeInTheDocument());
    expect(localStorage.getItem('token')).toBeNull();
  });
});
