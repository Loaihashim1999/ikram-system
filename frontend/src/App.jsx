import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

// Auth
import LoginPage from './pages/auth/LoginPage';

// Layout & Dashboard
import Dashboard from './pages/Dashboard';

// Beneficiaries
import AddBeneficiaryPage    from './pages/beneficiaries/AddBeneficiaryPage';
import BeneficiaryList       from './pages/beneficiaries/BeneficiaryList';
import BeneficiaryDetails    from './pages/beneficiaries/BeneficiaryDetails';
import EditBeneficiaryPage   from './pages/beneficiaries/EditBeneficiaryPage';
import BeneficiaryImportPage from './pages/beneficiaries/BeneficiaryImportPage';

// Staff
import StaffListPage    from './pages/staff/StaffListPage';
import StaffDetailsPage from './pages/staff/StaffDetailsPage';
import AddStaffPage     from './pages/staff/AddStaffPage';
import EditStaffPage    from './pages/staff/EditStaffPage';
import StaffImportPage   from './pages/staff/StaffImportPage';

// Warehouse / Inventory
import Warehouse from './pages/warehouse/Warehouse';

// Support Submission & Delivery
import SendSupportPage from './pages/delivery/SendSupportPage';
import DeliveryPage from './pages/delivery/DeliveryPage';
import DriverDashboard from './pages/delivery/DriverDashboard';

// Neighborhood Representatives
import NeighborhoodRepsPage from './pages/representatives/NeighborhoodRepsPage';

// Receiver Page (QR Scanner)
import ReceiverPage from './pages/receiver/ReceiverPage';

// Governance (formerly Statistics)
import GovernancePage from './pages/governance/GovernancePage';

// Audit & Logs
import AuditPage from './pages/audit/AuditPage';

// Admin & Settings
import SystemSettingsPage from './pages/admin/SystemSettingsPage';
import UsersPage from './pages/admin/Users';
import AssistantAdminDashboard from './pages/admin/AssistantAdminDashboard';

function App() {
  const { user: authUser, loading } = useAuth();

  const savedUser = JSON.parse(localStorage.getItem('user') || '{}');
  const user = authUser || (savedUser.id ? savedUser : null);
  const role = user?.role || 'admin';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F5F0]">
        <div className="w-12 h-12 border-4 border-[#C9A24A] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Guard enforcing login and role permissions
  const Guard = ({ element, allowedRoles = [] }) => {
    if (!user) return <Navigate to="/login" replace />;

    // Drivers restricted to /delivery and /receiver ONLY
    if ((role === 'delivery_driver' || role === 'driver') && !['delivery_driver', 'driver'].includes(role)) {
      return <Navigate to="/delivery" replace />;
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(role) && role !== 'admin') {
      // Redirect assistant supervisor if trying to access admin pages
      return <Navigate to="/dashboard" replace />;
    }

    return element;
  };

  // Determine initial landing page after login based on role
  const getHomePath = () => {
    if (role === 'delivery_driver' || role === 'driver') return '/delivery';
    if (role === 'assistant_admin') return '/receiver';
    return '/dashboard';
  };

  return (
    <Routes>
      {/* Auth */}
      <Route path="/login" element={!user ? <LoginPage /> : <Navigate to={getHomePath()} replace />} />

      {/* Dashboard */}
      <Route path="/dashboard" element={<Guard allowedRoles={['admin', 'assistant_admin']} element={<Dashboard />} />} />

      {/* Beneficiaries */}
      <Route path="/beneficiaries"              element={<Guard allowedRoles={['admin', 'assistant_admin']} element={<BeneficiaryList />} />} />
      <Route path="/beneficiaries/add-citizen"  element={<Guard allowedRoles={['admin', 'assistant_admin']} element={<AddBeneficiaryPage />} />} />
      <Route path="/beneficiaries/add-resident" element={<Guard allowedRoles={['admin', 'assistant_admin']} element={<AddBeneficiaryPage />} />} />
      <Route path="/beneficiaries/import"       element={<Guard allowedRoles={['admin', 'assistant_admin']} element={<BeneficiaryImportPage />} />} />
      <Route path="/beneficiaries/:id"          element={<Guard allowedRoles={['admin', 'assistant_admin']} element={<BeneficiaryDetails />} />} />
      <Route path="/beneficiaries/:id/edit"     element={<Guard allowedRoles={['admin', 'assistant_admin']} element={<EditBeneficiaryPage />} />} />

      {/* Support Submission Page - Redirect to Delivery */}
      <Route path="/send-support"               element={<Navigate to="/delivery" replace />} />
      <Route path="/distributions"              element={<Navigate to="/delivery" replace />} />

      {/* Neighborhood Representatives */}
      <Route path="/representatives"            element={<Guard allowedRoles={['admin', 'assistant_admin']} element={<NeighborhoodRepsPage />} />} />

      {/* Receiver Page (Accessible to All Roles) */}
      <Route path="/receiver"                   element={<Guard allowedRoles={['admin', 'assistant_admin', 'delivery_driver', 'driver']} element={<ReceiverPage />} />} />

      {/* Staff */}
      <Route path="/staff"          element={<Guard allowedRoles={['admin', 'assistant_admin']} element={<StaffListPage />} />} />
      <Route path="/staff/add"      element={<Guard allowedRoles={['admin', 'assistant_admin']} element={<AddStaffPage />} />} />
      <Route path="/staff/import"   element={<Guard allowedRoles={['admin', 'assistant_admin']} element={<StaffImportPage />} />} />
      <Route path="/staff/:id"      element={<Guard allowedRoles={['admin', 'assistant_admin']} element={<StaffDetailsPage />} />} />
      <Route path="/staff/:id/edit" element={<Guard allowedRoles={['admin', 'assistant_admin']} element={<EditStaffPage />} />} />

      {/* Warehouse */}
      <Route path="/warehouse"    element={<Guard allowedRoles={['admin', 'assistant_admin']} element={<Warehouse />} />} />

      {/* Delivery */}
      <Route path="/delivery"          element={<Guard allowedRoles={['admin', 'assistant_admin', 'delivery_driver', 'driver']} element={<DeliveryPage />} />} />
      <Route path="/driver/deliveries" element={<Guard allowedRoles={['admin', 'assistant_admin', 'delivery_driver', 'driver']} element={<DriverDashboard />} />} />

      {/* Governance (formerly Statistics) */}
      <Route path="/governance"   element={<Guard allowedRoles={['admin', 'assistant_admin']} element={<GovernancePage />} />} />
      <Route path="/statistics"   element={<Guard allowedRoles={['admin', 'assistant_admin']} element={<GovernancePage />} />} />

      {/* Audit & Logs (Admin only) */}
      <Route path="/audit"            element={<Guard allowedRoles={['admin']} element={<AuditPage />} />} />
      <Route path="/admin/audit-logs" element={<Guard allowedRoles={['admin']} element={<AuditPage />} />} />

      {/* Admin Pages (Supervisor Only) */}
      <Route path="/admin/users"            element={<Guard allowedRoles={['admin']} element={<UsersPage />} />} />
      <Route path="/admin/settings"         element={<Guard allowedRoles={['admin']} element={<SystemSettingsPage />} />} />
      <Route path="/assistant-admin"        element={<Guard allowedRoles={['admin', 'assistant_admin']} element={<AssistantAdminDashboard />} />} />

      {/* Default Fallback */}
      <Route path="*" element={<Navigate to={user ? getHomePath() : "/login"} replace />} />
    </Routes>
  );
}

export default App;