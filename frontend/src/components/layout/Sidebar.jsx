import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { canViewSupport, canViewRepresentatives, hasModuleAction } from '../../utils/modulePermissions';
import Scrim from '../overlays/Scrim';
import logoImg from '../../assets/logo.png';
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
  UserCheck,
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
      { path: '/receiver', label: 'الاستلام المباشر', icon: Truck },
    ];
  } else if (role === 'assistant_admin') {
    menuItems = [
      { path: '/dashboard', label: 'لوحة التحكم', icon: Home },
      { path: '/receiver', label: 'الاستلام المباشر', icon: Truck },
      { path: '/beneficiaries', label: 'إدارة وقوائم المستفيدين', icon: Users },
      { path: '/daily-beneficiaries', label: 'المستفيدون اليوميون', icon: UserCheck },
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
      { path: '/daily-beneficiaries', label: 'المستفيدون اليوميون', icon: UserCheck },
      { path: '/warehouse', label: 'المستودع والمخزون', icon: Package },
      { path: '/staff', label: 'إدارة وقوائم الموظفين', icon: Briefcase },
      { path: '/representatives', label: 'إدارة الجهات المستفيدة', icon: Building2 },
      { path: '/receiver', label: 'الاستلام المباشر', icon: Truck },
      { path: '/delivery', label: 'إدارة وتوصيل المنازل', icon: Truck },
      { path: '/admin/drivers', label: 'إدارة السائقين', icon: Truck },
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
    if (path.startsWith('/delivery') || path.startsWith('/support-delivery') || path.startsWith('/receiver')) return canViewSupport(user);
    if (path.startsWith('/representatives')) return canViewRepresentatives(user);
    if (path.startsWith('/governance')) return hasModuleAction(user, 'governance', 'view');
    const routeRoles = [
      ['/support-delivery', ['admin', 'assistant_admin', 'staff']],
      ['/dashboard', ['admin', 'assistant_admin', 'reception', 'staff', 'warehouse', 'readonly']],
      ['/beneficiaries', ['admin', 'assistant_admin', 'reception', 'staff', 'readonly']],
      ['/daily-beneficiaries', ['admin', 'assistant_admin', 'reception', 'staff', 'readonly']],
      ['/representatives', ['admin', 'assistant_admin', 'staff']],
      ['/staff', ['admin', 'assistant_admin']],
      ['/warehouse', ['admin', 'assistant_admin', 'warehouse', 'staff', 'readonly']],
      ['/delivery', ['admin', 'assistant_admin', 'staff', 'delivery_driver', 'driver']],
      ['/statistics', ['admin', 'assistant_admin', 'readonly']],
      ['/audit', ['admin']],
      ['/admin', ['admin']],
    ];
    const routeRule = routeRoles.find(([base]) => path === base || path.startsWith(`${base}/`));
    if (routeRule && !routeRule[1].includes(role)) return false;

    if (!userPerms || typeof userPerms !== 'object') return true;
    if (role === 'admin' && !userPerms.beneficiaries) return true;

    if (path.startsWith('/beneficiaries')) return userPerms.beneficiaries?.view !== false;
    if (path.startsWith('/daily-beneficiaries')) return userPerms.daily_beneficiaries?.view !== false;
    if (path.startsWith('/warehouse')) return userPerms.warehouse?.view !== false;
    if (path.startsWith('/staff')) return userPerms.staff?.view !== false;
    if (path.startsWith('/representatives')) return userPerms.representatives?.view !== false;
    if (path.startsWith('/delivery')) return userPerms.delivery?.view !== false;
    if (path.startsWith('/support-delivery')) return role === 'admin' || userPerms.support?.view === true;
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

  const isActive = (path) => location.pathname === path || (path !== '/dashboard' && location.pathname.startsWith(`${path}/`));

  return (
    <>
      {/* Mobile Scrim / Backdrop */}
      <Scrim isOpen={isOpen} onClose={onClose} zIndex="z-40" className="lg:hidden" />

      <aside
        className={`
          ikram-sidebar fixed top-0 right-0 h-screen z-50
          w-72 overflow-y-auto
          transition-transform duration-300 ease-in-out
          lg:translate-x-0
          ${isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
        `}
        style={{ width: '288px' }}
        dir="rtl"
      >
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 flex-1">
            <img
              src={logoImg}
              alt="شعار جمعية إكرام"
              className="h-10 w-auto object-contain"
            />
            <div>
              <h2 className="text-sm font-extrabold leading-tight">جمعية إكرام</h2>
              <p className="text-[11px] text-white/75">لخدمة ضيوف الرحمن</p>
            </div>
          </div>


          <button
            onClick={onClose}
            className="lg:hidden p-2 rounded-xl hover:bg-white/10 text-white cursor-pointer"
            aria-label="إغلاق القائمة"
          >
            <X size={20} />
          </button>
        </div>


        {/* User Role Badge */}
        <div className="px-4 py-2.5 bg-white/5 border-b border-white/10 flex items-center justify-between text-xs">
          <span className="font-bold">نوع الحساب:</span>
          <span className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] border ${
            role === 'admin' ? 'bg-amber-100 text-amber-900 border-amber-300' :
            role === 'assistant_admin' ? 'bg-green-100 text-green-900 border-green-300' :
            'bg-blue-100 text-blue-900 border-blue-300'
          }`}>
            {role === 'admin' ? 'المدير العام' : role === 'assistant_admin' ? 'مساعد المدير' : 'السائق الميداني'}
          </span>
        </div>

        {/* Navigation items */}
        <nav className="ikram-nav p-3 space-y-1 text-right" aria-label="التنقل الرئيسي">
          {filteredMenuItems.map((item, index) => (
            <div key={index}>
              {item.children ? (
                <div className="space-y-1 pt-1">
                  <div className="flex items-center gap-2.5 px-3 py-2 text-white/70 font-bold text-xs">
                    <item.icon size={16} />
                    <span>{item.label}</span>
                  </div>
                  {item.children.map((child, childIndex) => (
                    <NavLink
                      key={childIndex}
                      to={child.path}
                      onClick={onClose}
                      className="flex items-center gap-2.5 px-6 py-2 text-xs font-bold"
                    >
                      <child.icon size={18} />
                      <span>{child.label}</span>
                    </NavLink>
                  ))}
                </div>
              ) : (
                <NavLink
                  to={item.path}
                  onClick={onClose}
                  className="flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-bold"
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
