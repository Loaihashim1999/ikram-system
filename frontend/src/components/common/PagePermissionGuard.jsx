import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function PagePermissionGuard({ canAccess, children }) {
  const { user } = useAuth();
  if (!user || user.is_active === false) return <Navigate to="/login" replace />;
  if (['driver', 'delivery_driver'].includes(user.role)) {
    return <main role="alert" dir="rtl">هذه الصفحة غير متاحة لهذا الحساب. استخدم رابط السائق المؤقت.</main>;
  }
  if (canAccess(user)) return children;
  return <Navigate to="/dashboard" replace />;
}
