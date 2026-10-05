import { useState } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

/**
 * Master Application Layout for Ikram Management System:
 * - 288px (w-72) fixed RTL sidebar
 * - Fixed TopBar with page context, notifications, user profile
 * - Standardized main content container with max-w-7xl, comfortable padding, and vertical rhythm
 */
export default function MainLayout({ children, containerClassName = 'ikram-page' }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="ikram-app" dir="rtl">
      {/* Sidebar with mobile drawer support */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* TopBar with brand identity and controls */}
      <TopBar onMenuClick={() => setIsSidebarOpen(true)} />

      {/* Main Content Area */}
      <main className="ikram-stage lg:mr-72 mt-16 min-w-0 px-3 py-4 sm:px-5 sm:py-5 lg:px-8 lg:py-6 min-h-[calc(100vh-4rem)] overflow-x-hidden">
        <div className={containerClassName}>
          {children}
        </div>
      </main>
    </div>
  );
}
