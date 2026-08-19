import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Home,
  UserPlus,
  Users,
  Briefcase,
  MapPin,
  ShieldCheck,
  Package,
  Truck,
  Settings,
  Shield,
  ScrollText,
  Send,
  FileSpreadsheet,
  QrCode,
  X,
} from 'lucide-react';

export default function Sidebar({ isOpen, onClose }) {
  const location = useLocation();
  const { user: authUser } = useAuth();

  // Retrieve logged in user role dynamically
  const savedUser = JSON.parse(localStorage.getItem('user') || '{}');
  const user = authUser || savedUser;
  const role = user?.role || 'admin';
  const userPerms = user?.permissions;

  let menuItems = [];

  if (role === 'delivery_driver' || role === 'driver') {
    // Driver Role: Only 2 operational pages (Delivery & Receiver)
    menuItems = [
      { path: '/delivery', label: 'إدارة وتوصيل المنازل', icon: Truck },
      { path: '/receiver', label: 'صفحة الاستلام والمسح (QR Scanner)', icon: QrCode },
    ];
  } else if (role === 'assistant_admin') {
    // Assistant Supervisor Role: Operational pages
    menuItems = [
      { path: '/dashboard', label: 'لوحة التحكم', icon: Home },
      { path: '/receiver', label: 'صفحة الاستلام والمسح (الرئيسية)', icon: QrCode },
      { path: '/beneficiaries', label: 'إدارة وقوائم المستفيدين', icon: Users },
      { path: '/warehouse', label: 'المستودع والمخزون', icon: Package },
      { path: '/staff', label: 'إدارة وقوائم الموظفين', icon: Briefcase },
      { path: '/representatives', label: 'مناديب الأحياء', icon: MapPin },
      { path: '/delivery', label: 'إدارة وتوصيل المنازل', icon: Truck },
      { path: '/governance', label: 'الحوكمة والمؤشرات', icon: ShieldCheck },
    ];
  } else {
    // Supervisor (Admin) Role: FULL menu
    menuItems = [
      { path: '/dashboard', label: 'لوحة التحكم', icon: Home },
      { path: '/beneficiaries', label: 'إدارة وقوائم المستفيدين', icon: Users },
      { path: '/warehouse', label: 'المستودع والمخزون', icon: Package },
      { path: '/staff', label: 'إدارة وقوائم الموظفين', icon: Briefcase },
      { path: '/representatives', label: 'مناديب الأحياء', icon: MapPin },
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

  // Dynamic Permissions Checking
  const isPathAllowed = (path) => {
    if (!userPerms || typeof userPerms !== 'object') return true;
    if (role === 'admin' && !userPerms.beneficiaries) return true; // Super admin default

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
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        ></div>
      )}

      <aside
        className={`
          fixed top-0 right-0 h-screen bg-white border-l border-[#E5E2D9] z-50
          w-72 overflow-y-auto
          transition-transform duration-300 ease-in-out
          lg:translate-x-0
          ${isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Header */}
        <div className="p-4 border-b border-[#E5E2D9] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1">
            <h2 className="text-lg font-bold text-[#3F6B3A]">جمعية إكرام</h2>
            <img
              src="/assets/ekram-letterhead.jpeg"
              alt="شعار إكرام"
              className="w-20 h-10 object-contain rounded-md border border-amber-100"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>

          <button
            onClick={onClose}
            className="lg:hidden p-2 rounded-lg hover:bg-[#F7F5F0] text-[#6B6B66]"
          >
            <X size={20} />
          </button>
        </div>

        {/* User Role Badge */}
        <div className="px-4 py-2.5 bg-amber-50/60 border-b border-amber-100 flex items-center justify-between text-xs">
          <span className="font-bold text-gray-700">نوع الحساب:</span>
          <span className={`px-2.5 py-1 rounded-full font-bold text-[11px] border ${
            role === 'admin' ? 'bg-amber-100 text-amber-900 border-amber-300' :
            role === 'assistant_admin' ? 'bg-green-100 text-green-900 border-green-300' :
            'bg-blue-100 text-blue-900 border-blue-300'
          }`}>
            {role === 'admin' ? 'المدير العام (Supervisor)' : role === 'assistant_admin' ? 'مساعد المدير (Assistant)' : 'السائق الميداني (Driver)'}
          </span>
        </div>

        {/* Navigation items */}
        <nav className="p-4 space-y-1 text-right">
          {filteredMenuItems.map((item, index) => (
            <div key={index}>
              {item.children ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-3 px-4 py-2 text-[#6B6B66] font-medium text-xs">
                    <item.icon size={16} />
                    <span>{item.label}</span>
                  </div>
                  {item.children.map((child, childIndex) => (
                    <NavLink
                      key={childIndex}
                      to={child.path}
                      onClick={onClose}
                      className={`flex items-center gap-3 px-6 py-2 rounded-xl transition-all text-xs ${
                        isActive(child.path)
                          ? 'bg-[#F5EDDA] text-[#C9A24A] font-bold border-r-4 border-[#C9A24A]'
                          : 'text-[#6B6B66] hover:bg-[#F7F5F0] hover:text-[#111111]'
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
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all text-xs font-bold ${
                    isActive(item.path)
                      ? 'bg-[#F5EDDA] text-[#C9A24A] font-bold border-r-4 border-[#C9A24A]'
                      : 'text-[#6B6B66] hover:bg-[#F7F5F0] hover:text-[#111111]'
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