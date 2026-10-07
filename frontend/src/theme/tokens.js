// Ikram System Centralized Design System Tokens
export const tokens = {
  colors: {
    // Official Palette
    primaryGreen: '#1F4D3A',
    gold: '#A6843D',
    actionAmber: '#1F4D3A',
    hoverAmber: '#14352C',
    warmBg: '#F3EFE6',
    softBg: '#F7F3EA',
    lightBorder: '#E4DDD0',
    neutralBorder: '#E5E7EB',
    primaryText: '#111827',
    secondaryText: '#1F2937',

    // Semantic roles & statuses
    primary: {
      DEFAULT: '#1F4D3A',
      hover: '#14352C',
      light: '#E7F0EA',
      dark: '#14352C',
    },
    secondary: {
      DEFAULT: '#14352C',
      hover: '#0E241D',
      light: '#E7F0EA',
      dark: '#0E241D',
    },
    action: {
      DEFAULT: '#1F4D3A',
      hover: '#14352C',
      light: '#E7F0EA',
    },
    background: {
      DEFAULT: '#F3EFE6',
      soft: '#F7F3EA',
      card: '#FFFDF8',
      accent: '#EFE8D8',
    },
    text: {
      primary: '#1C1915',
      secondary: '#3A342C',
      muted: '#5C564C',
    },
    border: {
      light: '#E4DDD0',
      neutral: '#E4DDD0',
    },
    status: {
      valid: { bg: '#E7F5EE', text: '#146C43', border: '#E4DDD0', label: 'صالح' },
      nearExpiry: { bg: '#F8EED9', text: '#8A5A12', border: '#E4DDD0', label: 'قارب على الانتهاء' },
      expired: { bg: '#F8E8E8', text: '#9B2C2C', border: '#E4DDD0', label: 'منتهي الصلاحية' },
      distributed: { bg: '#E7EEF6', text: '#1D4E89', border: '#E4DDD0', label: 'تم توزيعه' },

      active: { bg: '#E7F5EE', text: '#146C43', border: '#E4DDD0', label: 'نشط' },
      used: { bg: '#F7F3EA', text: '#3A342C', border: '#E4DDD0', label: 'مستخدم' },
      revoked: { bg: '#F8E8E8', text: '#9B2C2C', border: '#E4DDD0', label: 'ملغي' },
      locked: { bg: '#F8E8E8', text: '#9B2C2C', border: '#E4DDD0', label: 'مقفل (3 محاولات)' },
    },
  },
  fonts: {
    family: '"IBM Plex Sans Arabic", Tahoma, "Segoe UI", sans-serif',
    mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    weight: { body: 400, label: 700, title: 800 },
  },
  type: {
    display: '1.75rem',
    title: '1.375rem',
    section: '1.05rem',
    body: '1rem',
    table: '0.875rem',
    label: '0.75rem',
  },
  spacing: { 1: '0.25rem', 2: '0.5rem', 3: '0.75rem', 4: '1rem', 5: '1.25rem', 6: '1.5rem', page: '1.25rem' },
  radius: { sm: '0.375rem', control: '0.5rem', panel: '0.75rem' },
  shadow: {
    rest: '0 1px 2px rgb(28 25 21 / 0.04)',
    overlay: '0 8px 24px rgb(20 53 44 / 0.08)',
    dialog: '0 16px 40px rgb(20 53 44 / 0.16)',
  },
  controlHeight: '2.75rem',
  tableRowMin: '2.75rem',
  focus: '0 0 0 3px rgb(166 132 61 / 0.45)',
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
