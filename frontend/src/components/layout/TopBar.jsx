import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Bell, LogOut, User, Menu } from 'lucide-react';

export default function TopBar({ onMenuClick }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="h-16 bg-white border-b border-[#E5E2D9] fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 lg:px-6 lg:right-72">
      {/* القسم الأيمن - زر القائمة للهاتف + عنوان الصفحة */}
      <div className="flex items-center gap-4">
        {/* زر القائمة (يظهر فقط على الهاتف) */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg hover:bg-[#F7F5F0] text-[#6B6B66]"
        >
          <Menu size={24} />
        </button>

        <h1 className="text-lg font-medium text-[#6B6B66]">
          لوحة التحكم
        </h1>
      </div>

      {/* القسم الأيسر - المستخدم والإشعارات */}
      <div className="flex items-center gap-2 lg:gap-4">
        {/* أيقونة الإشعارات */}
        <button className="relative p-2 rounded-lg hover:bg-[#F7F5F0] transition-colors">
          <Bell size={20} className="text-[#6B6B66]" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-[#C24B3F] rounded-full"></span>
        </button>

        {/* معلومات المستخدم */}
        <div className="flex items-center gap-3 pr-2 lg:pr-4 border-r border-[#E5E2D9]">
          <div className="w-9 h-9 bg-[#C9A24A] rounded-full flex items-center justify-center text-white">
            <User size={18} />
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-[#111111]">{user?.full_name}</p>
            <p className="text-xs text-[#6B6B66]">
              {user?.role === 'admin' ? 'مدير النظام' : user?.role === 'staff' ? 'موظف إداري' : 'موظف استقبال'}
            </p>
          </div>
        </div>

        {/* زر تسجيل الخروج */}
        <button
          onClick={handleLogout}
          className="p-2 rounded-lg hover:bg-[#FCE8E6] text-[#C24B3F] transition-colors"
          title="تسجيل الخروج"
        >
          <LogOut size={20} />
        </button>
      </div>
    </header>
  );
}