import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Representatives from '../pages/representatives/NeighborhoodRepsPage';
import Delivery from '../pages/delivery/SupportDeliveryPage';
import Sidebar from '../components/layout/Sidebar';
import api from '../api/axios';
import App from '../App';
const { state } = vi.hoisted(() => ({ state: { user: null } }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => state }));
vi.mock('../pages/Dashboard', () => ({ default: () => <p>TEST dashboard</p> }));
vi.mock('../api/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../components/layout/MainLayout', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('../components/overlays/Scrim', () => ({ default: ({ isOpen, children }) => isOpen ? <div>{children}</div> : null }));
function mount(page) { return render(<MemoryRouter initialEntries={['/subject']}><Routes><Route path="/subject" element={page}/><Route path="/dashboard" element={<p>TEST dashboard</p>}/></Routes></MemoryRouter>); }
beforeEach(() => {
  vi.resetAllMocks(); localStorage.clear();
  state.user = { id: 'test-assistant', role: 'assistant_admin', permissions: { representatives: { view: true }, delivery: { view: true }, support: { view: false } } };
  api.get.mockImplementation(url => Promise.resolve({ data: { data: url === '/neighborhood-reps' ? [{id:'rep-1',organization_name:'TEST Organization',status:'active',beneficiaries_count:1}] : url === '/neighborhood-reps/driver-options' ? [{id:'driver-1',full_name:'TEST Driver',role:'driver',is_active:true}] : [] } }));
});
describe('E2E-002 representative dependency', () => {
  it.each(['assistant_admin','admin'])('%s uses scoped driver directory and renders selector', async role => {
    state.user.role=role; mount(<Representatives/>);
    expect(await screen.findByText('TEST Organization')).toBeInTheDocument();
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/neighborhood-reps/driver-options'));
    expect(api.get).not.toHaveBeenCalledWith('/users');
    fireEvent.click(screen.getByRole('button',{name:'توجيه دعم وسلات'}));
    expect(await screen.findByRole('option',{name:'TEST Driver'})).toBeInTheDocument();
  });
  it.each(['no-grant','wrong-role'])('rejects %s before any API request', async reason => {
    if(reason==='no-grant') state.user.permissions.representatives.view=false; else state.user.role='reception';
    mount(<Representatives/>); expect(await screen.findByText('TEST dashboard')).toBeInTheDocument(); expect(api.get).not.toHaveBeenCalled();
  });
});
describe('E2E-003 support visibility', () => {
  it('hides delivery menu without support.view despite delivery.view', () => {
    render(<MemoryRouter><Sidebar isOpen onClose={()=>{}}/></MemoryRouter>);
    expect(screen.queryByRole('link',{name:'إدارة وتوصيل المنازل'})).not.toBeInTheDocument();
  });
  it('rejects direct page entry before support API request', async () => {
    mount(<Delivery/>); expect(await screen.findByText('TEST dashboard')).toBeInTheDocument(); expect(api.get).not.toHaveBeenCalled();
  });
  it.each(['assistant_admin','staff','admin'])('allows %s support page and menu', async role => {
    state.user.role=role;state.user.permissions.support.view=true;
    render(<MemoryRouter><Sidebar isOpen onClose={()=>{}}/></MemoryRouter>);
    expect(screen.getByRole('link',{name:'إدارة وتوصيل المنازل'})).toBeInTheDocument();
    mount(<Delivery/>); expect(await screen.findByRole('heading',{name:'الاستلام المباشر'})).toBeInTheDocument();
    await waitFor(()=>expect(api.get).toHaveBeenCalledWith('/support/distributions', expect.objectContaining({params:expect.objectContaining({fulfillment_method:'pickup'})})));
  });
});

describe('Actual application route guards', () => {
  it.each(['/delivery', '/representatives'])('rejects denied direct %s route before dependent requests', async path => {
    state.user.permissions.representatives.view=false;
    render(<MemoryRouter initialEntries={[path]}><App/></MemoryRouter>);
    expect(await screen.findByText('TEST dashboard')).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalledWith('/support/distributions');
    expect(api.get).not.toHaveBeenCalledWith('/neighborhood-reps/driver-options');
    expect(api.get).not.toHaveBeenCalledWith('/users');
  });
});

// E2E-004: account edit remains behind the existing administrator route guard.
it.each(['readonly','staff','assistant_admin'])('%s cannot mount account administration or request user data',async role=>{
 state.user.role=role;
 render(<MemoryRouter initialEntries={['/admin/users']}><App/></MemoryRouter>);
 expect(await screen.findByText('TEST dashboard')).toBeInTheDocument();
 expect(api.get).not.toHaveBeenCalledWith('/users');
});
