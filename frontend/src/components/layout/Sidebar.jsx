import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Scrim from '../overlays/Scrim';
import {
  Home,
  Users,
  Briefcase,
  Building2,
  ShieldCheck,
  Package,
  Truck,
  Settings,
  Shield,
  ScrollText,
  QrCode,
  X,
} from 'lucide-react';

export default function Sidebar({ isOpen, onClose }) {
  const location = useLocation();
  const { user: authUser } = useAuth();

  const savedUser = JSON.parse(localStorage.getItem('user') || '{}');
  const user = authUser || savedUser;
  const role = user?.role || 'admin';
  const userPerms = user?.permissions;

  let menuItems = [];

  if (role === 'delivery_driver' || role === 'driver') {
    menuItems = [
      { path: '/delivery', label: 'إدارة وتوصيل المنازل', icon: Truck },
      { path: '/receiver', label: 'صفحة الاستلام والمسح (QR Scanner)', icon: QrCode },
    ];
  } else if (role === 'assistant_admin') {
    menuItems = [
      { path: '/dashboard', label: 'لوحة التحكم', icon: Home },
      { path: '/receiver', label: 'صفحة الاستلام والمسح', icon: QrCode },
      { path: '/beneficiaries', label: 'إدارة وقوائم المستفيدين', icon: Users },
      { path: '/warehouse', label: 'المستودع والمخزون', icon: Package },
      { path: '/staff', label: 'إدارة وقوائم الموظفين', icon: Briefcase },
      { path: '/representatives', label: 'إدارة الجهات المستفيدة', icon: Building2 },
      { path: '/delivery', label: 'إدارة وتوصيل المنازل', icon: Truck },
      { path: '/governance', label: 'الحوكمة والمؤشرات', icon: ShieldCheck },
    ];
  } else {
    menuItems = [
      { path: '/dashboard', label: 'لوحة التحكم', icon: Home },
      { path: '/beneficiaries', label: 'إدارة وقوائم المستفيدين', icon: Users },
      { path: '/warehouse', label: 'المستودع والمخزون', icon: Package },
      { path: '/staff', label: 'إدارة وقوائم الموظفين', icon: Briefcase },
      { path: '/representatives', label: 'إدارة الجهات المستفيدة', icon: Building2 },
      { path: '/receiver', label: 'صفحة الاستلام والمسح', icon: QrCode },
      { path: '/delivery', label: 'إدارة وتوصيل المنازل', icon: Truck },
      { path: '/governance', label: 'الحوكمة والمؤشرات', icon: ShieldCheck },
      { path: '/audit', label: 'سجل التدقيق والوثائق', icon: ScrollText },
      {
        label: 'إدارة النظام والحسابات',
        icon: Settings,
        children: [
          { path: '/admin/users', label: 'إدارة الحسابات والصلاحيات', icon: Shield },
          { path: '/admin/settings', label: 'إعدادات النظام المالية', icon: Settings },
        ],
      },
    ];
  }

  const isPathAllowed = (path) => {
    if (!userPerms || typeof userPerms !== 'object') return true;
    if (role === 'admin' && !userPerms.beneficiaries) return true;

    if (path.startsWith('/beneficiaries')) return userPerms.beneficiaries?.view !== false;
    if (path.startsWith('/warehouse')) return userPerms.warehouse?.view !== false;
    if (path.startsWith('/staff')) return userPerms.staff?.view !== false;
    if (path.startsWith('/representatives')) return userPerms.representatives?.view !== false;
    if (path.startsWith('/delivery')) return userPerms.delivery?.view !== false;
    if (path.startsWith('/receiver')) return userPerms.receiver?.view !== false;
    if (path.startsWith('/governance')) return userPerms.governance?.view !== false;
    if (path.startsWith('/audit')) return userPerms.audit?.view !== false;
    if (path.startsWith('/admin')) return userPerms.settings?.view !== false;

    return true;
  };

  const filteredMenuItems = menuItems.map((item) => {
    if (item.children) {
      const allowedChildren = item.children.filter((c) => isPathAllowed(c.path));
      if (allowedChildren.length === 0) return null;
      return { ...item, children: allowedChildren };
    }
    if (!isPathAllowed(item.path)) return null;
    return item;
  }).filter(Boolean);

  const isActive = (path) => location.pathname === path;

  return (
    <>
      {/* Mobile Scrim / Backdrop */}
      <Scrim isOpen={isOpen} onClose={onClose} zIndex="z-40" className="lg:hidden" />

      <aside
        className={`
          fixed top-0 right-0 h-screen bg-white border-l border-[#E5E2D9] z-50
          w-72 overflow-y-auto
          transition-transform duration-300 ease-in-out
          lg:translate-x-0
          ${isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
        `}
        style={{ width: '288px' }}
        dir="rtl"
      >
        {/* Header */}
        <div className="p-4 border-b border-[#E5E2D9] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1">
            <div className="w-8 h-8 rounded-xl bg-[#3F6B3A] flex items-center justify-center text-white font-extrabold text-sm">
              إ
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#3F6B3A] leading-tight">جمعية إكرام</h2>
              <p className="text-[10px] text-[#6B7280]">لخدمة ضيوف الرحمن</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="lg:hidden p-2 rounded-xl hover:bg-[#FAF8F5] text-[#111827] cursor-pointer"
            aria-label="إغلاق القائمة"
          >
            <X size={20} />
          </button>
        </div>

        {/* User Role Badge */}
        <div className="px-4 py-2.5 bg-[#FAF8F5] border-b border-[#E5E2D9] flex items-center justify-between text-xs">
          <span className="font-bold text-[#4B5563]">نوع الحساب:</span>
          <span className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] border ${
            role === 'admin' ? 'bg-amber-100 text-amber-900 border-amber-300' :
            role === 'assistant_admin' ? 'bg-green-100 text-green-900 border-green-300' :
            'bg-blue-100 text-blue-900 border-blue-300'
          }`}>
            {role === 'admin' ? 'المدير العام' : role === 'assistant_admin' ? 'مساعد المدير' : 'السائق الميداني'}
          </span>
        </div>

        {/* Navigation items */}
        <nav className="p-3 space-y-1 text-right">
          {filteredMenuItems.map((item, index) => (
            <div key={index}>
              {item.children ? (
                <div className="space-y-1 pt-1">
                  <div className="flex items-center gap-2.5 px-3 py-2 text-[#6B7280] font-bold text-xs">
                    <item.icon size={16} />
                    <span>{item.label}</span>
                  </div>
                  {item.children.map((child, childIndex) => (
                    <NavLink
                      key={childIndex}
                      to={child.path}
                      onClick={onClose}
                      className={`flex items-center gap-2.5 px-6 py-2 rounded-xl transition-all text-xs font-bold ${
                        isActive(child.path)
                          ? 'bg-[#FAF8F5] text-[#C9A24A] font-extrabold border-r-4 border-[#C9A24A]'
                          : 'text-[#4B5563] hover:bg-[#FAF8F5] hover:text-[#111827]'
                      }`}
                    >
                      <child.icon size={15} />
                      <span>{child.label}</span>
                    </NavLink>
                  ))}
                </div>
              ) : (
                <NavLink
                  to={item.path}
                  onClick={onClose}
                  className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl transition-all text-xs font-bold ${
                    isActive(item.path)
                      ? 'bg-[#FAF8F5] text-[#C9A24A] font-extrabold border-r-4 border-[#C9A24A]'
                      : 'text-[#4B5563] hover:bg-[#FAF8F5] hover:text-[#111827]'
                  }`}
                >
                  <item.icon size={18} />
                  <span>{item.label}</span>
                </NavLink>
              )}
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}