// Ikram System Centralized Design System Tokens
export const tokens = {
  colors: {
    // Official Palette
    primaryGreen: '#3F6B3A',
    gold: '#C9A24A',
    actionAmber: '#D97706',
    hoverAmber: '#B45309',
    warmBg: '#F7F5F0',
    softBg: '#FAF8F5',
    lightBorder: '#E5E2D9',
    neutralBorder: '#E5E7EB',
    primaryText: '#111827',
    secondaryText: '#1F2937',

    // Semantic roles & statuses
    primary: {
      DEFAULT: '#C9A24A',
      hover: '#B45309',
      light: '#F5EDDA',
      dark: '#8C6C26',
    },
    secondary: {
      DEFAULT: '#3F6B3A',
      hover: '#31542D',
      light: '#EBF4EA',
      dark: '#223B1E',
    },
    action: {
      DEFAULT: '#D97706',
      hover: '#B45309',
      light: '#FEF3C7',
    },
    background: {
      DEFAULT: '#F7F5F0',
      soft: '#FAF8F5',
      card: '#FFFFFF',
      accent: '#F4EFE3',
    },
    text: {
      primary: '#111827',
      secondary: '#1F2937',
      muted: '#6B7280',
    },
    border: {
      light: '#E5E2D9',
      neutral: '#E5E7EB',
    },
    status: {
      valid: { bg: '#E6F4EC', text: '#2E7D32', border: '#A5D6A7', label: 'صالح' },
      nearExpiry: { bg: '#FEF3C7', text: '#B45309', border: '#FCD34D', label: 'قارب على الانتهاء' },
      expired: { bg: '#FEE2E2', text: '#B91C1C', border: '#FCA5A5', label: 'منتهي الصلاحية' },
      distributed: { bg: '#E0F2FE', text: '#0369A1', border: '#7DD3FC', label: 'تم توزيعه' },

      active: { bg: '#E6F4EC', text: '#2E7D32', border: '#A5D6A7', label: 'نشط' },
      used: { bg: '#F3F4F6', text: '#4B5563', border: '#D1D5DB', label: 'مستخدم' },
      revoked: { bg: '#FEE2E2', text: '#B91C1C', border: '#FCA5A5', label: 'ملغي' },
      locked: { bg: '#FEE2E2', text: '#991B1B', border: '#F87171', label: 'مقفل (3 محاولات)' },
    },
  },
  fonts: {
    family: "'Tajawal', 'Cairo', system-ui, -apple-system, sans-serif",
    mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
  roles: {
    supervisor: {
      badgeBg: 'bg-amber-100 text-amber-900 border-amber-300',
      title: 'المدير العام (Supervisor)',
    },
    assistant_supervisor: {
      badgeBg: 'bg-green-100 text-green-900 border-green-300',
      title: 'مساعد المدير (Assistant Supervisor)',
    },
    driver: {
      badgeBg: 'bg-blue-100 text-blue-900 border-blue-300',
      title: 'السائق الميداني (Driver)',
    },
  },
};
