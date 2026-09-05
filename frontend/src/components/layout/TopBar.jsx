import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { useNavigate } from 'react-router-dom';
import { Bell, LogOut, User, Menu, KeyRound, ChevronDown } from 'lucide-react';
import NotificationCenter from './NotificationCenter';
import ChangePasswordModal from '../common/ChangePasswordModal';
import logoImg from '../../assets/logo.png';


export default function TopBar({ onMenuClick }) {
  const { user: authUser, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();

  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

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
    <>
      <header className="h-16 bg-white border-b border-[#E5E2D9] fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 lg:px-6 lg:right-72 shadow-2xs" dir="rtl">
        {/* Right side: Mobile Menu button + Brand Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-xl hover:bg-[#FAF8F5] text-[#111827] border border-[#E5E2D9]"
            aria-label="فتح القائمة الرئيسية"
          >
            <Menu size={22} />
          </button>

          <div className="flex items-center gap-2">
            <img
              src={logoImg}
              alt="شعار جمعية إكرام"
              className="h-8 w-auto object-contain"
            />
            <h1 className="text-xs sm:text-sm font-extrabold text-[#111827]">
              جمعية إكرام — <span className="text-[#3F6B3A]">نظام إدارة المستفيدين والخدمات الميدانية</span>
            </h1>
          </div>


        </div>

        {/* Left side: Notifications, User profile & Actions */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Notification Bell with Badge */}
          <div className="relative">
            <button
              onClick={() => setIsNotifOpen(!isNotifOpen)}
              className="relative p-2.5 rounded-xl text-[#1F2937] hover:bg-[#FAF8F5] hover:text-[#C9A24A] transition-colors border border-[#E5E2D9] cursor-pointer"
              title="التنبيهات والإشعارات"
              aria-label="التنبيهات والإشعارات"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#D97706] text-white text-[10px] font-extrabold w-5 h-5 rounded-full flex items-center justify-center shadow-xs border-2 border-white animate-pulse">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
          </div>

          {/* User Profile & Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-2 sm:gap-3 pr-2 sm:pr-3 border-r border-[#E5E2D9] hover:opacity-90 cursor-pointer"
            >
              <div className="w-9 h-9 bg-[#C9A24A] rounded-xl flex items-center justify-center text-white shadow-xs font-bold">
                <User size={18} />
              </div>
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-[#111827]">{user?.full_name || user?.name || user?.username || 'مستخدم النظام'}</p>
                <p className="text-[10px] font-bold text-[#D97706]">
                  {getRoleLabel(role)}
                </p>
              </div>
              <ChevronDown size={14} className="text-gray-400 hidden sm:block" />
            </button>

            {/* Profile Dropdown Menu */}
            {isUserMenuOpen && (
              <div
                className="absolute left-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-[#E5E2D9] py-1.5 z-40 text-xs text-right"
                onClick={() => setIsUserMenuOpen(false)}
              >
                <div className="px-3.5 py-2 border-b border-[#E5E2D9] sm:hidden">
                  <p className="font-bold text-[#111827]">{user?.full_name || user?.username}</p>
                  <p className="text-[10px] text-[#D97706]">{getRoleLabel(role)}</p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(true)}
                  className="w-full px-3.5 py-2 hover:bg-[#FAF8F5] text-[#1F2937] flex items-center gap-2 font-medium transition-colors"
                >
                  <KeyRound size={15} className="text-[#C9A24A]" />
                  <span>تغيير كلمة المرور</span>
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full px-3.5 py-2 hover:bg-red-50 text-[#C24B3F] flex items-center gap-2 font-bold transition-colors border-t border-gray-100"
                >
                  <LogOut size={15} />
                  <span>تسجيل الخروج</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Centralized Notification Center Component */}
      <NotificationCenter isOpen={isNotifOpen} onClose={() => setIsNotifOpen(false)} />

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        isForced={false}
      />
    </>
  );
}