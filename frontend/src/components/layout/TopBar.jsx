import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Bell, LogOut, User, Menu } from 'lucide-react';

export default function TopBar({ onMenuClick }) {
  const { user: authUser, logout } = useAuth();
  const navigate = useNavigate();

  const savedUser = JSON.parse(localStorage.getItem('user') || '{}');
  const user = authUser || savedUser;
  const role = user?.role || 'admin';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getRoleLabel = (r) => {
    switch (r) {
      case 'admin':
        return 'المدير العام (Supervisor)';
      case 'assistant_admin':
        return 'مساعد / نائب المدير (Assistant)';
      case 'delivery_driver':
      case 'driver':
        return 'السائق الميداني (Driver)';
      case 'staff':
        return 'موظف دراسة حالات';
      default:
        return 'موظف إداري';
    }
  };

  return (
    <header className="h-16 bg-white border-b border-[#E5E2D9] fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 lg:px-6 lg:right-72" dir="rtl">
      {/* Right side: Mobile Menu button + Title */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg hover:bg-[#F7F5F0] text-[#6B6B66]"
        >
          <Menu size={24} />
        </button>

        <h1 className="text-sm font-bold text-[#6B6B66]">
          جمعية إكرام - نظام إدارة المستفيدين
        </h1>
      </div>

      {/* Left side: User profile & Logout */}
      <div className="flex items-center gap-2 lg:gap-4">
        <div className="flex items-center gap-3 pr-2 lg:pr-4 border-r border-[#E5E2D9]">
          <div className="w-9 h-9 bg-[#C9A24A] rounded-full flex items-center justify-center text-white shadow-sm font-bold">
            <User size={18} />
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-[#111111]">{user?.full_name || user?.name || user?.username}</p>
            <p className="text-[11px] font-bold text-amber-700">
              {getRoleLabel(role)}
            </p>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="p-2 rounded-lg hover:bg-[#FCE8E6] text-[#C24B3F] transition-colors flex items-center gap-1 text-xs font-bold"
          title="تسجيل الخروج"
        >
          <LogOut size={18} />
          <span className="hidden md:inline">خروج</span>
        </button>
      </div>
    </header>
  );
}