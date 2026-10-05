import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';

const { authState } = vi.hoisted(() => ({ authState: { user: null } }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => authState }));
vi.mock('../components/overlays/Scrim', () => ({ default: () => null }));

describe('Sidebar route-role filtering', () => {
  beforeEach(() => {
    authState.user = null;
    localStorage.clear();
  });

  it.each([
    ['reception', ['/dashboard', '/beneficiaries', '/daily-beneficiaries'], ['/warehouse', '/staff', '/representatives', '/receiver', '/delivery', '/governance', '/audit', '/admin/users', '/admin/settings']],
    ['staff', ['/dashboard', '/beneficiaries', '/daily-beneficiaries', '/warehouse', '/representatives', '/receiver', '/delivery'], ['/staff', '/governance', '/audit', '/admin/users', '/admin/settings']],
    ['warehouse', ['/dashboard', '/warehouse'], ['/beneficiaries', '/daily-beneficiaries', '/staff', '/representatives', '/receiver', '/delivery', '/governance', '/audit', '/admin/users', '/admin/settings']],
    ['readonly', ['/dashboard', '/beneficiaries', '/daily-beneficiaries', '/warehouse'], ['/staff', '/representatives', '/receiver', '/delivery', '/governance', '/audit', '/admin/users', '/admin/settings']],
    ['driver', [], ['/delivery', '/receiver', '/dashboard', '/beneficiaries', '/warehouse']],
    ['delivery_driver', [], ['/delivery', '/receiver', '/dashboard', '/beneficiaries', '/warehouse']],
  ])('%s sees route-permitted links and no links rejected by its route guard', (role, allowed, denied) => {
    authState.user = { id: `user-${role}`, role, permissions: { support: { view: role === 'staff' } } };
    render(<MemoryRouter><Sidebar isOpen onClose={() => {}} /></MemoryRouter>);
    const links = screen.queryAllByRole('link').map(link => link.getAttribute('href'));
    for (const path of allowed) expect(links).toContain(path);
    for (const path of denied) expect(links).not.toContain(path);
  });
});
