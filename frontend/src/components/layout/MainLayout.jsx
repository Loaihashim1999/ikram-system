import { useState } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function MainLayout({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F7F5F0]">
      {/* الشريط الجانبي - مع خاصية الفتح/الإغلاق */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* الشريط العلوي - مع زر القائمة */}
      <TopBar onMenuClick={() => setIsSidebarOpen(true)} />

      {/* المحتوى الرئيسي */}
      <main className="lg:mr-72 mt-16 p-4 lg:p-8">
        {children}
      </main>
    </div>
  );
}