import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import Users from '../pages/admin/Users';
import Dialog from '../components/overlays/Dialog';
import api from '../api/axios';
vi.mock('../api/axios', () => ({ default: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }));
vi.mock('../components/layout/MainLayout', () => ({ default: ({ children }) => <main>{children}</main> }));
let record; let consoleGuard;
beforeEach(() => {
 vi.resetAllMocks(); localStorage.clear();
 record={id:'test-user',username:'EKRAM-E2E-TEST-STAFF',full_name:'EKRAM-E2E-TEST STAFF',email:'test@example.invalid',phone:'0500000000',role:'assistant_admin',is_active:true,must_change_password:false,permissions:{support:{view:false},representatives:{view:true}}};
 api.get.mockImplementation(()=>Promise.resolve({data:{data:[{...record}]}}));
 api.put.mockImplementation(async (url,payload)=>{record={...record,...payload};return {data:{data:record}};});
 consoleGuard=vi.spyOn(console,'error').mockImplementation(()=>{});
});
afterEach(()=>consoleGuard.mockRestore());
function mount(){return render(<MemoryRouter><Users/></MemoryRouter>);}
async function edit(user){mount();await user.click(await screen.findByRole('button',{name:'تعديل',exact:true}));return screen.getByRole('dialog');}
it.each([
 ['مثال: عمر بن خالد السلمي','اختبار عربي English 123'],
 ['name@example.com','continuous.account@example.invalid'],
 ['05XXXXXXXX','0574917155'],
])('keeps the actual edit field %s focused through one continuous multi-character action',async(placeholder,value)=>{
 const user=userEvent.setup();await edit(user);const input=screen.getByPlaceholderText(placeholder);await user.clear(input);await user.type(input,value);
 expect(input).toHaveValue(value);expect(input).toHaveFocus();expect(screen.getByPlaceholderText(placeholder)).toBe(input);expect(api.put).not.toHaveBeenCalled();expect(api.get).toHaveBeenCalledTimes(1);
});
it('preserves cursor editing, continuous Backspace, selection, paste, Tab and Shift+Tab',async()=>{
 const user=userEvent.setup();await edit(user);const input=screen.getByPlaceholderText('مثال: عمر بن خالد السلمي');await user.clear(input);await user.type(input,'English123');await user.keyboard('{Backspace}{Backspace}{Backspace}');expect(input).toHaveValue('English');
 await user.keyboard('{Home}{ArrowRight}X');expect(input).toHaveValue('EXnglish');
 await user.keyboard('{Control>}a{/Control}');await user.paste('اسم عربي 123');expect(input).toHaveValue('اسم عربي 123');expect(input).toHaveFocus();
 await user.tab();expect(screen.getByPlaceholderText('05XXXXXXXX')).toHaveFocus();await user.tab();expect(screen.getByPlaceholderText('name@example.com')).toHaveFocus();await user.tab({shift:true});expect(screen.getByPlaceholderText('05XXXXXXXX')).toHaveFocus();
});
it('keeps username read-only in edit and supports continuous username entry in the creation form',async()=>{
 const user=userEvent.setup();await edit(user);expect(screen.getByPlaceholderText('مثال: assistant_omar')).toBeDisabled();await user.click(screen.getByRole('button',{name:'إلغاء',exact:true}));await user.click(screen.getByRole('button',{name:'إنشاء حساب مستخدم جديد'}));const input=screen.getByPlaceholderText('مثال: assistant_omar');await user.type(input,'EKRAM-E2E-TEST-USERNAME123');expect(input).toHaveValue('EKRAM-E2E-TEST-USERNAME123');expect(input).toHaveFocus();expect(api.post).not.toHaveBeenCalled();
});
it('saves exactly once and retains values when refreshed and reopened without changing account security fields',async()=>{
 const user=userEvent.setup();const dialog=await edit(user);const input=screen.getByPlaceholderText('مثال: عمر بن خالد السلمي');await user.clear(input);await user.type(input,'EKRAM-E2E-TEST اسم كامل');const email=screen.getByPlaceholderText('name@example.com');await user.clear(email);await user.type(email,'updated@example.invalid');await user.click(within(dialog).getByRole('button',{name:'حفظ التعديلات والتصاريح'}));await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());expect(api.put).toHaveBeenCalledTimes(1);expect(api.put.mock.calls[0][1]).not.toHaveProperty('password');expect(record.role).toBe('assistant_admin');expect(record.phone).toBe('0500000000');expect(record.username).toBe('EKRAM-E2E-TEST-STAFF');expect(record.permissions.support.view).toBe(false);expect(record.must_change_password).toBe(false);await user.click(await screen.findByRole('button',{name:'تعديل',exact:true}));expect(screen.getByPlaceholderText('مثال: عمر بن خالد السلمي')).toHaveValue('EKRAM-E2E-TEST اسم كامل');expect(screen.getByPlaceholderText('name@example.com')).toHaveValue('updated@example.invalid');
});
it('retains typed and unrelated values after server validation fails',async()=>{
 api.put.mockRejectedValue({response:{status:422,data:{message:'TEST validation failed'}}});const user=userEvent.setup();await edit(user);const input=screen.getByPlaceholderText('مثال: عمر بن خالد السلمي');await user.clear(input);await user.type(input,'EKRAM-E2E-TEST typed');await user.click(screen.getByRole('button',{name:'حفظ التعديلات والتصاريح'}));await waitFor(()=>expect(api.put).toHaveBeenCalledTimes(1));expect(screen.getByRole('dialog')).toBeInTheDocument();expect(input).toHaveValue('EKRAM-E2E-TEST typed');expect(screen.getByPlaceholderText('name@example.com')).toHaveValue('test@example.invalid');expect(screen.getByPlaceholderText('05XXXXXXXX')).toHaveValue('0500000000');
});
it('uses the latest close callback without reinitializing focus when the dialog rerenders',async()=>{
 const user=userEvent.setup();const oldClose=vi.fn();const newClose=vi.fn();const view=render(<Dialog isOpen onClose={oldClose} title="TEST"><input aria-label="TEST input"/></Dialog>);expect(screen.getByRole('button',{name:'إغلاق',exact:true})).toBeInTheDocument();const input=screen.getByLabelText('TEST input');await user.click(input);view.rerender(<Dialog isOpen onClose={newClose} title="TEST"><input aria-label="TEST input"/></Dialog>);expect(input).toHaveFocus();await user.keyboard('{Escape}');expect(oldClose).not.toHaveBeenCalled();expect(newClose).toHaveBeenCalled();
});
