import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

// Auth
import LoginPage from './pages/auth/LoginPage';

// Layout & Dashboard
import Dashboard from './pages/Dashboard';
import MainLayout from './components/layout/MainLayout';

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
import StaffImportPage   from './pages/staff/StaffImportPage';

// Warehouse / Inventory
import Warehouse from './pages/warehouse/Warehouse';

// Support Submission Page
import SendSupportPage from './pages/delivery/SendSupportPage';

// Delivery Pages
import DeliveryPage from './pages/delivery/DeliveryPage';
import DriverDashboard from './pages/delivery/DriverDashboard';

// Statistics & Reports
import StatisticsPage from './pages/statistics/StatisticsPage';

// Admin & Settings
import SystemSettingsPage from './pages/admin/SystemSettingsPage';
import UsersPage from './pages/admin/Users';
import AssistantAdminDashboard from './pages/admin/AssistantAdminDashboard';

// Placeholder for missing pages
const PlaceholderPage = ({ title }) => (
  <MainLayout>
    <div className="bg-white p-8 rounded-2xl shadow-md border border-[#E5E2D9] text-right" dir="rtl">
      <h1 className="text-2xl font-bold text-[#546027] mb-4">{title}</h1>
      <p className="text-[#6B6B66]">هذه الصفحة قيد الإنشاء والربط النهائي.</p>
    </div>
  </MainLayout>
);

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F5F0]">
        <div className="w-12 h-12 border-4 border-[#C9A24A] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const Guard = ({ element }) =>
    user ? element : <Navigate to="/login" />;

  return (
    <Routes>
      {/* Auth */}
      <Route path="/login" element={!user ? <LoginPage /> : <Navigate to="/dashboard" />} />

      {/* Dashboard */}
      <Route path="/dashboard" element={<Guard element={<Dashboard />} />} />

      {/* Beneficiaries */}
      <Route path="/beneficiaries"              element={<Guard element={<BeneficiaryList />} />} />
      <Route path="/beneficiaries/add-citizen"  element={<Guard element={<AddBeneficiaryPage />} />} />
      <Route path="/beneficiaries/add-resident" element={<Guard element={<AddBeneficiaryPage />} />} />
      <Route path="/beneficiaries/import"       element={<Guard element={<BeneficiaryImportPage />} />} />
      <Route path="/beneficiaries/:id"          element={<Guard element={<BeneficiaryDetails />} />} />
      <Route path="/beneficiaries/:id/edit"     element={<Guard element={<EditBeneficiaryPage />} />} />

      {/* Support Submission Page */}
      <Route path="/send-support"               element={<Guard element={<SendSupportPage />} />} />
      <Route path="/distributions"              element={<Guard element={<SendSupportPage />} />} />

      {/* Staff */}
      <Route path="/staff"        element={<Guard element={<StaffListPage />} />} />
      <Route path="/staff/add"    element={<Guard element={<AddStaffPage />} />} />
      <Route path="/staff/import" element={<Guard element={<StaffImportPage />} />} />
      <Route path="/staff/:id"    element={<Guard element={<StaffDetailsPage />} />} />

      {/* Warehouse */}
      <Route path="/warehouse"    element={<Guard element={<Warehouse />} />} />

      {/* Delivery */}
      <Route path="/delivery text-right"        element={<Guard element={<DeliveryPage />} />} />
      <Route path="/delivery"                   element={<Guard element={<DeliveryPage />} />} />
      <Route path="/driver/deliveries text-right" element={<Guard element={<DriverDashboard />} />} />
      <Route path="/driver/deliveries"          element={<Guard element={<DriverDashboard />} />} />

      {/* Statistics */}
      <Route path="/statistics"      element={<Guard element={<StatisticsPage />} />} />

      {/* Admin */}
      <Route path="/admin/users text-right" element={<Guard element={<UsersPage />} />} />
      <Route path="/admin/users shadow"     element={<Guard element={<UsersPage />} />} />
      <Route path="/admin/users"            element={<Guard element={<UsersPage />} />} />
      <Route path="/admin/audit-logs"       element={<Guard element={<PlaceholderPage title="سجل التدقيق" />} />} />
      <Route path="/admin/settings"         element={<Guard element={<SystemSettingsPage />} />} />
      <Route path="/assistant-admin"        element={<Guard element={<AssistantAdminDashboard />} />} />

      <Route path="/representatives" element={<Guard element={<PlaceholderPage title="مناديب الأحياء" />} />} />

      {/* Default Fallback */}
      <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} />} />
    </Routes>
  );
}

export default App;