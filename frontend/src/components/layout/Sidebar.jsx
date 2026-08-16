import { NavLink, useLocation } from 'react-router-dom';
import {
  Home,
  UserPlus,
  Users,
  Briefcase,
  MapPin,
  BarChart3,
  Package,
  Truck,
  Settings,
  Shield,
  ScrollText,
  Send,
  FileSpreadsheet,
  X,
} from 'lucide-react';

export default function Sidebar({ isOpen, onClose }) {
  const location = useLocation();

  const menuItems = [
    { path: '/dashboard', label: 'لوحة التحكم', icon: Home },
    {
      label: 'المستفيدون',
      icon: Users,
      children: [
        { path: '/beneficiaries/add-citizen', label: 'إضافة مواطن', icon: UserPlus },
        { path: '/beneficiaries/add-resident', label: 'إضافة مقيم', icon: UserPlus },
        { path: '/beneficiaries', label: 'قائمة المستفيدين', icon: Users },
        { path: '/beneficiaries/import', label: 'استيراد مستفيدين (Excel)', icon: FileSpreadsheet },
      ],
    },
    { path: '/send-support', label: 'تقديم الدعم', icon: Send },
    { path: '/warehouse', label: 'المستودع', icon: Package },
    {
      label: 'الموظفون',
      icon: Briefcase,
      children: [
        { path: '/staff', label: 'قائمة الموظفين', icon: Briefcase },
        { path: '/staff/add', label: 'إضافة موظف', icon: UserPlus },
        { path: '/staff/import', label: 'استيراد موظفين (Excel)', icon: FileSpreadsheet },
      ],
    },
    { path: '/representatives', label: 'مناديب الأحياء', icon: MapPin },
    { path: '/delivery', label: 'إدارة التوصيل', icon: Truck },
    { path: '/statistics', label: 'الإحصائيات', icon: BarChart3 },
    {
      label: 'الإدارة',
      icon: Settings,
      children: [
        { path: '/admin/users', label: 'المستخدمون', icon: Shield },
        { path: '/admin/audit-logs', label: 'سجل التدقيق', icon: ScrollText },
        { path: '/admin/settings', label: 'إعدادات النظام', icon: Settings },
      ],
    },
  ];

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
            <h2 className="text-lg font-bold text-[#546027]">نظام إكرام</h2>
            <img
              src={`${import.meta.env.BASE_URL}1.png`}
              alt="شعار إكرام"
              className="w-24 h-10 object-contain"
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

        {/* Navigation items */}
        <nav className="p-4 space-y-2">
          {menuItems.map((item, index) => (
            <div key={index}>
              {item.children ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-3 px-4 py-2 text-[#6B6B66] font-medium text-sm">
                    <item.icon size={18} />
                    <span>{item.label}</span>
                  </div>
                  {item.children.map((child, childIndex) => (
                    <NavLink
                      key={childIndex}
                      to={child.path}
                      onClick={onClose}
                      className={`flex items-center gap-3 px-6 py-2 rounded-lg transition-all text-xs ${
                        isActive(child.path)
                          ? 'bg-[#F5EDDA] text-[#C9A24A] font-bold border-r-4 border-[#C9A24A]'
                          : 'text-[#6B6B66] hover:bg-[#F7F5F0] hover:text-[#111111]'
                      }`}
                    >
                      <child.icon size={16} />
                      <span>{child.label}</span>
                    </NavLink>
                  ))}
                </div>
              ) : (
                <NavLink
                  to={item.path}
                  onClick={onClose}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all text-sm ${
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