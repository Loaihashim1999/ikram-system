import { lazy, Suspense, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import api from './api/axios';
import PagePermissionGuard from './components/common/PagePermissionGuard';
import { canViewSupport, canViewRepresentatives, hasModuleAction } from './utils/modulePermissions';

import ErrorButton from './components/ErrorButton';

const ChangePasswordPage = lazy(() => import('./pages/auth/ChangePasswordPage'));
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const FirstAdminSetupPage = lazy(() => import('./pages/auth/FirstAdminSetupPage'));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const AddBeneficiaryPage = lazy(() => import('./pages/beneficiaries/AddBeneficiaryPage'));
const UnifiedBeneficiaryPage = lazy(() => import('./pages/beneficiaries/UnifiedBeneficiaryPage'));
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
const DirectHandoverPage = lazy(() => import('./pages/delivery/DirectHandoverPage'));
const HomeDeliveryPage = lazy(() => import('./pages/delivery/HomeDeliveryPage'));
const SupportRequestPage = lazy(() => import('./pages/beneficiaries/SupportRequestPage'));
const NeighborhoodRepsPage = lazy(() => import('./pages/representatives/NeighborhoodRepsPage'));
const GovernancePage = lazy(() => import('./pages/governance/GovernancePage'));
const AuditPage = lazy(() => import('./pages/audit/AuditPage'));
const SystemSettingsPage = lazy(() => import('./pages/admin/SystemSettingsPage'));
const PolicyDReviewPage = lazy(() => import('./pages/admin/PolicyDReviewPage'));
const PolicyApplicationRunsPage = lazy(() => import('./pages/admin/PolicyApplicationRunsPage'));
const UsersPage = lazy(() => import('./pages/admin/Users'));
const DriversDirectoryPage = lazy(() => import('./pages/admin/DriversDirectoryPage'));
const AssistantAdminDashboard = lazy(() => import('./pages/admin/AssistantAdminDashboard'));
const DriverVisualEvidence = lazy(() => import('./pages/design/DriverVisualEvidence'));

function RouteFallback() {
  return (
    <div className="min-h-screen flex flex-col gap-3 items-center justify-center bg-[var(--color-bg-page)]" role="status" aria-label="جارٍ تحميل الصفحة">
      <div className="w-12 h-12 border-4 border-[var(--color-brand-gold)] border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-[var(--color-text-muted)]">جارٍ تحميل الصفحة…</p>
    </div>
  );
}

function canViewGovernance(user) {
  return hasModuleAction(user, 'governance', 'view');
}

function canImportBeneficiaries(user) {
  return hasModuleAction(user, 'beneficiaries', 'import');
}

function SupportDeliveryAlias() {
  const { search } = useLocation();
  return <Navigate to={`/receiver${search}`} replace />;
}

function Guard({ element, allowedRoles = [], canAccess }) {
  const { user: authenticatedUser } = useAuth();
  const user = authenticatedUser;
  const role = user?.role;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles.length > 0 && !allowedRoles.includes(role) && role !== 'admin') {
    return <Navigate to={role === 'delivery_driver' || role === 'driver' ? '/delivery' : '/dashboard'} replace />;
  }
  return canAccess ? <PagePermissionGuard canAccess={canAccess}>{element}</PagePermissionGuard> : element;
}

function App() {
  const { user: authUser, loading } = useAuth();
  const [setupRequired, setSetupRequired] = useState(null);

  useEffect(() => {
    let active = true;
    const settle = (value) => { if (active) setSetupRequired(value); };
    const timer = setTimeout(() => settle(false), 3000);
    api.get('/setup-admin/status', { timeout: 3000 })
      .then(({ data }) => settle(Boolean(data.data?.setup_required)))
      .catch(() => settle(false))
      .finally(() => clearTimeout(timer));
    return () => { active = false; clearTimeout(timer); };
  }, []);

  const user = authUser;
  const role = user?.role || 'admin';

  if (import.meta.env.DEV && window.location.pathname.startsWith('/visual-evidence')) {
    return <Suspense fallback={<RouteFallback />}><DriverVisualEvidence /></Suspense>;
  }

  if (loading || setupRequired === null) {
    return <RouteFallback />;
  }

  // Determine initial landing page after login based on role
  const getHomePath = () => {
    if (role === 'delivery_driver' || role === 'driver') return '/delivery';
    if (role === 'assistant_admin') return '/receiver';
    return '/dashboard';
  };

  if (user?.must_change_password) return <Suspense fallback={<RouteFallback />}><ChangePasswordPage /></Suspense>;

  return (
    <>
    <Suspense fallback={<RouteFallback />}>
    <Routes>
      <Route path="/setup-admin" element={setupRequired ? <FirstAdminSetupPage onComplete={() => setSetupRequired(false)} /> : <Navigate to="/login" replace />} />
      {setupRequired ? <Route path="*" element={<Navigate to="/setup-admin" replace />} /> : <>
      {/* Auth */}
      <Route path="/login" element={!user ? <LoginPage /> : <Navigate to={getHomePath()} replace />} />
      <Route path="/forgot-password" element={!user ? <ForgotPasswordPage /> : <Navigate to={getHomePath()} replace />} />
      {/* Email reset-link routes retired: recovery uses the SMS OTP wizard at /forgot-password. Legacy links fall through to /login. */}

      <Route path="/support-delivery" element={<SupportDeliveryAlias />} />
      <Route path="/support/request" element={<Guard canAccess={canViewSupport} element={<SupportRequestPage />} />} />
      <Route path="/beneficiaries/:id/support" element={<Guard canAccess={canViewSupport} element={<SupportRequestPage />} />} />
      {/* Dashboard */}
      <Route path="/dashboard" element={<Guard allowedRoles={['admin', 'assistant_admin', 'reception', 'staff', 'warehouse', 'readonly']} element={<Dashboard />} />} />

      {/* Beneficiaries */}
      <Route path="/beneficiaries"              element={<Guard allowedRoles={['admin', 'assistant_admin', 'reception', 'staff', 'readonly']} element={<UnifiedBeneficiaryPage />} />} />
      <Route path="/beneficiaries/add-citizen"  element={<Guard allowedRoles={['admin', 'assistant_admin', 'reception', 'staff']} element={<AddBeneficiaryPage />} />} />
      <Route path="/beneficiaries/add-resident" element={<Guard allowedRoles={['admin', 'assistant_admin', 'reception', 'staff']} element={<AddBeneficiaryPage />} />} />
      <Route path="/beneficiaries/import"       element={<Guard allowedRoles={['admin', 'assistant_admin', 'reception', 'staff']} canAccess={canImportBeneficiaries} element={<BeneficiaryImportPage />} />} />
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
      <Route path="/send-support"               element={<Navigate to="/support/request" replace />} />
      <Route path="/distributions"              element={<Navigate to="/delivery" replace />} />

      {/* Neighborhood Representatives */}
      <Route path="/representatives"            element={<Guard allowedRoles={['admin', 'assistant_admin', 'staff']} canAccess={canViewRepresentatives} element={<NeighborhoodRepsPage />} />} />

      {/* Receiver Page (Accessible to All Roles) */}
      <Route path="/receiver"                   element={<Guard canAccess={canViewSupport} element={<DirectHandoverPage />} />} />

      {/* Staff */}
      <Route path="/staff"          element={<Guard allowedRoles={['admin', 'assistant_admin']} element={<StaffListPage />} />} />
      <Route path="/staff/add"      element={<Guard allowedRoles={['admin', 'assistant_admin']} element={<AddStaffPage />} />} />
      <Route path="/staff/import"   element={<Guard allowedRoles={['admin', 'assistant_admin']} element={<StaffImportPage />} />} />
      <Route path="/staff/:id"      element={<Guard allowedRoles={['admin', 'assistant_admin']} element={<StaffDetailsPage />} />} />
      <Route path="/staff/:id/edit" element={<Guard allowedRoles={['admin', 'assistant_admin']} element={<EditStaffPage />} />} />

      {/* Warehouse */}
      <Route path="/warehouse"    element={<Guard allowedRoles={['admin', 'assistant_admin', 'warehouse', 'staff', 'readonly']} element={<Warehouse />} />} />

      {/* Delivery */}
      <Route path="/delivery"          element={<Guard canAccess={canViewSupport} element={<HomeDeliveryPage />} />} />
      <Route path="/driver/deliveries" element={<Guard allowedRoles={['admin', 'assistant_admin', 'staff', 'delivery_driver', 'driver']} element={<Navigate to="/driver-access" replace />} />} />

      {/* Governance (formerly Statistics) */}
      <Route path="/governance"   element={<Guard canAccess={canViewGovernance} element={<GovernancePage />} />} />
      <Route path="/statistics"   element={<Guard allowedRoles={['admin', 'assistant_admin', 'readonly']} element={<GovernancePage />} />} />

      {/* Audit & Logs (Admin only) */}
      <Route path="/audit"            element={<Guard allowedRoles={['admin']} element={<AuditPage />} />} />
      <Route path="/admin/audit-logs" element={<Guard allowedRoles={['admin']} element={<AuditPage />} />} />

      <Route path="/admin/beneficiary-policy/review/:evaluationId" element={<Guard element={<PolicyDReviewPage />} />} />
      <Route path="/admin/beneficiary-policy/versions/:versionId/application-runs" element={<Guard element={<PolicyApplicationRunsPage />} />} />
      {/* Admin Pages (Supervisor Only) */}
      <Route path="/admin/drivers"          element={<Guard allowedRoles={['admin']} element={<DriversDirectoryPage />} />} />
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
