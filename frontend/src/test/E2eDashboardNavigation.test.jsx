import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Dashboard from '../pages/Dashboard';
const { state }=vi.hoisted(()=>({state:{user:null}}));
vi.mock('../context/AuthContext',()=>({useAuth:()=>state}));
vi.mock('../api/axios',()=>({default:{get:vi.fn(()=>Promise.resolve({data:{data:[]}}))}}));
vi.mock('../components/layout/MainLayout',()=>({default:({children})=><div>{children}</div>}));
beforeEach(()=>{state.user={role:'assistant_admin',permissions:{delivery:{view:true},support:{view:false}}};});
function mount(){render(<MemoryRouter initialEntries={['/dashboard']}><Routes><Route path="/dashboard" element={<Dashboard/>}/><Route path="/delivery" element={<p>TEST delivery</p>}/></Routes></MemoryRouter>);}
it('hides support navigation cards and disables delivery KPI navigation without support.view',async()=>{
 mount(); await screen.findByText('أقسام وعمليات النظام');
 expect(screen.queryByText('إدارة وتوصيل المنازل')).not.toBeInTheDocument();
 expect(screen.queryByText('الاستلام المباشر')).not.toBeInTheDocument();
 expect(screen.queryByText('إجمالي طلبات التوصيل')).not.toBeInTheDocument();
});
it('retains permitted support dashboard navigation',async()=>{
 state.user.permissions.support.view=true;mount();fireEvent.click(await screen.findByText('التوصيل للمنازل'));expect(await screen.findByText('TEST delivery')).toBeInTheDocument();
});
