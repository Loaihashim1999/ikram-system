import { useState } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

/**
 * Master Application Layout for Ikram Management System:
 * - 288px (w-72) fixed RTL sidebar
 * - Fixed TopBar with page context, notifications, user profile
 * - Standardized main content container with max-w-7xl, comfortable padding, and vertical rhythm
 */
export default function MainLayout({ children, containerClassName = 'max-w-7xl mx-auto space-y-6' }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F7F5F0]" dir="rtl">
      {/* Sidebar with mobile drawer support */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* TopBar with brand identity and controls */}
      <TopBar onMenuClick={() => setIsSidebarOpen(true)} />

      {/* Main Content Area */}
      <main className="lg:mr-72 mt-16 px-4 sm:px-6 lg:px-8 py-6 min-h-[calc(100vh-4rem)]">
        <div className={containerClassName}>
          {children}
        </div>
      </main>
    </div>
  );
}