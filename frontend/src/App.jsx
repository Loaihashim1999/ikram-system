import { lazy, Suspense, useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import api from './api/axios';

import ErrorButton from './components/ErrorButton';

const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const FirstAdminSetupPage = lazy(() => import('./pages/auth/FirstAdminSetupPage'));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const AddBeneficiaryPage = lazy(() => import('./pages/beneficiaries/AddBeneficiaryPage'));
const BeneficiaryList = lazy(() => import('./pages/beneficiaries/BeneficiaryList'));
const BeneficiaryDetails = lazy(() => import('./pages/beneficiaries/BeneficiaryDetails'));
const EditBeneficiaryPage = lazy(() => import('./pages/beneficiaries/EditBeneficiaryPage'));
const BeneficiaryImportPage = lazy(() => import('./pages/beneficiaries/BeneficiaryImportPage'));
const DailyBeneficiariesPage = lazy(() => import('./pages/daily-beneficiaries/DailyBeneficiariesPage'));
const DailyBeneficiaryForm = lazy(() => import('./pages/daily-beneficiaries/DailyBeneficiaryForm'));
const DailyBeneficiaryDetails = lazy(() => import('./pages/daily-beneficiaries/DailyBeneficiaryDetails'));
const StaffListPage = lazy(() => import('./pages/staff/StaffListPage'));
const StaffDetailsPage = lazy(() => import('./pages/staff/StaffDetailsPage'));
const AddStaffPage = lazy(() => import('./pages/staff/AddStaffPage'));
const EditStaffPage = lazy(() => import('./pages/staff/EditStaffPage'));
const StaffImportPage = lazy(() => import('./pages/staff/StaffImportPage'));
const Warehouse = lazy(() => import('./pages/warehouse/Warehouse'));
const DeliveryPage = lazy(() => import('./pages/delivery/DeliveryPage'));
const DriverDashboard = lazy(() => import('./pages/delivery/DriverDashboard'));
const NeighborhoodRepsPage = lazy(() => import('./pages/representatives/NeighborhoodRepsPage'));
const ReceiverPage = lazy(() => import('./pages/receiver/ReceiverPage'));
const GovernancePage = lazy(() => import('./pages/governance/GovernancePage'));
const AuditPage = lazy(() => import('./pages/audit/AuditPage'));
const SystemSettingsPage = lazy(() => import('./pages/admin/SystemSettingsPage'));
const UsersPage = lazy(() => import('./pages/admin/Users'));
const AssistantAdminDashboard = lazy(() => import('./pages/admin/AssistantAdminDashboard'));

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F5F0]" role="status" aria-label="جارٍ تحميل الصفحة">
      <div className="w-12 h-12 border-4 border-[#C9A24A] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function Guard({ element, allowedRoles = [] }) {
  const { user: authenticatedUser } = useAuth();
  const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
  const user = authenticatedUser || (storedUser.id ? storedUser : null);
  const role = user?.role;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles.length > 0 && !allowedRoles.includes(role) && role !== 'admin') {
    return <Navigate to={role === 'delivery_driver' || role === 'driver' ? '/delivery' : '/dashboard'} replace />;
  }
  return element;
}

function App() {
  const { user: authUser, loading } = useAuth();
  const [setupRequired, setSetupRequired] = useState(null);

  useEffect(() => {
    api.get('/setup-admin/status')
      .then(({ data }) => setSetupRequired(Boolean(data.data?.setup_required)))
      .catch(() => setSetupRequired(false));
  }, []);

  const savedUser = JSON.parse(localStorage.getItem('user') || '{}');
  const user = authUser || (savedUser.id ? savedUser : null);
  const role = user?.role || 'admin';

  if (loading || setupRequired === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F5F0]">
        <div className="w-12 h-12 border-4 border-[#C9A24A] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Determine initial landing page after login based on role
  const getHomePath = () => {
    if (role === 'delivery_driver' || role === 'driver') return '/delivery';
    if (role === 'assistant_admin') return '/receiver';
    return '/dashboard';
  };

  return (
    <>
    <Suspense fallback={<RouteFallback />}>
    <Routes>
      <Route path="/setup-admin" element={setupRequired ? <FirstAdminSetupPage onComplete={() => setSetupRequired(false)} /> : <Navigate to="/login" replace />} />
      {setupRequired ? <Route path="*" element={<Navigate to="/setup-admin" replace />} /> : <>
      {/* Auth */}
      <Route path="/login" element={!user ? <LoginPage /> : <Navigate to={getHomePath()} replace />} />
      <Route path="/forgot-password" element={!user ? <ForgotPasswordPage /> : <Navigate to={getHomePath()} replace />} />
      <Route path="/reset-password/:token" element={!user ? <ResetPasswordPage /> : <Navigate to={getHomePath()} replace />} />

      {/* Dashboard */}
      <Route path="/dashboard" element={<Guard allowedRoles={['admin', 'assistant_admin', 'reception', 'staff', 'warehouse', 'readonly']} element={<Dashboard />} />} />

      {/* Beneficiaries */}
      <Route path="/beneficiaries"              element={<Guard allowedRoles={['admin', 'assistant_admin', 'reception', 'staff', 'readonly']} element={<BeneficiaryList />} />} />
      <Route path="/beneficiaries/add-citizen"  element={<Guard allowedRoles={['admin', 'assistant_admin', 'reception', 'staff']} element={<AddBeneficiaryPage />} />} />
      <Route path="/beneficiaries/add-resident" element={<Guard allowedRoles={['admin', 'assistant_admin', 'reception', 'staff']} element={<AddBeneficiaryPage />} />} />
      <Route path="/beneficiaries/import"       element={<Guard allowedRoles={['admin', 'assistant_admin', 'reception']} element={<BeneficiaryImportPage />} />} />
      <Route path="/beneficiaries/:id"          element={<Guard allowedRoles={['admin', 'assistant_admin', 'reception', 'staff', 'readonly']} element={<BeneficiaryDetails />} />} />
      <Route path="/beneficiaries/:id/edit"     element={<Guard allowedRoles={['admin', 'assistant_admin', 'reception', 'staff']} element={<EditBeneficiaryPage />} />} />

      {/* Daily Beneficiaries (Consolidated Module) */}
      <Route path="/daily-beneficiaries"                  element={<Guard allowedRoles={['admin', 'assistant_admin', 'reception', 'staff', 'readonly']} element={<DailyBeneficiariesPage />} />} />
      <Route path="/daily-beneficiaries/add"              element={<Guard allowedRoles={['admin', 'assistant_admin', 'reception', 'staff']} element={<DailyBeneficiaryForm />} />} />
      <Route path="/daily-beneficiaries/receiving"        element={<Navigate to="/daily-beneficiaries?tab=deliveries" replace />} />
      <Route path="/daily-beneficiaries/inventory"        element={<Navigate to="/daily-beneficiaries?tab=inventory" replace />} />
      <Route path="/daily-beneficiaries/:id"              element={<Guard allowedRoles={['admin', 'assistant_admin', 'reception', 'staff', 'readonly']} element={<DailyBeneficiaryDetails />} />} />
      <Route path="/daily-beneficiaries/:id/edit"         element={<Guard allowedRoles={['admin', 'assistant_admin', 'reception', 'staff']} element={<DailyBeneficiaryForm />} />} />

      {/* Support Submission Page - Redirect to Delivery */}
      <Route path="/send-support"               element={<Navigate to="/delivery" replace />} />
      <Route path="/distributions"              element={<Navigate to="/delivery" replace />} />

      {/* Neighborhood Representatives */}
      <Route path="/representatives"            element={<Guard allowedRoles={['admin', 'assistant_admin', 'staff']} element={<NeighborhoodRepsPage />} />} />

      {/* Receiver Page (Accessible to All Roles) */}
      <Route path="/receiver"                   element={<Guard allowedRoles={['admin', 'assistant_admin', 'reception', 'staff', 'warehouse', 'readonly', 'delivery_driver', 'driver']} element={<ReceiverPage />} />} />

      {/* Staff */}
      <Route path="/staff"          element={<Guard allowedRoles={['admin', 'assistant_admin']} element={<StaffListPage />} />} />
      <Route path="/staff/add"      element={<Guard allowedRoles={['admin', 'assistant_admin']} element={<AddStaffPage />} />} />
      <Route path="/staff/import"   element={<Guard allowedRoles={['admin', 'assistant_admin']} element={<StaffImportPage />} />} />
      <Route path="/staff/:id"      element={<Guard allowedRoles={['admin', 'assistant_admin']} element={<StaffDetailsPage />} />} />
      <Route path="/staff/:id/edit" element={<Guard allowedRoles={['admin', 'assistant_admin']} element={<EditStaffPage />} />} />

      {/* Warehouse */}
      <Route path="/warehouse"    element={<Guard allowedRoles={['admin', 'assistant_admin', 'warehouse', 'staff', 'readonly']} element={<Warehouse />} />} />

      {/* Delivery */}
      <Route path="/delivery"          element={<Guard allowedRoles={['admin', 'assistant_admin', 'staff', 'delivery_driver', 'driver']} element={<DeliveryPage />} />} />
      <Route path="/driver/deliveries" element={<Guard allowedRoles={['admin', 'assistant_admin', 'staff', 'delivery_driver', 'driver']} element={<DriverDashboard />} />} />

      {/* Governance (formerly Statistics) */}
      <Route path="/governance"   element={<Guard allowedRoles={['admin', 'assistant_admin', 'readonly']} element={<GovernancePage />} />} />
      <Route path="/statistics"   element={<Guard allowedRoles={['admin', 'assistant_admin', 'readonly']} element={<GovernancePage />} />} />

      {/* Audit & Logs (Admin only) */}
      <Route path="/audit"            element={<Guard allowedRoles={['admin']} element={<AuditPage />} />} />
      <Route path="/admin/audit-logs" element={<Guard allowedRoles={['admin']} element={<AuditPage />} />} />

      {/* Admin Pages (Supervisor Only) */}
      <Route path="/admin/users"            element={<Guard allowedRoles={['admin']} element={<UsersPage />} />} />
      <Route path="/admin/settings"         element={<Guard allowedRoles={['admin']} element={<SystemSettingsPage />} />} />
      <Route path="/assistant-admin"        element={<Guard allowedRoles={['admin', 'assistant_admin']} element={<AssistantAdminDashboard />} />} />

      {/* Default Fallback */}
      <Route path="*" element={<Navigate to={user ? getHomePath() : "/login"} replace />} />
      </>}
    </Routes>
    </Suspense>
    {import.meta.env.DEV && <ErrorButton />}
    </>
  );
}

export default App;
